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
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', path: 'dashboard', Icon: Home, permissions: ['dashboard.view'] },
  { name: 'POS', path: 'pos', Icon: ShoppingCart, permissions: ['sales.manage'] },
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
  const linkClass = ({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">R</div>
        <h2 className="text-xl text-primary">Romel Salon</h2>
      </div>
      <nav className="sidebar-navigation" aria-label="Salon workspace">
        {navItems.filter(({ permissions }) => permissions.some((p) => user.permissions.includes(p))).map(({ name, path, Icon }) => (
          <NavLink key={path} to={`/app/${path}`} className={linkClass}>
            <Icon size={20} aria-hidden="true" />
            {name}
          </NavLink>
        ))}
      </nav>
      <NavLink to="/account" className={linkClass}><UserRound size={20} />My Account</NavLink>
      {user.permissions.includes('settings.manage') && <NavLink to="/app/settings" className={linkClass}>
        <Settings size={20} aria-hidden="true" />
        Settings
      </NavLink>}
    </aside>
  )
}
