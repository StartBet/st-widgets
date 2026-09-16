<script setup lang="ts">
import { computed } from 'vue';
import { StThemeProvider } from '@startbet/st-core-ui';
import { useWidgetParams } from '@/app/context';

const params = useWidgetParams();

const style = computed(() =>
  params.mobilePaddingInline
    ? { '--st-widget-padding-inline': params.mobilePaddingInline }
    : undefined
);
</script>

<template>
  <StThemeProvider :theme="params.theme" root inline>
    <div class="st-widget" :style="style">
      <slot />
    </div>
  </StThemeProvider>
</template>
