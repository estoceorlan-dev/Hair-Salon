import { useCallback, useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'

export function useRecords(path, params = {}) {
  const query = JSON.stringify(params)
  const [state, setState] = useState({ data: null, loadedKey: null, error: '' })
  const [revision, setRevision] = useState(0)
  const requestKey = path + query + revision
  const refresh = useCallback(() => setRevision((n) => n + 1), [])
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    api.get(path, { params: JSON.parse(query), signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setState({ data, loadedKey: requestKey, error: '' }) })
      .catch((err) => { if (!controller.signal.aborted) setState({ data: null, loadedKey: requestKey, error: apiErrorMessage(err) }) })
    return () => controller.abort()
  }, [path, query, requestKey])
  return { ...state, loading: state.loadedKey !== requestKey, refresh }
}
