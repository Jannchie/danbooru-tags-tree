<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useTaxonomyData } from '@/composables/useTaxonomyData'
import {
  DEFAULT_LOCALE,
  taxonomyRouteName,
  type ViewMode,
} from '@/router/routeState'
import {
  formatSlug,
  getAncestorIds,
  getNodeLabel,
  getTagLabel,
  type LocaleCode,
  type TaxonomyNode,
} from '@/utils/taxonomy'

const { datasets, translations, tagFrequency, graphLayout, isLoading, error, localeOptions } = useTaxonomyData()

const route = useRoute()
const router = useRouter()

const searchText = ref('')
const manualOpenIds = ref<Set<string>>(new Set())

const dataset = computed(() => datasets.value?.default ?? null)

const locale = computed<LocaleCode>(() => {
  const value = route.params.locale

  return value === 'en' || value === 'ja' || value === 'zh-CN' ? value : DEFAULT_LOCALE
})

const viewMode = computed<ViewMode>(() => {
  const name = route.name as string | undefined
  return name?.endsWith('-graph') ? 'graph' : 'tree'
})

const routeNodeId = computed(() => (typeof route.params.nodeId === 'string' ? route.params.nodeId : null))
const routeFocusedTag = computed(() => (typeof route.query.tag === 'string' ? route.query.tag : null))

function firstNodeId(): string {
  return datasets.value?.default.rootChildren[0] ?? ''
}

const selectedNodeId = computed(() => {
  if (!dataset.value) {
    return ''
  }

  const nodeId = routeNodeId.value

  if (nodeId && dataset.value.nodes[nodeId]) {
    return nodeId
  }

  return firstNodeId()
})

const selectedNode = computed<TaxonomyNode | null>(() => {
  if (!dataset.value) {
    return null
  }

  return dataset.value.nodes[selectedNodeId.value] ?? null
})

const focusedTag = computed(() => {
  const tag = routeFocusedTag.value

  return tag && selectedNode.value?.tags.includes(tag) ? tag : null
})

function buildRouteLocation(options: {
  locale?: LocaleCode
  view?: ViewMode
  nodeId?: string
  tag?: string | null
}) {
  const nodeId = options.nodeId ?? selectedNodeId.value
  const tag = options.tag === undefined ? routeFocusedTag.value : options.tag
  const view = options.view ?? viewMode.value

  return {
    name: taxonomyRouteName(view),
    params: {
      locale: options.locale ?? locale.value,
      ...(nodeId ? { nodeId } : {}),
    },
    query: tag ? { tag } : {},
  }
}

watch(
  [dataset, routeNodeId],
  ([activeDataset, nodeId]) => {
    if (!activeDataset) {
      return
    }

    const fallbackNodeId = nodeId && activeDataset.nodes[nodeId] ? nodeId : firstNodeId()

    if (fallbackNodeId && fallbackNodeId !== nodeId) {
      void router.replace(buildRouteLocation({ nodeId: fallbackNodeId, tag: null }))
    }
  },
  {
    immediate: true,
  },
)

watch(
  [dataset, selectedNodeId],
  ([activeDataset, nodeId]) => {
    if (!activeDataset || !nodeId) {
      return
    }

    const nextOpenIds = new Set(
      manualOpenIds.value.size > 0 ? manualOpenIds.value : activeDataset.rootChildren,
    )
    let shouldUpdate = manualOpenIds.value.size === 0

    for (const ancestorId of getAncestorIds(activeDataset, nodeId)) {
      if (nextOpenIds.has(ancestorId)) {
        continue
      }

      nextOpenIds.add(ancestorId)
      shouldUpdate = true
    }

    if (shouldUpdate) {
      manualOpenIds.value = nextOpenIds
    }
  },
  {
    immediate: true,
  },
)

watch(
  [selectedNode, routeFocusedTag],
  ([node, tag]) => {
    if (!node || !tag || node.tags.includes(tag)) {
      return
    }

    void router.replace(buildRouteLocation({ tag: null }))
  },
  {
    immediate: true,
  },
)

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

function openSelectedAncestors(nodeId: string): void {
  if (!dataset.value || !dataset.value.nodes[nodeId]) {
    return
  }

  const ancestorIds = getAncestorIds(dataset.value, nodeId)
  manualOpenIds.value = new Set([...manualOpenIds.value, ...ancestorIds])
}

function selectNode(nodeId: string): void {
  if (!dataset.value || !dataset.value.nodes[nodeId]) {
    return
  }

  openSelectedAncestors(nodeId)
  searchText.value = ''

  void router.push(buildRouteLocation({ nodeId, tag: null }))
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

  openSelectedAncestors(nodeId)
  searchText.value = ''

  void router.push(buildRouteLocation({ nodeId, tag }))
}

function setViewMode(nextView: ViewMode): void {
  if (viewMode.value === nextView) {
    return
  }

  void router.push(buildRouteLocation({ view: nextView }))
}

function setLocale(nextLocale: LocaleCode): void {
  if (locale.value === nextLocale) {
    return
  }

  void router.push(buildRouteLocation({ locale: nextLocale }))
}
</script>

<template>
  <div
    v-if="isLoading && !dataset"
    class="loading-screen"
  >
    <div class="loading-spinner" />
    <span class="loading-text">Loading taxonomy data...</span>
  </div>

  <div
    v-else-if="error"
    class="error-screen"
  >
    <span class="error-title">Failed to load data</span>
    <span class="error-message">{{ error }}</span>
  </div>

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
          @click="setViewMode('tree')"
        >
          Tree
        </button>
        <button
          :class="['toggle-btn', { active: viewMode === 'graph' }]"
          type="button"
          @click="setViewMode('graph')"
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
          @click="setLocale(opt.value)"
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
      <RouterView
        :dataset="dataset"
        :selected-node-id="selectedNodeId"
        :selected-node="selectedNode"
        :locale="locale"
        :focused-tag="focusedTag"
        :translations="translations"
        :tag-frequency="tagFrequency"
        :graph-layout="graphLayout"
        :open-ids="manualOpenIds"
        @select="selectNode"
        @toggle="toggleNode"
      />
    </main>
  </div>
</template>
