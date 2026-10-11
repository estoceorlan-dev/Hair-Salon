import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { EmptyState, Feedback, LoadingState } from '../components/ui/Feedback'

const endpoints = { appointments: '/appointments', earnings: '/me/earnings', history: '/me/history' }
const titles = { appointments: 'Your appointment schedule', earnings: 'Your recorded earnings', history: 'Your service history' }
const date = (value) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
function money(cents) {
  if (cents === null) return 'Pending definition'
  const amount = BigInt(cents)
  return `PHP ${(amount / 100n).toLocaleString('en-PH')}.${(amount % 100n).toString().padStart(2, '0')}`
}
export default function ScopedRecords({ kind }) {
  const [rows, setRows] = useState([])
  const [loadedKey, setLoadedKey] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const key = kind + '-' + retry
  const loading = loadedKey !== key
  useEffect(() => {
    const controller = new AbortController()
    api.get(endpoints[kind], { signal: controller.signal }).then(({ data }) => setRows(data[kind]))
      .catch((err) => { if (!controller.signal.aborted) setError(apiErrorMessage(err)) })
      .finally(() => { if (!controller.signal.aborted) setLoadedKey(key) })
    return () => controller.abort()
  }, [kind, key])
  return <section className="card records-card"><h2>{titles[kind]}</h2>
    <p className="text-muted text-sm">{kind === 'earnings' ? 'Commission and payroll calculations are awaiting definition.' : 'Saved records only. Booking changes will be available in Phase 5.'} Showing up to 100 recent records.</p>
    {loading ? <LoadingState /> : error ? <><Feedback tone="error">{error}</Feedback><button className="btn btn-secondary mt-4" onClick={() => { setError(''); setRetry(retry + 1) }}>Retry</button></>
      : !rows.length ? <EmptyState title="No records yet" /> : <div className="table-container"><table>
        <thead><tr><th>{kind === 'appointments' ? 'Booking / service' : kind === 'history' ? 'Receipt / services' : 'Service'}</th><th>Date (Manila)</th><th>{kind === 'appointments' ? 'People' : 'Amount'}</th><th>Status</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td>{kind === 'history' ? <>{row.receipt_number}<p className="text-muted text-sm">{row.items.map((item) => item.name).join(', ')}</p></>
            : <>{row.service_name}{row.booking_reference && <p className="text-muted text-sm">{row.booking_reference}</p>}</>}</td>
          <td>{date(row.starts_at || row.sold_at || row.created_at)}</td>
          <td>{kind === 'appointments' ? <>{row.customer_name}<p className="text-muted text-sm">With {row.employee_name}</p></> : money(kind === 'earnings' ? row.amount_cents : row.total_cents)}</td>
          <td>{row.status.replaceAll('_', ' ')}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>
}
