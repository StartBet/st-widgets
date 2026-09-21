import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHostBridge, type HostBridge } from '@/bridge/transport';
import {
  HOST_SOURCE,
  PROTOCOL_VERSION,
  type BetslipState
} from '@/bridge/messages';

const HOST = 'https://start.bet.br';
const ORIGINS = [HOST];

// A pagina hospedeira e outra janela. happy-dom roda tudo no topo, entao
// trocamos `window.parent` por um duble que registra o que foi postado.
const parentPosts: Array<{ data: unknown; targetOrigin: string }> = [];

const fakeParent = {
  postMessage: (data: unknown, targetOrigin: string) => {
    parentPosts.push({ data, targetOrigin });
  }
} as unknown as Window;

const embed = () => {
  Object.defineProperty(window, 'parent', {
    value: fakeParent,
    configurable: true
  });
};

const unembed = () => {
  Object.defineProperty(window, 'parent', {
    value: window,
    configurable: true
  });
};

/** Simula uma mensagem chegando de outra origem. */
const deliver = (data: unknown, origin = HOST) => {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
};

const hostMessage = (type: string, payload?: unknown) => ({
  source: HOST_SOURCE,
  v: PROTOCOL_VERSION,
  type,
  ...(payload === undefined ? {} : { payload })
});

const state: BetslipState = { activeIds: [17273263], boostIds: [17273263] };

let bridge: HostBridge;

const createStarted = () => {
  bridge = createHostBridge({ hostOrigins: ORIGINS });
  bridge.start();

  return bridge;
};

beforeEach(() => {
  parentPosts.length = 0;
  vi.useFakeTimers();
  embed();
});

afterEach(() => {
  bridge?.destroy();
  vi.useRealTimers();
  unembed();
});

describe('createHostBridge', () => {
  it('anuncia ready ao iniciar', () => {
    createStarted();

    expect(parentPosts).toHaveLength(1);
    expect(parentPosts[0]?.data).toMatchObject({
      source: 'st-widget',
      v: PROTOCOL_VERSION,
      type: 'ready'
    });
  });

  it('nao fala quando a pagina esta fora de um iframe', () => {
    unembed();
    bridge = createHostBridge({ hostOrigins: ORIGINS });
    bridge.start();

    expect(bridge.embedded).toBe(false);
    expect(parentPosts).toHaveLength(0);
  });

  it('repete o ready ate o host responder, e entao para', () => {
    createStarted();

    vi.advanceTimersByTime(1200);
    expect(parentPosts.length).toBeGreaterThan(1);

    const antes = parentPosts.length;
    deliver(hostMessage('betslip:state', state));

    vi.advanceTimersByTime(4000);
    expect(parentPosts).toHaveLength(antes);
    expect(bridge.connected.value).toBe(true);
  });

  // Um retry que nao desliga e pior que o bug que ele corrige: vira um
  // postMessage a cada 400ms para sempre, na pagina de quem hospeda.
  it('desiste depois do teto de tentativas', () => {
    createStarted();

    vi.advanceTimersByTime(60_000);
    const total = parentPosts.length;

    vi.advanceTimersByTime(60_000);

    expect(parentPosts).toHaveLength(total);
    expect(total).toBeLessThanOrEqual(20);
    expect(bridge.connected.value).toBe(false);
  });

  it('ignora mensagem de origem fora da allowlist', () => {
    const recebidas: BetslipState[] = [];
    createStarted();
    bridge.on('betslip:state', (message) => recebidas.push(message.payload));

    deliver(hostMessage('betslip:state', state), 'https://intruso.com');

    expect(recebidas).toHaveLength(0);
    expect(bridge.connected.value).toBe(false);
  });

  it('ignora mensagem de outro emissor da pagina', () => {
    const recebidas: BetslipState[] = [];
    createStarted();
    bridge.on('betslip:state', (message) => recebidas.push(message.payload));

    // A pagina hospedeira tem o SDK da Altenar e o Smartico postando no mesmo
    // window; sem o namespace leriamos mensagem alheia.
    deliver({
      source: 'smartico',
      v: 1,
      type: 'betslip:state',
      payload: state
    });

    expect(recebidas).toHaveLength(0);
  });

  it('ignora versao de protocolo desconhecida', () => {
    const recebidas: BetslipState[] = [];
    createStarted();
    bridge.on('betslip:state', (message) => recebidas.push(message.payload));

    deliver({
      source: HOST_SOURCE,
      v: PROTOCOL_VERSION + 1,
      type: 'betslip:state',
      payload: state
    });

    expect(recebidas).toHaveLength(0);
  });

  it('entrega o estado a quem assinou', () => {
    const recebidas: BetslipState[] = [];
    createStarted();
    bridge.on('betslip:state', (message) => recebidas.push(message.payload));

    deliver(hostMessage('betslip:state', state));

    expect(recebidas).toEqual([state]);
  });

  it('responde ready quando o host se anuncia depois', () => {
    createStarted();
    parentPosts.length = 0;

    deliver(hostMessage('host:ready'));

    expect(parentPosts).toHaveLength(1);
    expect(parentPosts[0]?.data).toMatchObject({ type: 'ready' });
    // Resolvida a origem, passa a falar so com ela.
    expect(parentPosts[0]?.targetOrigin).toBe(HOST);
  });

  // `ancestorOrigins` diz quem nos embute. Resolver por ele evita emitir para a
  // allowlist inteira — mas so pode ser usado depois de conferir a allowlist,
  // senao o widget passa a falar com quem quer que o tenha colocado num iframe.
  describe('resolucao da origem do pai', () => {
    const setAncestors = (origins: string[]) => {
      const list: Record<string | number, unknown> = {
        length: origins.length
      };
      origins.forEach((origin, index) => {
        list[index] = origin;
      });

      Object.defineProperty(window.location, 'ancestorOrigins', {
        value: list,
        configurable: true
      });
    };

    afterEach(() => {
      Object.defineProperty(window.location, 'ancestorOrigins', {
        value: { length: 0 },
        configurable: true
      });
    });

    it('mira so o pai quando ele esta na allowlist', () => {
      setAncestors([HOST]);
      createStarted();

      expect(parentPosts).toHaveLength(1);
      expect(parentPosts[0]?.targetOrigin).toBe(HOST);
    });

    it('nao fala com um pai fora da allowlist', () => {
      setAncestors(['https://intruso.com']);
      createStarted();

      // Cai na emissao para a allowlist; o navegador descarta o que nao casa.
      expect(parentPosts.map((post) => post.targetOrigin)).toEqual(ORIGINS);
    });
  });

  it('para de entregar depois de cancelar a assinatura', () => {
    const recebidas: BetslipState[] = [];
    createStarted();
    const off = bridge.on('betslip:state', (m) => recebidas.push(m.payload));

    deliver(hostMessage('betslip:state', state));
    off();
    deliver(hostMessage('betslip:state', state));

    expect(recebidas).toHaveLength(1);
  });
});
