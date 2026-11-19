import { useState } from 'react'
import { Link } from 'react-router'
import { homeFor, useAuth } from '../auth/AuthContext'
import { apiErrorMessage } from '../api/client'
import ThemeToggle from '../components/ThemeToggle'
import { Feedback } from '../components/ui/Feedback'

export default function Account() {
  const auth = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setPending(true); setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    if (data.newPassword !== data.confirmPassword) { setError('The new passwords do not match.'); setPending(false); return }
    delete data.confirmPassword
    try { await auth.changePassword(data) }
    catch (err) { setError(apiErrorMessage(err)) }
    finally { setPending(false) }
  }
  return <div className="preview-entry"><section className="card account-card">
    <header className="account-header"><Link to={homeFor(auth.user)}>Back to workspace</Link><ThemeToggle /></header>
    <h1>My account</h1>
    <p>{auth.user.displayName} · {auth.user.roleName}</p><p className="text-muted">{auth.user.email}</p>
    <h2 className="mt-4">Change password</h2><Feedback>Changing your password ends all of your sessions. Sign in again afterward.</Feedback>
    {error && <Feedback tone="error">{error}</Feedback>}
    <form className="auth-form" onSubmit={submit}>
      <label className="input-group"><span className="input-label">Current password</span><input className="input-field" name="currentPassword" type="password" autoComplete="current-password" required maxLength={72} /></label>
      <label className="input-group"><span className="input-label">New password</span><input className="input-field" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
      <label className="input-group"><span className="input-label">Confirm new password</span><input className="input-field" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Saving...' : 'Change password'}</button>
    </form>
  </section></div>
}
