import { useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { useRecords } from '../hooks/useRecords'
import { Feedback, LoadingState } from '../components/ui/Feedback'
import { Field, Select } from '../components/ui/Management'
import { CommissionFields } from './EmployeeProfiles'
import { commissionFrom } from '../config/form-values'

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const labels = { booking_policy: 'Booking policy', receipt_details: 'Receipt details', tax_policy: 'Tax policy',
  discount_policy: 'Discount policy', payroll_policy: 'Base pay basis', commission_policy: 'Default commission', payroll_periods: 'Payroll periods' }
function Definition({ value }) {
  return <Select label="Definition status" name="definitionState" defaultValue={value || 'placeholder'}>
    <option value="placeholder">Undefined (clears values)</option><option value="demo">Demo only</option><option value="confirmed">Confirmed by manager</option></Select>
}
function PolicyForm({ setting, save, pending }) {
  const value = setting.value || {}, key = setting.key
  const [periods, setPeriods] = useState(Array.isArray(setting.value) ? setting.value : [])
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault(); setError('')
    const d = Object.fromEntries(new FormData(event.currentTarget))
    let payload = null
    if (d.definitionState !== 'placeholder') {
      if (key === 'booking_policy') payload = { leadMinutes: Number(d.leadMinutes), horizonDays: Number(d.horizonDays), cancellationHours: Number(d.cancellationHours), notes: d.notes }
      if (key === 'receipt_details') payload = { salonName: d.salonName, address: d.address, phone: d.phone, footer: d.footer }
      if (key === 'tax_policy') payload = { ratePercent: Number(d.ratePercent), inclusive: d.inclusive === 'true', notes: d.notes }
      if (key === 'discount_policy') payload = { maxPercent: Number(d.maxPercent), notes: d.notes }
      if (key === 'payroll_policy') payload = { basis: d.basis, notes: d.notes }
      if (key === 'commission_policy') payload = commissionFrom(d)
      if (key === 'payroll_periods') payload = periods
      const numbers = { booking_policy: ['leadMinutes', 'horizonDays', 'cancellationHours'], tax_policy: ['ratePercent'], discount_policy: ['maxPercent'] }[key] || []
      if (numbers.some((field) => d[field] === '')) { setError('Fill in the numeric policy fields, or leave the definition undefined.'); return }
    }
    await save('/settings', 'put', { key, value: payload, definitionState: d.definitionState })
  }
  return <section className="card"><h2>{labels[key]}</h2>{error && <Feedback tone="error">{error}</Feedback>}<form className="auth-form account-fields" onSubmit={submit}>
    <Definition value={setting.definition_state} />
    {key === 'booking_policy' && <><Field label="Minimum lead time (minutes)" name="leadMinutes" type="number" min="0" max="525600" defaultValue={value.leadMinutes ?? ''} />
      <Field label="Booking horizon (days)" name="horizonDays" type="number" min="1" max="730" defaultValue={value.horizonDays ?? ''} />
      <Field label="Cancellation notice (hours)" name="cancellationHours" type="number" min="0" max="8760" step="0.5" defaultValue={value.cancellationHours ?? ''} /></>}
    {key === 'receipt_details' && <><Field label="Salon name" name="salonName" maxLength={100} defaultValue={value.salonName || ''} /><Field label="Address" name="address" maxLength={500} defaultValue={value.address || ''} />
      <Field label="Phone" name="phone" maxLength={30} defaultValue={value.phone || ''} /><Field label="Receipt footer" name="footer" maxLength={1000} defaultValue={value.footer || ''} /></>}
    {key === 'tax_policy' && <><Field label="Tax rate (%)" name="ratePercent" type="number" min="0" max="100" step="0.01" defaultValue={value.ratePercent ?? ''} />
      <Select label="Price treatment" name="inclusive" defaultValue={String(value.inclusive ?? false)}><option value="false">Tax exclusive</option><option value="true">Tax inclusive</option></Select></>}
    {key === 'discount_policy' && <Field label="Maximum discount (%)" name="maxPercent" type="number" min="0" max="100" step="0.01" defaultValue={value.maxPercent ?? ''} />}
    {key === 'payroll_policy' && <Select label="Base pay basis" name="basis" defaultValue={value.basis || ''}><option value="">Choose basis</option><option value="monthly">Monthly</option><option value="daily">Daily</option><option value="hourly">Hourly</option><option value="per_period">Per payroll period</option></Select>}
    {key === 'commission_policy' && <CommissionFields policy={setting.value} />}
    {key === 'payroll_periods' && <div className="period-fields">{periods.map((p, i) => <div className="management-toolbar" key={i}>
      <Field label={`Period ${i + 1} start`} type="date" value={p.startsOn} onChange={(e) => setPeriods(periods.map((v, n) => n === i ? { ...v, startsOn: e.target.value } : v))} />
      <Field label={`Period ${i + 1} end`} type="date" value={p.endsOn} onChange={(e) => setPeriods(periods.map((v, n) => n === i ? { ...v, endsOn: e.target.value } : v))} />
      <button type="button" className="btn btn-secondary" onClick={() => setPeriods(periods.filter((_, n) => i !== n))}>Remove period {i + 1}</button>
    </div>)}<button type="button" className="btn btn-secondary" onClick={() => setPeriods([...periods, { startsOn: '', endsOn: '' }])}>Add period</button></div>}
    {['booking_policy', 'tax_policy', 'discount_policy', 'payroll_policy'].includes(key) && <Field label="Policy notes" name="notes" maxLength={1000} defaultValue={value.notes || ''} />}
    <button className="btn btn-primary" disabled={pending}>Save {labels[key].toLowerCase()}</button>
  </form></section>
}
function Hours({ hours, save, pending }) {
  const [rows, setRows] = useState(hours.map((h) => ({ weekday: h.weekday, opensAt: h.opens_at?.slice(0, 5) || null,
    closesAt: h.closes_at?.slice(0, 5) || null, isClosed: h.is_closed, definitionState: h.definition_state })))
  const change = (i, patch) => setRows(rows.map((r, n) => i === n ? { ...r, ...patch } : r))
  return <section className="card"><h2>Opening hours</h2><p className="text-muted">Asia/Manila · Opening and closing must be on the same day.</p>
    <form onSubmit={(e) => { e.preventDefault(); save('/settings/hours', 'put', { hours: rows }) }}>
      {rows.map((r, i) => <div className="hours-row" key={r.weekday}><strong>{days[r.weekday]}</strong>
        <Select label={`${days[r.weekday]} status`} value={r.definitionState === 'placeholder' ? 'placeholder' : r.isClosed ? 'closed' : 'open'}
          onChange={(e) => change(i, e.target.value === 'placeholder' ? { definitionState: 'placeholder', isClosed: null, opensAt: null, closesAt: null }
            : { definitionState: r.definitionState === 'placeholder' ? 'demo' : r.definitionState, isClosed: e.target.value === 'closed', opensAt: null, closesAt: null })}>
          <option value="placeholder">Undefined</option><option value="open">Open</option><option value="closed">Closed</option></Select>
        <Field label={`${days[r.weekday]} opens`} type="time" disabled={r.isClosed !== false} required={r.isClosed === false} value={r.opensAt || ''} onChange={(e) => change(i, { opensAt: e.target.value || null })} />
        <Field label={`${days[r.weekday]} closes`} type="time" disabled={r.isClosed !== false} required={r.isClosed === false} value={r.closesAt || ''} onChange={(e) => change(i, { closesAt: e.target.value || null })} />
        {r.definitionState !== 'placeholder' && <Select label={`${days[r.weekday]} definition`} value={r.definitionState} onChange={(e) => change(i, { definitionState: e.target.value })}><option value="demo">Demo</option><option value="confirmed">Confirmed</option></Select>}
      </div>)}<button className="btn btn-primary mt-4" disabled={pending}>Save opening hours</button>
    </form></section>
}
export default function Settings() {
  const records = useRecords('/settings')
  const [message, setMessage] = useState(null), [pending, setPending] = useState(false)
  async function save(path, method, body) {
    setPending(true); setMessage(null)
    try { await api({ url: path, method, data: body }); records.refresh(); setMessage({ tone: 'success', text: 'Settings saved.' }); return true }
    catch (err) { setMessage({ tone: 'error', text: apiErrorMessage(err) }); return false } finally { setPending(false) }
  }
  return <div className="flex-col gap-4"><Feedback>Currency: PHP · Timezone: Asia/Manila. Undefined policies stay blank. Saved policies are configuration for later booking, receipt, tax and payroll workflows; no financial calculations or payments run here.</Feedback>
    {message && <Feedback tone={message.tone}>{message.text}</Feedback>}
    {records.loading ? <LoadingState /> : records.error ? <><Feedback tone="error">{records.error}</Feedback><button className="btn btn-secondary" onClick={records.refresh}>Retry</button></> : <>
      <Hours hours={records.data.hours} save={save} pending={pending} />
      <section className="card"><h2>Salon closures</h2><form className="auth-form account-fields" onSubmit={async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); await save('/settings/closures', 'post', d) }}>
        <Field label="Closure date (Manila)" name="closedOn" type="date" required /><Field label="Closure reason" name="reason" required minLength={2} maxLength={500} /><button className="btn btn-primary" disabled={pending}>Add closure</button>
      </form>{records.data.closures.length === 0 ? <p className="text-muted">No closures recorded.</p> : <div className="table-container"><table><thead><tr><th>Date</th><th>Reason</th><th>Action</th></tr></thead><tbody>{records.data.closures.map((c) => <tr key={c.id}><td>{c.closed_on}</td><td>{c.reason}</td><td><button className="btn btn-secondary" disabled={pending} onClick={() => save('/settings/closures/' + c.id, 'delete', {})}>Remove</button></td></tr>)}</tbody></table></div>}</section>
      {records.data.settings.filter((s) => labels[s.key]).map((s) => <PolicyForm key={s.key + s.updated_at} setting={s} save={save} pending={pending} />)}
      <section className="card"><h2>Payment methods</h2><p className="text-muted">All payment methods remain disabled pending separate implementation.</p><div className="flex gap-4">{records.data.payments.map((p) => <button className="btn btn-secondary" key={p.code} disabled>{p.label} · Disabled</button>)}</div></section>
    </>}
  </div>
}
