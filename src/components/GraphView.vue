<script setup lang="ts">
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import FA2Layout from 'graphology-layout-forceatlas2/worker'
import Sigma from 'sigma'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { LocaleCode, LocalizedLabel, TaxonomyDataset } from '@/utils/taxonomy'
import { getNodeLabel } from '@/utils/taxonomy'

const props = defineProps<{
  dataset: TaxonomyDataset
  locale: LocaleCode
  translations: Record<string, LocalizedLabel>
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
let resizeObserver: ResizeObserver | null = null
let prevHighlightedId: string | null = null

const REFINE_DURATION_MS = 3000

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

const FA2_BASE = {
  gravity: 1.5,
  barnesHutOptimize: true,
  barnesHutTheta: 0.5,
  strongGravityMode: true,
  slowDown: 20,
  adjustSizes: true,
  linLogMode: false,
  outboundAttractionDistribution: false,
  edgeWeightInfluence: 2,
}

const PREWARM_PHASES = [
  { iterations: 60, scalingRatio: 1 },
  { iterations: 60, scalingRatio: 3 },
  { iterations: 60, scalingRatio: 5 },
  { iterations: 20, scalingRatio: 6 },
]

const fa2Settings = { ...FA2_BASE, scalingRatio: 30 }

function buildGraph(): Graph {
  const g = new Graph()
  const { rootChildren, flatNodes, nodes } = props.dataset

  // Color map for root categories
  const colorIndexMap = new Map<string, number>()
  rootChildren.forEach((id, i) => colorIndexMap.set(id, i % CATEGORY_COLORS.length))

  // Radial initial positions
  const sectorAngle = (2 * Math.PI) / rootChildren.length
  const radiusStep = 10

  function assignPositions(nodeId: string, centerAngle: number, angleSpan: number, depth: number): void {
    const node = nodes[nodeId]
    if (!node) return

    const radius = depth * radiusStep
    g.addNode(node.id, {
      color: CATEGORY_COLORS[colorIndexMap.get(node.path[0]) ?? 0],
      label: getNodeLabel(node, props.locale, props.translations),
      size: SIZE_BY_DEPTH[Math.min(node.depth + 1, SIZE_BY_DEPTH.length - 1)],
      x: Math.cos(centerAngle) * radius,
      y: Math.sin(centerAngle) * radius,
    })

    if (node.children.length === 0) return
    const step = angleSpan / node.children.length
    const start = centerAngle - angleSpan / 2 + step / 2
    node.children.forEach((childId, i) => assignPositions(childId, start + i * step, step, depth + 1))
  }

  // Root node (fixed at center)
  g.addNode('root', { color: '#8690a6', fixed: true, label: 'Danbooru Tags', size: SIZE_BY_DEPTH[0], x: 0, y: 0 })
  rootChildren.forEach((id, i) => assignPositions(id, i * sectorAngle - Math.PI / 2, sectorAngle, 1))

  // Edges (single loop)
  for (const node of flatNodes) {
    if (!node.parentId || !g.hasNode(node.parentId)) continue
    const ci = colorIndexMap.get(node.path[0]) ?? 0
    g.addEdge(node.parentId, node.id, {
      color: EDGE_COLORS[ci],
      size: node.parentId === 'root' ? 0.4 : 0.3,
    })
  }

  // Progressive prewarm
  for (const phase of PREWARM_PHASES) {
    forceAtlas2.assign(g, { iterations: phase.iterations, settings: { ...FA2_BASE, scalingRatio: phase.scalingRatio } })
  }

  return g
}

function highlightSelected(): void {
  if (!graph || !sigma) return

  if (prevHighlightedId && graph.hasNode(prevHighlightedId)) {
    graph.setNodeAttribute(prevHighlightedId, 'highlighted', false)
    graph.setNodeAttribute(prevHighlightedId, 'zIndex', 0)
  }

  const selectedId = props.selectedNodeId
  if (selectedId && graph.hasNode(selectedId)) {
    graph.setNodeAttribute(selectedId, 'highlighted', true)
    graph.setNodeAttribute(selectedId, 'zIndex', 1)
  }

  prevHighlightedId = selectedId
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
      if (!data.highlighted) return data
      return {
        ...data,
        color: '#f0a830',
        size: (typeof data.size === 'number' ? data.size : 0) + 2,
        zIndex: 1,
      }
    },
  })

  layout = new FA2Layout(graph, { settings: fa2Settings })
  layout.start()

  stopTimer = setTimeout(() => {
    if (layout?.isRunning()) layout.stop()
  }, REFINE_DURATION_MS)

  sigma.on('clickNode', ({ node }) => emit('select', node))
  sigma.on('enterNode', () => { if (containerRef.value) containerRef.value.style.cursor = 'pointer' })
  sigma.on('leaveNode', () => { if (containerRef.value) containerRef.value.style.cursor = 'default' })

  highlightSelected()
}

function cleanup(): void {
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
  if (layout) { layout.kill(); layout = null }
  if (sigma) { sigma.kill(); sigma = null }
  graph = null
  prevHighlightedId = null
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
