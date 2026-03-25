import { describe, expect, it } from 'vitest'

import { createUiText, getRootLabel } from '@/utils/uiText'

describe('uiText', () => {
  it('returns locale-specific UI labels', () => {
    expect(createUiText('zh-CN').graphView).toBe('图谱')
    expect(createUiText('ja').sidebarTitle).toBe('エクスプローラー')
    expect(createUiText('en').noResults({ query: 'pov' })).toBe('No results for "pov"')
    expect(getRootLabel('zh-CN')).toBe('Danbooru 标签')
  })
})
