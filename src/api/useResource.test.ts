import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { useResource } from '@/api/useResource';

/** `onScopeDispose` precisa de um escopo ativo, como dentro de um componente. */
const inScope = <T>(fn: () => T) => {
  const scope = effectScope();
  const value = scope.run(fn) as T;

  return { value, dispose: () => scope.stop() };
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
};

describe('useResource', () => {
  it('carrega ao criar e expoe os dados', async () => {
    const { value: resource, dispose } = inScope(() =>
      useResource(async () => ({ ok: true }))
    );

    expect(resource.pending.value).toBe(true);
    await flush();

    expect(resource.data.value).toEqual({ ok: true });
    expect(resource.pending.value).toBe(false);
    expect(resource.error.value).toBeNull();
    dispose();
  });

  it('nao carrega quando immediate e falso', async () => {
    const load = vi.fn(async () => 1);
    const { value: resource, dispose } = inScope(() =>
      useResource(load, { immediate: false })
    );

    await flush();

    expect(load).not.toHaveBeenCalled();
    expect(resource.pending.value).toBe(false);
    dispose();
  });

  it('guarda o erro sem derrubar a pendencia', async () => {
    const boom = new Error('502');
    const { value: resource, dispose } = inScope(() =>
      useResource(async () => {
        throw boom;
      })
    );

    await flush();

    expect(resource.error.value).toBe(boom);
    expect(resource.data.value).toBeNull();
    expect(resource.pending.value).toBe(false);
    dispose();
  });

  it('limpa o erro anterior ao recarregar', async () => {
    let falhar = true;
    const { value: resource, dispose } = inScope(() =>
      useResource(async () => {
        if (falhar) throw new Error('502');
        return 'ok';
      })
    );

    await flush();
    expect(resource.error.value).toBeInstanceOf(Error);

    falhar = false;
    await resource.refresh();

    expect(resource.error.value).toBeNull();
    expect(resource.data.value).toBe('ok');
    dispose();
  });

  // Uma resposta antiga chegando depois da nova sobrescreveria a tela com dado
  // velho — o classico do usuario trocando de filtro rapido.
  it('descarta o resultado de uma carga superada', async () => {
    const resolvers: Array<(value: string) => void> = [];
    const { value: resource, dispose } = inScope(() =>
      useResource<string>(
        () => new Promise((resolve) => resolvers.push(resolve)),
        { immediate: false }
      )
    );

    void resource.refresh();
    void resource.refresh();

    resolvers[1]?.('nova');
    resolvers[0]?.('velha');
    await flush();

    expect(resource.data.value).toBe('nova');
    dispose();
  });

  it('cancela a carga em voo ao recarregar', async () => {
    const sinais: AbortSignal[] = [];
    const { value: resource, dispose } = inScope(() =>
      useResource((signal) => {
        sinais.push(signal);
        return new Promise<string>(() => {});
      })
    );

    void resource.refresh();

    expect(sinais[0]?.aborted).toBe(true);
    expect(sinais[1]?.aborted).toBe(false);
    dispose();
  });

  it('cancela ao destruir o escopo', async () => {
    const sinais: AbortSignal[] = [];
    const { dispose } = inScope(() =>
      useResource((signal) => {
        sinais.push(signal);
        return new Promise<string>(() => {});
      })
    );

    expect(sinais[0]?.aborted).toBe(false);
    dispose();

    expect(sinais[0]?.aborted).toBe(true);
  });
});
