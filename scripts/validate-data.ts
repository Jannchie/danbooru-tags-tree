/**
 * Integrity checks for the taxonomy source data.
 *
 * The taxonomy and its translations are edited by hand and by migration
 * scripts. Nothing else verifies that a tag stayed unique, that a moved node
 * took its translation key with it, or that a Japanese label is actually
 * Japanese. This script does.
 *
 *   pnpm validate:data          fail on errors, print warnings
 *   pnpm validate:data --strict treat warnings as errors too
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import YAML from 'yaml'

import { readTagFrequency } from './tag-frequency.ts'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = resolve(ROOT, 'data', 'source')
const TAXONOMY_FILE = 'danbooru_tag_tree_v3.yaml'
const TRANSLATIONS_FILE = 'danbooru_tag_tree_v3.multilingual.yaml'
const FREQUENCY_FILE = 'tag_frequency_general.csv'
const HOMOGRAPH_FILE = 'ja-zh-homographs.txt'
const TAG_KEY = '_tags'
const MAX_DEPTH = 6
const ISSUE_PRINT_LIMIT = 40
const LOCALES = ['en', 'ja', 'zh-CN'] as const
const CATCH_ALL_PATTERN = /^(?:general|other|others|misc|special|etc|uncategorized)$|(?:_misc|_general|_other)$/
const TAG_PATTERN = /^[^A-Z\s]+$/

type RawRecord = Record<string, unknown>

interface LocalizedLabel {
  en?: string
  ja?: string
  'zh-CN'?: string
}

interface Leaf {
  id: string
  slug: string
  depth: number
  tags: string[]
}

/** How the tree decides which Danbooru tags it covers, from `_meta.membership`. */
interface MembershipRule {
  source: string
  min_post_count: number
  exempt: string[]
}

interface Taxonomy {
  declaredTotalTags: number | undefined
  membership: MembershipRule | undefined
  nodeIds: string[]
  leaves: Leaf[]
  tagOwners: Map<string, string[]>
}

const errors: string[] = []
const warnings: string[] = []

function fail(message: string): void {
  errors.push(message)
}

function warn(message: string): void {
  warnings.push(message)
}

function isPlainRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function read(name: string): string {
  return readFileSync(resolve(SRC, name), 'utf-8')
}

function isCatchAll(slug: string): boolean {
  return CATCH_ALL_PATTERN.test(slug)
}

function countTags(leaves: Leaf[]): number {
  return leaves.reduce((sum, leaf) => sum + leaf.tags.length, 0)
}

function loadTaxonomy(): Taxonomy {
  const parsed = YAML.parse(read(TAXONOMY_FILE)) as unknown

  if (!isPlainRecord(parsed)) {
    throw new Error(`${TAXONOMY_FILE} did not parse into a mapping`)
  }

  const meta = isPlainRecord(parsed._meta) ? parsed._meta : {}
  const declared = meta.source_total_tags
  const nodeIds: string[] = []
  const leaves: Leaf[] = []
  const tagOwners = new Map<string, string[]>()

  function claimTags(id: string, slug: string, depth: number, value: unknown): void {
    if (!Array.isArray(value)) {
      fail(`${id}: expected a list of tags, got ${typeof value}`)
      return
    }

    const tags: string[] = []

    for (const item of value) {
      if (typeof item !== 'string') {
        fail(`${id}: tag list contains a non-string entry (${JSON.stringify(item)})`)
        continue
      }

      tags.push(item)

      const owners = tagOwners.get(item)

      if (owners) {
        owners.push(id)
        continue
      }

      tagOwners.set(item, [id])
    }

    leaves.push({ id, slug, depth, tags })
  }

  function walk(slug: string, value: unknown, path: string[]): void {
    const id = path.join('.')
    const depth = path.length

    nodeIds.push(id)

    if (Array.isArray(value)) {
      claimTags(id, slug, depth, value)
      return
    }

    if (!isPlainRecord(value)) {
      fail(`${id}: expected a mapping or a list of tags, got ${typeof value}`)
      return
    }

    const childKeys = Object.keys(value).filter((key) => key !== TAG_KEY)

    if (TAG_KEY in value) {
      claimTags(id, slug, depth, value[TAG_KEY])
    }

    if (childKeys.length === 0 && !(TAG_KEY in value)) {
      fail(`${id}: node has neither child categories nor tags`)
      return
    }

    for (const childKey of childKeys) {
      walk(childKey, value[childKey], [...path, childKey])
    }
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (key === '_meta') {
      continue
    }

    walk(key, value, [key])
  }

  return {
    declaredTotalTags: typeof declared === 'number' ? declared : undefined,
    membership: isPlainRecord(meta.membership) ? (meta.membership as unknown as MembershipRule) : undefined,
    nodeIds,
    leaves,
    tagOwners,
  }
}

function loadTranslations(): Record<string, LocalizedLabel> {
  const parsed = YAML.parse(read(TRANSLATIONS_FILE)) as unknown

  if (!isPlainRecord(parsed)) {
    throw new Error(`${TRANSLATIONS_FILE} did not parse into a mapping`)
  }

  const translations: Record<string, LocalizedLabel> = {}

  for (const [key, value] of Object.entries(parsed)) {
    if (!isPlainRecord(value)) {
      fail(`translation ${key}: expected a mapping of locale to label`)
      continue
    }

    translations[key] = value as LocalizedLabel
  }

  return translations
}

function loadHomographs(): Set<string> {
  const lines = read(HOMOGRAPH_FILE).split('\n')
  const allowed = new Set<string>()

  for (const line of lines) {
    const value = line.split('#')[0]?.trim() ?? ''

    if (value) {
      allowed.add(value)
    }
  }

  return allowed
}

function checkStructure(taxonomy: Taxonomy): void {
  for (const leaf of taxonomy.leaves) {
    if (leaf.tags.length === 0) {
      fail(`${leaf.id}: empty tag list`)
    }

    if (leaf.depth > MAX_DEPTH) {
      warn(`${leaf.id}: depth ${leaf.depth} exceeds the ${MAX_DEPTH}-level budget`)
    }
  }

  for (const [tag, owners] of taxonomy.tagOwners) {
    if (owners.length > 1) {
      fail(`tag "${tag}" is claimed by ${owners.length} nodes: ${owners.join(', ')}`)
    }

    if (!TAG_PATTERN.test(tag)) {
      fail(`tag "${tag}" must be lowercase and free of whitespace`)
    }
  }
}

function checkMeta(taxonomy: Taxonomy): void {
  const declared = taxonomy.declaredTotalTags

  if (declared === undefined) {
    warn('_meta.source_total_tags is missing, so the tag count is unverified')
    return
  }

  const actual = countTags(taxonomy.leaves)

  if (declared !== actual) {
    fail(`_meta.source_total_tags says ${declared}, the tree holds ${actual}`)
  }
}

function checkMembership(taxonomy: Taxonomy, frequency: Record<string, number>): void {
  const rule = taxonomy.membership

  if (!rule) {
    warn('_meta.membership is missing, so the tree has no recorded admission rule')
    return
  }

  const exempt = new Set(rule.exempt ?? [])
  const floor = rule.min_post_count

  for (const tag of taxonomy.tagOwners.keys()) {
    if (exempt.has(tag)) {
      continue
    }

    const count = frequency[tag]

    if (count === undefined) {
      fail(`tag "${tag}" is not in ${rule.source}; check its spelling against the CSV`)
      continue
    }

    if (count < floor) {
      fail(`tag "${tag}" has ${count} posts, below the ${floor} the tree admits`)
    }
  }

  const uncollected = Object.entries(frequency)
    .filter(([tag, count]) => count >= floor && !taxonomy.tagOwners.has(tag) && !exempt.has(tag))
    .sort((a, b) => b[1] - a[1])

  for (const [tag, count] of uncollected.slice(0, 20)) {
    fail(`tag "${tag}" has ${count} posts but no place in the tree`)
  }

  if (uncollected.length > 20) {
    fail(`... and ${uncollected.length - 20} more tags above the ${floor}-post floor are uncollected`)
  }
}

function checkTranslations(taxonomy: Taxonomy, translations: Record<string, LocalizedLabel>): void {
  const expected = new Set<string>()

  for (const id of taxonomy.nodeIds) {
    expected.add(`category.${id}`)
  }

  for (const tag of taxonomy.tagOwners.keys()) {
    expected.add(`tag.${tag}`)
  }

  for (const key of expected) {
    if (!(key in translations)) {
      fail(`missing translation for ${key}`)
    }
  }

  for (const key of Object.keys(translations)) {
    if (!expected.has(key)) {
      fail(`orphan translation ${key} has no node or tag behind it`)
    }
  }

  for (const [key, label] of Object.entries(translations)) {
    for (const locale of LOCALES) {
      const value = label[locale]

      if (typeof value !== 'string' || value.trim() === '') {
        fail(`translation ${key} is missing a ${locale} label`)
      }
    }
  }
}

function checkJapanese(translations: Record<string, LocalizedLabel>, homographs: Set<string>): void {
  const offenders: string[] = []

  for (const [key, label] of Object.entries(translations)) {
    const ja = label.ja
    const zh = label['zh-CN']

    if (typeof ja !== 'string' || typeof zh !== 'string' || ja !== zh) {
      continue
    }

    if (homographs.has(ja)) {
      continue
    }

    offenders.push(`${key} (${ja})`)
  }

  if (offenders.length === 0) {
    return
  }

  fail(
    `${offenders.length} entries copy zh-CN into ja without being a known homograph. `
    + `Translate them or add the word to ${HOMOGRAPH_FILE}. First 10: ${offenders.slice(0, 10).join(', ')}`,
  )
}

function printIssues(label: string, marker: string, messages: string[]): void {
  if (messages.length === 0) {
    return
  }

  console.log(`\n${messages.length} ${label}(s):`)

  for (const message of messages.slice(0, ISSUE_PRINT_LIMIT)) {
    console.log(`  ${marker} ${message}`)
  }

  if (messages.length > ISSUE_PRINT_LIMIT) {
    console.log(`  ... and ${messages.length - ISSUE_PRINT_LIMIT} more`)
  }
}

interface Load {
  tags: number
  vagueTags: number
  posts: number
  vaguePosts: number
}

function percent(part: number, whole: number): string {
  return whole === 0 ? '0.0%' : `${((part / whole) * 100).toFixed(1)}%`
}

/**
 * How much of each branch still sits in a `general` / `other` / `misc` leaf.
 *
 * Reported twice: by tag count, and weighted by how often those tags are
 * actually used. A branch can hold a lot of vague tags that nobody applies,
 * and the second number is the one worth sorting work by.
 */
function reportCatchAll(taxonomy: Taxonomy, frequency: Record<string, number>): void {
  const perRoot = new Map<string, Load>()
  const all: Load = { tags: 0, vagueTags: 0, posts: 0, vaguePosts: 0 }

  for (const leaf of taxonomy.leaves) {
    const root = leaf.id.split('.')[0] ?? leaf.id
    const load = perRoot.get(root) ?? { tags: 0, vagueTags: 0, posts: 0, vaguePosts: 0 }
    const posts = leaf.tags.reduce((sum, tag) => sum + (frequency[tag] ?? 0), 0)

    load.tags += leaf.tags.length
    load.posts += posts
    all.tags += leaf.tags.length
    all.posts += posts

    if (isCatchAll(leaf.slug)) {
      load.vagueTags += leaf.tags.length
      load.vaguePosts += posts
      all.vagueTags += leaf.tags.length
      all.vaguePosts += posts
    }

    perRoot.set(root, load)
  }

  console.log(`\nCatch-all load: ${all.vagueTags}/${all.tags} tags (${percent(all.vagueTags, all.tags)}), `
    + `${percent(all.vaguePosts, all.posts)} weighted by use`)

  const rows = [...perRoot.entries()].sort((a, b) => b[1].vaguePosts / b[1].posts - a[1].vaguePosts / a[1].posts)
  const nameWidth = Math.max(...rows.map(([root]) => root.length)) + 2

  console.log(`  ${'branch'.padEnd(nameWidth)}${'tags'.padStart(6)}${'vague'.padStart(7)}${'share'.padStart(8)}${'by use'.padStart(9)}`)

  for (const [root, load] of rows) {
    console.log(`  ${root.padEnd(nameWidth)}${String(load.tags).padStart(6)}${String(load.vagueTags).padStart(7)}`
      + `${percent(load.vagueTags, load.tags).padStart(8)}${percent(load.vaguePosts, load.posts).padStart(9)}`)
  }
}

const strict = process.argv.includes('--strict')
const taxonomy = loadTaxonomy()
const translations = loadTranslations()
const homographs = loadHomographs()
const frequency = readTagFrequency(resolve(SRC, FREQUENCY_FILE))

checkStructure(taxonomy)
checkMeta(taxonomy)
checkMembership(taxonomy, frequency)
checkTranslations(taxonomy, translations)
checkJapanese(translations, homographs)

console.log(`Nodes: ${taxonomy.nodeIds.length}  Leaves: ${taxonomy.leaves.length}  Tags: ${countTags(taxonomy.leaves)}`)
reportCatchAll(taxonomy, frequency)

printIssues('warning', '!', warnings)
printIssues('error', 'x', errors)

if (errors.length > 0 || (strict && warnings.length > 0)) {
  process.exit(1)
}

console.log('\nData looks consistent.')
