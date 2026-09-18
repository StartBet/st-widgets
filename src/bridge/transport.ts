// Transporte da ponte com a pagina hospedeira.
//
// Generico e estavel: nada aqui e especifico de widget, e nada aqui muda quando
// um widget novo entra. O que cresce e o catalogo em messages.ts.
//
// Responsabilidades: resolver a origem do pai, validar a origem de quem fala,
// conduzir o handshake e entregar as mensagens a quem assinou.

import { ref, type Ref } from 'vue';
import { env } from '@/config/env';
import {
  isHostMessage,
  PROTOCOL_VERSION,
  WIDGET_SOURCE,
  type Envelope,
  type HostMessage,
  type HostMessageType,
  type WidgetMessage
} from '@/bridge/messages';

// O handshake tem duas metades e precisa das duas: o widget repete o `ready` e
// o host anuncia `host:ready` ao montar. Na carga inicial da pagina o iframe
// carrega antes do host, e um anuncio unico se perde — o bridge nasce mudo e
// nao se recupera. Medido na POC, ver docs/bridge-poc.md.
const READY_INTERVAL_MS = 400;
const READY_MAX_ATTEMPTS = 20;

type HostHandler<T extends HostMessageType> = (
  message: Extract<HostMessage, { type: T }>
) => void;

export type HostBridge = {
  /** Verdadeiro depois que o host respondeu pela primeira vez. */
  readonly connected: Ref<boolean>;
  /** Falso quando a pagina foi aberta fora de um iframe. */
  readonly embedded: boolean;
  send: (message: WidgetMessage) => void;
  on: <T extends HostMessageType>(
    type: T,
    handler: HostHandler<T>
  ) => () => void;
  start: () => void;
  destroy: () => void;
};

export type HostBridgeOptions = {
  debug?: boolean;
  hostOrigins?: readonly string[];
};

/**
 * A origem do pai, quando ela esta na allowlist.
 *
 * Resolver uma vez evita emitir para a lista inteira: funciona, porque o
 * navegador so entrega para a origem correta, mas cada descarte gera um aviso
 * no console de quem hospeda. `ancestorOrigins` nao existe no Firefox — dai o
 * fallback em `send`.
 */
const resolveParentOrigin = (allowed: readonly string[]): string | null => {
  const ancestors = window.location.ancestorOrigins;
  const parent = ancestors?.length ? ancestors[0] : null;

  return parent && allowed.includes(parent) ? parent : null;
};

export const createHostBridge = (
  options: HostBridgeOptions = {}
): HostBridge => {
  const allowed = options.hostOrigins ?? env.hostOrigins;
  const debug = options.debug ?? false;
  const embedded = window.parent !== window;

  const connected = ref(false);
  const handlers = new Map<HostMessageType, Set<(message: never) => void>>();

  let hostOrigin: string | null = null;
  let readyTimer: ReturnType<typeof setInterval> | null = null;
  let readyAttempts = 0;
  let started = false;

  const log = (...args: unknown[]) => {
    if (debug) console.log('[st-widget][bridge]', ...args);
  };

  const stopReadyRetry = () => {
    if (!readyTimer) return;
    clearInterval(readyTimer);
    readyTimer = null;
  };

  const send = (message: WidgetMessage) => {
    if (!embedded) return;

    const envelope: Envelope<WidgetMessage> = {
      source: WIDGET_SOURCE,
      v: PROTOCOL_VERSION,
      ...message
    };

    const target = hostOrigin ?? resolveParentOrigin(allowed);

    if (target) {
      log('enviado', envelope, '->', target);
      window.parent.postMessage(envelope, target);
      return;
    }

    log('enviado', envelope, '-> (allowlist)', allowed);
    for (const origin of allowed) window.parent.postMessage(envelope, origin);
  };

  const dispatch = (message: HostMessage) => {
    const subscribers = handlers.get(message.type);
    if (!subscribers) return;

    for (const handler of subscribers)
      (handler as (value: HostMessage) => void)(message);
  };

  const onMessage = (event: MessageEvent) => {
    // event.origin e preenchido pelo navegador e nao pode ser forjado por JS.
    // Validar antes de olhar para o conteudo.
    if (!allowed.includes(event.origin)) return;
    if (!isHostMessage(event.data)) return;

    // Travar na origem que respondeu: daqui em diante so falamos com ela.
    hostOrigin = event.origin;
    connected.value = true;
    stopReadyRetry();

    // O envelope segue inteiro para os assinantes: `source` e `v` sobram no
    // objeto sem atrapalhar, e evitamos uma copia por mensagem.
    const message = event.data;
    log('recebido', message);

    // O host montou depois de nos e esta se anunciando: responder na hora, sem
    // esperar o proximo tick da repeticao.
    if (message.type === 'host:ready') {
      send({ type: 'ready' });
      return;
    }

    dispatch(message);
  };

  const start = () => {
    if (started) return;
    started = true;

    if (!embedded) {
      log('sem host: a pagina nao esta dentro de um iframe');
      return;
    }

    window.addEventListener('message', onMessage);
    send({ type: 'ready' });

    readyTimer = setInterval(() => {
      readyAttempts += 1;

      if (readyAttempts >= READY_MAX_ATTEMPTS) {
        stopReadyRetry();
        log('host nao respondeu; seguindo sem ponte');
        return;
      }

      send({ type: 'ready' });
    }, READY_INTERVAL_MS);
  };

  const on = <T extends HostMessageType>(type: T, handler: HostHandler<T>) => {
    const subscribers = handlers.get(type) ?? new Set();
    subscribers.add(handler as (message: never) => void);
    handlers.set(type, subscribers);

    return () => {
      subscribers.delete(handler as (message: never) => void);
    };
  };

  const destroy = () => {
    stopReadyRetry();
    window.removeEventListener('message', onMessage);
    handlers.clear();
    connected.value = false;
    started = false;
  };

  return { connected, embedded, send, on, start, destroy };
};
