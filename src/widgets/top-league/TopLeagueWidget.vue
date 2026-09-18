<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue';
import { StButton, StTypography } from '@startbet/st-core-ui';
import { useResource } from '@/api/useResource';
import { useHostBridge } from '@/bridge/context';
import { useWidgetParams } from '@/app/context';
import { readTopLeagueParams } from './params';
import { fetchTopLeagues, type League } from './resource';

const MAX_ROWS = 2;

const global = useWidgetParams();
const params = readTopLeagueParams();
const bridge = useHostBridge();

const leagues = useResource((signal) =>
  fetchTopLeagues({
    integration: global.integration,
    limit: params.limit,
    signal
  })
);

// O widget descreve a intencao com o id de dominio. Montar a rota e assunto do
// host, que muda sem nos avisar. Ver docs/architecture.md.
const open = (league: League) => {
  bridge.send({
    type: 'navigate',
    payload: { target: { kind: 'championship', id: league.id } }
  });
};

// --- recorte em duas linhas -------------------------------------------------
//
// O layout e uma fileira que quebra, limitada a duas linhas, com reticencias no
// fim quando sobra item. Nao da para fazer so com CSS: `overflow: hidden` corta
// sem avisar, e `line-clamp` nao vale para elementos que quebram entre si.
//
// Entao medimos. Renderizamos tudo, lemos onde cada botao parou, e escondemos o
// que passou da segunda linha — reservando espaco para as reticencias, que
// tambem ocupam lugar na linha.

const container = ref<HTMLElement | null>(null);
const ellipsis = ref<HTMLElement | null>(null);
const visibleCount = ref(Number.POSITIVE_INFINITY);
const overflowing = ref(false);
/** Durante a medicao tudo aparece, senao nao ha o que medir. */
const measuring = ref(false);

const measure = async () => {
  const total = leagues.data.value?.length ?? 0;
  if (!total) return;

  measuring.value = true;
  await nextTick();

  const root = container.value;
  const marker = ellipsis.value;

  if (!root) {
    measuring.value = false;
    return;
  }

  const items = [...root.querySelectorAll<HTMLElement>('[data-league]')];
  const rows = [...new Set(items.map((item) => item.offsetTop))].sort(
    (a, b) => a - b
  );

  if (rows.length <= MAX_ROWS) {
    visibleCount.value = total;
    overflowing.value = false;
    measuring.value = false;
    return;
  }

  const lastRowTop = rows[MAX_ROWS - 1] ?? 0;

  // Ultimo botao que ainda cabe nas linhas permitidas. Varredura reversa em vez
  // de `findLastIndex`, que exige um target de ES mais novo que o do projeto.
  let last = items.length - 1;
  while (last >= 0 && (items[last]?.offsetTop ?? 0) > lastRowTop) last -= 1;

  // As reticencias entram no fim da ultima linha visivel, entao pode ser
  // preciso soltar mais um botao para caberem.
  const markerWidth = marker?.offsetWidth ?? 0;
  const available = root.clientWidth;

  while (last >= 0) {
    const item = items[last];
    if (!item) break;

    const fits =
      item.offsetTop < lastRowTop ||
      item.offsetLeft + item.offsetWidth + markerWidth <= available;

    if (fits) break;
    last -= 1;
  }

  visibleCount.value = last + 1;
  overflowing.value = true;
  measuring.value = false;
};

watch(() => leagues.data.value, measure);

// A largura muda quando o host redimensiona o iframe, e a quebra muda junto.
let observer: ResizeObserver | null = null;

watch(container, (el) => {
  observer?.disconnect();
  if (!el || typeof ResizeObserver === 'undefined') return;

  observer = new ResizeObserver(() => void measure());
  observer.observe(el);
});

onUnmounted(() => observer?.disconnect());
</script>

<template>
  <section class="flex min-w-0 flex-col gap-st-1 p-2">
    <div
      v-if="leagues.pending.value"
      class="flex flex-wrap gap-st-1"
      aria-hidden="true"
    >
      <span
        v-for="i in 8"
        :key="i"
        class="shimmer-effect h-9 w-32 rounded-full"
      />
    </div>

    <StTypography v-else-if="leagues.error.value" variant="body-small" as="p">
      Nao foi possivel carregar as ligas.
    </StTypography>

    <div
      v-else-if="leagues.data.value?.length"
      ref="container"
      class="flex flex-wrap items-center gap-st-1 p-st-1"
    >
      <StButton
        v-for="(league, index) in leagues.data.value"
        v-show="measuring || index < visibleCount"
        :key="league.id"
        data-league
        variant="outline"
        color="primary"
        size="medium"
        :aria-label="`Abrir ${league.name}`"
        @click="open(league)"
      >
        {{ league.name }}
      </StButton>

      <span
        v-show="measuring || overflowing"
        ref="ellipsis"
        class="select-none px-st-1 text-st-content-default"
        aria-hidden="true"
        >…</span
      >
    </div>
  </section>
</template>
