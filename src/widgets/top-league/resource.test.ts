import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTopLeagues, mapLeagues } from './resource';

// Recorte real de GetFavouritesChamps, com os casos que a resposta traz de
// verdade: iconName vazio, hasLiveEvents true e ausencia de `offers`.
const resposta = {
  champs: [
    {
      offers: [{ type: 0, parameter: 2 }],
      iconName: '',
      hasLiveEvents: false,
      id: 3709,
      name: 'Copa Libertadores'
    },
    {
      offers: [{ type: 0, parameter: 2 }],
      iconName: '',
      hasLiveEvents: true,
      id: 16809,
      name: 'Liga Europa'
    },
    {
      iconName: 'BRA',
      hasLiveEvents: false,
      id: 11005,
      name: 'Brasileirão Série B'
    }
  ]
};

describe('mapLeagues', () => {
  it('traduz a resposta para o modelo de dominio', () => {
    expect(mapLeagues(resposta)).toEqual([
      { id: 3709, name: 'Copa Libertadores', icon: null, live: false },
      { id: 16809, name: 'Liga Europa', icon: null, live: true },
      { id: 11005, name: 'Brasileirão Série B', icon: 'BRA', live: false }
    ]);
  });

  it('trata resposta vazia e sem a chave champs', () => {
    expect(mapLeagues({})).toEqual([]);
    expect(mapLeagues({ champs: [] })).toEqual([]);
  });

  // Sem id nao da para navegar; sem nome nao da para desenhar. Meia liga na
  // tela e pior que liga nenhuma.
  it('descarta entradas sem id ou sem nome', () => {
    const leagues = mapLeagues({
      champs: [
        { name: 'Sem id' },
        { id: 1 },
        { id: 2, name: '   ' },
        { id: 3, name: 'Valida' }
      ]
    });

    expect(leagues).toEqual([
      { id: 3, name: 'Valida', icon: null, live: false }
    ]);
  });

  it('normaliza campos ausentes em vez de propagar undefined', () => {
    expect(mapLeagues({ champs: [{ id: 7, name: 'Minima' }] })).toEqual([
      { id: 7, name: 'Minima', icon: null, live: false }
    ]);
  });
});

// --- fetch ---------------------------------------------------------------

/** Captura as chamadas de rede e devolve sempre a mesma resposta. */
const stubFetch = (body: unknown) => {
  const urls: string[] = [];
  const inits: RequestInit[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((...args: [string, RequestInit]) => {
      urls.push(args[0]);
      inits.push(args[1]);

      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    })
  );

  return { urls, inits };
};

const parse = (url: string) => new URL(url);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTopLeagues', () => {
  it('chama GetFavouritesChamps com os parametros comuns da Altenar', async () => {
    const { urls } = stubFetch(resposta);

    await fetchTopLeagues({ integration: 'startbet' });

    const url = parse(urls[0]!);

    expect(url.origin + url.pathname).toBe(
      'https://sb2frontend-altenar2.biahosted.com/api/widget/GetFavouritesChamps'
    );
    expect(url.searchParams.get('integration')).toBe('startbet');
    expect(url.searchParams.get('culture')).toBe('pt-BR');
    expect(url.searchParams.get('deviceType')).toBe('1');
    expect(url.searchParams.get('countryCode')).toBe('BR');
    // Vem do navegador, entao o valor varia por maquina — basta existir.
    expect(url.searchParams.get('timezoneOffset')).not.toBeNull();
  });

  it('devolve as ligas ja mapeadas', async () => {
    stubFetch(resposta);

    await expect(fetchTopLeagues()).resolves.toEqual([
      { id: 3709, name: 'Copa Libertadores', icon: null, live: false },
      { id: 16809, name: 'Liga Europa', icon: null, live: true },
      { id: 11005, name: 'Brasileirão Série B', icon: 'BRA', live: false }
    ]);
  });

  it('corta a lista quando o limit vem preenchido', async () => {
    stubFetch(resposta);

    const leagues = await fetchTopLeagues({ limit: 2 });

    expect(leagues).toHaveLength(2);
  });

  it('ignora limit zero ou negativo em vez de esvaziar a lista', async () => {
    stubFetch(resposta);

    await expect(fetchTopLeagues({ limit: 0 })).resolves.toHaveLength(3);
    await expect(fetchTopLeagues({ limit: -1 })).resolves.toHaveLength(3);
  });

  it('repassa o signal para o fetch', async () => {
    const { inits } = stubFetch(resposta);
    const controller = new AbortController();

    await fetchTopLeagues({ signal: controller.signal });

    expect(inits[0]).toMatchObject({ signal: controller.signal });
  });

  it('cai na integration do env quando nao vem parametro', async () => {
    const { urls } = stubFetch(resposta);

    await fetchTopLeagues();

    expect(parse(urls[0]!).searchParams.get('integration')).toBe('startbet');
  });
});
