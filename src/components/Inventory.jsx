import { useState } from 'react'
import { api } from '../api/client'
import { useRecords } from '../hooks/useRecords'
import { useCatalog } from '../hooks/useCatalog'
import { Field,Select } from './ui/Management'
import { Feedback,LoadingState } from './ui/Feedback'
import { useAction } from '../hooks/useAction'
import { money } from '../config/operation-format'

export default function Inventory() {
  const records=useRecords('/inventory'),recipes=useRecords('/inventory/supplies/recipes'),catalog=useCatalog(),action=useAction()
  const [edit,setEdit]=useState(null),[move,setMove]=useState(null),[filter,setFilter]=useState(''),[low,setLow]=useState(false)
  const products=records.data?.items || []
  const visible=products.filter(p=>(p.name+' '+p.sku).toLowerCase().includes(filter.toLowerCase()) && (!low || Number(p.stock)<=Number(p.minimum_stock)))
  function save(e) {
    e.preventDefault()
    const d=Object.fromEntries(new FormData(e.target))
    action.run(async()=>{
      const body={sku:d.sku,name:d.name,category:d.category,unit:d.unit,minimum:Number(d.minimum),price:d.price===''?null:Math.round(Number(d.price)*100)}
      if(edit.id) await api.put('/inventory/'+edit.id,body)
      else await api.post('/inventory',body)
      records.refresh();setEdit(null);return 'Product saved.'
    })
  }
  return <div className="flex-col gap-4">{action.feedback}<section className="card"><div className="management-toolbar"><Field type="search" label="Search products" value={filter} onChange={e=>setFilter(e.target.value)}/><label><input type="checkbox" checked={low} onChange={e=>setLow(e.target.checked)}/> Low stock</label><button className="btn btn-primary" onClick={()=>{setEdit({});setMove(null)}}>Add product</button></div>
    {records.loading?<LoadingState/>:records.error?<Feedback tone="error">{records.error}</Feedback>:!visible.length?<p>No products found.</p>:<div className="table-container"><table><thead><tr><th>Product</th><th>Stock</th><th>Minimum</th><th>Retail price</th><th>Actions</th></tr></thead><tbody>
    {visible.map(p=><tr key={p.id}><td>{p.name}<br/><small>{p.sku} · {p.category}</small></td><td>{Number(p.stock)} {p.stock_unit} {p.minimum_stock!==null && Number(p.stock)<=Number(p.minimum_stock) && <span className="badge badge-warning">Low</span>}</td><td>{p.minimum_stock===null?'—':Number(p.minimum_stock)}</td><td>{p.is_retail?money(p.retail_price_cents):'Supplies'}</td><td><button className="text-button" onClick={()=>{setMove(p);setEdit(null)}}>Adjust stock</button> <button className="text-button" onClick={()=>{setEdit(p);setMove(null)}}>Edit</button></td></tr>)}</tbody></table></div>}</section>
    {edit && <form className="card" key={edit.id || 'add'} onSubmit={save}><h2>{edit.id?'Edit product':'New product'}</h2><div className="account-fields">
    {[['SKU','sku',edit.sku],['Name','name',edit.name],['Category','category',edit.category],['Stock unit','unit',edit.stock_unit]].map(([label,name,value])=><Field key={name} label={label} name={name} defaultValue={value} required/>)}
    <Field label="Low-stock threshold" name="minimum" type="number" min="0" step=".001" defaultValue={edit.minimum_stock || 0} required/><Field label="Retail price (PHP, optional)" name="price" type="number" min="0" step=".01" defaultValue={edit.retail_price_cents==null?'':edit.retail_price_cents/100}/></div>
    <button className="btn btn-primary" disabled={action.pending}>Save product</button> <button className="btn btn-secondary" type="button" onClick={()=>setEdit(null)}>Cancel</button></form>}
    {move && <form key={move.id} className="card" onSubmit={e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));action.run(async()=>{await api.post('/inventory/'+move.id+'/movements',{delta:Number(d.delta),reason:d.reason});records.refresh();setMove(null);return 'Stock updated.'})}}><h2>Adjust {move.name}</h2><Field label={'Quantity to add or remove ('+move.stock_unit+')'} name="delta" required type="number" step=".001"/><Field label="Reason" name="reason" required minLength={2}/><button className="btn btn-primary" disabled={action.pending}>Post adjustment</button> <button className="btn btn-secondary" type="button" onClick={()=>setMove(null)}>Cancel</button></form>}
    <details className="card"><summary>Service supplies</summary>{(recipes.error || catalog.error) && <Feedback tone="error">{recipes.error || catalog.error}</Feedback>}
    {recipes.data?.items.map(r=><p key={r.service_id+r.product_id}>{r.service} · {r.product} · {Number(r.quantity)} {r.stock_unit}</p>)}
    <form onSubmit={e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));action.run(async()=>{await api.put('/inventory/supplies/recipes',{...d,quantity:Number(d.quantity)});recipes.refresh();return 'Service supplies updated.'})}}>
    <Select label="Service" name="service" required><option value="">Select service</option>{catalog.items.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>
    <Select label="Supply" name="product" required><option value="">Select product</option>{products.map(s=><option key={s.id} value={s.id}>{s.name} ({s.stock_unit})</option>)}</Select>
    <Field label="Units per service (0 to remove)" name="quantity" type="number" min="0" step=".001" required/><button className="btn btn-primary" disabled={action.pending}>Save usage</button></form></details></div>
}
