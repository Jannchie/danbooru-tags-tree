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
  deselect: []
  navigateTree: [nodeId: string]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const minimapRef = ref<HTMLCanvasElement | null>(null)

let sigma: Sigma | null = null
let graph: Graph | null = null
let resizeObserver: ResizeObserver | null = null
let minimapRAF = 0
let minimapDragging = false

// Cached minimap transform (updated each draw, reused by drag)
let mmMinX = 0
let mmMaxY = 0
let mmScale = 1
let mmOffsetX = 0
let mmOffsetY = 0

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

function mixColor(color1: string, color2: string, t: number): string {
  const r1 = Number.parseInt(color1.slice(1, 3), 16)
  const g1 = Number.parseInt(color1.slice(3, 5), 16)
  const b1 = Number.parseInt(color1.slice(5, 7), 16)
  const r2 = Number.parseInt(color2.slice(1, 3), 16)
  const g2 = Number.parseInt(color2.slice(3, 5), 16)
  const b2 = Number.parseInt(color2.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

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
    label: props.locale === 'ja' ? 'Danbooru タグ' : props.locale === 'zh-CN' ? 'Danbooru 标签' : 'Danbooru Tags',
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
  const hasSelection = !!selectedId && !!props.dataset.nodes[selectedId]
  const { pathNodeIds, pathEdgeIds } = buildPathState(selectedId)

  for (const nodeId of graph.nodes()) {
    const isSelected = nodeId === selectedId
    const isOnPath = pathNodeIds.has(nodeId)
    const dimmed = hasSelection && !isSelected && !isOnPath

    graph.setNodeAttribute(nodeId, 'selected', isSelected)
    graph.setNodeAttribute(nodeId, 'highlighted', isOnPath && !isSelected)
    graph.setNodeAttribute(nodeId, 'dimmed', dimmed)
    graph.setNodeAttribute(nodeId, 'forceLabel', isOnPath)
    graph.setNodeAttribute(nodeId, 'zIndex', isSelected ? 2 : isOnPath ? 1 : 0)
  }

  for (const currentEdgeId of graph.edges()) {
    const isOnPath = pathEdgeIds.has(currentEdgeId)
    const dimmed = hasSelection && !isOnPath

    graph.setEdgeAttribute(currentEdgeId, 'highlighted', isOnPath)
    graph.setEdgeAttribute(currentEdgeId, 'dimmed', dimmed)
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
          color: mixColor(baseColor, '#0c1020', 0.25),
          forceLabel: true,
          size: baseSize + 0.8,
          zIndex: 1,
        }
      }

      if (data.dimmed) {
        return {
          ...data,
          color: mixColor(baseColor, '#0c1020', 0.75),
          forceLabel: false,
          zIndex: 0,
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

      if (data.dimmed) {
        return {
          ...data,
          color: mixColor(baseColor, '#0c1020', 0.8),
          size: baseSize * 0.6,
        }
      }

      return data
    },
  })

  sigma.on('clickNode', ({ node }) => emit('select', node))
  sigma.on('doubleClickNode', ({ node, event }) => {
    event.original.preventDefault()
    emit('navigateTree', node)
  })
  sigma.on('clickStage', () => emit('deselect'))
  sigma.on('enterNode', () => { if (containerRef.value) containerRef.value.style.cursor = 'pointer' })
  sigma.on('leaveNode', () => { if (containerRef.value) containerRef.value.style.cursor = 'default' })

  sigma.on('afterRender', scheduleMinimapDraw)

  highlightSelected()
  scheduleMinimapDraw()
}

function drawMinimap(): void {
  if (!sigma || !graph || !minimapRef.value) return
  const canvas = minimapRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  ctx.scale(dpr, dpr)

  ctx.clearRect(0, 0, w, h)

  // Draw background
  ctx.fillStyle = 'rgba(12, 16, 32, 0.6)'
  ctx.roundRect(0, 0, w, h, 6)
  ctx.fill()

  // Compute graph bounding box in graph coordinates
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  graph.forEachNode((_id, attrs) => {
    const x = attrs.x as number
    const y = attrs.y as number
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  })

  const pad = 10
  const graphW = maxX - minX || 1
  const graphH = maxY - minY || 1
  const scale = Math.min((w - pad * 2) / graphW, (h - pad * 2) / graphH)
  const offsetX = (w - graphW * scale) / 2
  const offsetY = (h - graphH * scale) / 2

  // Cache for drag handler
  mmMinX = minX
  mmMaxY = maxY
  mmScale = scale
  mmOffsetX = offsetX
  mmOffsetY = offsetY

  function toMiniX(gx: number): number { return (gx - minX) * scale + offsetX }
  function toMiniY(gy: number): number { return (maxY - gy) * scale + offsetY }

  // Draw edges
  ctx.lineWidth = 0.3
  ctx.globalAlpha = 0.3
  graph!.forEachEdge((_edge, _attrs, _source, _target, sourceAttrs, targetAttrs) => {
    ctx!.strokeStyle = (sourceAttrs.color as string) || '#333'
    ctx!.beginPath()
    ctx!.moveTo(toMiniX(sourceAttrs.x as number), toMiniY(sourceAttrs.y as number))
    ctx!.lineTo(toMiniX(targetAttrs.x as number), toMiniY(targetAttrs.y as number))
    ctx!.stroke()
  })

  // Draw nodes
  ctx.globalAlpha = 0.8
  graph!.forEachNode((_id, attrs) => {
    const mx = toMiniX(attrs.x as number)
    const my = toMiniY(attrs.y as number)
    const r = Math.max(((attrs.size as number) || 3) * scale * 0.08, 0.8)
    ctx!.fillStyle = (attrs.color as string) || '#8690a6'
    ctx!.beginPath()
    ctx!.arc(mx, my, r, 0, Math.PI * 2)
    ctx!.fill()
  })

  // Draw viewport rectangle
  ctx.globalAlpha = 1
  const sigmaContainer = sigma!.getContainer()
  const containerWidth = sigmaContainer.clientWidth
  const containerHeight = sigmaContainer.clientHeight

  const topLeft = sigma!.viewportToGraph({ x: 0, y: 0 })
  const bottomRight = sigma!.viewportToGraph({ x: containerWidth, y: containerHeight })

  const vx = toMiniX(topLeft.x)
  const vy = toMiniY(topLeft.y)
  const vx2 = toMiniX(bottomRight.x)
  const vy2 = toMiniY(bottomRight.y)

  ctx.strokeStyle = 'rgba(134, 144, 166, 0.7)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(vx, vy, vx2 - vx, vy2 - vy)
}

function scheduleMinimapDraw(): void {
  if (minimapRAF) return
  minimapRAF = requestAnimationFrame(() => {
    minimapRAF = 0
    drawMinimap()
  })
}

function stopMinimapLoop(): void {
  if (minimapRAF) {
    cancelAnimationFrame(minimapRAF)
    minimapRAF = 0
  }
}

function minimapToGraph(mx: number, my: number): { x: number; y: number } {
  return {
    x: (mx - mmOffsetX) / mmScale + mmMinX,
    y: mmMaxY - (my - mmOffsetY) / mmScale,
  }
}

function moveCameraToMinimapPos(e: MouseEvent): void {
  if (!sigma || !minimapRef.value) return
  const rect = minimapRef.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const graphPos = minimapToGraph(mx, my)

  // Convert graph coords to viewport pixel, then to framed-graph coords used by camera
  const viewportPos = sigma.graphToViewport(graphPos)
  const framedPos = sigma.viewportToFramedGraph(viewportPos)

  const camera = sigma.getCamera()
  const state = camera.getState()

  if (minimapDragging) {
    camera.setState({ ...state, x: framedPos.x, y: framedPos.y })
  } else {
    camera.animate({ ...state, x: framedPos.x, y: framedPos.y }, { duration: 200 })
  }
}

function onMinimapPointerDown(e: PointerEvent): void {
  if (!minimapRef.value) return
  minimapDragging = true
  minimapRef.value.setPointerCapture(e.pointerId)
  moveCameraToMinimapPos(e)
}

function onMinimapPointerMove(e: PointerEvent): void {
  if (!minimapDragging) return
  moveCameraToMinimapPos(e)
}

function onMinimapPointerUp(): void {
  minimapDragging = false
}

function cleanup(): void {
  stopMinimapLoop()
  if (sigma) { sigma.kill(); sigma = null }
  graph = null
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    emit('deselect')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
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
  window.removeEventListener('keydown', onKeyDown)
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  cleanup()
})

watch(() => props.dataset, () => initSigma())

watch(() => props.locale, () => {
  if (!graph || !sigma) return
  graph.setNodeAttribute('root', 'label', props.locale === 'ja' ? 'Danbooru タグ' : props.locale === 'zh-CN' ? 'Danbooru 标签' : 'Danbooru Tags')
  for (const node of props.dataset.flatNodes) {
    graph.setNodeAttribute(node.id, 'label', getNodeLabel(node, props.locale, props.translations))
  }
  sigma.refresh()
})

watch(() => props.selectedNodeId, () => highlightSelected())
</script>

<template>
  <div class="graph-wrapper">
    <div
      ref="containerRef"
      class="graph-surface"
    />
    <canvas
      ref="minimapRef"
      class="graph-minimap"
      @pointerdown="onMinimapPointerDown"
      @pointermove="onMinimapPointerMove"
      @pointerup="onMinimapPointerUp"
      @pointercancel="onMinimapPointerUp"
    />
  </div>
</template>

<style scoped>
.graph-wrapper {
  position: relative;
  flex: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.graph-surface {
  position: absolute;
  inset: 0;
}

.graph-minimap {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 180px;
  height: 130px;
  border-radius: 6px;
  cursor: grab;
}
</style>
