<script setup lang="ts">
import { computed } from 'vue'

import {
  getNodeLabel,
  type LocaleCode,
  type LocalizedLabel,
  type TaxonomyDataset,
} from '@/utils/taxonomy'

defineOptions({
  name: 'TreeNodeItem',
})

const props = defineProps<{
  dataset: TaxonomyDataset
  nodeId: string
  selectedId: string
  locale: LocaleCode
  openIds: Set<string>
  translations: Record<string, LocalizedLabel>
}>()

const emit = defineEmits<{
  select: [nodeId: string]
  toggle: [nodeId: string]
}>()

const node = computed(() => props.dataset.nodes[props.nodeId])

const hasChildren = computed(() => node.value.children.length > 0)

const hasSelectedDescendant = computed(() =>
  props.selectedId.startsWith(`${props.nodeId}.`),
)

const isOpen = computed(
  () => hasChildren.value && (props.openIds.has(props.nodeId) || hasSelectedDescendant.value),
)

const isSelected = computed(() => props.selectedId === props.nodeId)

const label = computed(() =>
  getNodeLabel(node.value, props.locale, props.translations),
)
</script>

<template>
  <li class="tree-item">
    <div
      :class="[
        'tree-row',
        {
          'tree-row--selected': isSelected,
        },
      ]"
    >
      <button
        v-if="hasChildren"
        class="tree-toggle"
        type="button"
        @click="emit('toggle', nodeId)"
      >
        {{ isOpen ? '▾' : '▸' }}
      </button>
      <span
        v-else
        class="tree-toggle tree-toggle--placeholder"
      >
        ·
      </span>

      <button
        class="tree-label"
        type="button"
        @click="emit('select', nodeId)"
      >
        <span class="tree-label-text">{{ label }}</span>
        <span class="tree-label-count">{{ node.totalTagCount }}</span>
      </button>
    </div>

    <ul
      v-if="isOpen"
      class="tree-children"
    >
      <TreeNodeItem
        v-for="childId in node.children"
        :key="childId"
        :dataset="dataset"
        :node-id="childId"
        :selected-id="selectedId"
        :locale="locale"
        :open-ids="openIds"
        :translations="translations"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
      />
    </ul>
  </li>
</template>
