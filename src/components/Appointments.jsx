import { useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useRecords } from '../hooks/useRecords'
import { useCatalog } from '../hooks/useCatalog'
import { Field,Select } from './ui/Management'
import { Feedback,LoadingState } from './ui/Feedback'
import { useAction } from '../hooks/useAction'
import { dateTime, today } from '../config/operation-format'
import { CustomerChoice } from './ui/Operations'

function Booking({row,onDone}) {
  const {user}=useAuth(),catalog=useCatalog(),action=useAction()
  const [service,setService]=useState(row?.service_id || ''),[employee,setEmployee]=useState(row?.employee_id || '')
  const [customer,setCustomer]=useState(row?.customer_id || ''),[day,setDay]=useState(today()),[time,setTime]=useState('')
  const item=catalog.items.find(i=>i.id===service)
  const slots=useRecords(employee && day?'/slots':null,{serviceId:service,employeeId:employee,date:day})
  function submit(e) {
    e.preventDefault()
    action.run(async()=>{
      const body={serviceId:service,employeeId:employee,startsAt:time,...(customer?{customerId:customer}:{})}
      try {
        const {data}=await (row?api.put('/appointments/'+row.id,body):api.post('/appointments',body))
        onDone(data.item.booking_reference)
      }finally{slots.refresh();setTime('')}
    })
  }
  return <form className="card" onSubmit={submit}><h2>{row?'Reschedule appointment':'Book an appointment'}</h2>
    {action.feedback}{catalog.error && <Feedback tone="error">{catalog.error}</Feedback>}
    <div className="account-fields">{user.role!=='customer' && !row && <CustomerChoice required value={customer} onChange={setCustomer}/>}
    <Select label="Service" required value={service} onChange={e=>{setService(e.target.value);setEmployee('');setTime('')}}><option value="">Choose service</option>{catalog.items.filter(s=>s.duration_minutes && s.employees.length).map(s=><option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min</option>)}</Select>
    <Select label="Stylist" required value={employee} onChange={e=>{setEmployee(e.target.value);setTime('')}}><option value="">Choose stylist</option>{item?.employees.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>
    <Field label="Date (Manila)" type="date" required min={today()} value={day} onChange={e=>{setDay(e.target.value);setTime('')}}/>
    <Select label="Time (Manila)" required value={time} onChange={e=>setTime(e.target.value)}><option value="">{employee && !slots.loading && !slots.data?.items.length?'No slots available':'Choose time'}</option>{!slots.loading && slots.data?.items.map(s=><option key={s.start} value={s.start}>{new Date(s.start).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'})}</option>)}</Select></div>
    {item?.has_image && <img width="140" alt={item.name} src={'/api/images/'+item.id}/>}
    {slots.error && <Feedback tone="error">{slots.error}</Feedback>}
    <button className="btn btn-primary" disabled={action.pending || !time || slots.loading}>Confirm {row?'change':'booking'}</button></form>
}
export default function Appointments() {
  const {user}=useAuth(),records=useRecords('/appointments'),action=useAction()
  const [edit,setEdit]=useState(null),[notice,setNotice]=useState(''),[filter,setFilter]=useState(''),[day,setDay]=useState('')
  const canBook=user.role==='customer' || user.permissions.includes('appointments.manage')
  const transitions={pending:['confirmed','cancelled','no_show'],confirmed:['in_progress','cancelled','no_show'],in_progress:['completed']}
  const labels={confirmed:'Confirm',in_progress:'Check in',completed:'Complete',cancelled:'Cancel',no_show:'No-show'}
  const rows=(records.data?.appointments || []).filter(r=>(!filter || (r.customer_name+' '+r.employee_name+' '+r.status).toLowerCase().includes(filter.toLowerCase())) && (!day || new Date(Date.parse(r.starts_at)+28800000).toISOString().startsWith(day)))
  return <div className="flex-col gap-4">{canBook && <div><button className="btn btn-primary" onClick={()=>{setEdit(edit?null:{});setNotice('')}}>{edit?'Close booking':'New appointment'}</button></div>}
    {edit && <Booking key={edit.id || 'new'} row={edit.id?edit:null} onDone={ref=>{setEdit(null);setNotice('Booking saved · '+ref);records.refresh()}}/>}
    {notice && <Feedback tone="success">{notice}</Feedback>}{action.feedback}
    <section className="card"><h2>Schedule</h2><div className="management-toolbar"><Field label="Search schedule" value={filter} onChange={e=>setFilter(e.target.value)}/><Field label="Date" type="date" value={day} onChange={e=>setDay(e.target.value)}/></div>
    {records.loading?<LoadingState/>:records.error?<Feedback tone="error">{records.error}</Feedback>:!rows.length?<p>No appointments found.</p>:<div className="table-container"><table><thead><tr><th>Service</th><th>When</th><th>Customer / stylist</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>{rows.map(r=><tr key={r.id}><td>{r.service_name}<br/><small>{r.booking_reference}</small></td><td>{dateTime(r.starts_at)}</td><td>{r.customer_name}<br/><small>{r.employee_name}</small></td><td>{r.status.replaceAll('_',' ')}</td>
    <td>{canBook && ['pending','confirmed'].includes(r.status) && <button className="text-button" onClick={()=>setEdit(r)}>Reschedule</button>}{(transitions[r.status] || []).filter(s=>user.role!=='customer'||s==='cancelled').map(s=><button className="text-button" key={s} disabled={action.pending} onClick={()=>action.run(async()=>{await api.patch('/appointments/'+r.id,{status:s});records.refresh();return 'Appointment updated.'})}>{labels[s]}</button>)}</td></tr>)}</tbody></table></div>}</section></div>
}
