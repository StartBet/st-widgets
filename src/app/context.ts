import { inject, type InjectionKey } from 'vue';
import type { WidgetParams } from '@/config/params';

export const widgetParamsKey: InjectionKey<WidgetParams> =
  Symbol('st-widget-params');

export const useWidgetParams = (): WidgetParams => {
  const params = inject(widgetParamsKey);

  if (!params)
    throw new Error('useWidgetParams must be used inside createWidget');

  return params;
};
