# Publicação

Documento de referência para o time de infraestrutura. Descreve como o `st-widgets` é publicado, por que o desenho é este e o que precisa ser provisionado na AWS.

## Resumo

Duas branches, dois ambientes, dois buckets, duas distribuições:

| Branch | Ambiente | Domínio                             | Bucket            | GitHub Environment |
| ------ | -------- | ----------------------------------- | ----------------- | ------------------ |
| `dev`  | dev      | `supermultipla-dev.startbet.bet.br` | `st-widgets-dev`  | `dev`              |
| `main` | produção | `supermultipla.startbet.bet.br`     | `st-widgets-prod` | `production`       |

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

**Controle de headers.** O widget roda dentro de `<iframe>` — no back office da Altenar e em páginas nossas. Isso torna dois headers críticos: não pode sair `X-Frame-Options`, e precisa sair um `Content-Security-Policy: frame-ancestors` com a lista exata de quem pode embutir. No CloudFront isso é uma _Response Headers Policy_: declarativa, versionada, revisável.

**Controle de cache.** Widget em iframe tem uma exigência específica — o `.html` precisa ser revalidado a cada carga, senão o host continua servindo a versão anterior depois do deploy. Os assets, que têm hash no nome, podem ser imutáveis por um ano. São políticas diferentes por padrão de arquivo, o terreno natural do CloudFront.

**Um único pipeline.** O `.github/workflows/build.yml` já roda lint, formatação, cobertura e build. Com Amplify o build aconteceria de novo no runner da AWS, em dois lugares que podem divergir. Aqui o deploy é um job a mais no mesmo workflow, depois do portão de qualidade.

**Sem credencial de longa duração.** O GitHub assume uma role na AWS por OIDC, com token efêmero. Nenhuma `AWS_ACCESS_KEY_ID` guardada.

**Quando reconsiderar:** se o time não gerencia CloudFront por código hoje e não pretende passar a gerenciar, o custo de provisionamento pesa e o Amplify volta a ser competitivo. A pergunta que decide é se já existe distribuição CloudFront provisionada por IaC em outros projetos da StartBet.

## O que provisionar na AWS

Por ambiente:

**S3.** Bucket privado, sem _static website hosting_, sem acesso público. O acesso vem do CloudFront por OAC.

**CloudFront.** Distribuição com o bucket como origem via **Origin Access Control**, HTTPS obrigatório (redirect de HTTP), compressão ligada.

**ACM.** Certificado para o domínio do ambiente, emitido em **`us-east-1`** — o CloudFront só aceita certificado dessa região.

**Route 53.** Registro `A`/`ALIAS` apontando o domínio para a distribuição.

**Response Headers Policy:**

```
Content-Security-Policy: frame-ancestors https://www.startbet.bet.br <origem do back office da Altenar>
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

Sem `X-Frame-Options` — o header legado, se presente, vence o `frame-ancestors` em alguns navegadores e quebra o embed.

A origem exata do back office da Altenar ainda precisa ser confirmada com eles antes de fechar a policy.

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

| Nome                       | `dev`                                           | `production`                      |
| -------------------------- | ----------------------------------------------- | --------------------------------- |
| `VITE_ALTENAR_INTEGRATION` | `startbet`                                      | `startbet`                        |
| `VITE_API_BASE_URL`        | origem do Nitro de homologação                  | `https://www.startbet.bet.br`     |
| `VITE_HOST_ORIGINS`        | origens de homologação + back office da Altenar | origens de produção + back office |
| `VITE_DEFAULT_THEME`       | `dark`                                          | `dark`                            |
| `AWS_ROLE_ARN`             | ARN da role de dev                              | ARN da role de produção           |
| `AWS_S3_BUCKET`            | `st-widgets-dev`                                | `st-widgets-prod`                 |
| `AWS_CLOUDFRONT_ID`        | id da distribuição de dev                       | id da distribuição de produção    |

Todas são _variables_, não _secrets_ — nenhuma é sensível, e mantê-las visíveis evita a falsa sensação de proteção. ARN de role e id de distribuição não são segredo: sem o OIDC do repositório, não servem para nada.

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
        aws-region: us-east-1
    - name: Upload assets
      run: |
        aws s3 sync dist/ "s3://${{ vars.AWS_S3_BUCKET }}/" \
          --delete \
          --exclude "*.html" \
          --cache-control "public,max-age=31536000,immutable"
    - name: Upload HTML
      run: |
        aws s3 sync dist/ "s3://${{ vars.AWS_S3_BUCKET }}/" \
          --delete \
          --exclude "*" --include "*.html" \
          --cache-control "no-cache"
    - name: Invalidate CloudFront
      run: |
        aws cloudfront create-invalidation \
          --distribution-id "${{ vars.AWS_CLOUDFRONT_ID }}" \
          --paths "/*"
```

Três detalhes que não são óbvios:

**Por que o job reconstrói.** O build do job `quality` é uma validação: prova que o código compila, sem variáveis de ambiente. O build do `deploy` é o artefato real, com os valores do ambiente embutidos. São builds com propósitos diferentes — reaproveitar o primeiro publicaria um bundle com os valores errados.

**Por que dois `aws s3 sync`.** Cada passo aplica um `Cache-Control` diferente. A ordem importa: assets primeiro, HTML depois, para que nunca exista um `.html` publicado apontando para um asset que ainda não subiu. O `--delete` do primeiro passo não remove os `.html` do destino, porque o filtro `--exclude` também se aplica à listagem do bucket.

**Por que `concurrency` sem `cancel-in-progress`.** Dois deploys simultâneos na mesma branch podem intercalar uploads e deixar o bucket num estado misto. Cancelar um deploy no meio tem o mesmo efeito — por isso eles são enfileirados, não cancelados.

## Verificação pós-deploy

```bash
curl -sI https://supermultipla.startbet.bet.br/boosts.html
```

Conferir: `200`, `cache-control: no-cache`, presença de `content-security-policy` com `frame-ancestors` e ausência de `x-frame-options`. Num arquivo de `assets/`, conferir `cache-control: public, max-age=31536000, immutable`.

Depois, abrir a página num `<iframe>` a partir de uma origem autorizada e confirmar que não há bloqueio no console.

## Pendências antes do primeiro deploy

- **Grafia do domínio.** Confirmar se é `supermultipla` ou `supermutipla` — o nome vai para DNS e certificado, e mudar depois custa caro.
- **Raiz do domínio.** O `index.html` é catálogo de desenvolvimento e está excluído do build de produção: o `dist/` tem apenas `boosts.html` e `assets/`. Hoje `https://supermultipla.startbet.bet.br/` não resolve para nada. Decidir entre uma página mínima, um redirect ou um 404 tratado — com OAC, objeto ausente retorna `403`, então é preciso um _custom error response_ para virar um 404 apresentável.
- **CORS no Nitro.** O widget passa a chamar a API a partir de uma origem nova. O Nitro precisa liberar `supermultipla.startbet.bet.br` e `supermultipla-dev.startbet.bet.br`.
- **Origem do back office da Altenar.** Necessária para fechar o `frame-ancestors` e o `VITE_HOST_ORIGINS`.
- **Peso das fontes.** `base-neue-condensed.css` declara 18 pesos em TTF e o build emite todos (~2,2 MB). O navegador só baixa o peso usado, mas vale reduzir a família e migrar para woff2 antes do primeiro widget real em produção.
