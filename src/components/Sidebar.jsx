import { useState } from 'react'
import { NavLink } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import {
  Home,
  ShoppingCart,
  Calendar,
  Package,
  Users,
  Settings,
  Scissors,
  UserRound,
  Wallet,
  ChartColumn,
  History,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', path: 'dashboard', Icon: Home, permissions: ['dashboard.view'] },
  { name: 'Point of sale', path: 'pos', Icon: ShoppingCart, permissions: ['sales.manage'] },
  { name: 'Appointments', path: 'appointments', Icon: Calendar, permissions: ['appointments.manage', 'appointments.assigned'] },
  { name: 'My Earnings', path: 'earnings', Icon: Wallet, permissions: ['earnings.own'] },
  { name: 'Inventory', path: 'inventory', Icon: Package, permissions: ['inventory.manage'] },
  { name: 'Customers', path: 'customers', Icon: Users, permissions: ['customers.manage'] },
  { name: 'Services', path: 'services', Icon: Scissors, permissions: ['services.manage'] },
  { name: 'Employees', path: 'employees', Icon: UserRound, permissions: ['employees.manage'] },
  { name: 'Payroll', path: 'payroll', Icon: Wallet, permissions: ['payroll.manage'] },
  { name: 'Reports', path: 'reports', Icon: ChartColumn, permissions: ['reports.view'] },
  { name: 'Activity Logs', path: 'activity-logs', Icon: History, permissions: ['logs.view'] },
]

export default function Sidebar() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const linkClass = ({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">R</div>
        <span className="sidebar-name">Romel Salon</span>
        <button type="button" className="sidebar-menu-btn" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-controls="salon-nav" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      <nav id="salon-nav" className={'sidebar-navigation' + (open ? ' open' : '')} aria-label="Salon workspace">
        {navItems.filter(({ permissions }) => permissions.some((p) => user.permissions.includes(p))).map(({ name, path, Icon }) => (
          <NavLink key={path} to={`/app/${path}`} className={linkClass} onClick={() => setOpen(false)}>
            <Icon size={20} aria-hidden="true" />
            {name}
          </NavLink>
        ))}
      <div className="sidebar-separator" />
      <NavLink to="/account" className={linkClass} onClick={() => setOpen(false)}><UserRound size={20} />My account</NavLink>
      {user.permissions.includes('settings.manage') && <NavLink to="/app/settings" className={linkClass} onClick={() => setOpen(false)}>
        <Settings size={20} aria-hidden="true" />
        Settings
      </NavLink>}
      </nav>
    </aside>
  )
}
