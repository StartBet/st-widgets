<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  StButton,
  StCarousel,
  StIcon,
  StSuperOddsCard,
  StTypography
} from '@startbet/st-core-ui';
import { useResource } from '@/api/useResource';
import { useHostBridge } from '@/bridge/context';
import { useWidgetParams } from '@/app/context';
import { env } from '@/config/env';
import { readBoostsParams } from './params';
import { fetchBoostCards, isPopular, type BoostCard } from './resource';

// Espelha o StBetCardCarousel do front-startbet. A diferenca visual combinada
// e a ausencia do "Ver mais": aqui sobram icone, titulo e as setas. Navegar
// para uma listagem seria intencao nova no contrato, e o widget nao precisa.
const TITLE = 'Purple Odds';
const CARD_TYPE_FALLBACK = 'Turbinada';

const global = useWidgetParams();
const params = readBoostsParams();
const bridge = useHostBridge();

// O carrossel e infinito, entao as setas nunca desabilitam — so precisamos
// dos metodos de navegacao.
const carousel = ref<{ next: () => void; prev: () => void } | null>(null);

const cards = useResource((signal) =>
  fetchBoostCards({
    betCardListId: params.betCardListId,
    sportId: params.sportId,
    integration: global.integration,
    limit: params.limit,
    logos: { jerseyCdn: env.jerseyCdnUrl, logoSetId: env.logoSetId },
    fallbackType: CARD_TYPE_FALLBACK,
    signal
  })
);

// Estado do bilhete: so o host consegue ler, porque o localStorage da Altenar
// fica na origem dele. Ver docs/bridge-poc.md.
const activeIds = ref<number[]>([]);

bridge.on('betslip:state', (message) => {
  activeIds.value = message.payload.activeIds;
});

const isActive = (card: BoostCard) =>
  card.matchIds.some((id) => activeIds.value.includes(id));

const list = computed(() => cards.data.value ?? []);
const isLoading = computed(
  () => cards.pending.value && list.value.length === 0
);
const skeletonCount = 5;

const eventLabel = (card: BoostCard) =>
  card.home && card.away ? `${card.home} x ${card.away}` : card.eventName;

const addToBetslip = (card: BoostCard) => {
  bridge.send({
    type: 'betslip:add',
    payload: { selection: card.selection }
  });
};

// Id de dominio, nunca URL: montar a rota e assunto do host.
const openEvent = (card: BoostCard) => {
  if (card.eventId == null) return;

  bridge.send({
    type: 'navigate',
    payload: {
      target: { kind: 'event', id: card.eventId, live: card.isLive }
    }
  });
};
</script>

<template>
  <section
    v-if="isLoading || list.length > 0"
    class="flex min-w-0 flex-col gap-st-1 p-2 md:gap-st-2"
  >
    <header
      v-if="isLoading"
      class="flex items-center gap-st-1"
      aria-hidden="true"
    >
      <span class="shimmer-effect size-8 shrink-0 rounded-full sm:size-12" />
      <span class="shimmer-effect h-6 w-40 rounded-full sm:h-8 sm:w-64" />
    </header>

    <header v-else class="flex items-center justify-between gap-st-2">
      <div class="flex min-w-0 items-center gap-st-1">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-st-surface-0 text-st-content-secondary sm:size-12"
          aria-hidden="true"
        >
          <StIcon name="bolt" :size="3" />
        </span>

        <StTypography
          as="h2"
          variant="highlight-medium"
          uppercase
          truncate
          class-name="min-w-0 text-st-content-default text-st-sm"
        >
          {{ TITLE }}
        </StTypography>
      </div>

      <div class="hidden shrink-0 items-center gap-st-1 md:flex">
        <StButton
          variant="text"
          size="small"
          icon-left="chevron-left"
          :aria-label="`Voltar carrossel de ${TITLE}`"
          @click="carousel?.prev()"
        />
        <StButton
          variant="text"
          size="small"
          icon-left="chevron-right"
          :aria-label="`Avançar carrossel de ${TITLE}`"
          @click="carousel?.next()"
        />
      </div>
    </header>

    <StCarousel
      ref="carousel"
      arrows="none"
      bullets="none"
      grab
      slide-class-name="flex"
      infinite-loop
      highlight
      :aria-label="`Carrossel de ${TITLE}`"
      :slide-per-page="1"
      :sm-slide-per-page="2"
      :md-slide-per-page="3"
      :lg-slide-per-page="4"
      slide-align="center"
      md-slide-align="left"
      lg-slide-align="left"
      :gap="0"
      :md-gap="0"
      :peek="6"
      :md-peek="4"
    >
      <template v-if="isLoading">
        <div
          v-for="index in skeletonCount"
          :key="`skeleton-${index}`"
          class="shimmer-effect relative flex aspect-video min-h-[150px] w-full min-w-0 flex-col rounded-xl lg:min-h-[200px]"
          aria-hidden="true"
        />
      </template>

      <template v-else>
        <StSuperOddsCard
          v-for="card in list"
          :key="card.id"
          :competition="card.competition"
          :event-name="card.eventName"
          :home="card.home"
          :away="card.away"
          :home-logo="card.homeLogo"
          :away-logo="card.awayLogo"
          :start-date="card.startDate ?? undefined"
          :selections="card.selections"
          :price="card.price ?? undefined"
          :boosted-price="card.boostedPrice ?? undefined"
          :promotional="card.promotional"
          :show-boost-icon="isPopular(card)"
          :active="isActive(card)"
          :aria-label="eventLabel(card)"
          :action-aria-label="`Adicionar ${eventLabel(card)} ao bilhete`"
          @select="addToBetslip(card)"
          @click="openEvent(card)"
        >
          <template #type>
            <StIcon name="bolt" :size="1" aria-hidden="true" />
            {{ card.typeLabel }}
            <span v-if="card.isBB">BB</span>
          </template>
        </StSuperOddsCard>
      </template>
    </StCarousel>
  </section>
</template>
