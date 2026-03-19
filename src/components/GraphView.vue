<script setup lang="ts">
import Graph from 'graphology'
import Sigma from 'sigma'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { LocaleCode, LocalizedLabel, TaxonomyDataset } from '@/utils/taxonomy'
import { getNodeLabel } from '@/utils/taxonomy'

const props = defineProps<{
  dataset: TaxonomyDataset
  locale: LocaleCode
  translations: Record<string, LocalizedLabel>
  selectedNodeId: string
  layoutPositions: Record<string, { x: number, y: number }> | null
}>()

const emit = defineEmits<{
  select: [nodeId: string]
}>()

const containerRef = ref<HTMLDivElement | null>(null)

let sigma: Sigma | null = null
let graph: Graph | null = null
let resizeObserver: ResizeObserver | null = null

const CATEGORY_COLORS = [
  '#b07080', '#b09070', '#a0a060', '#70a070',
  '#60a0a0', '#6090b0', '#7080b0', '#9070a0',
  '#a070a0', '#b07090', '#a08060', '#80a080',
]

const EDGE_COLORS = [
  '#6e4850', '#6e5a46', '#636340', '#466346',
  '#3e6363', '#3e5a6e', '#4a5070', '#5a4664',
  '#644664', '#6e465a', '#64503e', '#506350',
]

const SIZE_BY_DEPTH = [18, 12, 8, 5.5, 4, 3.5, 3]


function edgeKey(sourceId: string, targetId: string): string {
  return `${sourceId}->${targetId}`
}

function buildGraph(): Graph {
  const g = new Graph()
  const { rootChildren, flatNodes, nodes } = props.dataset

  // Color map for root categories
  const colorIndexMap = new Map<string, number>()
  rootChildren.forEach((id, i) => colorIndexMap.set(id, i % CATEGORY_COLORS.length))

  const positions = props.layoutPositions

  // Add all nodes with pre-computed or fallback positions
  g.addNode('root', {
    baseColor: '#8690a6',
    color: '#8690a6',
    fixed: true,
    label: 'Danbooru Tags',
    size: SIZE_BY_DEPTH[0],
    x: positions?.root?.x ?? 0,
    y: positions?.root?.y ?? 0,
  })

  for (const node of flatNodes) {
    const pos = positions?.[node.id]
    const ci = colorIndexMap.get(node.path[0]) ?? 0
    g.addNode(node.id, {
      baseColor: CATEGORY_COLORS[ci],
      color: CATEGORY_COLORS[ci],
      label: getNodeLabel(node, props.locale, props.translations),
      size: SIZE_BY_DEPTH[Math.min(node.depth + 1, SIZE_BY_DEPTH.length - 1)],
      x: pos?.x ?? 0,
      y: pos?.y ?? 0,
    })
  }

  // Edges (single loop)
  for (const node of flatNodes) {
    if (!node.parentId || !g.hasNode(node.parentId)) continue
    const ci = colorIndexMap.get(node.path[0]) ?? 0
    g.addEdgeWithKey(edgeKey(node.parentId, node.id), node.parentId, node.id, {
      baseColor: EDGE_COLORS[ci],
      color: EDGE_COLORS[ci],
      size: node.parentId === 'root' ? 0.4 : 0.3,
    })
  }

  return g
}

function buildPathState(nodeId: string): {
  pathNodeIds: Set<string>
  pathEdgeIds: Set<string>
} {
  const pathNodeIds = new Set<string>()
  const pathEdgeIds = new Set<string>()

  if (!nodeId || !props.dataset.nodes[nodeId]) {
    return { pathNodeIds, pathEdgeIds }
  }

  let currentId: string | null = nodeId

  while (currentId) {
    pathNodeIds.add(currentId)

    const parentId = props.dataset.nodes[currentId]?.parentId ?? null

    if (!parentId) {
      break
    }

    pathNodeIds.add(parentId)
    pathEdgeIds.add(edgeKey(parentId, currentId))
    currentId = parentId
  }

  return { pathNodeIds, pathEdgeIds }
}

function highlightSelected(): void {
  if (!graph || !sigma) return

  const selectedId = props.selectedNodeId
  const { pathNodeIds, pathEdgeIds } = buildPathState(selectedId)

  for (const nodeId of graph.nodes()) {
    const isSelected = nodeId === selectedId
    const isOnPath = pathNodeIds.has(nodeId)

    graph.setNodeAttribute(nodeId, 'selected', isSelected)
    graph.setNodeAttribute(nodeId, 'highlighted', isOnPath)
    graph.setNodeAttribute(nodeId, 'forceLabel', isOnPath)
    graph.setNodeAttribute(nodeId, 'zIndex', isSelected ? 2 : isOnPath ? 1 : 0)
  }

  for (const currentEdgeId of graph.edges()) {
    const isOnPath = pathEdgeIds.has(currentEdgeId)

    graph.setEdgeAttribute(currentEdgeId, 'highlighted', isOnPath)
    graph.setEdgeAttribute(currentEdgeId, 'zIndex', isOnPath ? 1 : 0)
  }

  sigma.refresh()
}

function initSigma(): void {
  if (!containerRef.value) return
  cleanup()

  graph = buildGraph()

  sigma = new Sigma(graph, containerRef.value, {
    defaultEdgeColor: '#1c2233',
    defaultEdgeType: 'line',
    labelColor: { color: '#8690a6' },
    labelDensity: 0.4,
    labelFont: 'Manrope, system-ui, sans-serif',
    labelGridCellSize: 120,
    labelRenderedSizeThreshold: 4,
    labelSize: 12,
    renderEdgeLabels: false,
    renderLabels: true,
    stagePadding: 40,
    zIndex: true,
    nodeReducer(_node, data) {
      const baseColor = typeof data.baseColor === 'string' ? data.baseColor : data.color
      const baseSize = typeof data.size === 'number' ? data.size : 0

      if (data.selected) {
        return {
          ...data,
          color: baseColor,
          forceLabel: true,
          size: baseSize + 2,
          zIndex: 2,
        }
      }

      if (data.highlighted) {
        return {
          ...data,
          color: baseColor,
          forceLabel: true,
          size: baseSize + 0.8,
          zIndex: 1,
        }
      }

      return data
    },
    edgeReducer(_edge, data) {
      const baseColor = typeof data.baseColor === 'string' ? data.baseColor : data.color
      const baseSize = typeof data.size === 'number' ? data.size : 0.3

      if (data.highlighted) {
        return {
          ...data,
          color: baseColor,
          size: baseSize + 0.7,
          zIndex: 1,
        }
      }

      return data
    },
  })

  sigma.on('clickNode', ({ node }) => emit('select', node))
  sigma.on('enterNode', () => { if (containerRef.value) containerRef.value.style.cursor = 'pointer' })
  sigma.on('leaveNode', () => { if (containerRef.value) containerRef.value.style.cursor = 'default' })

  highlightSelected()
}

function cleanup(): void {
  if (sigma) { sigma.kill(); sigma = null }
  graph = null
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    const el = containerRef.value
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (width <= 0 || height <= 0) return

    if (sigma) {
      sigma.resize()
    } else {
      initSigma()
    }
  })

  if (containerRef.value) resizeObserver.observe(containerRef.value)
  void nextTick(() => { if (!sigma) initSigma() })
})

onBeforeUnmount(() => {
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  cleanup()
})

watch(() => props.dataset, () => initSigma())

watch(() => props.locale, () => {
  if (!graph || !sigma) return
  for (const node of props.dataset.flatNodes) {
    graph.setNodeAttribute(node.id, 'label', getNodeLabel(node, props.locale, props.translations))
  }
  sigma.refresh()
})

watch(() => props.selectedNodeId, () => highlightSelected())
</script>

<template>
  <div
    ref="containerRef"
    class="graph-surface"
  />
</template>

<style scoped>
.graph-surface {
  flex: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
