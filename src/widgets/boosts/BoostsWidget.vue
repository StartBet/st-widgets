<script setup lang="ts">
import { computed, ref } from 'vue';
import { StTypography } from '@startbet/st-core-ui';
import { useResource } from '@/api/useResource';
import { useHostBridge } from '@/bridge/context';
import { useWidgetParams } from '@/app/context';
import { readBoostsParams } from './params';
import { fetchBoostCards, type BoostCard } from './resource';

const global = useWidgetParams();
const params = readBoostsParams();
const bridge = useHostBridge();

const cards = useResource((signal) =>
  fetchBoostCards({
    betCardListId: params.betCardListId,
    sportId: params.sportId,
    integration: global.integration,
    limit: params.limit,
    signal
  })
);

// Estado do bilhete: so o host consegue ler (o localStorage da Altenar fica na
// origem dele). Ver docs/bridge-poc.md.
const activeIds = ref<number[]>([]);

bridge.on('betslip:state', (message) => {
  activeIds.value = message.payload.activeIds;
});

const isActive = (card: BoostCard) =>
  card.matchIds.some((id) => activeIds.value.includes(id));

const add = (card: BoostCard) => {
  bridge.send({
    type: 'betslip:add',
    payload: { selection: card.selection }
  });
};

const formatOdd = (value: number | null) =>
  value == null ? '' : value.toFixed(2);

const hasCards = computed(() => (cards.data.value?.length ?? 0) > 0);
</script>

<template>
  <section class="flex flex-col gap-3 p-4">
    <div v-if="cards.pending.value" class="flex gap-3 overflow-hidden">
      <div
        v-for="i in 4"
        :key="i"
        class="h-40 w-64 shrink-0 animate-pulse rounded"
        :style="{ background: 'var(--st-color-light-1)' }"
      />
    </div>

    <StTypography v-else-if="cards.error.value" variant="body-small" as="p">
      Nao foi possivel carregar as odds turbinadas.
    </StTypography>

    <ul v-else-if="hasCards" class="flex list-none gap-3 overflow-x-auto p-0">
      <li
        v-for="card in cards.data.value"
        :key="card.id"
        class="flex w-64 shrink-0 flex-col gap-2 rounded p-3"
        :style="{ background: 'var(--st-color-light-1)' }"
      >
        <StTypography variant="body-small" as="span">{{
          card.competition
        }}</StTypography>

        <StTypography variant="body-small" as="span" weight="bold"
          >{{ card.home }} x {{ card.away }}</StTypography
        >

        <ul class="flex list-none flex-col gap-1 p-0">
          <li v-for="(item, index) in card.selections" :key="index">
            <StTypography variant="body-small" as="span"
              >{{ item.selection }} — {{ item.market }}</StTypography
            >
          </li>
        </ul>

        <button
          type="button"
          class="mt-auto flex items-center justify-center gap-2 rounded py-2"
          :style="{
            background: isActive(card)
              ? 'var(--st-color-positive)'
              : 'var(--st-color-primary)'
          }"
          @click="add(card)"
        >
          <StTypography
            v-if="card.price != null && card.boostedPrice != null"
            variant="body-small"
            as="span"
            class="line-through"
            >{{ formatOdd(card.price) }}</StTypography
          >
          <StTypography variant="body-small" as="span" weight="bold">{{
            formatOdd(card.boostedPrice ?? card.price)
          }}</StTypography>
        </button>
      </li>
    </ul>
  </section>
</template>
