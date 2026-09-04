/**
 * Reads `tag_frequency_general.csv`.
 *
 * Splitting on the last comma is not enough: Danbooru tag names contain
 * quotes and commas, so those rows arrive as proper CSV fields — wrapped in
 * `"` with inner quotes doubled. Reading `"don't_say_""lazy""",1085` naively
 * yields a tag name that matches nothing, which is how the tree ended up with
 * both `don't_say_"lazy"` and its raw CSV spelling.
 */

import { readFileSync } from 'node:fs'

function unquote(field: string): string {
  if (!field.startsWith('"') || !field.endsWith('"') || field.length < 2) {
    return field
  }

  return field.slice(1, -1).replaceAll('""', '"')
}

export function parseTagFrequency(csv: string): Record<string, number> {
  const freq: Record<string, number> = {}

  for (const rawLine of csv.split('\n').slice(1)) {
    const line = rawLine.trimEnd()

    if (!line) {
      continue
    }

    // The count is always the last field and never contains a comma, so the
    // tag is everything before the final one.
    const lastComma = line.lastIndexOf(',')

    if (lastComma === -1) {
      continue
    }

    const tag = unquote(line.slice(0, lastComma))
    const count = Number.parseInt(line.slice(lastComma + 1), 10)

    if (tag && !Number.isNaN(count)) {
      freq[tag] = count
    }
  }

  return freq
}

export function readTagFrequency(path: string): Record<string, number> {
  return parseTagFrequency(readFileSync(path, 'utf-8'))
}
