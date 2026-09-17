// Parametros que o top-league aceita na URL, ao lado dos globais do shell.
// Quem preenche e o back office da Altenar, sem validacao do outro lado — por
// isso todo valor tem default. Ver docs/architecture.md.

import { numberParam, readWidgetParams } from '@/config/widgetParams';

const schema = {
  /** Quantas ligas mostrar. Sem valor, mostra todas as que vierem. */
  limit: numberParam(null)
};

export type TopLeagueParams = ReturnType<typeof readTopLeagueParams>;

export const readTopLeagueParams = (search?: string) =>
  readWidgetParams(schema, search);
