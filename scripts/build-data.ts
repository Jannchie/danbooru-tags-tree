/**
 * Pre-process YAML + CSV data into optimised JSON files for the browser.
 *
 * Source:  data/source/   (version-controlled)
 * Output:  public/output/ (gitignored build artifacts)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import YAML from 'yaml'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = resolve(ROOT, 'data', 'source')
const OUT = resolve(ROOT, 'public', 'output')
const SOURCE_FILES = {
  taxonomy: 'danbooru_tag_tree_v3.yaml',
  translations: 'danbooru_tag_tree_v3.multilingual.yaml',
  tagFrequency: 'tag_frequency_general.csv',
} as const
const TAG_KEY = '_tags'

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

function read(name: string): string {
  return readFileSync(resolve(SRC, name), 'utf-8')
}

function writeJSON(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true })
  const json = JSON.stringify(data)
  writeFileSync(resolve(OUT, name), json)
  const kb = (Buffer.byteLength(json) / 1024).toFixed(0)
  console.log(`  ${name} (${kb} KB)`)
}

interface TaxNode {
  children: string[]
  path: string[]
  depth: number
}

type BuildTarget = 'taxonomy' | 'translations' | 'tag-frequency' | 'graph-layout'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

let cachedTaxonomyData: Record<string, unknown> | null = null

function loadTaxonomyData(): Record<string, unknown> {
  cachedTaxonomyData ??= YAML.parse(read(SOURCE_FILES.taxonomy)) as Record<string, unknown>
  return cachedTaxonomyData
}

function buildTaxonomy(): void {
  console.log('Converting taxonomy YAML to JSON...')
  writeJSON('taxonomy.json', loadTaxonomyData())
}

function buildTranslations(): void {
  console.log('Converting translations...')
  writeJSON('translations.json', YAML.parse(read(SOURCE_FILES.translations)))
}

function buildTagFrequency(): void {
  console.log('Converting tag frequency CSV...')
  const csv = read(SOURCE_FILES.tagFrequency)
  const freq: Record<string, number> = {}

  for (const line of csv.split('\n').slice(1)) {
    if (!line) continue
    const lastComma = line.lastIndexOf(',')
    if (lastComma === -1) continue
    const tag = line.slice(0, lastComma)
    const count = parseInt(line.slice(lastComma + 1), 10)
    if (tag && !isNaN(count)) {
      freq[tag] = count
    }
  }

  writeJSON('tag_frequency.json', freq)
}

function buildGraphLayout(): void {
  console.log('Computing graph layout...')

  const taxonomyData = loadTaxonomyData()

  const nodeMap: Record<string, TaxNode> = {}
  const rootChildren: string[] = []

  function collectNodes(key: string, value: unknown, parentPath: string[]): void {
    const path = [...parentPath, key]
    const id = path.join('.')
    const children: string[] = []

    if (isRecord(value)) {
      for (const [childKey, childValue] of Object.entries(value)) {
        if (childKey === TAG_KEY) {
          continue
        }

        collectNodes(childKey, childValue, path)
        children.push([...path, childKey].join('.'))
      }
    }

    nodeMap[id] = { children, path, depth: path.length - 1 }
  }

  for (const [key, value] of Object.entries(taxonomyData)) {
    if (key === '_meta') continue
    collectNodes(key, value, [])
    rootChildren.push(key)
  }

  const g = new Graph()
  const sectorAngle = (2 * Math.PI) / rootChildren.length
  const radiusStep = 10

  function assignPositions(nodeId: string, centerAngle: number, angleSpan: number, depth: number): void {
    const node = nodeMap[nodeId]

    if (!node) return

    const radius = depth * radiusStep
    g.addNode(nodeId, {
      x: Math.cos(centerAngle) * radius,
      y: Math.sin(centerAngle) * radius,
    })

    if (node.children.length === 0) return

    const step = angleSpan / node.children.length
    const start = centerAngle - angleSpan / 2 + step / 2
    node.children.forEach((childId, index) => assignPositions(childId, start + index * step, step, depth + 1))
  }

  g.addNode('root', { x: 0, y: 0 })
  rootChildren.forEach((id, index) => assignPositions(id, index * sectorAngle - Math.PI / 2, sectorAngle, 1))

  for (const [id, node] of Object.entries(nodeMap)) {
    const parentId = node.path.length > 1 ? node.path.slice(0, -1).join('.') : 'root'

    if (g.hasNode(parentId)) {
      g.addEdge(parentId, id)
    }
  }

  const forceAtlasSettings = {
    gravity: 1.5,
    barnesHutOptimize: true,
    barnesHutTheta: 0.5,
    strongGravityMode: true,
    adjustSizes: true,
    linLogMode: false,
    outboundAttractionDistribution: false,
    edgeWeightInfluence: 2,
  }

  const batchSize = 50
  const maxBatches = 200
  const rampBatches = 15
  const convergence = 0.01

  for (let batch = 0; batch < maxBatches; batch++) {
    const t = Math.min(batch / rampBatches, 1)
    const scalingRatio = 1 + 29 * t
    const slowDown = 1 + 19 * t

    const prev = new Map<string, { x: number; y: number }>()
    g.forEachNode((node, attrs) => {
      prev.set(node, { x: attrs.x as number, y: attrs.y as number })
    })

    forceAtlas2.assign(g, {
      iterations: batchSize,
      settings: { ...forceAtlasSettings, scalingRatio, slowDown },
    })

    let totalDisp = 0
    g.forEachNode((node, attrs) => {
      const p = prev.get(node)

      if (!p) return

      const dx = (attrs.x as number) - p.x
      const dy = (attrs.y as number) - p.y
      totalDisp += Math.sqrt(dx * dx + dy * dy)
    })

    const avg = totalDisp / g.order

    if (batch % 10 === 0) {
      console.log(`  batch ${batch}, scalingRatio=${scalingRatio.toFixed(1)}, avgDisp=${avg.toFixed(4)}`)
    }

    if (t >= 1 && avg < convergence) {
      console.log(`  Converged at batch ${batch} (avgDisp=${avg.toFixed(4)})`)
      break
    }
  }

  const positions: Record<string, { x: number; y: number }> = {}
  g.forEachNode((node, attrs) => {
    positions[node] = {
      x: Math.round((attrs.x as number) * 100) / 100,
      y: Math.round((attrs.y as number) * 100) / 100,
    }
  })

  writeJSON('graph-layout.json', positions)
}

function normalizeTargets(args: string[]): BuildTarget[] {
  const filteredArgs = args.filter((arg) => arg !== '--')

  if (filteredArgs.length === 0) {
    return ['taxonomy', 'translations', 'tag-frequency', 'graph-layout']
  }

  const targets = new Set<BuildTarget>()

  for (const arg of filteredArgs) {
    const normalizedArg = arg.replace(/^.*\//, '')

    if (normalizedArg === SOURCE_FILES.taxonomy || normalizedArg === 'taxonomy') {
      targets.add('taxonomy')
      targets.add('graph-layout')
      continue
    }

    if (normalizedArg === SOURCE_FILES.translations || normalizedArg === 'translations') {
      targets.add('translations')
      continue
    }

    if (normalizedArg === SOURCE_FILES.tagFrequency || normalizedArg === 'tag-frequency') {
      targets.add('tag-frequency')
      continue
    }

    if (normalizedArg === 'graph-layout') {
      targets.add('graph-layout')
      continue
    }

    throw new Error(`Unknown build target: ${arg}`)
  }

  return [...targets]
}

const targets = normalizeTargets(process.argv.slice(2))

for (const target of targets) {
  if (target === 'taxonomy') {
    buildTaxonomy()
    continue
  }

  if (target === 'translations') {
    buildTranslations()
    continue
  }

  if (target === 'tag-frequency') {
    buildTagFrequency()
    continue
  }

  buildGraphLayout()
}

console.log('Done!')
