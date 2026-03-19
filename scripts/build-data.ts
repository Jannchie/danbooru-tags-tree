/**
 * Pre-process YAML + CSV data into optimised JSON files for the browser.
 *
 * Outputs (in data/output/):
 *   - taxonomy.json          (main taxonomy tree)
 *   - translations.json      (merged translations)
 *   - tag_frequency.json     (tag -> count map)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import YAML from 'yaml'

const OUT = resolve(import.meta.dirname!, '..', 'data', 'output')

function read(name: string): string {
  return readFileSync(resolve(OUT, name), 'utf-8')
}

function writeJSON(name: string, data: unknown): void {
  const json = JSON.stringify(data)
  writeFileSync(resolve(OUT, name), json)
  const kb = (Buffer.byteLength(json) / 1024).toFixed(0)
  console.log(`  ${name} (${kb} KB)`)
}

// --- Taxonomy YAML → JSON ---
console.log('Converting taxonomy YAML to JSON...')
writeJSON('taxonomy.json', YAML.parse(read('danbooru_tag_tree_v3.yaml')))

// --- Translations ---
console.log('Merging translations...')
const transV2 = YAML.parse(read('danbooru_tag_tree_v2.multilingual.yaml'))
const transV3 = YAML.parse(read('danbooru_tag_tree_v3.multilingual.yaml'))
const merged = { ...transV2, ...transV3 }
writeJSON('translations.json', merged)

// --- Tag frequency CSV → JSON ---
console.log('Converting tag frequency CSV...')
const csv = read('tag_frequency_general.csv')
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

console.log('Done!')
