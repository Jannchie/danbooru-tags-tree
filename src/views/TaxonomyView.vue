<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useTaxonomyData } from '@/composables/useTaxonomyData'
import { useTheme } from '@/composables/useTheme'
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

const {
  datasets,
  translations,
  tagFrequency,
  graphLayout,
  isLoading,
  error,
  ensureGraphLayoutLoaded,
  localeOptions,
} = useTaxonomyData()
const { theme, isDark, toggleTheme } = useTheme()

const route = useRoute()
const router = useRouter()

const searchText = ref('')
const manualOpenIds = ref<Set<string>>(new Set())

type NodeSearchEntry = {
  node: TaxonomyNode
  texts: string[]
}

type TagSearchEntry = {
  value: string
  label: string
  nodeId: string
  texts: string[]
}

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

  // Graph view allows empty selection
  if (viewMode.value === 'graph') {
    return ''
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
  [dataset, routeNodeId, viewMode],
  ([activeDataset, nodeId, activeViewMode]) => {
    if (!activeDataset) {
      return
    }

    // Graph view allows empty selection
    if (activeViewMode === 'graph') {
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
  viewMode,
  (activeViewMode) => {
    if (activeViewMode === 'graph') {
      void ensureGraphLayoutLoaded()
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

const normalizedSearchText = computed(() => searchText.value.trim().toLowerCase())

function normalizeSearchTexts(texts: string[]): string[] {
  return [...new Set(texts.map((text) => text.toLowerCase()))]
}

const nodeSearchEntries = computed<NodeSearchEntry[]>(() => {
  if (!dataset.value) {
    return []
  }

  return dataset.value.flatNodes.map((node) => ({
    node,
    texts: normalizeSearchTexts([
      getNodeLabel(node, locale.value, translations.value),
      getNodeLabel(node, 'en', translations.value),
      node.id,
      formatSlug(node.slug),
    ]),
  }))
})

const tagSearchEntries = computed<TagSearchEntry[]>(() => {
  if (!dataset.value) {
    return []
  }

  return dataset.value.flatTags.map((tag) => {
    const translatedLabel = getTagLabel(tag.value, locale.value, translations.value)

    return {
      value: tag.value,
      label: tag.label,
      nodeId: tag.nodeId,
      texts: normalizeSearchTexts([
        tag.value,
        tag.label,
        translatedLabel,
        `${tag.nodeId} ${tag.value}`,
      ]),
    }
  })
})

function insertTopMatch<T>(
  results: Array<{ item: T; score: number }>,
  item: T,
  score: number,
  limit: number,
): void {
  let insertAt = results.findIndex((entry) => score > entry.score)

  if (insertAt === -1) {
    if (results.length >= limit) {
      return
    }

    insertAt = results.length
  }

  results.splice(insertAt, 0, { item, score })

  if (results.length > limit) {
    results.pop()
  }
}

const searchResults = computed(() => {
  const query = normalizedSearchText.value

  if (!query) {
    return {
      nodes: [],
      tags: [],
    }
  }

  const nodeResults: Array<{ item: TaxonomyNode; score: number }> = []

  for (const entry of nodeSearchEntries.value) {
    const score = bestScore(entry.texts, query)

    if (score !== -1) {
      insertTopMatch(nodeResults, entry.node, score, 8)
    }
  }

  const tagResults: Array<{
    item: { value: string; label: string; nodeId: string }
    score: number
  }> = []

  for (const entry of tagSearchEntries.value) {
    const score = bestScore(entry.texts, query)

    if (score !== -1) {
      insertTopMatch(tagResults, entry, score, 10)
    }
  }

  return {
    nodes: nodeResults.map(({ item, score }) => ({ node: item, score })),
    tags: tagResults.map(({ item, score }) => ({
      value: item.value,
      label: item.label,
      nodeId: item.nodeId,
      score,
    })),
  }
})

const hasSearchResults = computed(
  () => normalizedSearchText.value.length > 0 && (searchResults.value.nodes.length > 0 || searchResults.value.tags.length > 0),
)

const hasNoResults = computed(
  () => normalizedSearchText.value.length > 0 && searchResults.value.nodes.length === 0 && searchResults.value.tags.length === 0,
)

const sharedRouteProps = computed(() => {
  if (!dataset.value) {
    return null
  }

  return {
    dataset: dataset.value,
    selectedNodeId: selectedNodeId.value,
    locale: locale.value,
    translations: translations.value,
  }
})

const treeRouteProps = computed(() => {
  if (!sharedRouteProps.value || !selectedNode.value) {
    return null
  }

  return {
    ...sharedRouteProps.value,
    selectedNode: selectedNode.value,
    focusedTag: focusedTag.value,
    tagFrequency: tagFrequency.value,
    openIds: manualOpenIds.value,
  }
})

const graphRouteProps = computed(() => {
  if (!sharedRouteProps.value) {
    return null
  }

  return {
    ...sharedRouteProps.value,
    graphLayout: graphLayout.value,
    theme: theme.value,
  }
})

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

function deselectNode(): void {
  void router.push(buildRouteLocation({ nodeId: '', tag: null }))
}

function navigateToTree(nodeId: string): void {
  if (!dataset.value?.nodes[nodeId]) return
  openSelectedAncestors(nodeId)
  void router.push(buildRouteLocation({ nodeId, view: 'tree', tag: null }))
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
    v-else-if="dataset && (selectedNode || viewMode === 'graph')"
    class="app"
  >
    <header class="header">
      <div class="header-brand">
        <img src="/favicon.svg" alt="logo" class="header-logo" />
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

      <button
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        class="theme-toggle"
        type="button"
        @click="toggleTheme"
      >
        <span class="theme-toggle-icon">{{ isDark ? '☀' : '☾' }}</span>
        <span class="theme-toggle-label">{{ isDark ? 'Light' : 'Dark' }}</span>
      </button>

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
      <RouterView v-slot="{ Component }">
        <component
          :is="Component"
          v-if="viewMode === 'tree' && treeRouteProps"
          v-bind="treeRouteProps"
          @select="selectNode"
          @toggle="toggleNode"
        />
        <component
          :is="Component"
          v-else-if="graphRouteProps"
          v-bind="graphRouteProps"
          @select="selectNode"
          @deselect="deselectNode"
          @navigate-tree="navigateToTree"
        />
      </RouterView>
    </main>
  </div>
</template>
