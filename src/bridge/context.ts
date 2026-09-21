import { inject, type InjectionKey } from 'vue';
import type { HostBridge } from '@/bridge/transport';

export const hostBridgeKey: InjectionKey<HostBridge> = Symbol('st-host-bridge');

/**
 * A ponte com a pagina hospedeira. Componentes usam isto e nunca tocam em
 * `postMessage` — o transporte, o handshake e a validacao de origem sao
 * assunto de src/bridge/transport.ts.
 */
export const useHostBridge = (): HostBridge => {
  const bridge = inject(hostBridgeKey);

  if (!bridge)
    throw new Error('useHostBridge must be used inside createWidget');

  return bridge;
};
