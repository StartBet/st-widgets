<script setup lang="ts">
import { StTypography } from '@startbet/st-core-ui';
import { useResource } from '@/api/useResource';
import { useHostBridge } from '@/bridge/context';
import { useWidgetParams } from '@/app/context';
import { readTopLeagueParams } from './params';
import { fetchTopLeagues, type League } from './resource';

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
</script>

<template>
  <section class="flex flex-col gap-2 p-4">
    <div
      v-if="leagues.pending.value"
      class="flex gap-2 overflow-hidden"
      aria-busy="true"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="h-10 w-32 shrink-0 animate-pulse rounded"
        :style="{ background: 'var(--st-color-light-1)' }"
      />
    </div>

    <StTypography v-else-if="leagues.error.value" variant="body-small" as="p">
      Nao foi possivel carregar as ligas.
    </StTypography>

    <ul
      v-else-if="leagues.data.value?.length"
      class="flex list-none gap-2 overflow-x-auto p-0"
    >
      <li
        v-for="league in leagues.data.value"
        :key="league.id"
        class="shrink-0"
      >
        <button
          type="button"
          class="flex items-center gap-2 whitespace-nowrap rounded px-3 py-2"
          :style="{ background: 'var(--st-color-light-1)' }"
          @click="open(league)"
        >
          <StTypography variant="body-small" as="span" weight="bold">{{
            league.name
          }}</StTypography>
          <StTypography
            v-if="league.live"
            variant="body-small"
            as="span"
            :style="{ color: 'var(--st-color-negative)' }"
            >AO VIVO</StTypography
          >
        </button>
      </li>
    </ul>
  </section>
</template>
