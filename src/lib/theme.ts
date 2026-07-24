import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'munshot-theme'

/** Read the persisted theme, defaulting to dark. Safe on the server (no window). */
export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'dark'
}

/** Reflect the theme onto <html data-theme> + persist it. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  window.localStorage.setItem(STORAGE_KEY, theme)
}

/**
 * Theme state hook. Initialises from the data-theme attribute set by the
 * inline no-flash script in index.html, so there's no mismatch on first paint.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme')
      if (attr === 'light' || attr === 'dark') return attr
    }
    return getInitialTheme()
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return {
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  }
}
