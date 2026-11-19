import { useState } from 'react'
import { Feedback } from './Feedback'
import { useRecords } from '../../hooks/useRecords'
import { Select } from './Management'

export function CustomerChoice({value,onChange,required=false}) {
  const [search,setSearch]=useState('')
  const records=useRecords('/customers',{q:search,status:'active',pageSize:100})
  return <div><input className="input-field" aria-label="Find customer" placeholder="Find customer…" type="search" value={search} onChange={e=>{setSearch(e.target.value);onChange('')}}/>
    <Select label="Customer" required={required} value={value} onChange={e=>onChange(e.target.value)}><option value="">{required?'Choose customer':'Walk-in'}</option>
    {records.data?.items.map(c=><option value={c.id} key={c.id}>{c.display_name}</option>)}</Select>{records.error && <Feedback tone="error">{records.error}</Feedback>}</div>
}
