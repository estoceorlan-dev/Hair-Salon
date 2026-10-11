import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, Feedback, LoadingState } from '../components/ui/Feedback'

export default function EmployeeAccounts() {
  const auth = useAuth()
  const [employees, setEmployees] = useState([])
  const [selected, setSelected] = useState(null)
  const [loadedRevision, setLoadedRevision] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [revision, setRevision] = useState(0)
  const loading = loadedRevision !== revision
  useEffect(() => {
    const controller = new AbortController()
    api.get('/employee-accounts', { signal: controller.signal }).then(({ data }) => setEmployees(data.employees))
      .catch((err) => { if (!controller.signal.aborted) setError(apiErrorMessage(err)) })
      .finally(() => { if (!controller.signal.aborted) setLoadedRevision(revision) })
    return () => controller.abort()
  }, [revision])
  const submit = async (event) => {
    event.preventDefault()
    setPending(true); setError(''); setSuccess('')
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    if (selected) {
      fields.isActive = fields.isActive === 'true'
      if (!fields.password) delete fields.password
    }
    try {
      if (selected) await api.patch('/employee-accounts/' + selected.id, fields)
      else await api.post('/employee-accounts', fields)
      const editingSelf = selected?.id === auth.user.id
      setSelected(null); setRevision(revision + 1)
      setSuccess('Account saved. Updated accounts must sign in again.')
      if (editingSelf) await auth.refresh()
    } catch (err) { setError(apiErrorMessage(err)) }
    finally { setPending(false) }
  }
  return <div className="flex-col gap-4">
    <Feedback>Manage sign-in accounts here. Pay, commission rules, and availability remain pending.</Feedback>
    {error && <Feedback tone="error">{error}</Feedback>}{success && <Feedback tone="success">{success}</Feedback>}
    <section className="card"><h2>{selected ? 'Edit employee account' : 'Create employee account'}</h2>
      <form className="auth-form account-fields" onSubmit={submit} key={selected?.id || 'new-' + revision}>
        <label className="input-group"><span className="input-label">Full name</span><input className="input-field" name="displayName" defaultValue={selected?.displayName || ''} required minLength={2} maxLength={100} autoComplete="off" /></label>
        <label className="input-group"><span className="input-label">Email</span><input className="input-field" name="email" type="email" defaultValue={selected?.email || ''} required maxLength={254} autoComplete="off" /></label>
        <div className="input-group"><label className="input-label" htmlFor="employee-role">Role</label><select id="employee-role" className="input-field" name="role" defaultValue={selected?.role || 'stylist'}>
          <option value="manager">Manager</option><option value="cashier">Receptionist / Cashier</option><option value="stylist">Stylist</option><option value="beautician">Beautician</option>
        </select></div>
        <label className="input-group"><span className="input-label">{selected ? 'New password (optional)' : 'Initial password'}</span><input className="input-field" name="password" type="password" required={!selected} minLength={12} maxLength={72} autoComplete="new-password" /></label>
        {selected && <div className="input-group"><label className="input-label" htmlFor="employee-status">Account status</label><select id="employee-status" className="input-field" name="isActive" defaultValue={String(selected.isActive)}><option value="true">Active</option><option value="false">Inactive</option></select></div>}
        <div className="flex gap-4"><button className="btn btn-primary" disabled={pending}>{pending ? 'Saving...' : selected ? 'Save changes' : 'Create account'}</button>
          {selected && <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setSelected(null)}>Cancel edit</button>}</div>
      </form><p className="text-muted text-sm">Passwords require at least 12 characters. Share the initial password privately; employees can change it under My Account.</p>
    </section>
    <section className="card"><h2>Employee accounts</h2>{loading ? <LoadingState /> : !employees.length ? <EmptyState title="No accounts found" />
      : <div className="table-container"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {employees.map((employee) => <tr key={employee.id}><td>{employee.displayName}</td><td>{employee.email}</td><td>{employee.roleName}</td><td>{employee.isActive ? 'Active' : 'Inactive'}</td>
          <td><button className="btn btn-secondary" disabled={pending} onClick={() => { setSelected(employee); setError(''); setSuccess('') }}>Edit</button></td></tr>)}
      </tbody></table></div>}
      <button className="btn btn-secondary mt-4" disabled={loading || pending} onClick={() => { setError(''); setRevision(revision + 1) }}>Refresh accounts</button>
    </section>
  </div>
}
