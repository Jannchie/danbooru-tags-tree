<script setup lang="ts">
import GraphView from '@/components/GraphView.vue'
import type { LocaleCode, LocalizedLabel, TaxonomyDataset } from '@/utils/taxonomy'

defineProps<{
  dataset: TaxonomyDataset
  selectedNodeId: string
  locale: LocaleCode
  translations: Record<string, LocalizedLabel>
  graphLayout: Record<string, { x: number, y: number }> | null
}>()

const emit = defineEmits<{
  select: [nodeId: string]
}>()
</script>

<template>
  <GraphView
    :dataset="dataset"
    :locale="locale"
    :translations="translations"
    :selected-node-id="selectedNodeId"
    :layout-positions="graphLayout"
    @select="emit('select', $event)"
  />
</template>
