// Set the preferred palette before the first paint.
(() => {
  let theme
  try { theme = localStorage.getItem('romel-theme') } catch { /* Storage may be blocked. */ }
  document.documentElement.dataset.theme = theme === 'light' || theme === 'dark'
    ? theme : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
})()
