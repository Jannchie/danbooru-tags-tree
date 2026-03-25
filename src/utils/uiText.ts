import type { LocaleCode } from '@/utils/taxonomy'

type TextParams = Record<string, number | string>
type TextResolver = string | ((params: TextParams) => string)

type UiTextSchema = {
  appTitle: string
  categories: string
  childCategories: string
  children: string
  darkMode: string
  descendants: string
  depth: (params: { depth: number }) => string
  directTags: string
  errorTitle: string
  graphView: string
  lightMode: string
  loading: string
  logoAlt: string
  noResults: (params: { query: string }) => string
  nodes: string
  rootLabel: string
  searchCategoriesAndTags: string
  searchCategoriesGroup: string
  searchTagsGroup: string
  sidebarCount: (params: { count: number }) => string
  sidebarTitle: string
  switchToDarkMode: string
  switchToLightMode: string
  tags: string
  tagItems: (params: { count: number }) => string
  totalTags: string
  treeView: string
}

const UI_TEXT: Record<LocaleCode, Record<keyof UiTextSchema, TextResolver>> = {
  'en': {
    appTitle: 'Danbooru Tags Tree',
    categories: 'categories',
    childCategories: 'Child categories',
    children: 'Children',
    darkMode: 'Dark',
    descendants: 'Descendants',
    depth: ({ depth }) => `Depth ${depth}`,
    directTags: 'Direct tags',
    errorTitle: 'Failed to load data',
    graphView: 'Graph',
    lightMode: 'Light',
    loading: 'Loading taxonomy data...',
    logoAlt: 'Danbooru Tags Tree logo',
    noResults: ({ query }) => `No results for "${query}"`,
    nodes: 'nodes',
    rootLabel: 'Danbooru Tags',
    searchCategoriesAndTags: 'Search categories & tags...',
    searchCategoriesGroup: 'Categories',
    searchTagsGroup: 'Tags',
    sidebarCount: ({ count }) => `${count.toLocaleString('en')} nodes`,
    sidebarTitle: 'Explorer',
    switchToDarkMode: 'Switch to dark mode',
    switchToLightMode: 'Switch to light mode',
    tags: 'tags',
    tagItems: ({ count }) => `${count.toLocaleString('en')} items`,
    totalTags: 'Total tags',
    treeView: 'Tree',
  },
  'ja': {
    appTitle: 'Danbooruタグツリー',
    categories: 'カテゴリ',
    childCategories: '子カテゴリ',
    children: '子ノード',
    darkMode: 'ダーク',
    descendants: '子孫ノード',
    depth: ({ depth }) => `深さ ${depth}`,
    directTags: '直下タグ',
    errorTitle: 'データの読み込みに失敗しました',
    graphView: 'グラフ',
    lightMode: 'ライト',
    loading: '分類データを読み込み中...',
    logoAlt: 'Danbooruタグツリーのロゴ',
    noResults: ({ query }) => `「${query}」の検索結果はありません`,
    nodes: 'ノード',
    rootLabel: 'Danbooru タグ',
    searchCategoriesAndTags: 'カテゴリとタグを検索...',
    searchCategoriesGroup: 'カテゴリ',
    searchTagsGroup: 'タグ',
    sidebarCount: ({ count }) => `${count.toLocaleString('ja-JP')} ノード`,
    sidebarTitle: 'エクスプローラー',
    switchToDarkMode: 'ダークモードに切り替え',
    switchToLightMode: 'ライトモードに切り替え',
    tags: 'タグ',
    tagItems: ({ count }) => `${count.toLocaleString('ja-JP')} 件`,
    totalTags: '合計タグ',
    treeView: 'ツリー',
  },
  'zh-CN': {
    appTitle: 'Danbooru 标签树',
    categories: '分类',
    childCategories: '子分类',
    children: '子节点',
    darkMode: '深色',
    descendants: '后代节点',
    depth: ({ depth }) => `深度 ${depth}`,
    directTags: '直属标签',
    errorTitle: '数据加载失败',
    graphView: '图谱',
    lightMode: '浅色',
    loading: '正在加载分类数据...',
    logoAlt: 'Danbooru 标签树标志',
    noResults: ({ query }) => `没有找到“${query}”的结果`,
    nodes: '节点',
    rootLabel: 'Danbooru 标签',
    searchCategoriesAndTags: '搜索分类和标签...',
    searchCategoriesGroup: '分类',
    searchTagsGroup: '标签',
    sidebarCount: ({ count }) => `${count.toLocaleString('zh-CN')} 个节点`,
    sidebarTitle: '浏览器',
    switchToDarkMode: '切换到深色模式',
    switchToLightMode: '切换到浅色模式',
    tags: '标签',
    tagItems: ({ count }) => `${count.toLocaleString('zh-CN')} 项`,
    totalTags: '总标签',
    treeView: '树形',
  },
}

function resolveText(
  locale: LocaleCode,
  key: keyof UiTextSchema,
  params: TextParams = {},
): string {
  const dictionary = UI_TEXT[locale] ?? UI_TEXT.en
  const value = dictionary[key]

  return typeof value === 'function' ? value(params) : value
}

export function createUiText(locale: LocaleCode): UiTextSchema {
  return {
    appTitle: resolveText(locale, 'appTitle'),
    categories: resolveText(locale, 'categories'),
    childCategories: resolveText(locale, 'childCategories'),
    children: resolveText(locale, 'children'),
    darkMode: resolveText(locale, 'darkMode'),
    descendants: resolveText(locale, 'descendants'),
    depth: ({ depth }) => resolveText(locale, 'depth', { depth }),
    directTags: resolveText(locale, 'directTags'),
    errorTitle: resolveText(locale, 'errorTitle'),
    graphView: resolveText(locale, 'graphView'),
    lightMode: resolveText(locale, 'lightMode'),
    loading: resolveText(locale, 'loading'),
    logoAlt: resolveText(locale, 'logoAlt'),
    noResults: ({ query }) => resolveText(locale, 'noResults', { query }),
    nodes: resolveText(locale, 'nodes'),
    rootLabel: resolveText(locale, 'rootLabel'),
    searchCategoriesAndTags: resolveText(locale, 'searchCategoriesAndTags'),
    searchCategoriesGroup: resolveText(locale, 'searchCategoriesGroup'),
    searchTagsGroup: resolveText(locale, 'searchTagsGroup'),
    sidebarCount: ({ count }) => resolveText(locale, 'sidebarCount', { count }),
    sidebarTitle: resolveText(locale, 'sidebarTitle'),
    switchToDarkMode: resolveText(locale, 'switchToDarkMode'),
    switchToLightMode: resolveText(locale, 'switchToLightMode'),
    tags: resolveText(locale, 'tags'),
    tagItems: ({ count }) => resolveText(locale, 'tagItems', { count }),
    totalTags: resolveText(locale, 'totalTags'),
    treeView: resolveText(locale, 'treeView'),
  }
}

export function getRootLabel(locale: LocaleCode): string {
  return createUiText(locale).rootLabel
}
