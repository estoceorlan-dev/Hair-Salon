import { useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { useRecords } from '../hooks/useRecords'
import { Feedback } from '../components/ui/Feedback'
import { Field, StatusField, Pager, RecordState, Filters } from '../components/ui/Management'
import { cents, pesos } from '../config/form-values'
import { formatCurrency } from '../config/business-rules'

export default function Services() {
  const [query, setQuery] = useState({ q: '', status: 'all', category: '', page: 1 })
  const records = useRecords('/services', query), staff = useRecords('/staff-options')
  const [selected, setSelected] = useState(null), [revision, setRevision] = useState(0)
  const [message, setMessage] = useState(null), [pending, setPending] = useState(false)
  async function save(event) {
    event.preventDefault(); setPending(true); setMessage(null)
    const form = new FormData(event.currentTarget), d = Object.fromEntries(form)
    const body = { code: d.code, name: d.name, category: d.category, priceCents: cents(d.price),
      durationMinutes: d.duration === '' ? null : Number(d.duration), isActive: d.isActive === 'true', employeeIds: form.getAll('employeeIds') }
    try {
      if (selected) await api.put('/services/' + selected.id, body)
      else await api.post('/services', body)
      setSelected(null); setRevision((n) => n + 1); records.refresh(); setMessage({ tone: 'success', text: 'Service saved. POS and booking previews use this catalog.' })
    } catch (err) { setMessage({ tone: 'error', text: apiErrorMessage(err) }) } finally { setPending(false) }
  }
  return <div className="flex-col gap-4"><section className="card"><h2>{selected ? 'Edit service' : 'New service'}</h2>
    <p className="text-muted">Leave undefined prices and durations blank. Deactivate services to remove them from choices and retain past transactions.</p>
    {message && <Feedback tone={message.tone}>{message.text}</Feedback>}
    <form key={selected?.id || revision} className="auth-form account-fields" onSubmit={save}>
      <Field label="Service code" name="code" required pattern="[A-Za-z0-9_-]{2,40}" maxLength={40} defaultValue={selected?.code || ''} />
      <Field label="Service name" name="name" required minLength={2} maxLength={100} defaultValue={selected?.name || ''} />
      <Field label="Category" name="category" required maxLength={100} defaultValue={selected?.category || ''} />
      <Field label="Price (PHP)" name="price" type="number" min="0" max="999999999.99" step="0.01" defaultValue={pesos(selected?.price_cents)} />
      <Field label="Duration (minutes)" name="duration" type="number" min="5" max="1440" step="1" defaultValue={selected?.duration_minutes || ''} />
      <StatusField value={selected?.is_active} />
      <fieldset className="staff-checks"><legend>Eligible staff</legend>
        {staff.data?.items.map((e) => <label key={e.id}><input type="checkbox" name="employeeIds" value={e.id} defaultChecked={selected?.employee_ids.includes(e.id)} /> {e.display_name}</label>)}
        {!staff.data?.items.length && <p className="text-muted">Create an active stylist or beautician account to assign services.</p>}
      </fieldset>
      <div className="flex gap-4"><button className="btn btn-primary" disabled={pending || staff.loading || !!staff.error}>{pending ? 'Saving...' : 'Save service'}</button>
        {selected && <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setSelected(null)}>Cancel edit</button>}</div>
    </form>{staff.error && <Feedback tone="error">{staff.error}</Feedback>}</section>
    <section className="card"><h2>Service catalog</h2><Filters query={query} setQuery={setQuery} />
      <Field label="Filter category" value={query.category} onChange={(e) => setQuery({ ...query, category: e.target.value, page: 1 })} />
      <RecordState records={records}><div className="table-container"><table><thead><tr><th>Service</th><th>Category</th><th>Price</th><th>Duration</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {records.data?.items.map((s) => <tr key={s.id}><td>{s.name}<br /><small>{s.code}{s.is_demo ? ' · Demo' : ''}</small></td><td>{s.category}</td><td>{s.price_cents === null ? 'Undefined' : formatCurrency(pesos(s.price_cents))}</td>
          <td>{s.duration_minutes === null ? 'Undefined' : `${s.duration_minutes} min`}</td><td>{s.is_active ? 'Active' : 'Inactive'}</td><td><button className="btn btn-secondary" disabled={pending} onClick={() => { setSelected(s); setMessage(null) }}>Edit</button></td></tr>)}
      </tbody></table></div></RecordState><Pager page={query.page} total={records.data?.total} onChange={(page) => setQuery({ ...query, page })} />
    </section></div>
}
