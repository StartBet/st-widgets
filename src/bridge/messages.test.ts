import { describe, expect, it } from 'vitest';
import {
  HOST_SOURCE,
  isHostMessage,
  PROTOCOL_VERSION,
  WIDGET_SOURCE
} from '@/bridge/messages';

const valid = (extra: Record<string, unknown> = {}) => ({
  source: HOST_SOURCE,
  v: PROTOCOL_VERSION,
  type: 'betslip:state',
  payload: { activeIds: [], boostIds: [] },
  ...extra
});

describe('isHostMessage', () => {
  it('aceita os tipos que o host pode mandar', () => {
    expect(isHostMessage(valid())).toBe(true);
    expect(
      isHostMessage(valid({ type: 'host:ready', payload: undefined }))
    ).toBe(true);
  });

  // A pagina hospedeira e barulhenta: o HMR do Vite, o SDK da Altenar e o
  // Smartico postam no mesmo window, e nem todo mundo posta objeto.
  it.each([
    ['string', 'webpackHotUpdate'],
    ['null', null],
    ['undefined', undefined],
    ['numero', 42],
    ['array', []]
  ])('descarta carga que nao e mensagem nossa: %s', (_label, data) => {
    expect(isHostMessage(data)).toBe(false);
  });

  it('descarta mensagem de outro emissor', () => {
    expect(isHostMessage(valid({ source: 'smartico' }))).toBe(false);
    expect(isHostMessage(valid({ source: undefined }))).toBe(false);
  });

  it('descarta o proprio widget falando', () => {
    // Sem isto, uma pagina aberta fora de iframe leria o que ela mesma emite:
    // `window.parent === window`.
    expect(isHostMessage(valid({ source: WIDGET_SOURCE }))).toBe(false);
  });

  it('descarta versao de protocolo diferente', () => {
    expect(isHostMessage(valid({ v: PROTOCOL_VERSION + 1 }))).toBe(false);
    expect(isHostMessage(valid({ v: PROTOCOL_VERSION - 1 }))).toBe(false);
    expect(isHostMessage(valid({ v: undefined }))).toBe(false);
  });

  // O caso mais provavel na pratica: o host publicado mais novo que o widget,
  // mandando um tipo que ainda nao existe deste lado.
  it('descarta tipo desconhecido, mesmo com remetente e versao corretos', () => {
    expect(isHostMessage(valid({ type: 'betslip:removed' }))).toBe(false);
  });

  it('descarta type que nao e string', () => {
    expect(isHostMessage(valid({ type: 7 }))).toBe(false);
    expect(isHostMessage(valid({ type: undefined }))).toBe(false);
  });
});
