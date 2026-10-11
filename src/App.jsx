import { useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { LogOut } from 'lucide-react'
import { homeFor, useAuth } from './auth/AuthContext'
import { apiErrorMessage } from './api/client'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import POS from './components/POS'
import Inventory from './components/Inventory'
import Login from './components/Login'
import CustomerPortal from './components/CustomerPortal'
import PlaceholderPage from './pages/PlaceholderPage'
import Settings from './pages/Settings'
import EmployeeAccounts from './pages/EmployeeAccounts'
import ScopedRecords from './pages/ScopedRecords'
import Account from './pages/Account'
import { Feedback, LoadingState } from './components/ui/Feedback'
import './App.css'

function Guard({ permissions, employee = false }) {
  const auth = useAuth()
  if (auth.loading) return <div className="preview-entry"><LoadingState message="Restoring your session..." /></div>
  if (auth.error) return <div className="preview-entry"><div><Feedback tone="error">{auth.error}</Feedback><button className="btn btn-secondary mt-4" onClick={auth.refresh}>Retry connection</button></div></div>
  if (!auth.user) return <Navigate to="/" replace />
  if ((employee && auth.user.role === 'customer') || (permissions && !permissions.some((p) => auth.user.permissions.includes(p))))
    return <div className="card"><Feedback tone="error">Your account cannot access this page.</Feedback><a className="btn btn-secondary mt-4" href={homeFor(auth.user)}>Back to your workspace</a></div>
  return <Outlet />
}
function Entry() {
  const auth = useAuth()
  if (auth.loading) return <div className="preview-entry"><LoadingState message="Checking your session..." /></div>
  return auth.user ? <Navigate to={homeFor(auth.user)} replace /> : <Login />
}
const pageTitles = { dashboard: 'Dashboard', pos: 'POS', appointments: 'Appointments', inventory: 'Inventory',
  customers: 'Customers', services: 'Services', employees: 'Employee Accounts', payroll: 'Payroll', reports: 'Reports',
  'activity-logs': 'Activity Logs', settings: 'Settings', earnings: 'My Earnings' }
function EmployeeLayout() {
  const auth = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const title = pageTitles[location.pathname.split('/').at(-1)] || 'Workspace'
  const logout = async () => {
    setPending(true)
    setError('')
    try { await auth.logout() } catch (err) { setError(apiErrorMessage(err)) } finally { setPending(false) }
  }
  return <div className="app-container"><Sidebar /><main className="main-content">
    <div className="top-header"><div><h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted text-sm">Romel Hair Salon</p></div><div className="flex items-center gap-4">
      <div className="profile-avatar">{auth.user.displayName.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div>
      <div><p className="text-sm font-bold">{auth.user.displayName}</p><p className="text-muted text-sm">{auth.user.roleName}</p></div>
      <button className="btn btn-secondary" aria-label="Sign out" disabled={pending} onClick={logout}><LogOut size={16} /></button>
    </div></div>{error && <Feedback tone="error">{error}</Feedback>}<Outlet />
  </main></div>
}
function EmployeeHome() { return <Navigate to={homeFor(useAuth().user)} replace /> }
const placeholder = (title, description) => <PlaceholderPage title={title} description={description} />
export default function App() {
  return <Routes>
    <Route path="/" element={<Entry />} />
    <Route element={<Guard employee />}><Route path="/app" element={<EmployeeLayout />}>
      <Route index element={<EmployeeHome />} />
      <Route element={<Guard permissions={['dashboard.view']} />}><Route path="dashboard" element={<><Feedback>Sample dashboard figures. Live analytics are planned for a later phase.</Feedback><Dashboard /></>} /></Route>
      <Route element={<Guard permissions={['sales.manage']} />}><Route path="pos" element={<POS />} /></Route>
      <Route element={<Guard permissions={['appointments.manage', 'appointments.assigned']} />}><Route path="appointments" element={<ScopedRecords kind="appointments" />} /></Route>
      <Route element={<Guard permissions={['earnings.own']} />}><Route path="earnings" element={<ScopedRecords kind="earnings" />} /></Route>
      <Route element={<Guard permissions={['inventory.manage']} />}><Route path="inventory" element={<Inventory />} /></Route>
      <Route element={<Guard permissions={['employees.manage']} />}><Route path="employees" element={<EmployeeAccounts />} /></Route>
      <Route element={<Guard permissions={['customers.manage']} />}><Route path="customers" element={placeholder('Customer management', 'Customer record editing will be added in Phase 4.')} /></Route>
      <Route element={<Guard permissions={['services.manage']} />}><Route path="services" element={placeholder('Service management', 'Service prices, durations, and eligibility remain to be defined.')} /></Route>
      <Route element={<Guard permissions={['payroll.manage']} />}><Route path="payroll" element={placeholder('Payroll', 'Payroll periods and commission rules are awaiting definition.')} /></Route>
      <Route element={<Guard permissions={['reports.view']} />}><Route path="reports" element={placeholder('Reports', 'Financial reports will be added in a later phase.')} /></Route>
      <Route element={<Guard permissions={['logs.view']} />}><Route path="activity-logs" element={placeholder('Activity logs', 'Business audit views will be added in a later phase.')} /></Route>
      <Route element={<Guard permissions={['settings.manage']} />}><Route path="settings" element={<Settings />} /></Route>
      <Route path="*" element={placeholder('Page not found', 'Choose a page from the navigation.')} />
    </Route></Route>
    <Route element={<Guard permissions={['appointments.own']} />}><Route path="/book" element={<CustomerPortal />} /></Route>
    <Route element={<Guard />}><Route path="/account" element={<Account />} /></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
