// Parametros do proprio widget — o segundo nivel, ao lado dos globais do shell
// (theme, integration, debug, mobilePaddingInline).
//
// Cada widget declara o que espera da URL. Isso importa mais do que parece:
// quem preenche esses valores e o back office da Altenar, fora do nosso
// alcance e sem validacao nenhuma do outro lado. Um parametro ausente, vazio ou
// escrito errado tem que cair num default previsivel — nunca quebrar a pagina,
// que estaria dentro de um iframe no site, sem ninguem para ver o erro.
//
// Ver docs/architecture.md, secao "Parametros: dois niveis".

export type ParamReader<T> = (raw: string | null) => T;

export type ParamSchema = Record<string, ParamReader<unknown>>;

export type ParamsOf<S extends ParamSchema> = {
  [K in keyof S]: S[K] extends ParamReader<infer T> ? T : never;
};

const trimmed = (raw: string | null): string | null => {
  const value = raw?.trim();

  return value ? value : null;
};

export const stringParam =
  (fallback = ''): ParamReader<string> =>
  (raw) =>
    trimmed(raw) ?? fallback;

/** Numero finito. Texto, vazio e `NaN` caem no default. */
export const numberParam =
  <T extends number | null>(fallback: T): ParamReader<number | T> =>
  (raw) => {
    const value = trimmed(raw);
    if (value === null) return fallback;

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallback;
  };

/** `1` e `true` ligam; qualquer outra coisa cai no default. */
export const booleanParam =
  (fallback = false): ParamReader<boolean> =>
  (raw) => {
    const value = trimmed(raw)?.toLowerCase();
    if (value === undefined || value === null) return fallback;

    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;

    return fallback;
  };

export const enumParam =
  <T extends string>(allowed: readonly T[], fallback: T): ParamReader<T> =>
  (raw) => {
    const value = trimmed(raw);

    return value && allowed.includes(value as T) ? (value as T) : fallback;
  };

/** Lista separada por virgula, descartando o que nao for numero finito. */
export const numberListParam =
  (fallback: readonly number[] = []): ParamReader<number[]> =>
  (raw) => {
    const value = trimmed(raw);
    if (value === null) return [...fallback];

    const parsed = value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));

    return parsed.length ? parsed : [...fallback];
  };

export const readWidgetParams = <S extends ParamSchema>(
  schema: S,
  search: string = window.location.search
): ParamsOf<S> => {
  const query = new URLSearchParams(search);
  const result = {} as Record<string, unknown>;

  for (const [key, read] of Object.entries(schema))
    result[key] = read(query.get(key));

  return result as ParamsOf<S>;
};
