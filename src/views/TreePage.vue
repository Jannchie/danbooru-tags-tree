<script setup lang="ts">
import NodeOverview from '@/components/NodeOverview.vue'
import TaxonomyTree from '@/components/TaxonomyTree.vue'
import type { LocaleCode, LocalizedLabel, TaxonomyDataset, TaxonomyNode } from '@/utils/taxonomy'

defineProps<{
  dataset: TaxonomyDataset
  selectedNodeId: string
  selectedNode: TaxonomyNode
  locale: LocaleCode
  focusedTag: string | null
  translations: Record<string, LocalizedLabel>
  tagFrequency: Record<string, number>
  openIds: Set<string>
}>()

const emit = defineEmits<{
  select: [nodeId: string]
  toggle: [nodeId: string]
  focusTag: [tag: string]
}>()
</script>

<template>
  <aside class="sidebar">
    <TaxonomyTree
      :dataset="dataset"
      :selected-id="selectedNodeId"
      :locale="locale"
      :open-ids="openIds"
      :translations="translations"
      @select="emit('select', $event)"
      @toggle="emit('toggle', $event)"
    />
  </aside>

  <section class="content">
    <NodeOverview
      :dataset="dataset"
      :node="selectedNode"
      :locale="locale"
      :focused-tag="focusedTag"
      :translations="translations"
      :tag-frequency="tagFrequency"
      @select="emit('select', $event)"
      @focus-tag="emit('focusTag', $event)"
    />
  </section>
</template>
