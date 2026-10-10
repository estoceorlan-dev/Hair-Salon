import { api } from './client'

export async function getHealth(signal) {
  const { data } = await api.get('/health', {
    signal,
    // 503 is a valid readiness result when the API runs without a database.
    validateStatus: (status) => status === 200 || status === 503,
  })
  if (data?.api?.status !== 'running' || !data.database?.status)
    throw new Error('Unexpected health response')
  return data
}
