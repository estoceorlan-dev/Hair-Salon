import { CalendarDays, Users, Banknote, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { useRecords } from '../hooks/useRecords'
import { formatCurrency } from '../config/business-rules'
import { EmptyState, Feedback, LoadingState } from './ui/Feedback'
import '../pages/Finance.css'

const appointmentTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function Dashboard() {
  const records = useRecords('/dashboard')
  if (records.loading) return <LoadingState />
  if (records.error) return <><Feedback tone="error">{records.error}</Feedback><button className="btn btn-secondary" onClick={records.refresh}>Retry</button></>
  const { net, bookings, customers, upcoming, stock } = records.data
  return <div className="finance-stack">
    <section aria-label="Today in Manila" className="finance-metrics">
      {[[Banknote,'Net sales today',formatCurrency(Number(net)/100)],[CalendarDays,"Today's appointments",bookings],[Users,'New customers today',customers]].map(([Icon,label,value]) =>
        <div key={label} className="card finance-metric"><Icon size={20} aria-hidden="true"/><p>{label}</p><strong>{value}</strong></div>)}
    </section>
    <section className="card"><header className="finance-head"><h2>Upcoming appointments</h2><Link to="/app/appointments">Schedule <ArrowUpRight size={16}/></Link></header>
      {upcoming.length ? <ul className="finance-list">{upcoming.map((a) => <li key={a.id}><div><strong>{a.customer}</strong><small>{a.service} · {a.stylist}</small></div><time>{appointmentTime.format(new Date(a.starts_at))}</time></li>)}</ul> : <EmptyState title="No upcoming appointments"/>}
    </section>
    {stock && <section className="card"><header className="finance-head"><h2>Low stock</h2><Link to="/app/inventory">Inventory <ArrowUpRight size={16}/></Link></header>
      {stock.length ? <ul className="finance-list">{stock.map((p) => <li key={p.id}><strong>{p.name}</strong><span>{Number(p.quantity)} {p.stock_unit} left</span></li>)}</ul> : <EmptyState title="Stock levels are healthy"/>}</section>}
  </div>
}
