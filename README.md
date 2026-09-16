# st-widgets

Aplicação de widgets da Start Bet: um build multi-página (uma `.html` por widget) em Vue 3 + Vite, consumindo os componentes de `@startbet/st-core-ui`.

Cada página é autônoma e pensada para ser carregada dentro de um `<iframe>` — no slot de HTML do back office da Altenar ou em qualquer página nossa. O widget não decide navegação, login nem boletim: ele descreve a intenção e quem executa é a aplicação hospedeira.

Este repositório está no estágio de configuração. O widget `boosts` é um esqueleto que prova o pipeline (render, tema, tokens, fontes e leitura de parâmetros).

## Rodando

```bash
npm install
npm run dev
```

O catálogo de desenvolvimento fica em `http://localhost:5180`. Cada widget tem sua própria URL, por exemplo `http://localhost:5180/boosts.html?theme=dark`.

| Script              | O que faz                                 |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | servidor de desenvolvimento na porta 5180 |
| `npm run build`     | typecheck + build de produção em `dist/`  |
| `npm run preview`   | serve o `dist/` na porta 5180             |
| `npm run typecheck` | `vue-tsc` sem emitir                      |
| `npm run lint`      | ESLint (`lint:fix` corrige)               |
| `npm run test`      | Vitest em watch (`test:run` roda uma vez) |
| `npm run format`    | Prettier                                  |

## Esteira

Os hooks são instalados pelo Husky no `npm install` (script `prepare`).

| Hook         | O que roda                                                                            |
| ------------ | ------------------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged`: ESLint com `--fix`, Prettier e a suíte de testes nos arquivos em stage |
| `commit-msg` | `commitlint` com `@commitlint/config-conventional`                                    |
| `pre-push`   | `test:run` e `validate:branch-name`                                                   |

Mesma configuração do `st-core-ui`, com uma simplificação: lá o validador de branch é TypeScript compilado por um `build:hooks`; aqui é um `.mjs` direto em `scripts/`, porque não há pipeline de build de scripts neste projeto.

No CI (`.github/workflows/build.yml`), a cada PR e a cada push na `main`, o job **Lint, test and build** roda `lint`, `format:check`, `test:coverage` e `build`, e publica a cobertura como artefato. O job **SonarQube** espelha o do `st-core-ui` e fica inerte enquanto o secret `SONAR_TOKEN` não existir — para ligá-lo, crie o projeto `StartBet_st-widgets` no Sonar e adicione o secret no repositório.

**Commits** seguem Conventional Commits (`feat:`, `fix:`, `chore:`…). **Branches** precisam de um dos prefixos `feature/`, `feat/`, `fix/`, `hotfix/`, `chore/`, `refactor/`, `perf/`, `docs/`, `test/`, `ci/`, `style/` — `main` não passa no `pre-push`, então o trabalho sai sempre de uma branch com prefixo.

## Estrutura

```
boosts.html              entrada do widget (uma por widget, na raiz)
index.html               catálogo de desenvolvimento, fora do build de produção
build/                   helpers do Vite (entradas MPA, plugin de CSS da lib)
src/
  app/                   bootstrap comum: createWidget, WidgetShell, contexto
  config/                env tipado e leitura dos parâmetros de URL
  styles/main.css        diretivas do Tailwind e o container .st-widget
  widgets/<nome>/        main.ts + componente do widget
```

## Adicionando um widget

1. Crie `src/widgets/<nome>/main.ts` chamando `createWidget(SeuComponente)`.
2. Crie `<nome>.html` na raiz apontando para esse `main.ts`.

Não há configuração a alterar: o Vite descobre as entradas varrendo os `.html` da raiz (`build/htmlEntries.ts`).

## Parâmetros de URL

Lidos em `src/config/params.ts` e disponíveis em qualquer componente via `useWidgetParams()`.

| Parâmetro             | Valores                   | Default                    |
| --------------------- | ------------------------- | -------------------------- |
| `theme`               | `light`, `dark`, `system` | `VITE_DEFAULT_THEME`       |
| `integration`         | skin da Altenar           | `VITE_ALTENAR_INTEGRATION` |
| `listId`              | número                    | nenhum                     |
| `mobilePaddingInline` | qualquer medida CSS       | vazio                      |
| `debug`               | `1`                       | desligado                  |

`mobilePaddingInline` compensa o padding do container do host e só vale abaixo de 480px.

## Variáveis de ambiente

`.env.development` já vem preenchido para desenvolvimento local. Para os demais ambientes, use `.env.example` como referência.

| Variável                   | Uso                                                            |
| -------------------------- | -------------------------------------------------------------- |
| `VITE_ALTENAR_INTEGRATION` | skin default quando a URL não manda `integration`              |
| `VITE_API_BASE_URL`        | origem da API de dados (hoje, o Nitro do front-startbet)       |
| `VITE_HOST_ORIGINS`        | origens autorizadas a conversar com o widget por `postMessage` |
| `VITE_DEFAULT_THEME`       | tema quando a URL não manda `theme`                            |

## Decisões de configuração

**Vite 7, não 8.** O Vite 8 (Rolldown) entrega o CSS vazio ao navegador no modo dev nesta combinação com Tailwind 3 — o build passa, o `npm run dev` fica sem estilo. Ficamos no 7 até isso estar resolvido.

**Tailwind 3 com o tema da lib.** `tailwind.config.ts` importa `stTailwindTheme` e `stTailwindPlugins` de `@startbet/st-core-ui` e varre o `dist` da lib, porque as classes usadas pelos componentes precisam ser geradas aqui. É o mesmo arranjo do front-startbet.

**Plugin `strip-font-layer`.** A lib envolve `@font-face` e os tokens em `@layer base` e importa todas as famílias de fonte dentro de `tokens.css`. O plugin em `build/stripStCoreUiFontLayer.ts` remove esses imports (escolhemos a família em `createWidget.ts`) e desembrulha o `@layer base`, senão os tokens perdem para qualquer regra não-camada. Portado do `nuxt.config.ts` do front-startbet.

**Tema pelo `StThemeProvider`.** `WidgetShell.vue` usa o provider da lib com `root`, que espelha o tema resolvido no `<html>` via `data-theme`. Não reimplementamos troca de tema.

**Fundo.** `body` é transparente e só o container `.st-widget` pinta, usando `--st-color-surface-0`. Assim o widget não depende do fundo do host. A escolha do token de superfície por widget é decisão de design; `src/styles/main.css` é o único lugar a mudar.

**`index.html` não vai para produção.** É catálogo interno; `vite.config.ts` o exclui das entradas do build.

## Pendências conhecidas

- **Fontes.** `base-neue-condensed.css` declara os 18 pesos da família em TTF; o build emite todos (~2,2 MB). O navegador só baixa o peso usado, mas vale reduzir a família e migrar para woff2 antes do primeiro widget real.
- **Bridge.** O contrato de `postMessage` com o host ainda não existe aqui. `VITE_HOST_ORIGINS` já está preparado para a allowlist de origem.
- **Camada de dados.** Nenhuma chamada de API ainda. O cliente vai falar com o Nitro do front-startbet, que já tem cache das rotas da Altenar.
