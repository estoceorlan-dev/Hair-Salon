import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  timeout: 5000,
  withCredentials: true,
  headers: { Accept: 'application/json', 'X-Romel-Request': 'browser' },
})

export function apiErrorMessage(error) {
  const first = error.response?.data?.error?.details?.[0]
  if (first) return `${first.field || 'Form'}: ${first.message}`
  return (
    error.response?.data?.error?.message ||
    'The connection is unavailable. Please try again.'
  )
}
