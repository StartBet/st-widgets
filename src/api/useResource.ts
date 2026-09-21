// Estado de uma carga assincrona: dados, erro e pendencia.
//
// Os dois primeiros widgets precisam da mesma trinca, e o Nitro pode devolver
// 502 quando a Altenar demora — visto na pratica. Um widget que nao trata erro
// fica em branco dentro da pagina do host, sem ninguem saber por que.
//
// Deliberadamente minimo: sem cache, sem deduplicacao, sem retry. Cache e
// assunto do Nitro, e o resto so entra quando houver caso de uso.

import { onScopeDispose, ref, shallowRef, type Ref } from 'vue';

export type Resource<T> = {
  data: Ref<T | null>;
  error: Ref<Error | null>;
  pending: Ref<boolean>;
  /** Refaz a carga, cancelando a anterior se ainda estiver em voo. */
  refresh: () => Promise<void>;
};

export type ResourceOptions = {
  /** Carrega ao criar. Desligue quando a carga depender de algo ainda ausente. */
  immediate?: boolean;
};

const isAbort = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

export const useResource = <T>(
  load: (signal: AbortSignal) => Promise<T>,
  options: ResourceOptions = {}
): Resource<T> => {
  // shallowRef: sao cargas de API, sem edicao campo a campo. Reatividade
  // profunda aqui so custa.
  const data = shallowRef<T | null>(null);
  const error = shallowRef<Error | null>(null);
  const pending = ref(false);

  let controller: AbortController | null = null;

  const refresh = async () => {
    controller?.abort();

    const current = new AbortController();
    controller = current;

    pending.value = true;
    error.value = null;

    try {
      const result = await load(current.signal);

      // Uma carga mais nova comecou enquanto esta terminava: o resultado velho
      // nao pode sobrescrever o novo.
      if (controller !== current) return;

      data.value = result;
    } catch (cause) {
      if (isAbort(cause) || controller !== current) return;

      error.value = cause instanceof Error ? cause : new Error(String(cause));
    } finally {
      if (controller === current) pending.value = false;
    }
  };

  onScopeDispose(() => controller?.abort());

  if (options.immediate ?? true) void refresh();

  return { data, error, pending, refresh };
};
