// Recurso do boosts: de onde vem o dado e como ele vira modelo de dominio.
//
// Este arquivo e o UNICO lugar do widget que conhece a forma da Altenar. O
// componente ve `BoostCard` e uma `SelectionRef` que ele nao consegue abrir —
// fronteira 2 de docs/architecture.md.
//
// A resposta vem normalizada: `betCards` referencia `events`, `competitors`,
// `champs`, `markets` e `odds` por id, e o join e feito aqui. As regras de
// selo, promocao e popularidade espelham `betCards.ts` do front-startbet, que
// e o componente equivalente no site.

import { altenarGatewayPost, altenarRequest } from '@/api/altenar';
import { toSelectionRef, type SelectionRef } from '@/bridge/messages';

type Identifiable = { id: number };

/** Formas brutas. Nenhuma delas sai deste arquivo. */
type RawBetCard = {
  id?: number;
  eventIds?: number[];
  isBB?: boolean;
  odds?: Array<{ marketId?: number; selectionId?: number }>;
  price?: number;
  boostInfo?: {
    price?: number;
    isWelcome?: boolean;
    property?: number;
  } | null;
};

type RawEvent = Identifiable & {
  name?: string;
  status?: number;
  champId?: number;
  competitorIds?: number[];
  startDate?: string;
};

type RawCompetitor = Identifiable & { name?: string; hasConfigLogo?: boolean };

type BetCardsResponse = {
  betCards?: RawBetCard[];
  events?: RawEvent[];
  competitors?: RawCompetitor[];
  champs?: Array<Identifiable & { name?: string }>;
  markets?: Array<Identifiable & { name?: string }>;
  odds?: Array<Identifiable & { name?: string }>;
};

export type BoostSelection = {
  market: string;
  selection: string;
};

export type BoostCard = {
  id: number;
  eventId: number | null;
  home: string;
  away: string;
  homeLogo: string | null;
  awayLogo: string | null;
  eventName: string;
  competition: string;
  isLive: boolean;
  /** Bet Builder: multipla dentro de um evento so. Vira selo no card. */
  isBB: boolean;
  startDate: string | null;
  selections: BoostSelection[];
  price: number | null;
  boostedPrice: number | null;
  /** Selo do card, derivado da familia do boost. */
  typeLabel: string;
  /** Muda a cor do selo, separando a promocao das turbinadas do dia a dia. */
  promotional: boolean;
  /** Apostas ja feitas neste card; decide o icone de fogo. */
  popularity: number;
  /**
   * Ids com que o bilhete registra este card. Para card simples a Altenar grava
   * o selectionId; para card BB grava o id do BET CARD. Medido na POC — casar
   * pela uniao, nunca so por selectionId. Ver docs/bridge-poc.md.
   */
  matchIds: number[];
  /** Opaca de proposito: o componente repassa, so o host interpreta. */
  selection: SelectionRef;
};

const PURPLE_ODDS_PROPERTY = 3;

const TYPE_LABELS: Record<number, string> = {
  1: 'Turbinada',
  [PURPLE_ODDS_PROPERTY]: 'Purple Odds'
};

/** Espelha `popularityIconThreshold` do back office da Altenar. */
export const POPULARITY_ICON_THRESHOLD = 1;

export const isPopular = (
  card: BoostCard,
  threshold = POPULARITY_ICON_THRESHOLD
): boolean => card.popularity > threshold;

const indexById = <T extends Identifiable>(
  list: T[] | undefined
): Map<number, T> => new Map((list ?? []).map((item) => [item.id, item]));

export type LogoConfig = {
  jerseyCdn?: string;
  logoSetId?: string | number;
};

const buildLogo = (
  competitor: RawCompetitor | undefined,
  { jerseyCdn, logoSetId }: LogoConfig
): string | null =>
  competitor?.hasConfigLogo && jerseyCdn && logoSetId
    ? `${jerseyCdn}/${logoSetId}/l/${competitor.id}`
    : null;

export const mapBoostCards = (
  data: BetCardsResponse,
  logos: LogoConfig = {},
  fallbackType = ''
): BoostCard[] => {
  const events = indexById(data.events);
  const competitors = indexById(data.competitors);
  const champs = indexById(data.champs);
  const markets = indexById(data.markets);
  const odds = indexById(data.odds);

  return (data.betCards ?? []).reduce<BoostCard[]>((cards, card) => {
    // Boost de boas-vindas nao entra na vitrine: e oferta individual, so vale
    // para quem ainda nao apostou. Mesma regra do modulo do front-startbet.
    if (card.boostInfo?.isWelcome) return cards;
    if (typeof card.id !== 'number') return cards;

    const event = events.get(Number(card.eventIds?.[0]));
    if (!event) return cards;

    const [homeId, awayId] = event.competitorIds ?? [];
    const homeCompetitor = competitors.get(Number(homeId));
    const awayCompetitor = competitors.get(Number(awayId));
    const home = homeCompetitor?.name?.trim() ?? '';
    const away = awayCompetitor?.name?.trim() ?? '';

    const oddIds = (card.odds ?? [])
      .map((ref) => ref.selectionId)
      .filter((id): id is number => typeof id === 'number');

    const selections = (card.odds ?? [])
      .map((ref) => ({
        market: markets.get(Number(ref.marketId))?.name?.trim() ?? '',
        selection: odds.get(Number(ref.selectionId))?.name?.trim() ?? ''
      }))
      .filter((item) => item.market || item.selection);

    const boostedPrice = card.boostInfo?.price ?? null;
    const property = card.boostInfo?.property;
    const typeLabel =
      (property == null ? undefined : TYPE_LABELS[property]) ?? fallbackType;

    cards.push({
      id: card.id,
      eventId: event.id ?? null,
      home,
      away,
      homeLogo: buildLogo(homeCompetitor, logos),
      awayLogo: buildLogo(awayCompetitor, logos),
      eventName: event.name?.trim() ?? '',
      competition: champs.get(Number(event.champId))?.name?.trim() ?? '',
      isLive: event.status !== 0,
      isBB: Boolean(card.isBB),
      startDate: event.startDate ?? null,
      selections,
      price: card.price ?? null,
      boostedPrice,
      typeLabel,
      promotional: typeLabel === TYPE_LABELS[PURPLE_ODDS_PROPERTY],
      popularity: 0,
      matchIds: [card.id, ...oddIds],
      // O host precisa disto para achar o bet card nativo e clicar nele: a odd
      // turbinada nao tem API. Os times identificam o card, `isBB` distingue
      // normal de Bet Builder, e o preco turbinado desempata. Ver bridge-poc.md.
      selection: toSelectionRef({
        oddIds,
        home,
        away,
        isBB: Boolean(card.isBB),
        boostedOdd: boostedPrice
      })
    });

    return cards;
  }, []);
};

export const applyPopularity = (
  cards: BoostCard[],
  counts: Record<string, number> | null | undefined
): BoostCard[] =>
  counts
    ? cards.map((card) => ({
        ...card,
        popularity: counts[String(card.id)] ?? 0
      }))
    : cards;

export type FetchBoostCardsOptions = {
  betCardListId: number;
  sportId?: number;
  integration?: string;
  signal?: AbortSignal;
  limit?: number | null;
  logos?: LogoConfig;
  fallbackType?: string;
};

/**
 * O selo de fogo depende de uma segunda chamada, noutro host. Ela e enfeite:
 * se falhar, os cards continuam validos e so ficam sem o destaque — por isso o
 * erro e engolido em vez de derrubar a vitrine.
 */
const fetchPopularity = async (
  ids: number[],
  options: { integration?: string; signal?: AbortSignal }
): Promise<Record<string, number> | null> => {
  if (!ids.length) return null;

  try {
    const data = await altenarGatewayPost<{
      itemCounts?: Record<string, number>;
    }>('/api/BoostedBets/GetCountsByIntegration', { itemIds: ids }, options);

    return data.itemCounts ?? null;
  } catch {
    return null;
  }
};

export const fetchBoostCards = async ({
  betCardListId,
  sportId = 0,
  integration,
  signal,
  limit,
  logos,
  fallbackType
}: FetchBoostCardsOptions): Promise<BoostCard[]> => {
  const data = await altenarRequest<BetCardsResponse>(
    '/api/BetCards/GetBetCards',
    { integration, signal, query: { betCardListId, sportId } }
  );

  const mapped = mapBoostCards(data, logos, fallbackType);
  const cards = limit && limit > 0 ? mapped.slice(0, limit) : mapped;

  return applyPopularity(
    cards,
    await fetchPopularity(
      cards.map((card) => card.id),
      { integration, signal }
    )
  );
};
