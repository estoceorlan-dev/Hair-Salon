import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Feedback } from './ui/Feedback'
import { homeFor, useAuth } from '../auth/AuthContext'
import { apiErrorMessage } from '../api/client'

export default function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [registering, setRegistering] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setPending(true)
    setError('')
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const user = await (registering ? auth.register(fields) : auth.login(fields))
      navigate(homeFor(user), { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  function switchForm() {
    setRegistering(!registering)
    setVisible(false)
    setError('')
  }

  return <main className="salon-entry">
    <div className="entry-portrait">
      <img src="/salon.webp" alt="" fetchPriority="high" />
      <div className="entry-wordmark" aria-label="Romel Hair Salon">
        <span>Romel</span><small>Hair Salon</small>
      </div>
    </div>
    <section className="entry-panel" aria-labelledby="entry-heading">
      <div className="entry-content">
        <h1 id="entry-heading">{registering ? <>Create an <em>account.</em></> : <>Welcome <em>back.</em></>}</h1>
        <p className="entry-subtitle">{registering ? 'Book appointments and see your visit history.' : 'Sign in to your salon account.'}</p>
        {auth.notice && <Feedback>{auth.notice}</Feedback>}
        {(error || auth.error) && <Feedback tone="error">{error || auth.error}</Feedback>}
        <form className="auth-form" onSubmit={submit} key={String(registering)}>
          {registering && <label><span className="input-label">Full name</span>
            <input className="input-field" name="displayName" autoComplete="name" required minLength={2} maxLength={100} /></label>}
          <label><span className="input-label">Email address</span>
            <input className="input-field" name="email" type="email" placeholder="you@example.com" autoComplete={registering ? 'email' : 'username'} required maxLength={254} /></label>
          <div><label className="input-label" htmlFor="entry-password">Password</label>
            <div className="entry-password">
              <input id="entry-password" className="input-field" name="password" type={visible ? 'text' : 'password'} placeholder={registering ? 'At least 12 characters' : 'Enter your password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 12 : 1} maxLength={72} />
              <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
          <button className="btn btn-primary entry-submit" disabled={pending}>{pending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}<ArrowRight size={18} /></button>
        </form>
        <p className="entry-switch">{registering ? 'Already have an account?' : 'New to the salon?'} <button type="button" disabled={pending} onClick={switchForm}>{registering ? 'Sign in' : 'Create an account'}</button></p>
      </div>
    </section>
  </main>
}
