# Publicação

Documento de referência para o time de infraestrutura. Descreve como o `st-widgets` é publicado, por que o desenho é este e o que está provisionado na AWS.

## Resumo

Duas branches, dois ambientes, dois buckets, duas distribuições:

| Branch | Ambiente | Domínio                          | Bucket            | GitHub Environment |
| ------ | -------- | -------------------------------- | ----------------- | ------------------ |
| `dev`  | dev      | `supermultipla-dev.start.bet.br` | `st-widgets-dev`  | `dev`              |
| `main` | produção | `supermultipla.start.bet.br`     | `st-widgets-prod` | `production`       |

O artefato é estático: o `npm run build` gera um `dist/` com uma `.html` por widget na raiz e os assets com hash em `assets/`. Não há servidor, runtime nem processo. O deploy é copiar arquivos para o S3 e invalidar o CloudFront.

A promoção para produção é o merge `dev` → `main`.

## Sobre as variáveis de ambiente

**Nenhuma variável deste projeto é segredo, e nenhuma pode vir a ser.**

O Vite compila as variáveis com prefixo `VITE_` dentro do bundle durante o build. Elas não são lidas em tempo de execução — viram string literal no JavaScript entregue ao navegador, legível por qualquer pessoa no devtools. Isso vale em qualquer hospedagem.

As variáveis do projeto, definidas em `src/config/env.ts`:

| Variável                   | Conteúdo                              | Sensível |
| -------------------------- | ------------------------------------- | -------- |
| `VITE_ALTENAR_INTEGRATION` | nome da skin da Altenar               | não      |
| `VITE_API_BASE_URL`        | origem pública da API                 | não      |
| `VITE_HOST_ORIGINS`        | allowlist de origens do `postMessage` | não      |
| `VITE_DEFAULT_THEME`       | tema default                          | não      |

Consequências para o desenho:

1. **Cada ambiente é um build distinto.** Não existe um artefato único reconfigurado por ambiente: os valores ficam embutidos no bundle. O pipeline constrói uma vez por ambiente, com os valores daquele ambiente.
2. **Segredo de verdade não entra no widget.** Token da Altenar, chave de API ou qualquer credencial ficam no Nitro do front-startbet, que já é o nosso backend-for-frontend e já faz cache das rotas da Altenar. O widget fala com o Nitro; o Nitro fala com quem tem segredo.
3. **A hospedagem não precisa oferecer gestão de segredos.** Esse requisito não existe aqui.

Os valores ficam em **GitHub Environments** (`dev` e `production`), como _variables_ — não como _secrets_. Ficam versionados junto do repositório, com histórico de quem mudou o quê, e sob as regras de proteção do próprio environment.

`.env.production` e `.env.dev` **não são commitados**. O Vite também lê variáveis `VITE_*` do ambiente do processo, então elas chegam ao build direto do GitHub Environment. O `.env.development` continua servindo o `npm run dev` local e o `.env.example` continua como documentação.

> **Atenção ao `--mode`.** Os dois ambientes rodam **build de produção**. Não usar `--mode development` para o ambiente de dev: isso desliga minificação e muda o comportamento do bundle. O que difere entre os ambientes são apenas os valores injetados.

## Por que S3 + CloudFront, e não Amplify

O Amplify entrega o modelo "branch = ambiente" pronto e é uma escolha defensável. A recomendação por S3 + CloudFront se apoia em quatro pontos:

**Controle de headers.** O widget roda dentro de `<iframe>`, embutido nas páginas do site. Isso torna dois headers críticos: não pode sair `X-Frame-Options`, e precisa sair um `Content-Security-Policy: frame-ancestors` com a lista exata de quem pode embutir. No CloudFront isso é uma _Response Headers Policy_: declarativa, versionada, revisável.

**Controle de cache.** Widget em iframe tem uma exigência específica — o `.html` precisa ser revalidado a cada carga, senão o host continua servindo a versão anterior depois do deploy. Os assets, que têm hash no nome, podem ser imutáveis por um ano. São políticas diferentes por padrão de arquivo, o terreno natural do CloudFront.

**Um único pipeline.** O `.github/workflows/build.yml` já roda lint, formatação, cobertura e build. Com Amplify o build aconteceria de novo no runner da AWS, em dois lugares que podem divergir. Aqui o deploy é um job a mais no mesmo workflow, depois do portão de qualidade.

**Sem credencial de longa duração.** O GitHub assume uma role na AWS por OIDC, com token efêmero. Nenhuma `AWS_ACCESS_KEY_ID` guardada.

**Quando reconsiderar:** se o time não gerencia CloudFront por código hoje e não pretende passar a gerenciar, o custo de provisionamento pesa e o Amplify volta a ser competitivo. A pergunta que decide é se já existe distribuição CloudFront provisionada por IaC em outros projetos da StartBet.

## Infra provisionada

Entregue e testada pelo time de infraestrutura nos dois ambientes.

|                   | dev                                                | produção                                            |
| ----------------- | -------------------------------------------------- | --------------------------------------------------- |
| URL               | `https://supermultipla-dev.start.bet.br`           | `https://supermultipla.start.bet.br`                |
| Bucket            | `st-widgets-dev`                                   | `st-widgets-prod`                                   |
| Distribuição      | `EHZS07M1IQ2IM`                                    | `E341JJ1RNTO8J9`                                    |
| Role              | `arn:aws:iam::538039268943:role/gh-st-widgets-dev` | `arn:aws:iam::538039268943:role/gh-st-widgets-prod` |
| Região            | `sa-east-1`                                        | `sa-east-1`                                         |
| `frame-ancestors` | `https://start-dev.cometagaming.com`               | `https://start.bet.br`                              |

Nos dois: bucket privado com OAC, HTTPS obrigatório, TLS 1.2+, HTTP/2 e HTTP/3, versionamento com expiração das versões antigas em 90 dias, cache policy `CachingOptimized` (respeita o `Cache-Control` do upload) e os headers de segurança abaixo — sem `X-Frame-Options`, que o código também não deve emitir.

Esta tabela é referência. Quem alimenta o workflow são as _variables_ do GitHub Environment; se divergirem, valem as variables.

As roles só aceitam token OIDC cujo `sub` seja `repo:StartBet/st-widgets:environment:dev` ou `:environment:production`. Na prática isso torna obrigatórios, no job de deploy, o `environment:` com exatamente esses nomes e o `permissions: id-token: write` — sem os dois, a autenticação falha.

## O que foi provisionado, em detalhe

Por ambiente:

**S3.** Bucket privado, sem _static website hosting_, sem acesso público. O acesso vem do CloudFront por OAC.

**CloudFront.** Distribuição com o bucket como origem via **Origin Access Control**, HTTPS obrigatório (redirect de HTTP), compressão ligada.

**ACM.** Certificado para o domínio do ambiente, emitido em **`us-east-1`** — o CloudFront só aceita certificado dessa região.

**Route 53.** Registro `A`/`ALIAS` apontando o domínio para a distribuição.

**Response Headers Policy:**

Em produção:

```
Content-Security-Policy: frame-ancestors https://start.bet.br
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

Em dev, o `frame-ancestors` troca para `https://start-dev.cometagaming.com`. Cada distribuição tem a sua policy: a de produção não deve listar a origem de dev.

É a mesma origem do `VITE_HOST_ORIGINS`, e pela mesma razão — quem embute é a página do site, não a Altenar. Sem `www` nos dois ambientes; o teste que confirmou isso está em _Configuração no GitHub_.

Sem `X-Frame-Options` — o header legado, se presente, vence o `frame-ancestors` em alguns navegadores e quebra o embed.

**Política de cache**, aplicada no `Cache-Control` durante o upload:

| Padrão     | `Cache-Control`                       | Motivo                                  |
| ---------- | ------------------------------------- | --------------------------------------- |
| `assets/*` | `public, max-age=31536000, immutable` | nome contém hash do conteúdo            |
| `*.html`   | `no-cache`                            | precisa refletir o deploy imediatamente |

**IAM.** Um provider OIDC do GitHub na conta e uma role por ambiente.

Trust policy — o `sub` é escopado ao _environment_, não à branch, porque o job de deploy declara `environment:`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:StartBet/st-widgets:environment:production"
        }
      }
    }
  ]
}
```

Permissões mínimas da role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::st-widgets-prod"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::st-widgets-prod/*"
    },
    {
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
    }
  ]
}
```

## Configuração no GitHub

Dois environments, `dev` e `production`. No `production`, restringir o _deployment branch_ a `main`.

_Variables_ de cada environment:

| Nome                       | `dev`                                | `production`                |
| -------------------------- | ------------------------------------ | --------------------------- |
| `VITE_ALTENAR_INTEGRATION` | `startbet`                           | `startbet`                  |
| `VITE_API_BASE_URL`        | `https://start-dev.cometagaming.com` | `https://start.bet.br`      |
| `VITE_HOST_ORIGINS`        | `https://start-dev.cometagaming.com` | `https://start.bet.br`      |
| `VITE_DEFAULT_THEME`       | `dark`                               | `dark`                      |
| `AWS_ROLE_ARN`             | `…:role/gh-st-widgets-dev`           | `…:role/gh-st-widgets-prod` |
| `AWS_REGION`               | `sa-east-1`                          | `sa-east-1`                 |
| `AWS_S3_BUCKET`            | `st-widgets-dev`                     | `st-widgets-prod`           |
| `AWS_CLOUDFRONT_ID`        | `EHZS07M1IQ2IM`                      | `E341JJ1RNTO8J9`            |

Todas são _variables_, não _secrets_ — nenhuma é sensível, e mantê-las visíveis evita a falsa sensação de proteção. ARN de role e id de distribuição não são segredo: sem o OIDC do repositório, não servem para nada.

`AWS_REGION` é `sa-east-1` nos dois ambientes, porque é onde os buckets vivem. Não confundir com o `us-east-1` do certificado ACM: aquela região é imposta pelo CloudFront e vale só para o certificado, não para as chamadas de S3 do deploy.

`VITE_API_BASE_URL` aponta para o front-startbet do ambiente, porque é o Nitro dele que serve as rotas de dados — não existe domínio separado de API. Sem barra no final e sem caminho: o `trimSlash` de `src/config/env.ts` normaliza, mas o valor certo já entra limpo.

Note que o ambiente de dev vive em outro domínio registrável (`cometagaming.com`, não `bet.br`). Para requisição de leitura com CORS isso é indiferente, mas se a camada de dados um dia precisar mandar cookie, o navegador vai tratar como contexto _cross-site_ e exigir `SameSite=None; Secure`. Vale saber agora para não descobrir depois.

`VITE_HOST_ORIGINS` leva **uma origem só**: a da página que embute o widget. Não entra a origem do próprio widget, e não entra nenhuma origem da Altenar — o porquê está na seção seguinte.

> **Sem `www`, verificado.** Comparação de origem é string exata, e a errada quebra o bridge sem emitir erro. `www.start.bet.br` responde `302` para o apex, e `www.start-dev.cometagaming.com` sequer resolve — as duas origens canônicas são sem `www`. Para repetir o teste: `curl -sIL https://<host> | grep -iE "^HTTP/|^location:"` nas duas variantes; a que responde `200` sem redirecionar é a boa. A barra de endereço do navegador serve, mas Chrome e Edge escondem o `www.` visualmente, então o `curl` é mais confiável.

## Topologia do embed

O widget fica num `<iframe>` embutido **direto na página do site**. Não há iframe intermediário da Altenar: o sportsbook dela é um SDK JavaScript (`altenarWSDK.js`) carregado na própria página, então boletim e catálogo vivem no mesmo documento que nos embute.

Isso foi verificado no widget equivalente da EstrelaBet, que usa esta mesma arquitetura. Rodando `location.ancestorOrigins` dentro do iframe do widget:

```
DOMStringList { 0: "https://www.estrelabet.bet.br", length: 1 }
```

Uma origem só, e é a do site.

Duas consequências:

**O back office não entra em lugar nenhum.** Ele é o painel administrativo onde o HTML do embed é colado; em tempo de execução não aparece. Nem no `VITE_HOST_ORIGINS`, nem no `frame-ancestors`.

**O host já tem o SDK da Altenar em mãos.** Quando o bridge existir, o handler de `postMessage` do lado da página traduz a intenção do widget em chamada do WSDK — o widget descreve, o host executa com o que já tem carregado.

Para repetir a verificação no nosso ambiente: abrir a página do site onde o widget está embutido, trocar o contexto do console do DevTools para o frame do widget e rodar `location.ancestorOrigins`. O que voltar é o valor da variável.

## O workflow

Duas mudanças em `.github/workflows/build.yml`.

**1. Incluir a `dev` no gatilho.** Hoje o workflow só dispara em push na `main` e em pull requests, então a `dev` não roda nada:

```yaml
on:
  push:
    branches:
      - main
      - dev
  pull_request:
    types: [opened, synchronize, reopened]
```

**2. Acrescentar o job `deploy`:**

```yaml
deploy:
  name: Deploy
  needs: quality
  if: github.event_name == 'push'
  runs-on: ubuntu-latest
  environment: ${{ github.ref_name == 'main' && 'production' || 'dev' }}
  concurrency:
    group: deploy-${{ github.ref_name }}
    cancel-in-progress: false
  permissions:
    id-token: write
    contents: read
  steps:
    - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
    - name: Install dependencies
      run: npm ci --ignore-scripts
    - name: Build
      run: npm run build
      env:
        VITE_ALTENAR_INTEGRATION: ${{ vars.VITE_ALTENAR_INTEGRATION }}
        VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}
        VITE_HOST_ORIGINS: ${{ vars.VITE_HOST_ORIGINS }}
        VITE_DEFAULT_THEME: ${{ vars.VITE_DEFAULT_THEME }}
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ vars.AWS_ROLE_ARN }}
        aws-region: ${{ vars.AWS_REGION }}
    - name: Upload assets
      run: |
        aws s3 sync dist/assets "s3://${{ vars.AWS_S3_BUCKET }}/assets" \
          --cache-control "public,max-age=31536000,immutable"
    - name: Upload HTML
      run: |
        aws s3 sync dist "s3://${{ vars.AWS_S3_BUCKET }}" \
          --delete \
          --exclude "assets/*" \
          --cache-control "no-cache"
    - name: Invalidate CloudFront
      run: |
        aws cloudfront create-invalidation \
          --distribution-id "${{ vars.AWS_CLOUDFRONT_ID }}" \
          --paths "/*"
```

Quatro detalhes que não são óbvios:

**Por que o job reconstrói.** O build do job `quality` é uma validação: prova que o código compila, sem variáveis de ambiente. O build do `deploy` é o artefato real, com os valores do ambiente embutidos. São builds com propósitos diferentes — reaproveitar o primeiro publicaria um bundle com os valores errados.

**Por que dois `aws s3 sync`.** Cada passo aplica um `Cache-Control` diferente. A ordem importa: assets primeiro, HTML depois, para que nunca exista um `.html` publicado apontando para um asset que ainda não subiu.

**Por que `--delete` só no HTML.** Apagar os assets antigos junto com o upload quebra quem está com a página **já aberta**: o navegador segue referenciando os arquivos da versão anterior, e eles somem embaixo dele no meio da sessão. Por isso os assets sobem sem `--delete` e acumulam, enquanto o `--delete` fica no passo do HTML, com `--exclude "assets/*"` — ali limpar é seguro, e é o que remove do bucket o `.html` de um widget descontinuado.

**Por que `concurrency` sem `cancel-in-progress`.** Dois deploys simultâneos na mesma branch podem intercalar uploads e deixar o bucket num estado misto. Cancelar um deploy no meio tem o mesmo efeito — por isso eles são enfileirados, não cancelados.

Sobre a invalidação: o `--paths` do CloudFront só aceita `*` no fim do caminho, então `"/*.html"` é inválido. `"/*"` invalida tudo, o que é barato aqui — os assets têm hash no nome e nunca são rebaixados por uma invalidação.

## Verificação pós-deploy

```bash
curl -sI https://supermultipla-dev.start.bet.br/boosts.html
```

Conferir: `200`, `cache-control: no-cache`, presença de `content-security-policy` com `frame-ancestors` e ausência de `x-frame-options`. Num arquivo de `assets/`, conferir `cache-control: public, max-age=31536000, immutable`.

Depois, abrir a página num `<iframe>` a partir de uma origem autorizada e confirmar que não há bloqueio no console.

## Pendências antes do primeiro deploy

- **Nome do primeiro widget.** O smoke test combinado com a infraestrutura aponta para `apostas-aumentadas.html`, mas o build hoje gera `boosts.html` — o único widget que existe. Alinhar o nome antes do primeiro deploy, senão o teste dá 404 por motivo errado.
- **Raiz do domínio.** O `index.html` é catálogo de desenvolvimento e está excluído do build de produção: o `dist/` tem apenas `boosts.html` e `assets/`. Hoje `https://supermultipla.start.bet.br/` não resolve para nada. Decidir entre uma página mínima, um redirect ou um 404 tratado — com OAC, objeto ausente retorna `403`, então é preciso um _custom error response_ para virar um 404 apresentável.
- ~~**CORS no Nitro.**~~ Resolvido por não existir mais: a camada de dados chama a API de widgets da Altenar direto, e aquele host já responde `access-control-allow-origin: *`. O Nitro volta ao radar só se algum widget precisar de dado que só exista na DataFeed. Ver `docs/architecture.md`.
- ~~**CSP da página hospedeira.**~~ Registrei aqui que o `connect-src 'none'` visto no host da EstrelaBet poderia derrubar a nossa camada de dados. Errado: CSP vale por documento, e o iframe é um documento próprio, com o CSP que nós mesmos servimos pelo CloudFront. A política da página que embute não alcança as requisições feitas de dentro do widget.
- **Peso das fontes.** `base-neue-condensed.css` declara 18 pesos em TTF e o build emite todos (~2,2 MB). O navegador só baixa o peso usado, mas vale reduzir a família e migrar para woff2 antes do primeiro widget real em produção.
