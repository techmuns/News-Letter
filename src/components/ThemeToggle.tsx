import { useTheme } from '../lib/theme'
import { IconSun, IconMoon } from './icons'

/** Compact dark/light theme switch — lives in the top bar. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="grid h-9 w-9 place-items-center rounded-full border border-border text-text-muted transition-colors duration-200 hover:border-border-strong hover:text-violet focus-violet"
    >
      {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
    </button>
  )
}
