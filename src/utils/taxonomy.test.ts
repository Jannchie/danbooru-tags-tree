import { describe, expect, it } from 'vitest'

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
})
