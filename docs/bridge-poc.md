# POC do bridge — insumos

Registro do que a prova de conceito de 17/09/2026 mediu. O código dela é descartável; o que está aqui não é.

O objetivo era responder uma pergunta: **o widget, de dentro do iframe, consegue colocar uma seleção turbinada no bilhete?** Consegue. Mas o caminho até lá revelou mais restrições do que a resposta em si.

## Montagem

|            |                                                                        |
| ---------- | ---------------------------------------------------------------------- |
| Host       | `front-startbet` em `localhost:3000`, página `/sports`                 |
| Widget     | `st-widgets` em `localhost:5180`, `boosts.html` num `<iframe>`         |
| Card usado | Flamengo x Independiente del Valle, Copa Libertadores, BB, 8.00 → 9.00 |

Os dados do card vieram de `/v2/altenar/bet-cards?betCardListId=915`, o proxy Nitro do próprio host.

## O que foi validado

```
[st-widget][poc] enviado {source:'st-widget', v:1, type:'betslip:add', …}
[poc][host]     intencao recebida {origin:'http://localhost:5180', …}
[poc][host]     clicou no card nativo — odd turbinada
```

O card ficou ativo no sportsbook exibindo **9.00**, o preço turbinado — não os 8.00 da odd base. Em ordem, isso prova: a mensagem atravessa a fronteira de origem, a validação de `event.origin` funciona, o namespace distingue a nossa mensagem das do Smartico e do WSDK que trafegam no mesmo `window`, e o clique simulado no card nativo funciona **mesmo quando o gatilho vem de um `postMessage` a qualquer momento**, e não de uma navegação de rota no instante do init.

Essa última era a incógnita real. O deep-link `?boostTeams=` dispara o clique durante a inicialização do sportsbook, quando o card acabou de renderizar. A POC dispara com a página já assentada, e funcionou igual.

## Achado central: não existe API para a odd turbinada

Documentado no próprio host, em `stores/altenarBetslip.ts` e `modules/WBetCardsCarousel.vue`:

> a odd TURBINADA só é ativada pela ação interna do widget nativo — não há API pública/URL que a injete

São dois caminhos, e eles **não são equivalentes**:

| Caminho                       | Como                                       | Resultado                |
| ----------------------------- | ------------------------------------------ | ------------------------ |
| `altenarWSDK.set({ oddIds })` | API pública                                | odd **base** (8.00)      |
| `activateBoost(...)`          | localiza o card nativo no DOM e clica nele | odd **turbinada** (9.00) |

O `set({ oddIds })` existe hoje como fallback quando o card não é encontrado. Nesse caminho **o usuário recebe a aposta pelo preço errado, e nada sinaliza isso** — nem erro, nem aviso. É risco de produto, não detalhe de implementação, e precisa de uma decisão explícita: falhar visivelmente ou aceitar o preço menor em silêncio.

Consequência direta para o widget: ele **depende do card nativo estar renderizado** no sportsbook no momento do clique. Se a carousel nativa for removida da página — que é o plano, quando o nosso widget substituí-la — esse mecanismo deixa de existir e não há substituto conhecido. **Isso precisa ser resolvido com a Altenar antes de desligar o widget nativo.**

## A forma da mensagem

Um `selectionId` sozinho não reproduz uma seleção turbinada. O host desambigua porque o mesmo jogo pode ter card normal **e** Bet Builder ao mesmo tempo:

```js
{
  source: 'st-widget',        // a página tem outros emissores; sem isso lemos mensagem alheia
  v: 1,                       // widget e host têm deploys independentes
  type: 'betslip:add',
  payload: {
    oddIds: [4482652839, …],  // fallback — adiciona a odd BASE
    home: 'Flamengo',
    away: 'Independiente del Valle',
    isBB: true,               // distingue card normal de Bet Builder
    boostedOdd: 9             // desempata quando os dois critérios acima empatam
  }
}
```

Os três últimos campos não são escolha nossa: são exatamente os desambiguadores que o deep-link `?boostTeams=&boostBB=&boostOdd=` já carrega, porque o host precisa deles para achar o card certo no DOM.

## Descobertas de mecânica

**Mandar para todas as origens da allowlist gera aviso no console.** A POC percorria `VITE_HOST_ORIGINS` chamando `postMessage` uma vez por origem. O navegador entrega só para a que corresponde ao pai e descarta as outras — não há vazamento —, mas cada descarte emite:

> Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://localhost:5180') does not match the recipient window's origin ('http://localhost:3000').

Funciona, mas polui o console de quem hospeda. **O contrato definitivo deve resolver a origem do pai uma vez** — por handshake ou por `location.ancestorOrigins` — e passar a mandar só para ela.

**O widget não vê o `localStorage` do host.** Origens diferentes, `localStorage` separados. Isso invalida, para o widget, a técnica que o módulo do host usa para saber o estado do bilhete (ver a seção seguinte).

**`window.parent === window` quando não há host.** Vale guardar: sem a checagem, o widget aberto direto na aba manda mensagem para si mesmo.

## Estado do bilhete: por que o widget não pode se virar sozinho

O card não fica ativo para sempre. Ele é desativado quando o usuário remove a seleção, quando a aposta é concluída, quando a campanha de boost termina — e por caminhos dentro da plataforma da Altenar que não passam pelo nosso código.

O módulo que hoje roda no host resolve isso lendo `localStorage['WSDK_startbet_betSelections']`, onde a SPA da Altenar persiste o bilhete, e reagindo a mudanças por três vias: um interceptor em `Storage.prototype` (o evento nativo `storage` **não** dispara na aba que escreveu, e a Altenar escreve na mesma aba), o evento `storage` para outras abas, e `visibilitychange`.

**O widget não consegue fazer isso.** O `localStorage` do host é inacessível de outra origem. Não é uma questão de esforço — é a fronteira do navegador, a mesma que exige o `postMessage`.

Então o estado tem que **atravessar o bridge**. O host continua sendo o único leitor do estado da Altenar, porque é o único que pode ser, e publica as mudanças para o widget.

**Regra de casamento — medida, não deduzida.** O comentário do store dizia que para card simples a Altenar grava o `selectionId` e para card BB grava o id do **bet card**. A POC casou por `[cardId, ...oddIds]` para descobrir qual aparece, e a resposta veio:

```
ids ativos: 17273263          ← o cardId
NO BILHETE — casou pelo id 17273263 (cardId)
```

Os `selectionId` das três pernas (`4482652839`, `4482652762`, `4491831241`) **não aparecem**. Um widget que casasse só por `selectionId` ficaria permanentemente apagado nos cards BB — que são justamente a maioria das odds turbinadas.

O contrato tem que carregar os dois e casar pela união.

## O que isso impõe ao contrato

O handshake deixa de ser opcional. O widget precisa de um retrato do estado ao montar — não só das mudanças seguintes —, porque ele pode recarregar a qualquer momento com o bilhete já cheio.

Fica assim:

1. Widget anuncia `ready` ao montar
2. Host responde com o retrato do estado atual
3. Host publica de novo a cada mudança do bilhete

O passo 3 sozinho não basta, e o passo 2 sozinho também não.

## A volta, validada

Matriz rodada com o host em `localhost:3000/sports` e o widget em `localhost:5180`:

| Cenário                                        | Resultado                                       |
| ---------------------------------------------- | ----------------------------------------------- |
| Clicar no botão do widget                      | acende, **9.00 turbinada**, casa pelo `cardId`  |
| Desmarcar pelo card nativo                     | apaga                                           |
| **Recarregar só o iframe com o bilhete cheio** | **volta aceso** — o retrato no `ready` funciona |
| Sair de `/sports` e voltar pela navegação SPA  | `ready` dispara de novo, estado reconstruído    |
| Carga inicial da página, do zero               | falhava; passa com as duas metades do handshake |

Um detalhe que o teste entregou de brinde: o carrossel tinha **dois cards do mesmo jogo** — um simples (2.00 → 2.30) e o BB (8.00 → 9.00). O host escolheu o BB. É a prova de que os desambiguadores `isBB` e `boostedOdd` não são zelo excessivo: sem eles o clique cairia no card errado, e esse empate acontece na prática.

## A corrida do handshake é real, e aparece na primeira carga

O `ready` enviado uma vez no mount **se perde na carga inicial da página**. Nenhum log `[poc]`, bridge mudo, widget permanentemente apagado.

O motivo é ordem: o iframe está no topo da página e carrega cedo; o `AltenarFrame` monta depois, com SSR, hidratação e carregamento do SDK pelo caminho. Quando o widget anuncia, não há ninguém escutando.

Confirmado por eliminação: recarregando **só o iframe**, com o host já montado, o handshake fecha na hora. E na navegação SPA também funciona, porque ali o iframe remonta junto com a página, depois do host.

Ou seja, o caminho que falha é justamente o mais comum: **o usuário abrindo a página**.

Duas correções, as duas implementadas e validadas:

- **Widget:** repete o `ready` a cada 400ms, até 20 tentativas, parando no primeiro `betslip:state`
- **Host:** anuncia `host:ready` ao registrar o listener, derivando a origem do `src` de cada `<iframe>` da página em vez de varrer `window.frames` — assim acerta só os nossos e não gera aviso de `postMessage` nos outros

Com as duas, a carga inicial passa:

```
[st-widget][poc] host se anunciou
[poc][host]      widget pronto http://localhost:5180
[st-widget][poc] estado do bilhete {activeIds: [17273263], boostIds: [17273263]}
```

Na prática foi o anúncio do host que fechou o handshake — ele monta depois e encontra o widget já esperando. A repetição do lado do widget cobre a ordem inversa, que é a que vai acontecer quando o back office injetar a tag depois da página montada. **Nenhuma das duas sozinha cobre todas as ordens de carga.**

Depois do handshake o tráfego cessa: a repetição para e nada mais é publicado até o bilhete mudar.

**Observação menor:** cada mudança de estado publica duas vezes. Uma vem da resposta ao `ready`, outra do `watch` disparado pelo `parse()` no mount. É idempotente e inofensivo, mas na implementação definitiva vale publicar só quando o payload muda de fato.

## Pendências que a POC abriu

- **Substituto para o clique no card nativo**, para quando a carousel da Altenar sair da página. Assunto para a Altenar, e bloqueia o plano de desligar o widget nativo
- **O que fazer quando o card não é encontrado** — hoje cai em silêncio na odd base, com preço menor
- **Corrida do handshake** — o `ready` único se perde na carga inicial; precisa de repetição no widget e de `host:ready` no host
- **Origem do pai resolvida uma vez** — feito na POC via `location.ancestorOrigins`, com emissão para a allowlist como fallback (Firefox não tem a API). O aviso de `postMessage` no console do host sumiu
- **`betslip:remove`** — o card ativo sugere que clicar de novo remove; a POC não cobriu isso
- **Sandbox do `<iframe>`** — a tag será colada pelo back office, fora do nosso controle, e um atributo `sandbox` restritivo desliga o `postMessage` sem aviso

## O que era só da POC

Não vai para lugar nenhum: o card fixo no código, a allowlist fixa no host, o botão no `BoostsWidget`, e os `console.log` dos dois lados. O que sobrevive é este documento.
