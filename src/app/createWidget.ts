import '@/styles/main.css';
import '@startbet/st-core-ui/base-neue-condensed.css';
import '@startbet/st-core-ui/tokens.css';

import { createApp, h, type App, type Component } from 'vue';
import WidgetShell from '@/app/WidgetShell.vue';
import { widgetParamsKey } from '@/app/context';
import { hostBridgeKey } from '@/bridge/context';
import { createHostBridge } from '@/bridge/transport';
import { readParams } from '@/config/params';

export const createWidget = (widget: Component, selector = '#widget'): App => {
  const params = readParams();
  const bridge = createHostBridge({ debug: params.debug });

  const app = createApp({
    render: () => h(WidgetShell, null, { default: () => h(widget) })
  });

  app.provide(widgetParamsKey, params);
  app.provide(hostBridgeKey, bridge);
  app.mount(selector);

  // Depois do mount: o handshake responde e o primeiro estado pode chegar
  // imediatamente, entao os assinantes precisam ja existir.
  bridge.start();

  return app;
};
