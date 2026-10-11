import { useCallback, useEffect, useRef, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { AuthContext } from './AuthContext'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const version = useRef(0)
  const mutating = useRef(false)
  const expire = useCallback(() => {
    version.current++
    setSession(null)
    setLoading(false)
    setNotice('Your session ended. Please sign in again.')
  }, [])
  const refresh = useCallback(async () => {
    if (mutating.current) return
    const request = ++version.current
    try {
      const { data } = await api.get('/auth/session')
      if (request === version.current) { setSession(data); setError('') }
    } catch (err) {
      if (request !== version.current) return
      if (err.response?.status === 401) { setSession(null); setError('') }
      else { setSession(null); setError(apiErrorMessage(err)) }
    } finally { if (request === version.current) setLoading(false) }
  }, [])
  useEffect(() => {
    let active = true
    const request = ++version.current
    try { sessionStorage.removeItem('romel.ui-preview-mode') } catch { /* Storage may be blocked. */ }
    const interceptor = api.interceptors.response.use((response) => response, (err) => {
      const path = err.config?.url || ''
      const credentialFailure = ['/auth/login', '/auth/register'].includes(path) ||
        (path === '/auth/password' && err.response?.data?.error?.code === 'INVALID_CREDENTIALS')
      if (err.response?.status === 401 && path !== '/auth/session' && !credentialFailure) expire()
      return Promise.reject(err)
    })
    api.get('/auth/session').then(({ data }) => {
      if (active && request === version.current) { setSession(data); setError(''); setLoading(false) }
    }).catch((err) => {
      if (!active || request !== version.current) return
      setSession(null)
      setError(err.response?.status === 401 ? '' : apiErrorMessage(err))
      setLoading(false)
    })
    window.addEventListener('focus', refresh)
    return () => { active = false; api.interceptors.response.eject(interceptor); window.removeEventListener('focus', refresh) }
  }, [refresh, expire])
  useEffect(() => {
    if (!session) return
    const timer = setTimeout(expire, Math.max(0, Date.parse(session.expiresAt) - Date.now()))
    return () => clearTimeout(timer)
  }, [session, expire])
  const enter = async (action, fields) => {
    mutating.current = true
    const request = ++version.current
    try {
      const { data } = await api.post('/auth/' + action, fields)
      if (request === version.current) { setSession(data); setError(''); setNotice(''); setLoading(false) }
      return data.user
    } finally { mutating.current = false }
  }
  const logout = async () => {
    mutating.current = true
    version.current++
    try {
      try { await api.post('/auth/logout', {}) }
      catch (err) { if (err.response?.status !== 401) throw err }
      setSession(null)
      setNotice('')
    } finally { mutating.current = false }
  }
  const changePassword = async (fields) => {
    mutating.current = true
    version.current++
    try {
      await api.post('/auth/password', fields)
      setSession(null)
      setNotice('Password changed. Please sign in with your new password.')
    } finally { mutating.current = false }
  }
  return <AuthContext.Provider value={{ user: session?.user, loading, error, notice, refresh, logout, changePassword,
    login: (fields) => enter('login', fields), register: (fields) => enter('register', fields) }}>{children}</AuthContext.Provider>
}
