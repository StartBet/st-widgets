import { env } from '@/config/env';

export type WidgetTheme = 'light' | 'dark' | 'system';

/**
 * Qual token de superficie pinta o fundo do widget. Numerados vao do mais
 * escuro ao mais claro dentro do tema corrente; `primary` e `secondary` sao as
 * superficies de marca.
 */
export type WidgetSurface =
  '0' | '1' | '2' | '3' | '4' | 'primary' | 'secondary';

// Globais do shell. Parametro que so um widget usa nao entra aqui: ele declara
// o proprio esquema com readWidgetParams. Ver docs/architecture.md.
export type WidgetParams = {
  theme: WidgetTheme;
  surface: WidgetSurface;
  integration: string;
  mobilePaddingInline: string;
  debug: boolean;
};

const THEMES: readonly WidgetTheme[] = ['light', 'dark', 'system'];

const SURFACES: readonly WidgetSurface[] = [
  '0',
  '1',
  '2',
  '3',
  '4',
  'primary',
  'secondary'
];

// O fundo do frame é decisão de quem embute, e o back office preenche isto à
// mão: valor desconhecido cai no default em vez de deixar o widget sem fundo.
const toSurface = (value: string | null): WidgetSurface => {
  const surface = value?.trim();

  return surface && SURFACES.includes(surface as WidgetSurface)
    ? (surface as WidgetSurface)
    : '2';
};

const toTheme = (value: string | null): WidgetTheme => {
  if (value && THEMES.includes(value as WidgetTheme))
    return value as WidgetTheme;
  if (THEMES.includes(env.defaultTheme as WidgetTheme))
    return env.defaultTheme as WidgetTheme;

  return 'dark';
};

export const readParams = (
  search: string = window.location.search
): WidgetParams => {
  const query = new URLSearchParams(search);

  return {
    theme: toTheme(query.get('theme')),
    surface: toSurface(query.get('surface')),
    integration: query.get('integration')?.trim() || env.integration,
    mobilePaddingInline: query.get('mobilePaddingInline')?.trim() ?? '',
    debug: query.get('debug') === '1'
  };
};
