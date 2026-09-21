import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyPopularity,
  fetchBoostCards,
  isPopular,
  mapBoostCards
} from './resource';

// Recorte real de GetBetCards?betCardListId=915, com as tabelas de lookup que a
// resposta traz. O card BB e o Flamengo x Independiente del Valle da POC.
const resposta = {
  betCards: [
    {
      id: 17273263,
      eventIds: [17599353],
      isBB: true,
      odds: [
        { marketId: 1726560393, selectionId: 4482652839 },
        { marketId: 1726560355, selectionId: 4482652762 }
      ],
      price: 8,
      boostInfo: { price: 9, property: 1, isWelcome: false }
    },
    {
      id: 17355593,
      eventIds: [17599353],
      isBB: false,
      odds: [{ marketId: 1734822744, selectionId: 4507521485 }],
      price: 2,
      boostInfo: { price: 2.3, property: 3, isWelcome: false }
    }
  ],
  events: [
    {
      id: 17599353,
      name: 'Flamengo x Independiente del Valle',
      status: 0,
      champId: 3709,
      competitorIds: [101, 102],
      startDate: '2026-09-17T21:30:00Z'
    }
  ],
  competitors: [
    { id: 101, name: 'Flamengo', hasConfigLogo: true },
    { id: 102, name: 'Independiente del Valle' }
  ],
  champs: [{ id: 3709, name: 'Copa Libertadores' }],
  markets: [
    { id: 1726560393, name: 'Ambas equipes marcam' },
    { id: 1726560355, name: 'Total de gols' },
    { id: 1734822744, name: 'Total de Defesas do Goleiro' }
  ],
  odds: [
    { id: 4482652839, name: 'Não' },
    { id: 4482652762, name: 'Mais de 2.5' },
    { id: 4507521485, name: 'Mais de 2.5' }
  ]
};

describe('mapBoostCards', () => {
  it('junta as tabelas de lookup num card de dominio', () => {
    const [bb] = mapBoostCards(resposta);

    expect(bb).toMatchObject({
      id: 17273263,
      home: 'Flamengo',
      away: 'Independiente del Valle',
      competition: 'Copa Libertadores',
      isLive: false,
      price: 8,
      boostedPrice: 9,
      selections: [
        { market: 'Ambas equipes marcam', selection: 'Não' },
        { market: 'Total de gols', selection: 'Mais de 2.5' }
      ]
    });
  });

  // Card simples registra o selectionId; card BB registra o id do BET CARD.
  // Casar pela uniao e o que faz o BB acender. Ver docs/bridge-poc.md.
  it('leva o id do card e os selectionIds como candidatos de casamento', () => {
    const [bb, simples] = mapBoostCards(resposta);

    expect(bb?.matchIds).toEqual([17273263, 4482652839, 4482652762]);
    expect(simples?.matchIds).toEqual([17355593, 4507521485]);
  });

  it('descarta boost de boas-vindas', () => {
    const cards = mapBoostCards({
      ...resposta,
      betCards: [
        { ...resposta.betCards[0]!, boostInfo: { price: 9, isWelcome: true } }
      ]
    });

    expect(cards).toEqual([]);
  });

  it('descarta card cujo evento nao veio na resposta', () => {
    const cards = mapBoostCards({ ...resposta, events: [] });

    expect(cards).toEqual([]);
  });

  it('trata resposta vazia', () => {
    expect(mapBoostCards({})).toEqual([]);
    expect(mapBoostCards({ betCards: [] })).toEqual([]);
  });

  it('marca como ao vivo quando o evento nao esta com status 0', () => {
    const cards = mapBoostCards({
      ...resposta,
      events: [{ ...resposta.events[0]!, status: 1 }]
    });

    expect(cards[0]?.isLive).toBe(true);
  });

  // A resposta e normalizada: o card referencia events/competitors/markets/odds
  // por id. Se alguma tabela vier incompleta — paginacao, filtro, mudanca do
  // lado deles — o card nao pode renderizar "undefined" na tela.
  it('sobrevive a tabelas de lookup incompletas', () => {
    const cards = mapBoostCards({
      betCards: resposta.betCards,
      events: [{ id: 17599353, status: 0 }],
      competitors: [],
      champs: [],
      markets: [],
      odds: []
    });

    expect(cards[0]).toMatchObject({
      home: '',
      away: '',
      competition: '',
      // Sem nome de mercado nem de selecao, a perna e descartada em vez de
      // virar uma linha vazia no card.
      selections: []
    });
  });

  it('trata card sem odds, sem preco e sem boostInfo', () => {
    const cards = mapBoostCards({
      ...resposta,
      betCards: [{ id: 999, eventIds: [17599353] }]
    });

    expect(cards[0]).toMatchObject({
      price: null,
      boostedPrice: null,
      selections: [],
      // Sem selectionIds, sobra o id do proprio card como candidato.
      matchIds: [999]
    });
  });

  it('descarta card sem id', () => {
    const cards = mapBoostCards({
      ...resposta,
      betCards: [{ eventIds: [17599353], price: 2 }]
    });

    expect(cards).toEqual([]);
  });

  it('descarta perna cujo selectionId nao e numero', () => {
    const cards = mapBoostCards({
      ...resposta,
      betCards: [
        {
          id: 1,
          eventIds: [17599353],
          odds: [{ marketId: 1726560393 }, { selectionId: 4482652839 }]
        }
      ]
    });

    expect(cards[0]?.matchIds).toEqual([1, 4482652839]);
  });

  it('nao expoe a forma da Altenar na referencia de selecao', () => {
    const [bb] = mapBoostCards(resposta);

    // O tipo e opaco; em runtime ainda da para inspecionar, e e isto que o
    // host recebe para achar o bet card nativo.
    expect(bb?.selection).toEqual({
      cardId: 17273263,
      oddIds: [4482652839, 4482652762],
      home: 'Flamengo',
      away: 'Independiente del Valle',
      isBB: true,
      boostedOdd: 9
    });
  });
});

describe('selo, promocao e escudos', () => {
  // O selo vem da familia do boost (`boostInfo.property`), nao de texto fixo:
  // 1 = Turbinada, 3 = Purple Odds. A familia 3 tambem muda a cor do selo.
  it('deriva o selo da familia do boost', () => {
    const [turbinada, purple] = mapBoostCards(resposta);

    expect(turbinada).toMatchObject({
      typeLabel: 'Turbinada',
      promotional: false
    });
    expect(purple).toMatchObject({
      typeLabel: 'Purple Odds',
      promotional: true
    });
  });

  it('cai no fallback quando a familia e desconhecida', () => {
    const cards = mapBoostCards(
      {
        ...resposta,
        betCards: [
          { ...resposta.betCards[0]!, boostInfo: { price: 9, property: 99 } }
        ]
      },
      {},
      'Turbinada'
    );

    expect(cards[0]?.typeLabel).toBe('Turbinada');
    expect(cards[0]?.promotional).toBe(false);
  });

  it('preserva isBB, que decide o selo BB no card', () => {
    const [bb, simples] = mapBoostCards(resposta);

    expect(bb?.isBB).toBe(true);
    expect(simples?.isBB).toBe(false);
  });

  // O escudo so existe quando o competidor traz hasConfigLogo; o logoSetId e
  // constante da integracao e nao vem na resposta.
  it('monta o escudo so para quem tem hasConfigLogo', () => {
    const [bb] = mapBoostCards(resposta, {
      jerseyCdn: 'https://cdn.exemplo',
      logoSetId: '127'
    });

    expect(bb?.homeLogo).toBe('https://cdn.exemplo/127/l/101');
    expect(bb?.awayLogo).toBeNull();
  });

  it('nao monta escudo sem configuracao de cdn', () => {
    const [bb] = mapBoostCards(resposta);

    expect(bb?.homeLogo).toBeNull();
  });
});

describe('popularidade', () => {
  it('aplica a contagem e decide o icone de fogo', () => {
    const cards = applyPopularity(mapBoostCards(resposta), { '17273263': 5 });

    expect(cards[0]?.popularity).toBe(5);
    expect(isPopular(cards[0]!)).toBe(true);
    // Sem contagem, o card fica em zero e nao ganha o destaque.
    expect(cards[1]?.popularity).toBe(0);
    expect(isPopular(cards[1]!)).toBe(false);
  });

  it('mantem os cards quando a contagem nao veio', () => {
    const cards = mapBoostCards(resposta);

    expect(applyPopularity(cards, null)).toBe(cards);
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

describe('fetchBoostCards', () => {
  it('chama GetBetCards com a lista curada e o default de sportId', async () => {
    const { urls } = stubFetch(resposta);

    await fetchBoostCards({ betCardListId: 915 });

    const url = parse(urls[0]!);

    expect(url.origin + url.pathname).toBe(
      'https://sb2frontend-altenar2.biahosted.com/api/BetCards/GetBetCards'
    );
    expect(url.searchParams.get('betCardListId')).toBe('915');
    // 0 = todos os esportes, o comportamento da lista hoje.
    expect(url.searchParams.get('sportId')).toBe('0');
    expect(url.searchParams.get('culture')).toBe('pt-BR');
  });

  it('respeita o sportId quando informado', async () => {
    const { urls } = stubFetch(resposta);

    await fetchBoostCards({ betCardListId: 915, sportId: 66 });

    expect(parse(urls[0]!).searchParams.get('sportId')).toBe('66');
  });

  it('devolve os cards ja mapeados', async () => {
    stubFetch(resposta);

    const cards = await fetchBoostCards({ betCardListId: 915 });

    expect(cards).toHaveLength(2);
    expect(cards[0]?.matchIds).toEqual([17273263, 4482652839, 4482652762]);
  });

  it('corta a lista quando o limit vem preenchido', async () => {
    stubFetch(resposta);

    await expect(
      fetchBoostCards({ betCardListId: 915, limit: 1 })
    ).resolves.toHaveLength(1);
  });

  it('ignora limit zero ou negativo em vez de esvaziar a vitrine', async () => {
    stubFetch(resposta);

    await expect(
      fetchBoostCards({ betCardListId: 915, limit: 0 })
    ).resolves.toHaveLength(2);
  });

  it('repassa o signal para o fetch', async () => {
    const { inits } = stubFetch(resposta);
    const controller = new AbortController();

    await fetchBoostCards({ betCardListId: 915, signal: controller.signal });

    expect(inits[0]).toMatchObject({ signal: controller.signal });
  });

  it('usa a integration informada, sobrescrevendo o default do env', async () => {
    const { urls } = stubFetch(resposta);

    await fetchBoostCards({ betCardListId: 915, integration: 'vupi' });

    expect(parse(urls[0]!).searchParams.get('integration')).toBe('vupi');
  });
});

describe('fetchBoostCards + popularidade', () => {
  it('consulta a contagem no common gateway e enriquece os cards', async () => {
    const urls: string[] = [];
    const bodies: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn((...args: [string, RequestInit]) => {
        urls.push(args[0]);
        if (args[1]?.body) bodies.push(String(args[1].body));

        const body = args[0].includes('BoostedBets')
          ? { itemCounts: { '17273263': 9 } }
          : resposta;

        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        );
      })
    );

    const cards = await fetchBoostCards({ betCardListId: 915 });

    expect(urls[1]).toBe(
      'https://sb2commongateway-altenar2.biahosted.com/api/BoostedBets/GetCountsByIntegration'
    );
    expect(JSON.parse(bodies[0]!)).toMatchObject({
      itemIds: [17273263, 17355593],
      integration: 'startbet'
    });
    expect(cards[0]?.popularity).toBe(9);
  });

  // O selo de fogo e enfeite: sem a contagem o card continua valido, entao a
  // falha da segunda chamada nao pode derrubar a vitrine.
  it('segue com os cards quando a contagem falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((...args: [string, RequestInit]) =>
        args[0].includes('BoostedBets')
          ? Promise.resolve(new Response('', { status: 500 }))
          : Promise.resolve(
              new Response(JSON.stringify(resposta), {
                status: 200,
                headers: { 'content-type': 'application/json' }
              })
            )
      )
    );

    const cards = await fetchBoostCards({ betCardListId: 915 });

    expect(cards).toHaveLength(2);
    expect(cards[0]?.popularity).toBe(0);
  });
});
