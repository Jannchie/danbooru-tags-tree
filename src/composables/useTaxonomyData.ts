import { ref, shallowRef } from 'vue'

import {
  buildDataset,
  castTranslations,
  type DatasetVersion,
  type LocaleCode,
  type LocalizedLabel,
  type TaxonomyDataset,
} from '@/utils/taxonomy'

const datasets = shallowRef<Record<DatasetVersion, TaxonomyDataset> | null>(null)
const translations = shallowRef<Record<string, LocalizedLabel>>({})
const tagFrequency = shallowRef<Record<string, number>>({})
const graphLayout = shallowRef<Record<string, { x: number, y: number }> | null>(null)
const isLoading = ref(false)
const isGraphLayoutLoading = ref(false)
const error = ref<string | null>(null)

const localeOptions: {
  value: LocaleCode
  label: string
}[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
]

async function fetchJSON(path: string): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(`Failed to load ${path}`)
  }

  return response.json()
}

async function ensureLoaded(): Promise<void> {
  if (datasets.value || isLoading.value) {
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const [rawTrans, rawFreq, rawData] = await Promise.all([
      fetchJSON('output/translations.json'),
      fetchJSON('output/tag_frequency.json'),
      fetchJSON('output/taxonomy.json'),
    ])

    translations.value = castTranslations(rawTrans)
    tagFrequency.value = rawFreq as Record<string, number>

    datasets.value = {
      default: buildDataset(rawData, 'default'),
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Failed to load taxonomy files.'
  } finally {
    isLoading.value = false
  }
}

async function ensureGraphLayoutLoaded(): Promise<void> {
  if (graphLayout.value || isGraphLayoutLoading.value) {
    return
  }

  isGraphLayoutLoading.value = true

  try {
    graphLayout.value = await fetchJSON('output/graph-layout.json') as Record<string, { x: number, y: number }>
  } catch (loadError) {
    console.error(
      loadError instanceof Error
        ? loadError.message
        : 'Failed to load graph layout file.',
    )
  } finally {
    isGraphLayoutLoading.value = false
  }
}

export function useTaxonomyData() {
  void ensureLoaded()

  return {
    datasets,
    translations,
    tagFrequency,
    graphLayout,
    isLoading,
    isGraphLayoutLoading,
    error,
    ensureLoaded,
    ensureGraphLayoutLoaded,
    localeOptions,
  }
}
