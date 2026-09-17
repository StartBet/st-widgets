const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const trimSlash = (value: string | undefined) =>
  (value ?? '').replace(/\/+$/, '');

// A API de widgets da Altenar responde com `access-control-allow-origin: *`,
// entao o widget chama direto. O default cobre o caso de a variavel nao estar
// configurada no ambiente. Ver docs/architecture.md.
const ALTENAR_API_FALLBACK = 'https://sb2frontend-altenar2.biahosted.com';

export const env = {
  integration: import.meta.env.VITE_ALTENAR_INTEGRATION ?? 'startbet',
  altenarApiUrl:
    trimSlash(import.meta.env.VITE_ALTENAR_API_URL) || ALTENAR_API_FALLBACK,
  // Nitro do front-startbet: excecao, para o que so existir na DataFeed.
  apiBaseUrl: trimSlash(import.meta.env.VITE_API_BASE_URL),
  hostOrigins: list(import.meta.env.VITE_HOST_ORIGINS),
  defaultTheme: import.meta.env.VITE_DEFAULT_THEME ?? 'dark'
} as const;
