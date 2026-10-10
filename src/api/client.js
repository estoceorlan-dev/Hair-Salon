import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  timeout: 5000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

export function apiErrorMessage(error) {
  return (
    error.response?.data?.error?.message ||
    'The connection is unavailable. Please try again.'
  )
}
