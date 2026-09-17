import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, buildUrl, request } from '@/api/client';

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init
  });

const stubFetch = (impl: typeof fetch) => vi.stubGlobal('fetch', vi.fn(impl));

/** Captura a rejeicao ja tipada, para nao inspecionar `unknown` em cada teste. */
const caught = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
    throw new Error('esperava uma rejeicao');
  } catch (error) {
    return error as ApiError;
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildUrl', () => {
  it('monta o caminho com e sem barra inicial', () => {
    expect(buildUrl('/v2/altenar/bet-cards')).toBe('/v2/altenar/bet-cards');
    expect(buildUrl('v2/altenar/bet-cards')).toBe('/v2/altenar/bet-cards');
  });

  it('serializa a query', () => {
    expect(buildUrl('/x', { betCardListId: 915, live: true })).toBe(
      '/x?betCardListId=915&live=true'
    );
  });

  it('omite valores nulos em vez de mandar a string "null"', () => {
    expect(buildUrl('/x', { a: null, b: undefined, c: 1 })).toBe('/x?c=1');
  });

  it('repete a chave para arrays, como o Nitro espera', () => {
    expect(buildUrl('/x', { 'odd_id[]': [1, 2] })).toBe(
      '/x?odd_id%5B%5D=1&odd_id%5B%5D=2'
    );
  });
});

describe('request', () => {
  it('devolve o corpo em caso de sucesso', async () => {
    stubFetch(async () => jsonResponse({ betCards: [{ id: 1 }] }));

    await expect(request('/v2/altenar/bet-cards')).resolves.toEqual({
      betCards: [{ id: 1 }]
    });
  });

  // O Nitro responde { statusCode, statusMessage, message, stack }. Queremos a
  // mensagem dele, nunca o stack, que aponta para caminhos do servidor.
  it('usa a mensagem do Nitro no erro, sem o stack', async () => {
    stubFetch(async () =>
      jsonResponse(
        {
          error: true,
          statusCode: 502,
          statusMessage: 'Falha ao consultar o Altenar DataFeed',
          message: 'Falha ao consultar o Altenar DataFeed',
          stack: ['C:/caminho/do/servidor']
        },
        { status: 502, statusText: 'Bad Gateway' }
      )
    );

    const error = await caught(request('/v2/altenar/menu-champs'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toBe('Falha ao consultar o Altenar DataFeed');
    expect(JSON.stringify(error)).not.toContain('caminho/do/servidor');
  });

  it('cai no statusText quando o corpo do erro nao e JSON', async () => {
    stubFetch(
      async () =>
        new Response('<html>502</html>', {
          status: 502,
          statusText: 'Bad Gateway'
        })
    );

    const error = await caught(request('/x'));

    expect(error.message).toBe('Bad Gateway');
    expect(error.status).toBe(502);
  });

  it('vira ApiError com status 0 quando a rede falha', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const error = await caught(request('/x'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
  });

  it('deixa o cancelamento subir como esta', async () => {
    const abort = new DOMException('The operation was aborted', 'AbortError');
    stubFetch(async () => {
      throw abort;
    });

    const error = await caught(request('/x'));

    expect(error).toBe(abort);
    expect(error).not.toBeInstanceOf(ApiError);
  });

  it('repassa o signal para o fetch', async () => {
    const chamadas: RequestInit[] = [];
    stubFetch(((...args: [string, RequestInit]) => {
      chamadas.push(args[1]);
      return Promise.resolve(jsonResponse({}));
    }) as unknown as typeof fetch);

    const controller = new AbortController();
    await request('/x', { signal: controller.signal });

    expect(chamadas[0]).toMatchObject({ signal: controller.signal });
  });
});
