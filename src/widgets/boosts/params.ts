// Parametros que o boosts aceita na URL, ao lado dos globais do shell.
// Quem preenche e o back office da Altenar, sem validacao do outro lado — por
// isso todo valor tem default. Ver docs/architecture.md.

import { numberParam, readWidgetParams } from '@/config/widgetParams';

/** Lista "Purple Odds", a curadoria que esta no ar hoje. */
const DEFAULT_LIST_ID = 915;

const schema = {
  /** Qual lista curada carregar. */
  betCardListId: numberParam(DEFAULT_LIST_ID),
  /** `0` traz todos os esportes, que e o comportamento da lista hoje. */
  sportId: numberParam(0),
  /** Quantos cards mostrar. Sem valor, mostra todos os que vierem. */
  limit: numberParam(null)
};

export type BoostsParams = ReturnType<typeof readBoostsParams>;

export const readBoostsParams = (search?: string) =>
  readWidgetParams(schema, search);
