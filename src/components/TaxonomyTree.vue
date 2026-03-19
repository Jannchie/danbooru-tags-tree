<script setup lang="ts">
import TreeNodeItem from '@/components/TreeNodeItem.vue'
import type {
  LocaleCode,
  LocalizedLabel,
  TaxonomyDataset,
} from '@/utils/taxonomy'

const props = defineProps<{
  dataset: TaxonomyDataset
  selectedId: string
  locale: LocaleCode
  openIds: Set<string>
  translations: Record<string, LocalizedLabel>
}>()

const emit = defineEmits<{
  select: [nodeId: string]
  toggle: [nodeId: string]
}>()
</script>

<template>
  <div class="sidebar-header">
    <span class="sidebar-title">Explorer</span>
    <span class="sidebar-count">{{ props.dataset.totalNodeCount }} nodes</span>
  </div>

  <nav class="tree-panel">
    <ul class="tree-root">
      <TreeNodeItem
        v-for="rootId in dataset.rootChildren"
        :key="rootId"
        :dataset="dataset"
        :node-id="rootId"
        :selected-id="selectedId"
        :locale="locale"
        :open-ids="openIds"
        :translations="translations"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
      />
    </ul>
  </nav>
</template>
