import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import YAML from 'yaml'

import { buildDataset, castTranslations, formatSlug } from '@/utils/taxonomy'

describe('taxonomy helpers', () => {
  it('builds nested nodes and aggregates tag counts', () => {
    const dataset = buildDataset(
      {
        _meta: { version: 'test' },
        root_a: {
          branch_b: ['alpha_tag', 'beta_tag'],
          branch_c: {
            leaf_d: ['gamma_tag'],
          },
        },
      },
      'default',
    )

    const rootA = dataset.nodes.root_a
    const branchB = dataset.nodes['root_a.branch_b']
    const branchC = dataset.nodes['root_a.branch_c']

    expect(rootA).toBeDefined()
    expect(branchB).toBeDefined()
    expect(branchC).toBeDefined()

    if (!rootA || !branchB || !branchC) {
      throw new Error('Expected taxonomy nodes to exist')
    }

    expect(dataset.totalNodeCount).toBe(4)
    expect(dataset.totalTagCount).toBe(3)
    expect(rootA.totalTagCount).toBe(3)
    expect(branchB.directTagCount).toBe(2)
    expect(branchC.descendantCount).toBe(1)
  })

  it('casts translation entries and falls back to slug formatting', () => {
    const translations = castTranslations({
      'category.subject': {
        en: 'subject',
        'zh-CN': '主体',
      },
    })

    expect(translations['category.subject']?.['zh-CN']).toBe('主体')
    expect(formatSlug('black_hair')).toBe('black hair')
  })

  it('keeps head and shoulder placement tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const rows: Array<{ tag: string, path: string }> = []
    const placementPattern =
      /_on_head$|_on_shoulder$|_on_shoulders$|_over_shoulder$|_around_shoulder$|^on_head$|^on_shoulder$|^over_shoulder$|^holding_over_opposite_shoulder$/

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && placementPattern.test(item)) {
            rows.push({ tag: item, path: path.join('.') })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.path.startsWith('composition.framing.body_part_anchor'))).toBe(true)
  })
})
