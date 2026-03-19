<script setup lang="ts">
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import FA2Layout from 'graphology-layout-forceatlas2/worker'
import Sigma from 'sigma'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { LocaleCode, TaxonomyDataset } from '@/utils/taxonomy'
import type { LocalizedLabel } from '@/utils/taxonomy'
import { getNodeLabel } from '@/utils/taxonomy'

const props = defineProps<{
  dataset: TaxonomyDataset
  locale: LocaleCode
  translations: Record<string, LocalizedLabel>
  tagFrequency: Record<string, number>
  selectedNodeId: string
}>()

const emit = defineEmits<{
  select: [nodeId: string]
}>()

const containerRef = ref<HTMLDivElement | null>(null)

let sigma: Sigma | null = null
let graph: Graph | null = null
let layout: FA2Layout | null = null
let stopTimer: ReturnType<typeof setTimeout> | null = null

// Muted, cohesive palette
const CATEGORY_COLORS = [
  '#b07080', '#b09070', '#a0a060', '#70a070',
  '#60a0a0', '#6090b0', '#7080b0', '#9070a0',
  '#a070a0', '#b07090', '#a08060', '#80a080',
]

// Dimmed edge colors
const EDGE_COLORS = [
  '#6e4850', '#6e5a46', '#636340', '#466346',
  '#3e6363', '#3e5a6e', '#4a5070', '#5a4664',
  '#644664', '#6e465a', '#64503e', '#506350',
]

function getRootCategory(nodeId: string): string {
  return nodeId.split('.')[0]
}

// Node size by depth: depth 0 (root) is largest
const SIZE_BY_DEPTH = [18, 12, 8, 5.5, 4, 3.5, 3]

function computePositions(): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const { nodes, rootChildren } = props.dataset

  // Root node at center
  positions.set('root', { x: 0, y: 0 })

  const sectorAngle = (2 * Math.PI) / rootChildren.length
  const radiusStep = 40

  function layoutSubtree(nodeId: string, centerAngle: number, angleSpan: number, depth: number): void {
    const node = nodes[nodeId]
    if (!node) return

    const radius = depth * radiusStep
    positions.set(nodeId, {
      x: Math.cos(centerAngle) * radius,
      y: Math.sin(centerAngle) * radius,
    })

    const childIds = node.children
    if (childIds.length === 0) return

    const childAngleStep = angleSpan / childIds.length
    const startAngle = centerAngle - angleSpan / 2 + childAngleStep / 2

    childIds.forEach((childId, i) => {
      const childAngle = startAngle + i * childAngleStep
      layoutSubtree(childId, childAngle, childAngleStep, depth + 1)
    })
  }

  rootChildren.forEach((rootId, i) => {
    const centerAngle = i * sectorAngle - Math.PI / 2
    layoutSubtree(rootId, centerAngle, sectorAngle, 1)
  })

  return positions
}

function buildGraph(): Graph {
  const g = new Graph()
  const { rootChildren } = props.dataset
  // Color index per root category
  const colorIndexMap = new Map<string, number>()
  rootChildren.forEach((id, i) => {
    colorIndexMap.set(id, i % CATEGORY_COLORS.length)
  })

  // Add root ancestor node at center, fixed in place
  g.addNode('root', {
    label: 'Danbooru Tags',
    size: SIZE_BY_DEPTH[0],
    color: '#8690a6',
    x: 0,
    y: 0,
    fixed: true,
  })

  const allPositions = computePositions()

  // Add all category nodes
  for (const node of props.dataset.flatNodes) {
    const rootCat = getRootCategory(node.id)
    const ci = colorIndexMap.get(rootCat) ?? 0
    const color = CATEGORY_COLORS[ci]
    const label = getNodeLabel(node, props.locale, props.translations)
    const depth = node.depth + 1
    const size = SIZE_BY_DEPTH[Math.min(depth, SIZE_BY_DEPTH.length - 1)]
    const pos = allPositions.get(node.id) ?? { x: 0, y: 0 }

    g.addNode(node.id, {
      label,
      size,
      color,
      x: pos.x,
      y: pos.y,
    })
  }

  // Add edges: root -> top-level categories
  for (const rootChildId of rootChildren) {
    if (g.hasNode(rootChildId)) {
      const ci = colorIndexMap.get(rootChildId) ?? 0
      g.addEdge('root', rootChildId, {
        color: EDGE_COLORS[ci],
        size: 0.4,
      })
    }
  }

  // Add edges: parent -> child for all other nodes
  for (const node of props.dataset.flatNodes) {
    if (node.parentId && node.parentId !== 'root' && g.hasNode(node.parentId)) {
      const rootCat = getRootCategory(node.id)
      const ci = colorIndexMap.get(rootCat) ?? 0
      g.addEdge(node.parentId, node.id, {
        color: EDGE_COLORS[ci],
        size: 0.3,
      })
    }
  }

  return g
}

function highlightSelected(): void {
  if (!graph || !sigma) return
  const selectedId = props.selectedNodeId

  graph.forEachNode((nodeId) => {
    const isSelected = nodeId === selectedId
    graph!.setNodeAttribute(nodeId, 'highlighted', isSelected)
    graph!.setNodeAttribute(nodeId, 'zIndex', isSelected ? 1 : 0)
  })

  sigma.refresh()
}

function initSigma(): void {
  if (!containerRef.value) return

  cleanup()

  const fa2Settings = {
    gravity: 0.5,
    scalingRatio: 20,
    barnesHutOptimize: true,
    barnesHutTheta: 0.5,
    strongGravityMode: true,
    slowDown: 10,
    adjustSizes: true,
    linLogMode: false,
    outboundAttractionDistribution: true,
  }

  graph = buildGraph()

  sigma = new Sigma(graph, containerRef.value, {
    renderLabels: true,
    renderEdgeLabels: false,
    labelColor: { color: '#8690a6' },
    labelFont: 'Manrope, system-ui, sans-serif',
    labelSize: 12,
    labelDensity: 0.4,
    labelGridCellSize: 120,
    labelRenderedSizeThreshold: 4,
    defaultEdgeColor: '#1c2233',
    defaultEdgeType: 'line',
    stagePadding: 40,
    zIndex: true,
    nodeReducer(node, data) {
      const res = { ...data }
      if (data.highlighted) {
        res.color = '#f0a830'
        res.size = (data.size as number) + 2
        res.zIndex = 1
      }
      return res
    },
  })

  // Worker refines the remaining details
  layout = new FA2Layout(graph, { settings: fa2Settings })
  layout.start()

  // Auto-stop after convergence
  stopTimer = setTimeout(() => {
    if (layout?.isRunning()) layout.stop()
  }, 8000)

  sigma.on('clickNode', ({ node }) => {
    emit('select', node)
  })

  sigma.on('enterNode', () => {
    if (containerRef.value) containerRef.value.style.cursor = 'pointer'
  })
  sigma.on('leaveNode', () => {
    if (containerRef.value) containerRef.value.style.cursor = 'default'
  })

  highlightSelected()
}

function cleanup(): void {
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
  if (layout) { layout.kill(); layout = null }
  if (sigma) { sigma.kill(); sigma = null }
}

onMounted(() => {
  initSigma()
})

onBeforeUnmount(() => {
  cleanup()
})

watch(
  () => [props.dataset, props.locale],
  () => { initSigma() },
)

watch(
  () => props.selectedNodeId,
  () => { highlightSelected() },
)
</script>

<template>
  <div
    ref="containerRef"
    class="graph-container"
  />
</template>

<style scoped>
.graph-container {
  width: 100%;
  height: 100%;
  background: var(--bg-base);
}
</style>
