import { NavLink } from 'react-router'
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
  { name: 'Dashboard', path: 'dashboard', Icon: Home },
  { name: 'POS', path: 'pos', Icon: ShoppingCart },
  { name: 'Appointments', path: 'appointments', Icon: Calendar },
  { name: 'Inventory', path: 'inventory', Icon: Package },
  { name: 'Customers', path: 'customers', Icon: Users },
  { name: 'Services', path: 'services', Icon: Scissors },
  { name: 'Employees', path: 'employees', Icon: UserRound },
  { name: 'Payroll', path: 'payroll', Icon: Wallet },
  { name: 'Reports', path: 'reports', Icon: ChartColumn },
  { name: 'Activity Logs', path: 'activity-logs', Icon: History },
]

export default function Sidebar() {
  const linkClass = ({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">R</div>
        <h2 className="text-xl text-primary">Romel Salon</h2>
      </div>
      <nav className="sidebar-navigation" aria-label="Salon workspace">
        {navItems.map(({ name, path, Icon }) => (
          <NavLink key={path} to={`/app/${path}`} className={linkClass}>
            <Icon size={20} aria-hidden="true" />
            {name}
          </NavLink>
        ))}
      </nav>
      <NavLink to="/app/settings" className={linkClass}>
        <Settings size={20} aria-hidden="true" />
        Settings
      </NavLink>
    </aside>
  )
}
