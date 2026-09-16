import { env } from '@/config/env';

export type WidgetTheme = 'light' | 'dark' | 'system';

export type WidgetParams = {
  theme: WidgetTheme;
  integration: string;
  listId: number | null;
  mobilePaddingInline: string;
  debug: boolean;
};

const THEMES: readonly WidgetTheme[] = ['light', 'dark', 'system'];

const toTheme = (value: string | null): WidgetTheme => {
  if (value && THEMES.includes(value as WidgetTheme))
    return value as WidgetTheme;
  if (THEMES.includes(env.defaultTheme as WidgetTheme))
    return env.defaultTheme as WidgetTheme;

  return 'dark';
};

const toNumber = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

export const readParams = (
  search: string = window.location.search
): WidgetParams => {
  const query = new URLSearchParams(search);

  return {
    theme: toTheme(query.get('theme')),
    integration: query.get('integration')?.trim() || env.integration,
    listId: toNumber(query.get('listId')),
    mobilePaddingInline: query.get('mobilePaddingInline')?.trim() ?? '',
    debug: query.get('debug') === '1'
  };
};
