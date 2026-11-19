import { useState } from 'react'
import { Printer, Download } from 'lucide-react'
import { api, apiErrorMessage } from '../api/client'
import { useRecords } from '../hooks/useRecords'
import { formatCurrency } from '../config/business-rules'
import { EmptyState, Feedback, LoadingState } from '../components/ui/Feedback'
import { Field, Select } from '../components/ui/Management'
import './Finance.css'

const money = (cents) => formatCurrency(Number(cents) / 100)
const dateTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
const manilaDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function period(preset) {
  const to = manilaDay(), start = new Date(to + 'T00:00:00Z')
  if (preset === 'week') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
  if (preset === 'month') start.setUTCDate(1)
  return { from: start.toISOString().slice(0,10), to }
}
function csv(filename, rows) {
  const safe = (cell) => {
    let text = String(cell ?? '')
    if (typeof cell === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"','""') + '"'
  }
  const url = URL.createObjectURL(new Blob(['\uFEFF', rows.map((row) => row.map(safe).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function Result({ records, children }) {
  if (records.loading) return <LoadingState />
  if (records.error) return <><Feedback tone="error">{records.error}</Feedback><button className="btn btn-secondary" onClick={records.refresh}>Retry</button></>
  return children(records.data)
}
function Dates({ value, onChange, required = true }) {
  return <><Field label="From" type="date" value={value.from} required={required} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })}/>
    <Field label="Through" type="date" value={value.to} required={required} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })}/></>
}
function Table({ headings, rows }) {
  return rows.length ? <div className="table-container"><table><thead><tr>{headings.map((h) => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((cells,i) => <tr key={i}>{cells.map((cell,j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div> : <EmptyState title="No records in this period"/>
}
function Exports({ download }) {
  return <div className="finance-actions"><button className="btn btn-secondary" onClick={download}><Download size={16}/> CSV</button>
    <button className="btn btn-secondary" onClick={() => window.print()}><Printer size={16}/> Print</button></div>
}
function Ranking({ title, rows, keyName }) {
  const max = Number(rows[0]?.[keyName]) || 1
  return <section className="card"><h2>{title}</h2>{rows.length ? <ul className="finance-list">{rows.slice(0,10).map((r) =>
    <li key={r.name}><strong>{r.name}</strong><span>{Number(r[keyName])}</span><progress aria-label={r.name} value={Number(r[keyName])} max={max}/></li>)}</ul> : <EmptyState title="No services sold"/>}</section>
}
function Reports() {
  const [dates,setDates] = useState(() => period('month'))
  const records = useRecords('/reports',dates)
  const dailyColumns = ['Day','Sales','Subtotal','Discount','Tax','Charged','Refunds','Net']
  const keys = ['gross','discount','tax','charged','refunded','net']
  return <div className="finance-stack"><div className="finance-filter">
    {['today','week','month'].map((p) => <button key={p} className="btn btn-secondary" onClick={() => setDates(period(p))}>{p === 'today' ? 'Today' : 'This ' + p}</button>)}
    <Dates value={dates} onChange={(v) => { if(v.from && v.to) setDates(v) }}/></div>
    <Result records={records}>{(data) => {
      const sum = (key) => data.daily.reduce((n,r) => n + Number(r[key]),0)
      const exportRows = [dailyColumns,...data.daily.map((r) => [r.day,r.sales,...keys.map((k) => Number(r[k])/100)]),
        [],['Payment method','Net (PHP)'],...data.payments.map((r) => [r.method_code,Number(r.net)/100]),
        [],['Item','Type','Units','Subtotal (PHP)'],...data.items.map((r) => [r.name,r.kind,Number(r.units),Number(r.amount)/100]),
        [],['Stylist','Services'],...data.staff.map((r) => [r.name,Number(r.services)])]
      return <><div className="finance-metrics">{[['Net sales',money(sum('net'))],['Receipts',sum('sales')],['Refunds',money(sum('refunded'))]].map(([label,val]) =>
        <div className="card finance-metric" key={label}><p>{label}</p><strong>{val}</strong></div>)}</div>
        <section className="card"><header className="finance-head"><div><h2>Daily sales</h2><small>{dates.from} – {dates.to}</small></div>
        <Exports download={() => csv('sales-' + dates.from + '-' + dates.to + '.csv',exportRows)}/></header>
        <Table headings={dailyColumns} rows={data.daily.map((r) => [r.day,r.sales,...keys.map((k) => money(r[k]))])}/></section>
        <div className="grid-cols-2"><Ranking title="Service demand" rows={data.items.filter((r) => r.kind === 'Service')} keyName="units"/>
        <Ranking title="Services by stylist" rows={data.staff} keyName="services"/></div>
        <section className="card"><h2>Payments</h2><Table headings={['Method','Net collected']} rows={data.payments.map((r) => [r.method_code.toUpperCase(),money(r.net)])}/></section>
        <section className="card"><h2>Item sales</h2><Table headings={['Item','Type','Units','Subtotal']} rows={data.items.map((r) => [r.name,r.kind,Number(r.units),money(r.amount)])}/></section></>
    }}</Result></div>
}
function Activity() {
  const [filter,setFilter] = useState({from:'',to:'',q:'',page:1})
  const records = useRecords('/activity-logs',{ ...filter,from:filter.from || undefined,to:filter.to || undefined })
  const change = (v) => setFilter({ ...v,page:1 })
  return <div className="finance-stack"><div className="finance-filter"><Field label="Search activity" type="search" value={filter.q} placeholder="Name, action, or reference" onChange={(e) => change({...filter,q:e.target.value})}/>
    <Dates value={filter} onChange={change} required={false}/></div>
    <section className="card"><Result records={records}>{({items,hasNext}) => <>
      <Table headings={['Time (Manila)','Actor','Action','Reference','Reason']} rows={items.map((r) => [dateTime.format(new Date(r.occurred_at)),r.actor,r.action.replaceAll('_',' '),r.entity_reference || '—',r.reason || '—'])}/>
      {(hasNext || filter.page>1) && <div className="list-pagination"><span>Page {filter.page}</span><button className="btn btn-secondary" disabled={filter.page===1} onClick={() => setFilter({...filter,page:filter.page-1})}>Previous</button>
        <button className="btn btn-secondary" disabled={!hasNext} onClick={() => setFilter({...filter,page:filter.page+1})}>Next</button></div>}</>}</Result></section></div>
}
function PayrollSheet({ run, items, saved }) {
  const [edits,setEdits] = useState({})
  const [pending,setPending] = useState(false), [error,setError] = useState('')
  const draft = run.status === 'draft'
  const value = (r,k) => edits[r.id]?.[k] ?? (k === 'note' ? r.note || '' : r[k] == null ? (k === 'adjustment' ? '0' : '') : (Number(r[k])/100).toFixed(2))
  const edit = (r,k,newValue) => setEdits((prev) => ({...prev,[r.id]:{...prev[r.id],[k]:newValue}}))
  const cents = (r,k) => Math.round(Number(value(r,k))*100)
  const net = (r) => cents(r,'base') + cents(r,'adjustment') + Number(r.commission) + Number(r.carry)
  const hasCarry = items.some((r) => Number(r.carry) !== 0)
  const headers = ['Employee','Base pay (PHP)','Commission',...(hasCarry ? ['Commission corrections'] : []),'Adjustment (PHP)','Reason','Net pay']
  const field = (r,k,label) => <input className={'input-field ' + (k==='note' ? 'finance-note-input' : 'finance-pay-input')} aria-label={label + ' for ' + r.display_name}
    type={k==='note' ? 'text' : 'number'} min={k==='base' ? 0 : undefined} step={k==='note' ? undefined : '.01'} maxLength={k==='note' ? 500 : undefined}
    required={k==='base' || (k==='note' && cents(r,'adjustment')!==0)} value={value(r,k)} onChange={(e) => edit(r,k,e.target.value)} />
  async function submit(e) {
    e.preventDefault();setPending(true);setError('')
    try {
      if (draft) await api.post('/payroll/' + run.id + '/approve',{items:items.map((r) => ({id:r.id,base:cents(r,'base'),adjustment:cents(r,'adjustment'),note:value(r,'note'),expectedCommission:Number(r.commission),expectedCarry:Number(r.carry)}))})
      else await api.post('/payroll/' + run.id + '/pay',{})
      saved()
    } catch(err) { setError(apiErrorMessage(err)) } finally { setPending(false) }
  }
  return <section className="card"><header className="finance-head"><div><h2>Pay period</h2><small>{run.starts_on} – {run.ends_on} · {run.status}</small></div>
    <Exports download={() => csv('payroll-' + run.starts_on + '.csv',[headers,...items.map((r) => [r.display_name,value(r,'base'),Number(r.commission)/100,...(hasCarry ? [Number(r.carry)/100] : []),value(r,'adjustment'),value(r,'note'),net(r)/100])])}/></header>
    {error && <Feedback tone="error">{error}</Feedback>}
    <form onSubmit={submit}><Table headings={headers} rows={items.map((r) => [<div key={r.id}><strong>{r.display_name}</strong>{draft && r.basis && r.rate != null && <small className="finance-rate">{money(r.rate)} · {r.basis.replace('_',' ')}</small>}</div>,
      draft ? field(r,'base','Base pay') : money(r.base),money(r.commission),...(hasCarry ? [money(r.carry)] : []),draft ? field(r,'adjustment','Adjustment') : money(r.adjustment),draft ? field(r,'note','Reason') : r.note || '—',money(net(r))])}/>
      <div className="finance-head mt-4"><strong>Total {money(items.reduce((n,r) => n+net(r),0))}</strong>
      {items.length>0 && ['draft','approved'].includes(run.status) && <button className="btn btn-primary" disabled={pending}>{draft ? 'Approve payroll' : 'Record cash payout'}</button>}</div></form></section>
}
function Payroll() {
  const runs = useRecords('/payroll'), [selection,setSelection] = useState(''), [dates,setDates] = useState(() => period('month'))
  const [error,setError] = useState(''), [pending,setPending] = useState(false)
  const selected = selection || runs.data?.items[0]?.id
  const detail = useRecords(selected ? '/payroll/' + selected : '')
  async function create(e) {
    e.preventDefault();setPending(true);setError('')
    try {const {data} = await api.post('/payroll',dates);setSelection(data.id);runs.refresh();detail.refresh()}
    catch(err) {setError(apiErrorMessage(err))} finally {setPending(false)}
  }
  return <div className="finance-stack"><form className="finance-filter card" onSubmit={create}><Dates value={dates} onChange={setDates}/>
    <button className="btn btn-primary" disabled={pending}>Open pay period</button></form>
    {error && <Feedback tone="error">{error}</Feedback>}
    <Result records={runs}>{({items}) => items.length ? <><div className="finance-filter">
      <Select label="Pay period" value={selected} onChange={(e) => setSelection(e.target.value)}>{items.map((r) => <option key={r.id} value={r.id}>{r.starts_on} – {r.ends_on} · {r.status}</option>)}</Select></div>
      <Result records={detail}>{(data) => <PayrollSheet key={data.run.id+data.run.status} {...data} saved={() => {runs.refresh();detail.refresh()}}/>}</Result></> : <EmptyState title="No payroll periods yet"/>}</Result></div>
}
export default function Finance({ kind }) {
  if (kind==='reports') return <Reports/>
  if (kind==='payroll') return <Payroll/>
  return <Activity/>
}

