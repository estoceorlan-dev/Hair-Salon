import { useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { useRecords } from '../hooks/useRecords'
import { Feedback, LoadingState, EmptyState } from '../components/ui/Feedback'
import { Field, Select, StatusField, Pager, RecordState, Filters } from '../components/ui/Management'
import { nullable } from '../config/form-values'
import { formatCurrency } from '../config/business-rules'

function CustomerHistory({ customer }) {
  const [page, setPage] = useState(1)
  const records = useRecords('/customers/' + customer.id + '/history', { page })
  return <section className="card"><h2>Service history · {customer.display_name}</h2>
    {records.loading ? <LoadingState /> : records.error ? <Feedback tone="error">{records.error}</Feedback>
      : !records.data.history.length ? <EmptyState title="No completed transactions" /> : <div className="table-container"><table>
        <thead><tr><th>Date (Manila)</th><th>Receipt</th><th>Services / items</th><th>Total</th></tr></thead><tbody>
          {records.data.history.map((sale) => <tr key={sale.id}><td>{new Date(sale.sold_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td>
            <td>{sale.receipt_number || '—'}</td><td>{sale.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}</td><td>{formatCurrency(Number(sale.total_cents) / 100)}</td></tr>)}
        </tbody></table></div>}
    <Pager page={page} total={records.data?.total} onChange={setPage} />
    <p className="text-muted text-sm">Completed paid transactions only, using the original item names and prices.</p>
  </section>
}
export default function Customers() {
  const [query, setQuery] = useState({ q: '', status: 'all', page: 1 })
  const records = useRecords('/customers', query)
  const staff = useRecords('/staff-options')
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState(null)
  const [formKey, setFormKey] = useState(0)
  const [message, setMessage] = useState(null)
  const [duplicates, setDuplicates] = useState([])
  const [pending, setPending] = useState(false)
  async function save(event) {
    event.preventDefault(); setPending(true); setMessage(null); setDuplicates([])
    const d = Object.fromEntries(new FormData(event.currentTarget))
    const body = { displayName: d.displayName, email: nullable(d.email), phone: nullable(d.phone),
      notes: nullable(d.notes), preferredEmployeeId: nullable(d.preferredEmployeeId), isActive: d.isActive === 'true',
      ...(d.duplicateReason.trim() ? { duplicateReason: d.duplicateReason.trim() } : {}) }
    try {
      if (selected) await api.put('/customers/' + selected.id, body)
      else await api.post('/customers', body)
      setSelected(null); setFormKey((n) => n + 1); records.refresh()
      setMessage({ tone: 'success', text: 'Customer saved.' })
    } catch (err) {
      setMessage({ tone: 'error', text: apiErrorMessage(err) })
      setDuplicates(err.response?.data?.error?.details?.matches || [])
    } finally { setPending(false) }
  }
  return <div className="flex-col gap-4">
    <section className="card"><h2>{selected ? 'Edit customer' : 'New customer'}</h2>
      <p className="text-muted">Walk-in records do not create a sign-in account. Contact edits do not change an existing login email.</p>
      {message && <Feedback tone={message.tone}>{message.text}</Feedback>}
      {duplicates.length > 0 && <div className="duplicate-review"><p>Possible matches:</p>{duplicates.map((d) => <button type="button" className="btn btn-secondary" key={d.id}
        onClick={() => { setQuery({ q: d.display_name, status: 'all', page: 1 }); setMessage(null) }}>{d.display_name} · {d.id.slice(0, 8)}</button>)}</div>}
      <form key={selected?.id || formKey} className="auth-form account-fields" onSubmit={save}>
        <Field label="Full name" name="displayName" required minLength={2} maxLength={100} defaultValue={selected?.display_name || ''} />
        <Field label="Contact email" name="email" type="email" maxLength={254} defaultValue={selected?.email || ''} />
        <Field label="Phone" name="phone" maxLength={30} defaultValue={selected?.phone || ''} />
        <Select label="Preferred stylist" name="preferredEmployeeId" defaultValue={selected?.preferred_employee_id || ''}>
          <option value="">No preference</option>
          {selected?.preferred_employee_id && !staff.data?.items.some((e) => e.id === selected.preferred_employee_id) && <option value={selected.preferred_employee_id}>{selected.preferred_employee_name} (inactive)</option>}
          {staff.data?.items.map((e) => <option key={e.id} value={e.id}>{e.display_name}</option>)}
        </Select>
        <StatusField value={selected?.is_active} />
        <Field label="Notes" name="notes" maxLength={2000} defaultValue={selected?.notes || ''} />
        <Field label="Reason for separate duplicate record (only if needed)" name="duplicateReason" minLength={10} maxLength={500} />
        <div className="flex gap-4"><button className="btn btn-primary" disabled={pending || staff.loading || !!staff.error}>{pending ? 'Saving...' : 'Save customer'}</button>
          {selected && <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => { setSelected(null); setMessage(null) }}>Cancel edit</button>}</div>
      </form>{staff.error && <Feedback tone="error">{staff.error}</Feedback>}
    </section>
    <section className="card"><h2>Customers</h2><Filters query={query} setQuery={setQuery} />
      <RecordState records={records}><div className="table-container"><table><thead><tr><th>Name</th><th>Contact</th><th>Preferred stylist</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {records.data?.items.map((c) => <tr key={c.id}><td>{c.display_name}</td><td>{c.email || '—'}<br />{c.phone}</td><td>{c.preferred_employee_name || 'No preference'}</td><td>{c.is_active ? 'Active' : 'Inactive'}</td>
          <td><div className="flex gap-2"><button className="btn btn-secondary" disabled={pending} onClick={() => { setSelected(c); setMessage(null); setDuplicates([]) }}>Edit</button><button className="btn btn-secondary" onClick={() => setHistory(c)}>History</button></div></td></tr>)}
      </tbody></table></div></RecordState>
      <Pager page={query.page} total={records.data?.total} onChange={(page) => setQuery({ ...query, page })} />
    </section>{history && <CustomerHistory key={history.id} customer={history} />}
  </div>
}
