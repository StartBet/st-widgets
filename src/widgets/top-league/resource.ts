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
  /**
   * Esporte e pais compoem o caminho legivel da rota, montado pelo host.
   * Vazios quando o menu nao respondeu — a navegacao continua funcionando,
   * so com a URL curta.
   */
  sport: string;
  country: string;
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
      live: champ.hasLiveEvents === true,
      sport: '',
      country: ''
    });

    return leagues;
  }, []);

/**
 * O caminho legivel da rota precisa de esporte e pais, e o GetFavouritesChamps
 * devolve so id e nome. O menu clicavel tem as duas tabelas e as chaves para
 * ligar: `categories[].champIds` aponta para o campeonato, `sports[].catIds`
 * aponta para a categoria.
 *
 * E dado de referencia, de cache longo. Se falhar, as ligas seguem sem esporte
 * e pais e a rota sai na forma curta — nao vale derrubar a lista por causa do
 * enfeite da URL.
 */
type MenuResponse = {
  sports?: Array<{ id: number; name?: string; catIds?: number[] }>;
  categories?: Array<{ id: number; name?: string; champIds?: number[] }>;
};

export type LeaguePath = { sport: string; country: string };

export const buildLeaguePaths = (
  menu: MenuResponse
): Map<number, LeaguePath> => {
  const sportByCategory = new Map<number, string>();

  for (const sport of menu.sports ?? [])
    for (const catId of sport.catIds ?? [])
      if (!sportByCategory.has(catId))
        sportByCategory.set(catId, sport.name?.trim() ?? '');

  const paths = new Map<number, LeaguePath>();

  for (const category of menu.categories ?? [])
    for (const champId of category.champIds ?? [])
      paths.set(champId, {
        sport: sportByCategory.get(category.id) ?? '',
        country: category.name?.trim() ?? ''
      });

  return paths;
};

export const applyLeaguePaths = (
  leagues: League[],
  paths: Map<number, LeaguePath> | null
): League[] =>
  paths
    ? leagues.map((league) => ({ ...league, ...(paths.get(league.id) ?? {}) }))
    : leagues;

const fetchLeaguePaths = async (options: {
  integration?: string;
  signal?: AbortSignal;
}): Promise<Map<number, LeaguePath> | null> => {
  try {
    return buildLeaguePaths(
      await altenarRequest<MenuResponse>('/api/widget/GetClickableSportMenu', {
        ...options,
        query: { period: 0 }
      })
    );
  } catch {
    return null;
  }
};

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

  const mapped = mapLeagues(data);
  const leagues = limit && limit > 0 ? mapped.slice(0, limit) : mapped;

  return applyLeaguePaths(
    leagues,
    await fetchLeaguePaths({ integration, signal })
  );
};
