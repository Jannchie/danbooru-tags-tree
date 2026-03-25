<script setup lang="ts">
import { computed } from 'vue'

import TreeNodeItem from '@/components/TreeNodeItem.vue'
import type {
  LocaleCode,
  LocalizedLabel,
  TaxonomyDataset,
} from '@/utils/taxonomy'
import { createUiText } from '@/utils/uiText'

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

const ui = computed(() => createUiText(props.locale))
</script>

<template>
  <div class="sidebar-header">
    <span class="sidebar-title">{{ ui.sidebarTitle }}</span>
    <span class="sidebar-count">{{ ui.sidebarCount({ count: props.dataset.totalNodeCount }) }}</span>
  </div>

  <nav class="tree-panel">
    <ul class="tree-root">
      <TreeNodeItem
        :dataset="dataset"
        :node-id="'root'"
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
