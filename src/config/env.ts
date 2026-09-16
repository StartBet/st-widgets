const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const trimSlash = (value: string | undefined) =>
  (value ?? '').replace(/\/+$/, '');

export const env = {
  integration: import.meta.env.VITE_ALTENAR_INTEGRATION ?? 'startbet',
  apiBaseUrl: trimSlash(import.meta.env.VITE_API_BASE_URL),
  hostOrigins: list(import.meta.env.VITE_HOST_ORIGINS),
  defaultTheme: import.meta.env.VITE_DEFAULT_THEME ?? 'dark'
} as const;
