<script setup lang="ts">
import { computed } from 'vue'

import {
  formatSlug,
  getAncestorIds,
  getNodeLabel,
  getTagLabel,
  type LocaleCode,
  type LocalizedLabel,
  type TaxonomyDataset,
  type TaxonomyNode,
} from '@/utils/taxonomy'

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
}>()

const breadcrumbs = computed(() =>
  getAncestorIds(props.dataset, props.node.id).map((id) => props.dataset.nodes[id]),
)

const childNodes = computed(() =>
  props.node.children.map((id) => props.dataset.nodes[id]),
)

const localizedLabels = computed(() => {
  const entry = props.translations[props.node.categoryKey]

  return [
    { locale: 'zh-CN', label: entry?.['zh-CN'] ?? null },
    { locale: 'en', label: entry?.en ?? null },
    { locale: 'ja', label: entry?.ja ?? null },
  ].filter((item) => item.label !== null)
})
</script>

<template>
  <div class="overview">
    <!-- Breadcrumb -->
    <nav class="overview-breadcrumb">
      <template
        v-for="(item, i) in breadcrumbs"
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
      <span class="overview-depth">depth {{ node.depth + 1 }}</span>
    </div>
    <div class="overview-key">
      {{ node.categoryKey }}
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-card-label">Direct tags</span>
        <span class="stat-card-value">{{ node.directTagCount }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Total tags</span>
        <span class="stat-card-value">{{ node.totalTagCount }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Children</span>
        <span class="stat-card-value">{{ node.children.length }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Descendants</span>
        <span class="stat-card-value">{{ node.descendantCount }}</span>
      </div>
    </div>

    <!-- Localized Labels -->
    <div
      v-if="localizedLabels.length > 0"
      class="locale-row"
    >
      <div
        v-for="item in localizedLabels"
        :key="item.locale"
        class="locale-chip"
      >
        <span class="locale-chip-code">{{ item.locale }}</span>
        <span class="locale-chip-value">{{ item.label }}</span>
      </div>
    </div>

    <!-- Child Categories -->
    <section
      v-if="childNodes.length > 0"
      class="overview-section"
    >
      <div class="section-title">
        <h3>Child categories</h3>
        <span>{{ childNodes.length }}</span>
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
        <h3>Tags</h3>
        <span>{{ node.tags.length }} items</span>
      </div>
      <div class="tag-list">
        <div
          v-for="tag in node.tags"
          :key="tag"
          :class="[
            'tag-chip',
            {
              'tag-chip--active': focusedTag === tag,
            },
          ]"
        >
          <span class="tag-chip-label">{{ getTagLabel(tag, locale, translations) }}</span>
          <span class="tag-chip-name">{{ tag }}</span>
          <span
            v-if="tagFrequency[tag]"
            class="tag-chip-count"
          >{{ tagFrequency[tag].toLocaleString() }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
