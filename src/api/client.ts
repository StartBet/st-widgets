// Cliente HTTP do Nitro do front-startbet.
//
// Tudo passa por aqui porque nao ha alternativa: a DataFeed da Altenar nao envia
// headers de CORS, entao o navegador bloqueia qualquer chamada direta do widget.
// O Nitro e o unico caminho, e ele ja centraliza skin, idioma e cache.
// Ver docs/architecture.md.
//
// Este modulo nao guarda nada e nao decide politica de cache — quem decide e o
// Nitro, que ja separa os buckets "live" e "ref".

import { env } from '@/config/env';

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue | readonly QueryValue[]>;

export class ApiError extends Error {
  /** `0` quando a requisicao nem chegou a ter resposta. */
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }
}

const appendValue = (
  search: URLSearchParams,
  key: string,
  value: QueryValue
) => {
  if (value === null || value === undefined) return;
  search.append(key, String(value));
};

/**
 * Monta a URL final. Valores nulos somem em vez de virar a string "null", e
 * arrays repetem a chave — e o formato que o Nitro espera (ex.: `odd_id[]`).
 */
export const buildUrl = (
  path: string,
  query?: Query,
  baseUrl: string = env.apiBaseUrl
): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) appendValue(search, key, item);
      continue;
    }

    appendValue(search, key, value as QueryValue);
  }

  const suffix = search.toString();
  const normalized = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalized}${suffix ? `?${suffix}` : ''}`;
};

/**
 * O Nitro responde erro como `{ statusCode, statusMessage, message, stack }`.
 * Aproveitamos a mensagem dele e ignoramos o resto — `stack` aponta para
 * caminhos do servidor e nao tem por que chegar ao navegador.
 */
const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const message = body.message ?? body.statusMessage;

    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // corpo vazio ou nao-JSON: cai no statusText
  }

  return response.statusText || `HTTP ${response.status}`;
};

const isAbort = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

export type RequestOptions = {
  query?: Query;
  signal?: AbortSignal;
  /** Default: o Nitro. A API de widgets da Altenar passa a sua propria base. */
  baseUrl?: string;
  /** Default `GET`. */
  method?: 'GET' | 'POST';
  /** Corpo JSON. So faz sentido com `POST`. */
  body?: unknown;
};

export const request = async <T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  const url = buildUrl(path, options.query, options.baseUrl);
  let response: Response;

  const method = options.method ?? 'GET';

  try {
    response = await fetch(url, {
      method,
      signal: options.signal,
      headers:
        options.body === undefined
          ? { accept: 'application/json' }
          : { accept: 'application/json', 'content-type': 'application/json' },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch (error) {
    // Cancelamento nao e falha: sobe como esta para quem chamou distinguir.
    if (isAbort(error)) throw error;

    throw new ApiError('falha de rede', 0, path);
  }

  if (!response.ok)
    throw new ApiError(await readErrorMessage(response), response.status, path);

  return (await response.json()) as T;
};
