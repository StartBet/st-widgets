<script setup lang="ts">
import { StTypography } from '@startbet/st-core-ui';
import { useWidgetParams } from '@/app/context';
import { env } from '@/config/env';

const params = useWidgetParams();

const rows = [
  { label: 'theme', value: String(params.theme) },
  { label: 'integration', value: params.integration },
  {
    label: 'listId',
    value: params.listId === null ? '(padrao)' : String(params.listId)
  },
  {
    label: 'mobilePaddingInline',
    value: params.mobilePaddingInline || '(vazio)'
  },
  { label: 'apiBaseUrl', value: env.apiBaseUrl || '(vazio)' },
  { label: 'hostOrigins', value: env.hostOrigins.join(', ') || '(vazio)' }
];
</script>

<template>
  <section class="flex flex-col gap-4 p-4">
    <StTypography variant="heading-3" as="h1">Boosts</StTypography>
    <StTypography variant="body-small" as="p">
      Esqueleto do widget. Renderizacao, tema e leitura de parametros
      funcionando.
    </StTypography>
    <div class="flex flex-col gap-1">
      <div v-for="row in rows" :key="row.label" class="flex flex-wrap gap-2">
        <StTypography variant="body-small" as="span" weight="bold">{{
          row.label
        }}</StTypography>
        <StTypography variant="body-small" as="span">{{
          row.value
        }}</StTypography>
      </div>
    </div>
  </section>
</template>
