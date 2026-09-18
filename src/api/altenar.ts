// API de widgets da Altenar, chamada direto do navegador.
//
// E o mesmo host que a SPA da Altenar consome, e que o Nitro do front-startbet
// ja proxia para as bet cards. Ele responde `access-control-allow-origin: *` e
// `Cache-Control: public, max-age=15`, entao nao precisa de intermediario.
// Ver docs/architecture.md.
//
// O host agrupa a API em prefixos diferentes (`/api/widget/`, `/api/BetCards/`),
// entao cada recurso informa o caminho inteiro. Aqui mora so o que TODA chamada
// precisa; a forma de cada resposta e assunto do mapeador do widget
// correspondente — nada de tipos da Altenar subindo para este nivel.

import { request, type Query } from '@/api/client';
import { env } from '@/config/env';

const CULTURE = 'pt-BR';
const NUM_FORMAT = 'en-GB';
const COUNTRY_CODE = 'BR';

// A Altenar usa 1 para desktop. Nao diferenciamos mobile por enquanto: os
// widgets sao os mesmos nos dois, e o que muda e o layout, nao os dados.
const DEVICE_TYPE = 1;

export type AltenarRequestOptions = {
  query?: Query;
  signal?: AbortSignal;
  /** Skin, vinda dos parametros do widget — a URL pode sobrescrever o default. */
  integration?: string;
};

/** Parametros que toda chamada da Altenar leva, em query ou em corpo. */
const commonParams = (integration?: string) => ({
  culture: CULTURE,
  // Minutos a oeste de UTC, como o navegador reporta: 180 no horario de
  // Brasilia. E o mesmo numero que a SPA da Altenar envia.
  timezoneOffset: new Date().getTimezoneOffset(),
  integration: integration ?? env.integration,
  deviceType: DEVICE_TYPE,
  numFormat: NUM_FORMAT,
  countryCode: COUNTRY_CODE
});

export const altenarRequest = <T>(
  path: string,
  options: AltenarRequestOptions = {}
): Promise<T> =>
  request<T>(path, {
    baseUrl: env.altenarApiUrl,
    signal: options.signal,
    query: {
      ...commonParams(options.integration),
      ...options.query
    }
  });

/**
 * POST no common gateway. Hoje so o contador de apostas por bet card mora la,
 * e ele e enfeite: sem a contagem o card continua valido, entao a falha nao
 * pode derrubar a vitrine.
 */
export const altenarGatewayPost = <T>(
  path: string,
  body: Record<string, unknown>,
  options: AltenarRequestOptions = {}
): Promise<T> =>
  request<T>(path, {
    baseUrl: env.altenarGatewayUrl,
    method: 'POST',
    signal: options.signal,
    body: { ...commonParams(options.integration), ...body }
  });
