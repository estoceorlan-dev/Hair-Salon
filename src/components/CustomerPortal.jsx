import { useState } from 'react'
import { Link } from 'react-router'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { apiErrorMessage } from '../api/client'
import ScopedRecords from '../pages/ScopedRecords'
import ThemeToggle from './ThemeToggle'
import Appointments from './Appointments'
import { Feedback } from './ui/Feedback'

export default function CustomerPortal() {
  const auth = useAuth()
  const [error, setError] = useState(''), [pending, setPending] = useState(false)
  async function logout() {
    setPending(true); setError('')
    try { await auth.logout() } catch (err) { setError(apiErrorMessage(err)) } finally { setPending(false) }
  }
  return <div className="customer-portal"><header className="glass customer-header"><h1 className="text-xl text-primary">Romel Salon</h1>
    <div className="header-actions"><ThemeToggle /><Link to="/account">My Account</Link>
      <button className="btn btn-secondary" disabled={pending} onClick={logout}><LogOut size={16} />Sign out</button></div>
  </header><main className="customer-main flex-col gap-4">
    {error && <Feedback tone="error">{error}</Feedback>}<Appointments /><ScopedRecords kind="history" />
  </main></div>
}
