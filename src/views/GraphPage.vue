<script setup lang="ts">
import GraphView from '@/components/GraphView.vue'
import type { ThemeMode } from '@/composables/useTheme'
import type { LocaleCode, LocalizedLabel, TaxonomyDataset } from '@/utils/taxonomy'

defineProps<{
  dataset: TaxonomyDataset
  selectedNodeId: string
  locale: LocaleCode
  translations: Record<string, LocalizedLabel>
  graphLayout: Record<string, { x: number, y: number }> | null
  theme: ThemeMode
}>()

const emit = defineEmits<{
  select: [nodeId: string]
  deselect: []
  navigateTree: [nodeId: string]
}>()
</script>

<template>
  <GraphView
    :dataset="dataset"
    :locale="locale"
    :translations="translations"
    :selected-node-id="selectedNodeId"
    :layout-positions="graphLayout"
    :theme="theme"
    @select="emit('select', $event)"
    @deselect="emit('deselect')"
    @navigate-tree="emit('navigateTree', $event)"
  />
</template>
