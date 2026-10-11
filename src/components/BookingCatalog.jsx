import { useState } from 'react'
import { useCatalog } from '../hooks/useCatalog'
import { Field, Select } from './ui/Management'
import { Feedback, LoadingState, EmptyState } from './ui/Feedback'
import { formatCurrency } from '../config/business-rules'

export default function BookingCatalog() {
  const catalog = useCatalog()
  const [selectedId, setSelectedId] = useState(''), [staffId, setStaffId] = useState(''), [search, setSearch] = useState('')
  const selected = catalog.items.find((s) => s.id === selectedId)
  return <section className="card"><h2>Explore services</h2>
    <Feedback>Service choices and eligible staff come from the salon catalog. Live appointment availability and reservations arrive in Phase 5.</Feedback>
    <div className="management-toolbar"><Field label="Search services" type="search" value={search} onChange={(e) => setSearch(e.target.value)} /><button className="btn btn-secondary" disabled={catalog.loading} onClick={catalog.refresh}>Refresh catalog</button></div>
    {catalog.loading ? <LoadingState /> : catalog.error ? <Feedback tone="error">{catalog.error}</Feedback> : <>
      <div className="grid-cols-2">{catalog.items.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())).map((s) => <button type="button" key={s.id}
        className={`card booking-service ${selectedId === s.id ? 'selected' : ''}`} aria-pressed={selectedId === s.id}
        onClick={() => { setSelectedId(s.id); setStaffId('') }}>
        <strong>{s.name}</strong><span>{s.category}</span><span>{s.duration_minutes === null ? 'Duration undefined' : `${s.duration_minutes} minutes`}</span>
        <span className="text-primary font-bold">{s.price_cents === null ? 'Price undefined' : formatCurrency(Number(s.price_cents) / 100)}{s.is_demo ? ' · Demo' : ''}</span>
      </button>)}</div>
      {!catalog.items.length && <EmptyState title="No active services available" />}
      {selected && <div className="mt-4"><h3>Selection preview · {selected.name}</h3><Select label="Preferred stylist" value={selected.employees.some((e) => e.id === staffId) ? staffId : ''} onChange={(e) => setStaffId(e.target.value)}>
        <option value="">No preference</option>{selected.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
        {!selected.employees.length && <p className="text-muted">Eligible staff have not been assigned yet.</p>}
        <button className="btn btn-primary mt-4" disabled>Booking not yet available</button>
      </div>}
    </>}
  </section>
}
