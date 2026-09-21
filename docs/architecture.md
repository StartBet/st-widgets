# Arquitetura

Decisões de estrutura do `st-widgets`, tomadas antes do primeiro widget real. O que está aqui vale como contrato entre quem escreve os widgets; mudar exige mudar este documento junto.

O escopo imediato são dois widgets: **boosts** e **top-league**. O horizonte é um catálogo grande, cobrindo boa parte do que hoje são widgets nativos da Altenar.

## Os dois primeiros widgets, e por que esse par

Eles caem em perfis opostos, e é isso que os torna úteis para desenhar:

|                        | boosts                                      | top-league                         |
| ---------------------- | ------------------------------------------- | ---------------------------------- |
| Origem dos dados       | `/api/BetCards/GetBetCards`                 | `/api/widget/GetFavouritesChamps`  |
| Natureza da lista      | curada no back office (`betCardListId`)     | curada no back office (favourites) |
| Volatilidade           | alta — odds mudam                           | baixa — ligas quase não mudam      |
| Intenção principal     | adicionar ao bilhete                        | navegar para a liga                |
| Mecanismo no host      | clique simulado no card nativo, **sem API** | rota normal                        |
| Frequência no catálogo | exceção                                     | regra                              |

O boosts é o widget mais valioso para o produto e o mais esquisito tecnicamente. O top-league é o mais representativo do que virá depois.

**A arquitetura é desenhada pelo top-league e acomoda o boosts como exceção**, não o contrário. Desenhar pelo caso raro produziria abstrações tortas para os outros dez widgets. O que a POC descobriu sobre o boosts está em [bridge-poc.md](bridge-poc.md) e continua valendo — só não vira o molde.

## Restrições que não são escolhas

Antes das decisões, o que o ambiente impõe. Nenhum destes itens é negociável por esforço de engenharia.

**O widget roda cross-origin.** Ele não lê o DOM do host, não lê o `localStorage` do host, não chama funções do host. Tudo que atravessa passa por `postMessage`.

**O widget nunca fala com o WSDK.** O SDK da Altenar vive na página do host. Não existe, e não vai existir, cliente do WSDK dentro deste projeto. O widget emite intenções; quem executa é o host.

**A Altenar tem dois hosts, e eles se comportam de formas opostas.** Medido:

| Host                                              | CORS                             | Consequência           |
| ------------------------------------------------- | -------------------------------- | ---------------------- |
| `sb2frontend-altenar2.biahosted.com/api/widget/*` | `access-control-allow-origin: *` | o widget chama direto  |
| `sb2datafeedexport-altenar2.biahosted.com`        | não envia                        | exige proxy pelo Nitro |

Uma versão anterior deste documento dizia que o widget nunca falaria com a Altenar direto. Isso valia para a DataFeed e foi generalizado para o fornecedor inteiro, sem conferir o outro host — errado.

**Toda `VITE_*` é pública.** O Vite as compila dentro do bundle. Nenhum segredo entra aqui; credencial fica no Nitro.

**Não controlamos a tag `<iframe>`.** Ela é colada no back office da Altenar, por outra equipe. Altura, atributos e parâmetros de URL são definidos lá fora.

**A altura é fixa nesta primeira versão**, por decisão de design. Widgets em carrossel mantêm a mesma altura entre breakpoints.

## As fronteiras

Quatro, e só quatro. Cada uma existe porque um vazamento nela custa caro depois.

### 1. A montagem é fina e descartável

`createWidget()` e o `<nome>.html` são a camada de montagem. O componente do widget **não sabe** que existe uma página só para ele.

Regra prática: **`main.ts` é uma linha.** No dia em que alguém puser lógica ali, o widget ficou preso ao modo uma-página-por-widget.

Isso é o que mantém barato o cenário distante de a aplicação passar a ser construída por rotas: os componentes são reaproveitados inteiros e só a montagem muda. Não estamos construindo nada para esse cenário hoje — estamos só não fechando a porta.

### 2. O widget não conhece a Altenar

A fronteira mais importante, e a mais fácil de furar — a POC furou.

Lá, o componente montava `{ isBB, boostTeams, boostedOdd }` na mão. Isso é conhecimento do mecanismo interno da Altenar dentro de um componente de interface. Com dez widgets, esse conhecimento se espalha por dez arquivos e qualquer mudança da Altenar vira uma caçada.

O desenho correto tem três papéis:

- **O mapeador** (camada de dados) traduz a resposta bruta em modelo de domínio, e produz uma **referência de seleção opaca**
- **O componente** repassa essa referência sem abrir
- **O host** é o único que a interpreta

Na prática: o componente diz "adiciona isto", nunca "adiciona um bet builder de preço turbinado 9 do jogo Flamengo x Independiente". Quando a Altenar mudar o mecanismo — e a POC mostrou que ele é frágil o bastante para mudar —, mexe-se no mapeador e no adaptador do host. Nenhum componente é tocado.

### 3. A ponte é um módulo, não código de widget

Na POC o `postMessage` estava dentro do `BoostsWidget`. Com dez widgets isso vira dez handshakes, cada um com um bug diferente.

A ponte se divide em duas partes:

**Transporte, genérico e estável** — resolução da origem do pai, validação de `event.origin`, o handshake de duas metades (o widget repete o `ready`, o host anuncia `host:ready`), namespace, versão. Nada disso é específico de widget e nada disso muda quando um widget novo entra.

**Catálogo de mensagens, tipado e versionado** — os tipos de intenção e de estado. Cresce a cada widget.

O componente consome via composable e **nunca toca em `postMessage`**.

Duas regras do contrato:

- **Intenção carrega id de domínio, nunca URL.** O top-league manda "abrir a liga 42", não `/sport/championship/42`. A estrutura de rotas é assunto do host e vai mudar sem nos avisar
- **Mensagem sempre versionada.** Widget e host têm deploys independentes; em algum momento o widget será mais novo que o site

O handshake de duas metades não é zelo: a POC mostrou que a metade única falha justamente na carga inicial da página, que é o caminho mais comum. E quando a tag vier do back office, o momento da injeção deixa de ser previsível.

### 4. Um cliente de dados, recursos por widget

Um cliente HTTP genérico — URL, erro, cancelamento — e um módulo de recurso por widget, que sabe qual endpoint chamar e como mapear a resposta.

Sem store global: os widgets não compartilham estado e nem se enxergam. Cada página é um documento isolado.

Sem polling na primeira versão. Quando aparecer a necessidade (odds ao vivo), o lugar é a camada de recurso, não o componente.

**A origem dos dados é a API de widgets da Altenar, direto.** O Nitro do `front-startbet` fica como exceção, para o que só existir na DataFeed.

O motivo é coerência com o resto do desenho. O `st-widgets` é publicado como site estático independente — domínio, pipeline e distribuição próprios, sem backend. Rotear os dados pelo Nitro criaria uma dependência de runtime do deploy de outro time a cada carregamento de widget: a aplicação pareceria autônoma sem ser. Também apaga uma pendência do documento de publicação, já que o Nitro não precisa mais liberar CORS para o domínio dos widgets.

O que o Nitro daria de valioso — um ponto único que conhece a forma da resposta — já é o **mapeador** de cada recurso, dentro deste projeto. A fronteira não se perde; ela só muda de lugar.

Duas coisas para acompanhar, nenhuma bloqueante:

- **O `/api/widget/*` não é versionado nem documentado publicamente** — é o que a SPA da Altenar consome. O `front-startbet` já depende dele para as bet cards, então o risco não é novo; ainda assim vale confirmar com a Altenar se consideram estável
- **Carga.** Pelo Nitro, N usuários viravam uma chamada por período de cache; direto, cada navegador chama, com os 15s de `Cache-Control` que a própria Altenar envia. Se virar problema, a saída é pôr cache na frente — não voltar a depender do Nitro

## Parâmetros: dois níveis

Hoje o `readParams()` devolve uma forma fixa e global. Com dez widgets isso vira um balaio — cada um querendo `listId`, `sportId`, `count`, `marketId`.

A divisão:

- **Globais do shell** — `theme`, `integration`, `debug`, `mobilePaddingInline`. Valem para todos e são lidos pelo `WidgetShell`
- **Do widget** — declarados e validados pelo próprio widget, num esquema tipado

Isso importa mais do que parece porque **quem preenche esses parâmetros é o back office**, fora do nosso alcance. Um parâmetro ausente ou malformado precisa cair num default previsível em vez de quebrar a página.

## Estrutura

```
<nome>.html              entrada do widget (uma por widget, na raiz)
index.html               catálogo de desenvolvimento, fora do build
build/                   helpers do Vite
src/
  app/                   bootstrap: createWidget, WidgetShell, contexto
  bridge/                transporte + catálogo de mensagens
  api/                   cliente do Nitro + estado de carga (useResource)
  config/                env tipado e parâmetros globais
  styles/
  widgets/<nome>/        main.ts + componente + params, recurso e mapeador
```

A regra para decidir onde algo mora: **se dois widgets vão precisar, sobe; se é de um só, fica em `widgets/<nome>/`.** Na dúvida, fica no widget — mover para cima depois é barato, desmontar uma abstração errada não é.

## O que não vamos construir agora

- **Registry ou sistema de plugins de widgets.** Com dois widgets é adivinhação
- **Gerenciador de estado global.** Não há estado compartilhado
- **Abstração da API da Altenar.** Esperar o terceiro widget — com dois, extrai-se a semelhança errada
- **Modo rotas.** Só não fechamos a porta (fronteira 1)
- **Resize pelo bridge.** A altura é fixa por decisão de design; quando mudar, entra como tipo novo de mensagem, sem quebrar o contrato

Regra dos três: extrair na terceira repetição, não na primeira.

## Em aberto

- **O mecanismo do boosts depende do widget nativo da Altenar estar na página.** Se o plano é desligar os widgets nativos, isso precisa de resposta da Altenar antes. Registrado em [bridge-poc.md](bridge-poc.md)
- **Nome do arquivo de cada widget** vira contrato com o back office no instante em que a tag é colada. Decidir antes do primeiro embed
- **Estados de carregamento, vazio e erro** — provavelmente um componente compartilhado no shell, mas a forma certa só aparece com os dois widgets escritos
