import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useLocation } from 'react-router'

const storageKey = 'romel-theme'

function savedTheme() {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === 'light' || value === 'dark') return value
  } catch { /* Browser storage can be unavailable. */ }
  return null
}

export default function ThemeToggle() {
  const { pathname } = useLocation()
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function sync() {
      setTheme(savedTheme() || (media.matches ? 'dark' : 'light'))
    }
    media.addEventListener('change', sync)
    window.addEventListener('storage', sync)
    return () => {
      media.removeEventListener('change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    try { localStorage.setItem(storageKey, next) } catch { /* Keep this session's selection. */ }
  }
  const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
  const position = pathname.startsWith('/app') ? 'workspace' : pathname === '/' ? 'entry' : 'general'
  return <button className={'theme-switch theme-' + position} type="button" onClick={toggle} title={label} aria-label={label}>
    <span className="theme-thumb" aria-hidden="true" /><Sun size={15} aria-hidden="true" /><Moon size={15} aria-hidden="true" />
  </button>
}
