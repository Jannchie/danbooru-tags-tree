<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import GraphView from '@/components/GraphView.vue'
import NodeOverview from '@/components/NodeOverview.vue'
import TaxonomyTree from '@/components/TaxonomyTree.vue'
import { useTaxonomyData } from '@/composables/useTaxonomyData'
import {
  formatSlug,
  getAncestorIds,
  getNodeLabel,
  getTagLabel,
  type LocaleCode,
  type TaxonomyNode,
} from '@/utils/taxonomy'

const { datasets, translations, tagFrequency, isLoading, error, localeOptions } = useTaxonomyData()

function readHashState(): {
  locale: LocaleCode
  nodeId: string | null
} {
  const hash = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(hash)
  const nextLocale = params.get('locale')

  return {
    locale: nextLocale === 'en' || nextLocale === 'ja' || nextLocale === 'zh-CN' ? nextLocale : 'zh-CN',
    nodeId: params.get('node'),
  }
}

const initialHashState = readHashState()

type ViewMode = 'tree' | 'graph'

const locale = ref<LocaleCode>(initialHashState.locale)
const viewMode = ref<ViewMode>('tree')
const searchText = ref('')
const focusedTag = ref<string | null>(null)
const manualOpenIds = ref<Set<string>>(new Set())
const selectedNodeId = ref<string>(initialHashState.nodeId ?? '')

const dataset = computed(() => datasets.value?.default ?? null)

function firstNodeId(): string {
  return datasets.value?.default.rootChildren[0] ?? ''
}

watch(
  datasets,
  (datasetMap) => {
    if (!datasetMap) {
      return
    }

    const activeDataset = datasetMap.default

    if (initialHashState.nodeId && activeDataset.nodes[initialHashState.nodeId]) {
      selectedNodeId.value = initialHashState.nodeId
    } else if (!activeDataset.nodes[selectedNodeId.value]) {
      selectedNodeId.value = firstNodeId()
    }

    if (manualOpenIds.value.size === 0) {
      manualOpenIds.value = new Set(activeDataset.rootChildren)
    }
  },
  {
    immediate: true,
  },
)

watch(
  [selectedNodeId, locale, datasets],
  ([nodeId, activeLocale, datasetMap]) => {
    if (!datasetMap || !nodeId) {
      return
    }

    const params = new URLSearchParams()
    params.set('locale', activeLocale)
    params.set('node', nodeId)
    window.history.replaceState(null, '', `#${params.toString()}`)
  },
  {
    immediate: true,
  },
)

const selectedNode = computed<TaxonomyNode | null>(() => {
  if (!dataset.value) {
    return null
  }

  const fallbackId = firstNodeId()

  return dataset.value.nodes[selectedNodeId.value] ?? dataset.value.nodes[fallbackId] ?? null
})

const summaryStats = computed(() =>
  dataset.value
    ? [
        {
          label: 'categories',
          value: dataset.value.rootChildren.length,
        },
        {
          label: 'nodes',
          value: dataset.value.totalNodeCount,
        },
        {
          label: 'tags',
          value: dataset.value.totalTagCount,
        },
      ]
    : [],
)

const searchResults = computed(() => {
  if (!dataset.value) {
    return {
      nodes: [],
      tags: [],
    }
  }

  const query = searchText.value.trim().toLowerCase()

  if (!query) {
    return {
      nodes: [],
      tags: [],
    }
  }

  const nodeResults = dataset.value.flatNodes
    .map((node) => {
      const texts = [
        getNodeLabel(node, locale.value, translations.value),
        getNodeLabel(node, 'en', translations.value),
        node.id,
        formatSlug(node.slug),
      ]
      const score = bestScore(texts, query)

      return score === -1
        ? null
        : {
            node,
            score,
          }
    })
    .filter((item): item is { node: TaxonomyNode; score: number } => item !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)

  const tagResults = dataset.value.flatTags
    .map((tag) => {
      const translatedLabel = getTagLabel(tag.value, locale.value, translations.value)
      const texts = [tag.value, tag.label, translatedLabel, `${tag.nodeId} ${tag.value}`]
      const score = bestScore(texts, query)

      return score === -1
        ? null
        : {
            ...tag,
            score,
          }
    })
    .filter((item): item is { value: string; label: string; nodeId: string; score: number } => item !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)

  return {
    nodes: nodeResults,
    tags: tagResults,
  }
})

const hasSearchResults = computed(
  () => searchText.value.trim().length > 0 && (searchResults.value.nodes.length > 0 || searchResults.value.tags.length > 0),
)

const hasNoResults = computed(
  () => searchText.value.trim().length > 0 && searchResults.value.nodes.length === 0 && searchResults.value.tags.length === 0,
)

function bestScore(texts: string[], query: string): number {
  let score = -1

  for (const text of texts) {
    const lower = text.toLowerCase()
    const index = lower.indexOf(query)

    if (index === -1) {
      continue
    }

    const nextScore = index === 0 ? 100 : Math.max(10, 80 - index)
    score = Math.max(score, nextScore)
  }

  return score
}

function selectNode(nodeId: string): void {
  if (!dataset.value || !dataset.value.nodes[nodeId]) {
    return
  }

  selectedNodeId.value = nodeId
  focusedTag.value = null
  searchText.value = ''

  const ancestorIds = getAncestorIds(dataset.value, nodeId)
  manualOpenIds.value = new Set([...manualOpenIds.value, ...ancestorIds])
}

function toggleNode(nodeId: string): void {
  if (!dataset.value?.nodes[nodeId]) {
    return
  }

  const next = new Set(manualOpenIds.value)

  if (next.has(nodeId)) {
    next.delete(nodeId)
  } else {
    next.add(nodeId)
  }

  manualOpenIds.value = next
}

function focusTag(nodeId: string, tag: string): void {
  if (!dataset.value || !dataset.value.nodes[nodeId]) {
    return
  }

  selectedNodeId.value = nodeId
  focusedTag.value = tag
  searchText.value = ''

  const ancestorIds = getAncestorIds(dataset.value, nodeId)
  manualOpenIds.value = new Set([...manualOpenIds.value, ...ancestorIds])
}
</script>

<template>
  <!-- Loading -->
  <div
    v-if="isLoading && !dataset"
    class="loading-screen"
  >
    <div class="loading-spinner" />
    <span class="loading-text">Loading taxonomy data...</span>
  </div>

  <!-- Error -->
  <div
    v-else-if="error"
    class="error-screen"
  >
    <span class="error-title">Failed to load data</span>
    <span class="error-message">{{ error }}</span>
  </div>

  <!-- App -->
  <div
    v-else-if="dataset && selectedNode"
    class="app"
  >
    <header class="header">
      <div class="header-brand">
        <h1>Danbooru Tags Tree</h1>
      </div>

      <div class="toggle-group">
        <button
          :class="['toggle-btn', { active: viewMode === 'tree' }]"
          type="button"
          @click="viewMode = 'tree'"
        >
          Tree
        </button>
        <button
          :class="['toggle-btn', { active: viewMode === 'graph' }]"
          type="button"
          @click="viewMode = 'graph'"
        >
          Graph
        </button>
      </div>

      <div class="toggle-group">
        <button
          v-for="opt in localeOptions"
          :key="opt.value"
          :class="['toggle-btn', { active: locale === opt.value }]"
          type="button"
          @click="locale = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <div class="header-search">
        <div class="search-wrap">
          <span class="search-icon">&#x2315;</span>
          <input
            v-model.trim="searchText"
            class="search-input"
            type="search"
            placeholder="Search categories & tags..."
            @keydown.escape="searchText = ''"
          >

          <div
            v-if="hasSearchResults"
            class="search-overlay"
          >
            <template v-if="searchResults.nodes.length > 0">
              <div class="search-group-title">
                Categories
              </div>
              <button
                v-for="item in searchResults.nodes"
                :key="item.node.id"
                class="search-result"
                type="button"
                @click="selectNode(item.node.id)"
              >
                <strong>{{ getNodeLabel(item.node, locale, translations) }}</strong>
                <span class="search-result-path">{{ item.node.id }}</span>
              </button>
            </template>

            <div
              v-if="searchResults.nodes.length > 0 && searchResults.tags.length > 0"
              class="search-divider"
            />

            <template v-if="searchResults.tags.length > 0">
              <div class="search-group-title">
                Tags
              </div>
              <button
                v-for="item in searchResults.tags"
                :key="`${item.nodeId}:${item.value}`"
                class="search-result"
                type="button"
                @click="focusTag(item.nodeId, item.value)"
              >
                <strong>{{ getTagLabel(item.value, locale, translations) }}</strong>
                <span class="search-result-path">{{ item.value }}</span>
              </button>
            </template>
          </div>

          <div
            v-else-if="hasNoResults"
            class="search-overlay"
          >
            <div class="search-empty">
              No results for "{{ searchText }}"
            </div>
          </div>
        </div>
      </div>

      <div class="header-stats">
        <span
          v-for="item in summaryStats"
          :key="item.label"
          class="stat-badge"
        >
          <strong>{{ item.value.toLocaleString() }}</strong> {{ item.label }}
        </span>
      </div>
    </header>

    <main class="workspace">
      <template v-if="viewMode === 'tree'">
        <aside class="sidebar">
          <TaxonomyTree
            :dataset="dataset"
            :selected-id="selectedNodeId"
            :locale="locale"
            :open-ids="manualOpenIds"
            :translations="translations"
            @select="selectNode"
            @toggle="toggleNode"
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
            @select="selectNode"
          />
        </section>
      </template>

      <template v-else>
        <GraphView
          :dataset="dataset"
          :locale="locale"
          :translations="translations"
          :tag-frequency="tagFrequency"
          :selected-node-id="selectedNodeId"
          @select="selectNode"
        />
      </template>
    </main>
  </div>
</template>
