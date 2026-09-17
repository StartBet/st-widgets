// Contrato de mensagens entre o widget e a pagina hospedeira.
//
// Duas metades, com remetentes distintos:
//   st-widget -> st-host   intencoes ("o usuario quer isto")
//   st-host   -> st-widget estado ("o bilhete esta assim")
//
// O widget descreve a intencao; quem executa e o host, unico com acesso ao WSDK
// da Altenar. Ver docs/architecture.md.
//
// Este arquivo cresce a cada widget novo. O transporte, nao.

export const PROTOCOL_VERSION = 1;
export const WIDGET_SOURCE = 'st-widget';
export const HOST_SOURCE = 'st-host';

declare const selectionRefBrand: unique symbol;

/**
 * Referencia opaca a uma selecao.
 *
 * O mapeador da camada de dados constroi, o componente repassa sem abrir, e so
 * o host interpreta. O tipo e marcado de proposito: ler um campo daqui dentro
 * de um componente nao compila, e e isso que impede o conhecimento do mecanismo
 * da Altenar de vazar para a interface.
 *
 * O que vai dentro depende do widget — para o boosts, os desambiguadores que o
 * host precisa para achar o bet card nativo (ver docs/bridge-poc.md).
 */
export type SelectionRef = { readonly [selectionRefBrand]: true };

export const toSelectionRef = (value: Record<string, unknown>): SelectionRef =>
  value as unknown as SelectionRef;

/**
 * Alvo de navegacao por id de dominio, nunca por URL: a estrutura de rotas e
 * assunto do host e muda sem nos avisar.
 */
export type NavigationTarget =
  | { kind: 'championship'; id: number }
  | { kind: 'sport'; id: number }
  | { kind: 'event'; id: number; live?: boolean };

/** Ids presentes no bilhete, do ponto de vista do host. */
export type BetslipState = {
  /**
   * Para card simples a Altenar registra o selectionId; para card BB registra o
   * id do BET CARD. Medido na POC — casar pela uniao dos dois, nunca so por
   * selectionId. Ver docs/bridge-poc.md.
   */
  activeIds: number[];
  /** Subconjunto de activeIds cuja selecao esta com odd turbinada. */
  boostIds: number[];
};

export type WidgetMessage =
  | { type: 'ready' }
  | { type: 'betslip:add'; payload: { selection: SelectionRef } }
  | { type: 'navigate'; payload: { target: NavigationTarget } };

export type HostMessage =
  { type: 'host:ready' } | { type: 'betslip:state'; payload: BetslipState };

export type HostMessageType = HostMessage['type'];

/** Mensagem no fio: a carga util mais remetente e versao. */
export type Envelope<M> = M & { source: string; v: number };

const HOST_MESSAGE_TYPES: readonly HostMessageType[] = [
  'host:ready',
  'betslip:state'
];

/**
 * A pagina hospedeira tem outros emissores no mesmo `window` — o SDK da Altenar
 * e o Smartico, no minimo. Sem esta checagem lemos mensagem alheia.
 *
 * Versao maior que a nossa e descartada: o host pode ser mais novo que o
 * widget, e um formato que nao conhecemos e pior que silencio.
 */
export const isHostMessage = (data: unknown): data is Envelope<HostMessage> => {
  if (typeof data !== 'object' || data === null) return false;

  const message = data as Partial<Envelope<HostMessage>>;

  return (
    message.source === HOST_SOURCE &&
    message.v === PROTOCOL_VERSION &&
    typeof message.type === 'string' &&
    HOST_MESSAGE_TYPES.includes(message.type as HostMessageType)
  );
};
