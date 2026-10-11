import { useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { useRecords } from '../hooks/useRecords'
import { Feedback } from '../components/ui/Feedback'
import { Field, Select, Pager, RecordState, Filters } from '../components/ui/Management'
import { cents, pesos, nullable, commissionFrom } from '../config/form-values'
import EmployeeAccounts from './EmployeeAccounts'

function Availability({ employee }) {
  const [page, setPage] = useState(1), [message, setMessage] = useState(null), [pending, setPending] = useState(false)
  const records = useRecords('/employee-profiles/' + employee.id + '/availability', { page })
  async function add(event) {
    event.preventDefault(); setPending(true); setMessage(null)
    const form = event.currentTarget, d = Object.fromEntries(new FormData(form))
    try {
      await api.post('/employee-profiles/' + employee.id + '/availability', { startsAt: d.start + ':00+08:00', endsAt: d.end + ':00+08:00', available: d.available === 'true', reason: nullable(d.reason) })
      form.reset(); records.refresh(); setMessage({ tone: 'success', text: 'Availability saved.' })
    } catch (err) { setMessage({ tone: 'error', text: apiErrorMessage(err) }) } finally { setPending(false) }
  }
  async function remove(id) {
    setPending(true); setMessage(null)
    try { await api.delete('/availability/' + id, { data: {} }); records.refresh(); setMessage({ tone: 'success', text: 'Availability removed.' }) }
    catch (err) { setMessage({ tone: 'error', text: apiErrorMessage(err) }) } finally { setPending(false) }
  }
  return <section className="card"><h2>Availability · {employee.display_name}</h2>
    <p className="text-muted">All times are Asia/Manila. Availability entries cannot overlap. Booking enforcement arrives in Phase 5.</p>
    {message && <Feedback tone={message.tone}>{message.text}</Feedback>}
    <form className="auth-form account-fields" onSubmit={add}>
      <Field label="Start (Manila)" type="datetime-local" name="start" required />
      <Field label="End (Manila)" type="datetime-local" name="end" required />
      <Select label="Availability" name="available"><option value="true">Available</option><option value="false">Unavailable / time off</option></Select>
      <Field label="Reason" name="reason" maxLength={2000} />
      <button className="btn btn-primary" disabled={pending || !employee.is_active}>Add interval</button>
    </form>
    <RecordState records={records}><div className="table-container"><table><thead><tr><th>Start (Manila)</th><th>End (Manila)</th><th>Availability</th><th>Reason</th><th>Action</th></tr></thead><tbody>
      {records.data?.items.map((a) => <tr key={a.id}><td>{new Date(a.starts_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td><td>{new Date(a.ends_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td>
        <td>{a.available ? 'Available' : 'Unavailable'}</td><td>{a.reason || '—'}</td><td><button className="btn btn-secondary" disabled={pending} onClick={() => remove(a.id)}>Remove</button></td></tr>)}
    </tbody></table></div></RecordState><Pager page={page} total={records.data?.total} onChange={setPage} />
  </section>
}
export function CommissionFields({ policy }) {
  return <>
    <Select label="Commission basis" name="commissionBasis" defaultValue={policy?.basis || ''}>
      <option value="">Undefined</option><option value="service_subtotal">Service subtotal percentage</option><option value="fixed_per_service">Fixed amount per service</option>
    </Select>
    <Field label="Commission rate (%)" name="commissionRate" type="number" min="0" max="100" step="0.01" defaultValue={policy?.ratePercent ?? ''} />
    <Field label="Fixed commission (PHP)" name="commissionAmount" type="number" min="0" max="999999999.99" step="0.01" defaultValue={pesos(policy?.amountCents)} />
    <Field label="Commission notes" name="commissionNotes" maxLength={1000} defaultValue={policy?.notes || ''} />
  </>
}
export default function EmployeeProfiles() {
  const [tab, setTab] = useState('profiles')
  const [query, setQuery] = useState({ q: '', status: 'all', page: 1 })
  const records = useRecords('/employee-profiles', query)
  const [selected, setSelected] = useState(null), [availability, setAvailability] = useState(null)
  const [message, setMessage] = useState(null), [pending, setPending] = useState(false)
  async function save(event) {
    event.preventDefault(); setPending(true); setMessage(null)
    const d = Object.fromEntries(new FormData(event.currentTarget))
    try {
      await api.put('/employee-profiles/' + selected.id, { phone: nullable(d.phone), notes: nullable(d.notes), basePayCents: cents(d.basePay), commissionPolicy: commissionFrom(d) })
      setSelected(null); records.refresh(); setMessage({ tone: 'success', text: 'Employee profile saved.' })
    } catch (err) { setMessage({ tone: 'error', text: apiErrorMessage(err) }) } finally { setPending(false) }
  }
  return <div className="flex-col gap-4"><div className="flex gap-4"><button className={`btn btn-${tab === 'profiles' ? 'primary' : 'secondary'}`} onClick={() => { setTab('profiles'); records.refresh() }}>Profiles & availability</button>
    <button className={`btn btn-${tab === 'accounts' ? 'primary' : 'secondary'}`} onClick={() => setTab('accounts')}>Accounts & roles</button></div>
    {tab === 'accounts' ? <EmployeeAccounts /> : <>
      <Feedback>Base pay and commission values are configuration only. Leave undefined values blank; payroll and commission calculations remain pending.</Feedback>
      {message && <Feedback tone={message.tone}>{message.text}</Feedback>}
      {selected && <section className="card"><h2>Edit profile · {selected.display_name}</h2>
        <form key={selected.id} className="auth-form account-fields" onSubmit={save}>
          <Field label="Phone" name="phone" maxLength={30} defaultValue={selected.phone || ''} />
          <Field label="Notes" name="notes" maxLength={2000} defaultValue={selected.notes || ''} />
          <Field label="Base pay (PHP; basis in Settings)" name="basePay" type="number" min="0" max="999999999.99" step="0.01" defaultValue={pesos(selected.base_pay_cents)} />
          <CommissionFields policy={selected.commission_policy} />
          <div className="flex gap-4"><button className="btn btn-primary" disabled={pending}>Save profile</button><button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setSelected(null)}>Cancel edit</button></div>
        </form></section>}
      <section className="card"><h2>Employee profiles</h2><p className="text-muted">Create employees and change names, roles, passwords or active status under Accounts & roles.</p>
        <Filters query={query} setQuery={setQuery} /><RecordState records={records}><div className="table-container"><table><thead><tr><th>Name</th><th>Role</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {records.data?.items.map((e) => <tr key={e.id}><td>{e.display_name}</td><td>{e.job_kind}</td><td>{e.phone || e.email || '—'}</td><td>{e.is_active ? 'Active' : 'Inactive'}</td>
            <td><div className="flex gap-2"><button className="btn btn-secondary" disabled={pending} onClick={() => { setSelected(e); setMessage(null) }}>Edit profile</button><button className="btn btn-secondary" onClick={() => setAvailability(e)}>Availability</button></div></td></tr>)}
        </tbody></table></div></RecordState><Pager page={query.page} total={records.data?.total} onChange={(page) => setQuery({ ...query, page })} />
      </section>{availability && <Availability key={availability.id} employee={availability} />}
    </>}
  </div>
}
