export type DatasetVersion = 'default'
export type LocaleCode = 'en' | 'zh-CN' | 'ja'

export interface LocalizedLabel {
  en?: string
  'zh-CN'?: string
  ja?: string
}

export interface TaxonomyNode {
  id: string
  slug: string
  path: string[]
  categoryKey: string
  depth: number
  parentId: string | null
  children: string[]
  tags: string[]
  directTagCount: number
  totalTagCount: number
  descendantCount: number
}

export interface DatasetMeta {
  [key: string]: unknown
}

export interface TaxonomyDataset {
  version: DatasetVersion
  label: string
  meta: DatasetMeta
  rootId: 'root'
  rootChildren: string[]
  nodes: Record<string, TaxonomyNode>
  flatNodes: TaxonomyNode[]
  flatTags: {
    value: string
    label: string
    nodeId: string
  }[]
  totalNodeCount: number
  totalTagCount: number
}

type RawRecord = Record<string, unknown>

function isPlainRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function formatSlug(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').trim()
}

export function castTranslations(parsed: unknown): Record<string, LocalizedLabel> {
  if (!isPlainRecord(parsed)) {
    return {}
  }

  const translations: Record<string, LocalizedLabel> = {}

  for (const [key, value] of Object.entries(parsed)) {
    if (!isPlainRecord(value)) {
      continue
    }

    translations[key] = {
      en: typeof value.en === 'string' ? value.en : undefined,
      'zh-CN': typeof value['zh-CN'] === 'string' ? value['zh-CN'] : undefined,
      ja: typeof value.ja === 'string' ? value.ja : undefined,
    }
  }

  return translations
}

export function getNodeLabel(
  node: TaxonomyNode,
  locale: LocaleCode,
  translations: Record<string, LocalizedLabel>,
): string {
  const localized = translations[node.categoryKey]

  return localized?.[locale] ?? localized?.en ?? formatSlug(node.slug)
}

export function getTagLabel(
  tag: string,
  locale: LocaleCode,
  translations: Record<string, LocalizedLabel>,
): string {
  const localized = translations[`tag.${tag}`]

  return localized?.[locale] ?? localized?.en ?? formatSlug(tag)
}

export function buildDataset(
  parsed: unknown,
  version: DatasetVersion,
): TaxonomyDataset {
  if (!isPlainRecord(parsed)) {
    throw new Error(`Invalid taxonomy data for ${version}`)
  }

  const meta = isPlainRecord(parsed._meta) ? parsed._meta : {}

  const nodes: Record<string, TaxonomyNode> = {
    root: {
      id: 'root',
      slug: 'root',
      path: [],
      categoryKey: 'category.root',
      depth: -1,
      parentId: null,
      children: [],
      tags: [],
      directTagCount: 0,
      totalTagCount: 0,
      descendantCount: 0,
    },
  }

  function addNode(entryKey: string, entryValue: unknown, parentId: string, path: string[]): void {
    const id = path.join('.')
    const tags = Array.isArray(entryValue)
      ? entryValue.filter((item): item is string => typeof item === 'string')
      : []

    nodes[id] = {
      id,
      slug: entryKey,
      path,
      categoryKey: `category.${id}`,
      depth: path.length - 1,
      parentId,
      children: [],
      tags,
      directTagCount: tags.length,
      totalTagCount: tags.length,
      descendantCount: 0,
    }

    nodes[parentId]?.children.push(id)

    if (isPlainRecord(entryValue)) {
      for (const [childKey, childValue] of Object.entries(entryValue)) {
        addNode(childKey, childValue, id, [...path, childKey])
      }
    }
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (key === '_meta') {
      continue
    }

    addNode(key, value, 'root', [key])
  }

  function finalizeNode(nodeId: string): { totalTags: number; totalDescendants: number } {
    const node = nodes[nodeId]

    if (!node) {
      return {
        totalTags: 0,
        totalDescendants: 0,
      }
    }

    let totalTags = node.directTagCount
    let totalDescendants = 0

    for (const childId of node.children) {
      const childResult = finalizeNode(childId)
      totalTags += childResult.totalTags
      totalDescendants += childResult.totalDescendants + 1
    }

    node.totalTagCount = totalTags
    node.descendantCount = totalDescendants

    return {
      totalTags,
      totalDescendants,
    }
  }

  const rootSummary = finalizeNode('root')
  const flatNodes = Object.values(nodes).filter((node) => node.id !== 'root')
  const flatTags = flatNodes.flatMap((node) =>
    node.tags.map((tag) => ({
      value: tag,
      label: formatSlug(tag),
      nodeId: node.id,
    })),
  )

  return {
    version,
    label: 'Danbooru Tag Taxonomy',
    meta,
    rootId: 'root',
    rootChildren: [...nodes.root.children],
    nodes,
    flatNodes,
    flatTags,
    totalNodeCount: flatNodes.length,
    totalTagCount: rootSummary.totalTags,
  }
}

export function getAncestorIds(dataset: TaxonomyDataset, nodeId: string): string[] {
  const ancestors: string[] = []
  let currentId = dataset.nodes[nodeId]?.parentId ?? null

  while (currentId && currentId !== dataset.rootId) {
    ancestors.unshift(currentId)
    currentId = dataset.nodes[currentId]?.parentId ?? null
  }

  return ancestors
}

export function serializeMetaValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  if (isPlainRecord(value)) {
    return `${Object.keys(value).length} entries`
  }

  return String(value)
}
