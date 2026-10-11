import { useCallback, useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'

export function useCatalog() {
  const [state, setState] = useState({ items: [], loadedRevision: null, error: '' })
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((n) => n + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    async function read() {
      const items = []
      for (let page = 1; ; page++) {
        const { data } = await api.get('/catalog', { params: { page, pageSize: 100 }, signal: controller.signal })
        items.push(...data.items)
        if (items.length >= data.total || !data.items.length) break
      }
      if (!controller.signal.aborted) setState({ items, loadedRevision: revision, error: '' })
    }
    read().catch((err) => { if (!controller.signal.aborted) setState({ items: [], loadedRevision: revision, error: apiErrorMessage(err) }) })
    return () => controller.abort()
  }, [revision])
  useEffect(() => {
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  return { ...state, loading: state.loadedRevision !== revision, refresh }
}
