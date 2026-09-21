# Integração

O que precisa estar configurado para um widget funcionar dentro da página do site, e o que quebra quando não está.

Escrito para o momento de embutir os widgets pelo back office da Altenar. Quem for colar a tag, quem configurar o deploy do `front-startbet` e quem cuidar do CloudFront usam este documento.

## As três configurações que precisam concordar

Não é uma allowlist, são três — em três lugares diferentes, mantidas por times diferentes. Todas dependem do ambiente e todas precisam apontar para a mesma dupla de origens.

| #   | Onde                                     | Quem mantém        | O que controla                       |
| --- | ---------------------------------------- | ------------------ | ------------------------------------ |
| 1   | `frame-ancestors` no CloudFront          | infraestrutura     | se o iframe **renderiza**            |
| 2   | `VITE_HOST_ORIGINS` no `st-widgets`      | este repositório   | de quem o widget **aceita** mensagem |
| 3   | `ST_WIDGETS_ORIGINS` no `front-startbet` | aquele repositório | de quem o host **aceita** mensagem   |

Repare na direção: **1 e 2 listam a origem do site; 3 lista a origem do widget.** Apontam para lados opostos, e trocar isso é o engano mais fácil de cometer.

### Os valores

|                          | dev                                      | produção                             |
| ------------------------ | ---------------------------------------- | ------------------------------------ |
| Origem do site (host)    | `https://start-dev.cometagaming.com`     | `https://start.bet.br`               |
| Origem do widget         | `https://supermultipla-dev.start.bet.br` | `https://supermultipla.start.bet.br` |
| 1 · `frame-ancestors`    | origem do site                           | origem do site                       |
| 2 · `VITE_HOST_ORIGINS`  | origem do site                           | origem do site                       |
| 3 · `ST_WIDGETS_ORIGINS` | origem do widget                         | origem do widget                     |

Em desenvolvimento local as duas origens viram `http://localhost:3000` e `http://localhost:5180`.

**1 e 2 já estão configurados** nos dois ambientes — o CloudFront pelo time de infraestrutura, o `VITE_HOST_ORIGINS` nos GitHub Environments deste repositório. **O 3 é novo** e precisa entrar no deploy do `front-startbet`, como `NUXT_PUBLIC_ST_WIDGETS_ORIGINS` ou `ST_WIDGETS_ORIGINS`.

Fora de produção o `front-startbet` cai em `http://localhost:5180` por default. Em produção o default é vazio, de propósito: sem a variável configurada o bridge fica inerte, e falhar fechado é melhor do que herdar um `localhost` que ninguém lembra de tirar.

### Pode colocar as três origens em todos os ambientes?

Funciona, e em **dev** é razoável — incluir `http://localhost:5180` no `ST_WIDGETS_ORIGINS` de dev poupa configuração e o risco é baixo.

Em **produção, não.** A lista é controle de segurança: cada origem a mais é alguém a mais autorizado a mexer no bilhete do usuário. A de produção leva uma origem só.

## Como cada erro se manifesta

Todos falham em silêncio, o que os torna caros de diagnosticar. Por isso a tabela:

| Configuração errada  | Sintoma                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `frame-ancestors`    | o iframe não desenha; o console do **host** mostra "Refused to display … because an ancestor violates" |
| `VITE_HOST_ORIGINS`  | o widget carrega e mostra os dados, mas clicar não faz nada; nenhum erro em lugar nenhum               |
| `ST_WIDGETS_ORIGINS` | idem — widget carrega, clique não faz nada, nenhum erro                                                |

A distinção prática: **se o widget aparece, o item 1 está certo.** Se aparece e não reage, é o 2 ou o 3.

Para separar os dois, abra o widget com `?debug=1`: ele passa a logar o que envia e recebe. Se ele registra envio e nunca recebe `betslip:state`, o host não está aceitando — é o item 3. Se nem envia, é o 2.

## A tag do iframe

O snippet que vai no slot do back office:

```html
<iframe
  src="https://supermultipla.start.bet.br/boosts.html?theme=dark"
  title="Odds turbinadas"
  scrolling="no"
  style="border: 0; width: 100%; height: 304px;"
></iframe>
```

Trocando `boosts.html` por `top-league.html` e a altura conforme o widget.

### Atenção: `sandbox` quebra o bridge

Se alguém acrescentar o atributo `sandbox` à tag, duas coisas podem acontecer:

- **`sandbox` sem `allow-scripts`** — o widget não executa nada. Tela em branco
- **`sandbox` com `allow-scripts` mas sem `allow-same-origin`** — pior, porque parece funcionar: o widget renderiza e busca dados normalmente, mas a origem dele passa a ser **opaca**. O host recebe as mensagens com `event.origin` igual à string `"null"`, que nunca vai casar com a allowlist. O bridge morre em silêncio

Como a tag é colada por quem administra o back office, e não por nós, isso precisa estar escrito na especificação entregue a essa pessoa: **a tag não leva `sandbox`.**

### O resto dos atributos também é deles

`height`, `width` e os parâmetros da URL (`theme`, `betCardListId`, `limit`) são definidos na tag. Mudar qualquer um depende de quem tem acesso ao back office — vale ter um contato nomeado antes de precisar com pressa.

A altura é fixa nesta primeira versão, por decisão de design. Se o conteúdo passar dela, é cortado em silêncio: com `scrolling="no"` não aparece barra de rolagem.

## O que o back office não afeta

Vale registrar para evitar preocupação à toa: **o back office só injeta a tag.** Ele não muda origem nenhuma.

A origem do widget é o domínio no `src`. A origem do host é a página do site. As três allowlists continuam valendo igual, independente de a tag ter sido colada pelo painel da Altenar ou escrita no código do `front-startbet`. Foi assim que os testes locais aconteceram, com a tag no código, e o comportamento é o mesmo.

## Uma pergunta em aberto

Se outra marca do grupo — EstrelaBet, por exemplo — for embutir **estes mesmos** widgets, nada disso funciona como está: o `frame-ancestors` e o `VITE_HOST_ORIGINS` listam só as origens da Start Bet.

As saídas seriam ampliar as duas listas ou publicar um conjunto de widgets por marca. É decisão de produto e de infraestrutura, não técnica, mas melhor decidir antes de alguém tentar.
