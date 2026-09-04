/**
 * Pull Chinese tag names from danbooru-tag-index into the multilingual source.
 *
 *   pnpm sync:zh [--tag-index DIR] [--dry-run]
 *
 * Chinese used to originate here, get copied into the pictoria image library,
 * and get imported from there into danbooru-tag-index -- a loop with no owner,
 * where a correction made at any point reached the other two only by accident.
 * danbooru-tag-index is the owner now: it is the only one of the three with a
 * review layer (a hand-checked correction file, a rejection list that can drop
 * a name outright, and post counts to prioritise by), so a name it ships has
 * been looked at and a name here has not.
 *
 * What that project does *not* have is Japanese for general tags, or names for
 * the 888 category nodes, or the tree itself. Those stay owned here, and this
 * script does not touch them -- it rewrites `zh-CN` on tag entries and nothing
 * else. Tags it has no Chinese name for keep theirs: this repo reaches further
 * down the long tail than the index's post-count floor.
 *
 * Run it after danbooru-tag-index regenerates display_names.json, and commit
 * the diff -- the YAML stays the checked-in source it has always been, this
 * just stops it from being the place corrections have to be re-made by hand.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import YAML from 'yaml'

const ROOT = resolve(import.meta.dirname, '..')
const SOURCE = resolve(ROOT, 'data', 'source', 'danbooru_tag_tree_v3.multilingual.yaml')
const TAG_PREFIX = 'tag.'

// Sibling-checkout default, overridable by env or flag. An absolute path
// belongs in whatever script knows where every repository lives, not in here.
const DEFAULT_TAG_INDEX = process.env.DANBOORU_TAG_INDEX
  ?? resolve(ROOT, '..', '..', 'danbooru-tag-index')

interface DisplayName {
  zh_hans?: string | null
  [lang: string]: string | null | undefined
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i === -1 ? undefined : process.argv[i + 1]
}

const tagIndex = arg('--tag-index') ?? DEFAULT_TAG_INDEX
const dryRun = process.argv.includes('--dry-run')
const namesPath = resolve(tagIndex, 'data', 'translations', 'display_names.json')

if (!existsSync(namesPath)) {
  console.error(
    `missing ${namesPath}\n`
    + `Generate it there with:  uv run python scripts/export_display_names.py\n`
    + `Point at another checkout with --tag-index or $DANBOORU_TAG_INDEX.`,
  )
  process.exit(1)
}

const names = JSON.parse(readFileSync(namesPath, 'utf-8')) as Record<string, DisplayName>
const doc = YAML.parseDocument(readFileSync(SOURCE, 'utf-8'))

let changed = 0
let cleared = 0
const samples: string[] = []

for (const item of (doc.contents as YAML.YAMLMap).items) {
  const key = String((item.key as YAML.Scalar).value)
  if (!key.startsWith(TAG_PREFIX)) {
    continue
  }
  // Tag names may contain dots, so strip the fixed prefix rather than splitting.
  const tag = key.slice(TAG_PREFIX.length)
  const entry = names[tag]
  if (!entry || !('zh_hans' in entry)) {
    continue
  }
  const value = item.value as YAML.YAMLMap
  const current = value.get('zh-CN') as string | undefined

  // An explicit null is a review that found the name wrong and had no
  // replacement. Drop ours too rather than leaving the rejected one standing.
  if (entry.zh_hans === null) {
    if (current !== undefined) {
      value.delete('zh-CN')
      cleared += 1
    }
    continue
  }
  if (current === entry.zh_hans) {
    continue
  }
  if (samples.length < 12) {
    samples.push(`  ${tag.padEnd(28)} ${String(current ?? '-').padEnd(14)} -> ${entry.zh_hans}`)
  }
  value.set('zh-CN', entry.zh_hans)
  changed += 1
}

console.log(`${Object.keys(names).length.toLocaleString()} names from ${namesPath}`)
console.log(samples.join('\n'))
console.log(`${changed.toLocaleString()} zh-CN updated, ${cleared} cleared as rejected`)

if (dryRun) {
  console.log('--dry-run: source not written')
}
else {
  writeFileSync(SOURCE, doc.toString({ lineWidth: 0 }), 'utf-8')
  console.log(`wrote ${SOURCE}`)
}
