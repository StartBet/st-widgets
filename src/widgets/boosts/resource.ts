// Recurso do boosts: de onde vem o dado e como ele vira modelo de dominio.
//
// Este arquivo e o UNICO lugar do widget que conhece a forma da Altenar. O
// componente ve `BoostCard` e uma `SelectionRef` que ele nao consegue abrir —
// fronteira 2 de docs/architecture.md.
//
// A resposta vem normalizada: `betCards` referencia `events`, `competitors`,
// `champs`, `markets` e `odds` por id, e o join e feito aqui.
//
// A lista e curada no back office por `betCardListId` (915 = "Purple Odds").

import { altenarRequest } from '@/api/altenar';
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

type BetCardsResponse = {
  betCards?: RawBetCard[];
  events?: RawEvent[];
  competitors?: Array<Identifiable & { name?: string }>;
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
  home: string;
  away: string;
  competition: string;
  isLive: boolean;
  startDate: string | null;
  selections: BoostSelection[];
  price: number | null;
  boostedPrice: number | null;
  /**
   * Ids com que o bilhete registra este card. Para card simples a Altenar grava
   * o selectionId; para card BB grava o id do BET CARD. Medido na POC — casar
   * pela uniao, nunca so por selectionId. Ver docs/bridge-poc.md.
   */
  matchIds: number[];
  /** Opaca de proposito: o componente repassa, so o host interpreta. */
  selection: SelectionRef;
};

const indexById = <T extends Identifiable>(
  list: T[] | undefined
): Map<number, T> => new Map((list ?? []).map((item) => [item.id, item]));

export const mapBoostCards = (data: BetCardsResponse): BoostCard[] => {
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
    const home = competitors.get(Number(homeId))?.name?.trim() ?? '';
    const away = competitors.get(Number(awayId))?.name?.trim() ?? '';

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

    cards.push({
      id: card.id,
      home,
      away,
      competition: champs.get(Number(event.champId))?.name?.trim() ?? '',
      isLive: event.status !== 0,
      startDate: event.startDate ?? null,
      selections,
      price: card.price ?? null,
      boostedPrice,
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

export type FetchBoostCardsOptions = {
  betCardListId: number;
  sportId?: number;
  integration?: string;
  signal?: AbortSignal;
  limit?: number | null;
};

export const fetchBoostCards = async ({
  betCardListId,
  sportId = 0,
  integration,
  signal,
  limit
}: FetchBoostCardsOptions): Promise<BoostCard[]> => {
  const data = await altenarRequest<BetCardsResponse>(
    '/api/BetCards/GetBetCards',
    { integration, signal, query: { betCardListId, sportId } }
  );

  const cards = mapBoostCards(data);

  return limit && limit > 0 ? cards.slice(0, limit) : cards;
};
