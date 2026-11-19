import { useState } from 'react'
import { api } from '../api/client'
import { useCatalog } from '../hooks/useCatalog'
import { useRecords } from '../hooks/useRecords'
import { useAuth } from '../auth/AuthContext'
import { Field,Select } from './ui/Management'
import { Feedback } from './ui/Feedback'
import { useAction } from '../hooks/useAction'
import { money, dateTime } from '../config/operation-format'
import { CustomerChoice } from './ui/Operations'

export default function POS() {
  const catalog=useCatalog(),options=useRecords('/sales/options'),history=useRecords('/sales'),action=useAction(),{user}=useAuth()
  const [cart,setCart]=useState([]),[search,setSearch]=useState(''),[customer,setCustomer]=useState(''),[appointment,setAppointment]=useState('')
  const [key,setKey]=useState(()=>crypto.randomUUID()),[discount,setDiscount]=useState(0),[cash,setCash]=useState(''),[receipt,setReceipt]=useState(null)
  const data=options.data || {}, settings=data.settings || {}, appt=data.appointments?.find(a=>a.id===appointment)
  const items=[...catalog.items.filter(s=>s.price_cents!==null).map(s=>({...s,type:'service'})),...(data.products || []).map(p=>({...p,type:'product',price_cents:p.retail_price_cents}))]
  const gross=cart.reduce((sum,i)=>sum+i.qty*Number(i.price_cents),0),net=gross-Math.round(gross*discount/100),rate=(settings.tax_policy?.ratePercent || 0)/100
  const total=settings.tax_policy?.inclusive?net:net+Math.round(net*rate)
  function update(next){setCart(next);setKey(crypto.randomUUID())}
  function add(i){
    const index=cart.findIndex(r=>r.id===i.id)
    if(index>=0)update(cart.map((r,k)=>k===index?{...r,qty:Math.min(999,r.qty+1)}:r))
    else update([...cart,{...i,qty:1,employee:i.employees?.[0]?.id || null}])
  }
  function selectBooking(id) {
    const a=data.appointments.find(r=>r.id===id),i=catalog.items.find(r=>r.id===a?.service_id)
    setAppointment(id);setCustomer(a?.customer_id || '')
    update(i?[{...i,type:'service',qty:1,price_cents:a.price_cents_snapshot ?? i.price_cents,employee:a.employee_id}]:[])
  }
  async function checkout(e){
    e.preventDefault()
    action.run(async()=>{
      const {data:result}=await api.post('/sales',{key,customer:customer || null,appointment:appointment || null,tendered:Math.round(Number(cash)*100),discount:Number(discount),
        items:cart.map(({id,type,qty,employee})=>({id,type,qty,employee}))})
      setReceipt(result.item);update([]);setAppointment('');setCustomer('');setCash('');setDiscount(0);history.refresh();options.refresh();return 'Cash payment recorded.'
    })
  }
  return <div className="flex-col gap-4">{action.feedback}{(catalog.error || options.error || history.error) && <Feedback tone="error">{catalog.error || options.error || history.error}</Feedback>}
    <div className="pos-layout"><section className="card"><Field label="Search catalog" type="search" value={search} onChange={e=>setSearch(e.target.value)}/><div className="grid-cols-2">
    {items.filter(i=>i.name.toLowerCase().includes(search.toLowerCase())).map(i=><button key={i.id} className="card booking-service" disabled={action.pending || (i.type==='service'?!i.employees.length:Number(i.stock)<1)} onClick={()=>add(i)}>{i.has_image && <img className="service-thumb" src={'/api/images/'+i.id} alt=""/>}<strong>{i.name}</strong><small>{i.category} · {money(i.price_cents)}</small></button>)}</div>{!items.length && !catalog.loading && <p>No priced items in the catalog.</p>}</section>
    <form className="card" onSubmit={checkout}><h2>Current order</h2><fieldset className="plain-fieldset" disabled={action.pending}>
    <Select label="Appointment" value={appointment} onChange={e=>selectBooking(e.target.value)}><option value="">New order</option>{data.appointments?.map(a=><option key={a.id} value={a.id}>{a.display_name} · {a.name} · {a.booking_reference}</option>)}</Select>
    {appt?<p>{appt.display_name}</p>:<CustomerChoice value={customer} onChange={v=>{setCustomer(v);setKey(crypto.randomUUID())}}/>}
    {cart.map((r,index)=><div className="cart-line" key={r.id}><strong>{r.name}</strong> · {money(r.price_cents)}
    <Field label="Quantity" type="number" min="1" max="999" required value={r.qty} onChange={e=>update(cart.map((v,k)=>k===index?{...v,qty:Number(e.target.value)}:v))}/>
    {r.type==='service' && <Select label="Assigned stylist" required value={r.employee || ''} onChange={e=>update(cart.map((v,k)=>k===index?{...v,employee:e.target.value}:v))}>{r.employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</Select>}
    <button type="button" className="text-button" onClick={()=>update(cart.filter((_,k)=>k!==index))}>Remove</button></div>)}
    {settings.discount_policy?.maxPercent>0 && <Field label="Discount (%)" type="number" step=".01" min="0" max={settings.discount_policy.maxPercent} value={discount} onChange={e=>setDiscount(e.target.value)}/>}
    <div className="cart-row"><strong>Total</strong><strong>{money(total)}</strong></div><Field label="Cash received (PHP)" required min={total/100} step=".01" type="number" value={cash} onChange={e=>setCash(e.target.value)}/>
    <button className="btn btn-primary" disabled={!cart.length || !total || options.loading}>Record payment</button></fieldset></form></div>
    <section className="card"><h2>Recent receipts</h2>{history.data?.items.length===0 && <p>No sales yet.</p>}{history.data?.items.map(s=><div className="cart-row" key={s.id}><button className="text-button" onClick={()=>setReceipt(s)}>{s.receipt_number}</button><span>{money(s.total_cents)} · {s.status}</span></div>)}</section>
    {receipt && <section className="card print-receipt"><h2>{settings.receipt_details?.salonName || 'Romel Hair Salon'}</h2><p>{settings.receipt_details?.address}</p><p>{receipt.receipt_number} · {dateTime(receipt.sold_at)}</p>
    {receipt.items?.map(i=><div key={i.id} className="cart-row"><span>{Number(i.quantity)} × {i.description_snapshot}</span><strong>{money(i.line_total_cents)}</strong></div>)}
    {[['Subtotal',receipt.subtotal_cents],['Discount',receipt.discount_cents],['Tax',receipt.tax_cents],['Total',receipt.total_cents],['Cash',receipt.tendered_cents],['Change',receipt.change_cents]].map(([k,v])=><div className="cart-row" key={k}><span>{k}</span><b>{money(v)}</b></div>)}<p>{settings.receipt_details?.footer}</p>
    <p>{receipt.status}</p><div className="no-print"><button className="btn btn-secondary" onClick={()=>window.print()}>Print receipt</button> <button className="text-button" onClick={()=>setReceipt(null)}>Close</button>
    {user.role==='manager' && receipt.status==='paid' && <details><summary>Refund sale</summary><form onSubmit={e=>{e.preventDefault();const d=new FormData(e.target);action.run(async()=>{await api.post('/sales/'+receipt.id+'/refund',{reason:d.get('reason'),returnStock:d.has('stock')});setReceipt(null);history.refresh();options.refresh();return 'Refund recorded.'})}}><Field label="Refund reason" name="reason" required minLength={3}/><label><input type="checkbox" name="stock"/> Return retail items to stock</label><button disabled={action.pending} className="btn btn-secondary">Record full refund</button></form></details>}</div></section>}</div>
}
