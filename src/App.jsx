import { useContext } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'
import { LogOut } from 'lucide-react'
import { DemoAccessContext } from './auth/DemoAccessContext'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import POS from './components/POS'
import Appointments from './components/Appointments'
import Inventory from './components/Inventory'
import Login from './components/Login'
import CustomerPortal from './components/CustomerPortal'
import PlaceholderPage from './pages/PlaceholderPage'
import Settings from './pages/Settings'
import './App.css'

function PreviewGuard({ mode }) {
  const access = useContext(DemoAccessContext)
  if (!access.mode) return <Navigate to="/" replace />
  if (access.mode !== mode)
    return (
      <Navigate
        to={access.mode === 'employee' ? '/app/dashboard' : '/book'}
        replace
      />
    )
  return <Outlet />
}

function PreviewEntry() {
  const access = useContext(DemoAccessContext)
  const navigate = useNavigate()
  if (access.mode)
    return (
      <Navigate
        to={access.mode === 'employee' ? '/app/dashboard' : '/book'}
        replace
      />
    )
  return (
    <Login
      onLogin={(mode) => {
        access.enterPreview(mode)
        navigate(mode === 'employee' ? '/app/dashboard' : '/book')
      }}
    />
  )
}

const pageTitles = {
  dashboard: 'Dashboard',
  pos: 'POS',
  appointments: 'Appointments',
  inventory: 'Inventory',
  customers: 'Customers',
  services: 'Services',
  employees: 'Employees',
  payroll: 'Payroll',
  reports: 'Reports',
  'activity-logs': 'Activity Logs',
  settings: 'Settings',
}

function EmployeeLayout() {
  const access = useContext(DemoAccessContext)
  const location = useLocation()
  const navigate = useNavigate()
  const title =
    pageTitles[location.pathname.split('/').filter(Boolean).at(-1)] ||
    'Workspace'
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <div className="top-header">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted text-sm">
              Romel Hair Salon · Sample data preview
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="profile-avatar">RS</div>
            <div>
              <p className="text-sm font-bold">Romel</p>
              <p className="text-muted text-sm">Manager preview</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              aria-label="Exit preview"
              onClick={() => {
                access.leavePreview()
                navigate('/')
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}

function CustomerPreview() {
  const access = useContext(DemoAccessContext)
  const navigate = useNavigate()
  return (
    <CustomerPortal
      onLogout={() => {
        access.leavePreview()
        navigate('/')
      }}
    />
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PreviewEntry />} />
      <Route element={<PreviewGuard mode="employee" />}>
        <Route path="/app" element={<EmployeeLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="inventory" element={<Inventory />} />
          <Route
            path="customers"
            element={
              <PlaceholderPage
                title="Customer management"
                description="Customer profiles, service history, and preferred stylists will be added here."
              />
            }
          />
          <Route
            path="services"
            element={
              <PlaceholderPage
                title="Service management"
                description="Service prices, durations, and staff eligibility will be configured here."
              />
            }
          />
          <Route
            path="employees"
            element={
              <PlaceholderPage
                title="Employee management"
                description="Employee profiles, availability, and permissions will be added here."
              />
            }
          />
          <Route
            path="payroll"
            element={
              <PlaceholderPage
                title="Payroll"
                description="Payroll periods and commission rules are awaiting definition."
              />
            }
          />
          <Route
            path="reports"
            element={
              <PlaceholderPage
                title="Reports"
                description="Sales summaries and analytics will use saved records once available."
              />
            }
          />
          <Route
            path="activity-logs"
            element={
              <PlaceholderPage
                title="Activity logs"
                description="Recorded business actions will appear here once workflows are implemented."
              />
            }
          />
          <Route path="settings" element={<Settings />} />
          <Route
            path="*"
            element={
              <PlaceholderPage
                title="Page"
                description="Choose a page from the navigation."
              />
            }
          />
        </Route>
      </Route>
      <Route element={<PreviewGuard mode="customer" />}>
        <Route path="/book" element={<CustomerPreview />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
