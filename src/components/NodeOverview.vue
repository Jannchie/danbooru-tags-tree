<script setup lang="ts">
import { computed } from 'vue'

import {
  getAncestorIds,
  getNodeLabel,
  getTagLabel,
  type LocaleCode,
  type LocalizedLabel,
  type TaxonomyDataset,
  type TaxonomyNode,
} from '@/utils/taxonomy'
import { createUiText } from '@/utils/uiText'

const props = defineProps<{
  dataset: TaxonomyDataset
  node: TaxonomyNode
  locale: LocaleCode
  focusedTag: string | null
  translations: Record<string, LocalizedLabel>
  tagFrequency: Record<string, number>
}>()

const emit = defineEmits<{
  select: [nodeId: string]
  focusTag: [tag: string]
}>()

const breadcrumbs = computed(() =>
  getAncestorIds(props.dataset, props.node.id).map((id) => props.dataset.nodes[id]),
)

const childNodes = computed(() =>
  props.node.children.map((id) => props.dataset.nodes[id]),
)

const ui = computed(() => createUiText(props.locale))

</script>

<template>
  <div class="overview">
    <!-- Breadcrumb -->
    <nav class="overview-breadcrumb">
      <template
        v-for="item in breadcrumbs"
        :key="item.id"
      >
        <button
          class="crumb"
          type="button"
          @click="emit('select', item.id)"
        >
          {{ getNodeLabel(item, locale, translations) }}
        </button>
        <span class="crumb-sep">/</span>
      </template>
      <span class="crumb crumb--current">
        {{ getNodeLabel(node, locale, translations) }}
      </span>
    </nav>

    <!-- Title -->
    <div class="overview-title">
      <h2>{{ getNodeLabel(node, locale, translations) }}</h2>
      <span class="overview-depth">{{ ui.depth({ depth: node.depth + 1 }) }}</span>
    </div>
    <div class="overview-key">
      {{ node.categoryKey }}
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-card-label">{{ ui.directTags }}</span>
        <span class="stat-card-value">{{ node.directTagCount }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">{{ ui.totalTags }}</span>
        <span class="stat-card-value">{{ node.totalTagCount }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">{{ ui.children }}</span>
        <span class="stat-card-value">{{ node.children.length }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">{{ ui.descendants }}</span>
        <span class="stat-card-value">{{ node.descendantCount }}</span>
      </div>
    </div>

    <!-- Child Categories -->
    <section
      v-if="childNodes.length > 0"
      class="overview-section"
    >
      <div class="section-title">
        <h3>{{ ui.childCategories }}</h3>
        <span>{{ childNodes.length.toLocaleString(locale) }}</span>
      </div>
      <div class="child-grid">
        <button
          v-for="child in childNodes"
          :key="child.id"
          class="child-card"
          type="button"
          @click="emit('select', child.id)"
        >
          <span class="child-card-name">{{ getNodeLabel(child, locale, translations) }}</span>
          <span class="child-card-count">{{ child.totalTagCount }}</span>
        </button>
      </div>
    </section>

    <!-- Tags -->
    <section
      v-if="node.tags.length > 0"
      class="overview-section"
    >
      <div class="section-title">
        <h3>{{ ui.searchTagsGroup }}</h3>
        <span>{{ ui.tagItems({ count: node.tags.length }) }}</span>
      </div>
      <div class="tag-list">
        <button
          v-for="tag in node.tags"
          :key="tag"
          :class="[
            'tag-chip',
            {
              'tag-chip--active': focusedTag === tag,
            },
          ]"
          :aria-pressed="focusedTag === tag"
          type="button"
          @click="emit('focusTag', tag)"
        >
          <span class="tag-chip-label">{{ getTagLabel(tag, locale, translations) }}</span>
          <span class="tag-chip-name">{{ tag }}</span>
          <span
            v-if="tagFrequency[tag]"
            class="tag-chip-count"
          >{{ tagFrequency[tag].toLocaleString(locale) }}</span>
        </button>
      </div>
    </section>
  </div>
</template>
