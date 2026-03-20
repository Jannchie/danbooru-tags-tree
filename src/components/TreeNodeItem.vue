<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

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

const rowRef = ref<HTMLElement | null>(null)

const node = computed(() => props.dataset.nodes[props.nodeId])

const isRoot = computed(() => props.nodeId === 'root')

const hasChildren = computed(() => node.value.children.length > 0)

const hasSelectedDescendant = computed(() => {
  if (isRoot.value) {
    return props.selectedId.length > 0
  }
  return props.selectedId.startsWith(`${props.nodeId}.`)
})

const isOpen = computed(
  () => hasChildren.value && (isRoot.value || props.openIds.has(props.nodeId) || hasSelectedDescendant.value),
)

const isSelected = computed(() => props.selectedId === props.nodeId)

const ROOT_LABELS: Record<LocaleCode, string> = {
  'en': 'Danbooru Tags',
  'ja': 'Danbooru タグ',
  'zh-CN': 'Danbooru 标签',
}

const label = computed(() => {
  if (isRoot.value) {
    return ROOT_LABELS[props.locale]
  }
  return getNodeLabel(node.value, props.locale, props.translations)
})

function handleLabelClick() {
  emit('select', props.nodeId)
  if (hasChildren.value && !isRoot.value) {
    emit('toggle', props.nodeId)
  }
}

watch(
  () => props.selectedId,
  async (id) => {
    if (id === props.nodeId && rowRef.value) {
      await nextTick()
      rowRef.value.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  },
)
</script>

<template>
  <li :class="['tree-item', { 'tree-item--root': isRoot }]">
    <div
      ref="rowRef"
      :class="[
        'tree-row',
        {
          'tree-row--selected': isSelected,
          'tree-row--root': isRoot,
        },
      ]"
    >
      <button
        v-if="hasChildren && !isRoot"
        class="tree-toggle"
        type="button"
        @click="emit('toggle', nodeId)"
      >
        {{ isOpen ? '▾' : '▸' }}
      </button>
      <span
        v-else-if="!isRoot"
        class="tree-toggle tree-toggle--placeholder"
      >
        ·
      </span>

      <button
        class="tree-label"
        type="button"
        @click="handleLabelClick"
      >
        <span class="tree-label-text">{{ label }}</span>
        <span class="tree-label-count">{{ node.totalTagCount }}</span>
      </button>
    </div>

    <ul
      v-if="isOpen"
      :class="isRoot ? 'tree-root-children' : 'tree-children'"
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
