import '@/styles/main.css';
import '@startbet/st-core-ui/base-neue-condensed.css';
import '@startbet/st-core-ui/tokens.css';

import { createApp, h, type App, type Component } from 'vue';
import WidgetShell from '@/app/WidgetShell.vue';
import { widgetParamsKey } from '@/app/context';
import { readParams } from '@/config/params';

export const createWidget = (widget: Component, selector = '#widget'): App => {
  const params = readParams();

  const app = createApp({
    render: () => h(WidgetShell, null, { default: () => h(widget) })
  });

  app.provide(widgetParamsKey, params);
  app.mount(selector);

  return app;
};
