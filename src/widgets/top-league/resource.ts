// Recurso do top-league: de onde vem o dado e como ele vira modelo de dominio.
//
// Este arquivo e o UNICO lugar do widget que conhece a forma da resposta da
// Altenar. O componente ve `League` e nada mais — e a fronteira 2 de
// docs/architecture.md. Se a Altenar mudar o formato, muda aqui e so aqui.
//
// A lista e curada no back office ("favourites"), nao e todas as ligas de um
// esporte. E exatamente o que aparece hoje no menu lateral do site.

import { altenarRequest } from '@/api/altenar';

/** Forma bruta da resposta. Nao sai deste arquivo. */
type AltenarChamp = {
  id?: number;
  name?: string;
  iconName?: string;
  hasLiveEvents?: boolean;
};

type FavouritesChampsResponse = {
  champs?: AltenarChamp[];
};

export type League = {
  id: number;
  name: string;
  /** Codigo de pais/regiao usado pelo icone, ex.: "BRA". Vazio quando nao ha. */
  icon: string | null;
  live: boolean;
};

/**
 * Descarta entradas sem id ou sem nome: sem uma das duas nao da para navegar
 * nem para desenhar, e meia liga na tela e pior que liga nenhuma.
 */
export const mapLeagues = (data: FavouritesChampsResponse): League[] =>
  (data.champs ?? []).reduce<League[]>((leagues, champ) => {
    const name = champ.name?.trim();

    if (typeof champ.id !== 'number' || !name) return leagues;

    leagues.push({
      id: champ.id,
      name,
      icon: champ.iconName?.trim() || null,
      live: champ.hasLiveEvents === true
    });

    return leagues;
  }, []);

export type FetchTopLeaguesOptions = {
  integration?: string;
  signal?: AbortSignal;
  limit?: number | null;
};

export const fetchTopLeagues = async ({
  integration,
  signal,
  limit
}: FetchTopLeaguesOptions = {}): Promise<League[]> => {
  const data = await altenarRequest<FavouritesChampsResponse>(
    '/api/widget/GetFavouritesChamps',
    { integration, signal }
  );

  const leagues = mapLeagues(data);

  return limit && limit > 0 ? leagues.slice(0, limit) : leagues;
};
