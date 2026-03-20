import { computed, ref, type ComputedRef } from 'vue'

export type ThemeMode = 'dark' | 'light'

const THEME_STORAGE_KEY = 'danbooru-tags-tree-theme'
const theme = ref<ThemeMode>('dark')

let isInitialized = false

function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') {
    return null
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : null
}

function readDocumentTheme(): ThemeMode | null {
  if (typeof document === 'undefined') {
    return null
  }

  const documentTheme = document.documentElement.dataset.theme

  return documentTheme === 'dark' || documentTheme === 'light' ? documentTheme : null
}

function resolveTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  return readStoredTheme()
    ?? readDocumentTheme()
    ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

function applyTheme(nextTheme: ThemeMode): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = nextTheme
  document.documentElement.style.colorScheme = nextTheme
}

function syncTheme(nextTheme: ThemeMode): void {
  theme.value = nextTheme
  applyTheme(nextTheme)
}

function handleSystemThemeChange(event: MediaQueryListEvent): void {
  if (readStoredTheme()) {
    return
  }

  syncTheme(event.matches ? 'dark' : 'light')
}

export function initializeTheme(): void {
  if (isInitialized) {
    return
  }

  syncTheme(resolveTheme())

  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemThemeChange)
  }

  isInitialized = true
}

export function useTheme(): {
  theme: ComputedRef<ThemeMode>
  isDark: ComputedRef<boolean>
  toggleTheme: () => void
} {
  initializeTheme()

  function toggleTheme(): void {
    const nextTheme: ThemeMode = theme.value === 'dark' ? 'light' : 'dark'

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    }

    syncTheme(nextTheme)
  }

  return {
    theme: computed(() => theme.value),
    isDark: computed(() => theme.value === 'dark'),
    toggleTheme,
  }
}
