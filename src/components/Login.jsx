import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Scissors, ArrowRight } from 'lucide-react'
import { Feedback } from './ui/Feedback'
import { homeFor, useAuth } from '../auth/AuthContext'
import { apiErrorMessage } from '../api/client'

export default function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [registering, setRegistering] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setPending(true)
    setError('')
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const user = await (registering ? auth.register(fields) : auth.login(fields))
      navigate(homeFor(user), { replace: true })
    } catch (err) { setError(apiErrorMessage(err)) }
    finally { setPending(false) }
  }
  return <div className="preview-entry"><div className="card glass preview-entry-card">
    <div className="text-center mb-4">
      <div className="salon-logo"><Scissors size={32} aria-hidden="true" /></div>
      <h1 className="text-2xl font-bold">Romel Hair Salon</h1>
      <p className="text-muted">{registering ? 'Create your customer account.' : 'Sign in to your salon account.'}</p>
    </div>
    {auth.notice && <Feedback>{auth.notice}</Feedback>}
    {(error || auth.error) && <Feedback tone="error">{error || auth.error}</Feedback>}
    <form className="auth-form" onSubmit={submit} key={String(registering)}>
      {registering && <label className="input-group"><span className="input-label">Full name</span>
        <input className="input-field" name="displayName" autoComplete="name" required minLength={2} maxLength={100} /></label>}
      <label className="input-group"><span className="input-label">Email</span>
        <input className="input-field" name="email" type="email" autoComplete="username" required maxLength={254} /></label>
      <label className="input-group"><span className="input-label">Password</span>
        <input className="input-field" name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 12 : 1} maxLength={72} /></label>
      {registering && <p className="text-muted text-sm">Use at least 12 characters. Employee accounts are created by a manager.</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Please wait...' : registering ? 'Create account' : 'Sign in'} <ArrowRight size={18} /></button>
    </form>
    <button type="button" className="btn btn-secondary auth-switch" disabled={pending} onClick={() => { setRegistering(!registering); setError('') }}>
      {registering ? 'Already registered? Sign in' : 'New customer? Create an account'}
    </button>
  </div></div>
}
