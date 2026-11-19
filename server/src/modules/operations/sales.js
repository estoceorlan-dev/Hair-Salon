import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { validate } from '../../middleware/validate.js'
import { requirePermission,requireManager } from '../../middleware/auth.js'
import { post, missing, conflict } from './shared.js'
import { productSelect,movement } from './stock.js'

const checkout=z.object({key:z.uuid(),customer:z.uuid().nullable(),appointment:z.uuid().nullable(),discount:z.number().min(0).max(100),
  tendered:z.number().int().nonnegative().max(1e12),items:z.array(z.object({id:z.uuid(),type:z.enum(['service','product']),qty:z.number().int().min(1).max(999),employee:z.uuid().nullable()})).min(1).max(80)})
const receiptSql=`SELECT s.*,p.tendered_cents,p.change_cents,(SELECT json_agg(i ORDER BY i.id) FROM salon.sale_items i WHERE i.sale_id=s.id) AS items
  FROM salon.sales s JOIN salon.payments p ON p.sale_id=s.id`
async function insertLine(c,sale,line,actor,appt,commission) {
  const service=line.type==='service'
  const {rows:[item]}=await c.query(service?'SELECT name,price_cents FROM salon.services WHERE id=$1 AND is_active FOR SHARE':
    'SELECT name,retail_price_cents AS price_cents FROM salon.products WHERE id=$1 AND is_active AND is_retail FOR SHARE',[line.id])
  if (!item || item.price_cents===null) throw conflict('An item is unavailable. Refresh the catalog.')
  let policy
  if (service) {
    const staff=(await c.query(`SELECT e.commission_policy FROM salon.employee_services es JOIN salon.employees e ON e.id=es.employee_id
      WHERE e.is_active AND es.service_id=$1 AND e.id=$2 FOR SHARE`,[line.id,line.employee])).rows[0]
    if (!staff) throw conflict('Choose eligible staff for every service.')
    policy=staff.commission_policy || commission
  }
  const price=Number(appt && appt.service_id===line.id && appt.employee_id===line.employee ? appt.price_cents_snapshot ?? item.price_cents:item.price_cents)
  const total=price*line.qty
  const {rows:[row]}=await c.query(`INSERT INTO salon.sale_items(sale_id,service_id,product_id,description_snapshot,unit_price_cents,quantity,line_total_cents)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[sale,service?line.id:null,service?null:line.id,item.name,price,line.qty,total])
  if (service) {
    await c.query('INSERT INTO salon.sale_item_staff(sale_item_id,employee_id,commission_policy_snapshot) VALUES($1,$2,$3)',[row.id,line.employee,policy])
    const amount=policy?.basis==='service_subtotal'?Math.round(total*policy.ratePercent/100):policy?.basis==='fixed_per_service'?policy.amountCents*line.qty:null
    await c.query('INSERT INTO salon.commission_entries(sale_item_id,employee_id,amount_cents,policy_snapshot,status) VALUES($1,$2,$3,$4,$5)',[row.id,line.employee,amount,policy,amount===null?'pending_definition':'earned'])
  }
  const supplies=service?(await c.query("SELECT product_id,quantity FROM salon.service_products WHERE service_id=$1 AND definition_state<>'placeholder' ORDER BY product_id",[line.id])).rows:[{product_id:line.id,quantity:1}]
  for (const supply of supplies) await movement(c,{product:supply.product_id,delta:-Number(supply.quantity)*line.qty,type:service?'service_consumption':'retail_sale',reference:row.id,actor,reason:item.name,item:row.id})
  return total
}
export function salesRoutes(router,db) {
  const allow=requirePermission('sales.manage')
  router.get('/sales/options',allow,async(req,res)=>{
    const [products,appointments,settings]=await Promise.all([db.query(productSelect+' WHERE p.is_active AND p.is_retail ORDER BY p.name'),
      db.query(`SELECT a.id,a.customer_id,a.service_id,a.employee_id,a.price_cents_snapshot,a.booking_reference,s.name,c.display_name FROM salon.appointments a
        JOIN salon.services s ON s.id=a.service_id JOIN salon.customers c ON c.id=a.customer_id WHERE a.status='completed'
        AND NOT EXISTS(SELECT FROM salon.sales WHERE appointment_id=a.id AND status<>'voided') ORDER BY a.starts_at DESC`),
      db.query("SELECT key,value FROM salon.settings WHERE key IN ('tax_policy','discount_policy','receipt_details')")])
    res.json({products:products.rows,appointments:appointments.rows,settings:Object.fromEntries(settings.rows.map(r=>[r.key,r.value]))})
  })
  router.get('/sales',allow,async(req,res)=>res.json({items:(await db.query(receiptSql+' ORDER BY s.sold_at DESC LIMIT 100')).rows}))
  router.post('/sales',allow,validate(checkout),async(req,res)=>{
    const d=req.validated.body, actor=req.auth.user.id
    const item=await post(db,req,'sale.checkout',async c=>{
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[d.key])
      const existing=(await c.query(receiptSql+' WHERE s.idempotency_key=$1 AND s.cashier_id=$2',[d.key,actor])).rows[0]
      if (existing) return existing
      const appt=d.appointment?(await c.query('SELECT * FROM salon.appointments WHERE id=$1 FOR UPDATE',[d.appointment])).rows[0]:null
      if (d.appointment && (appt?.status!=='completed' || appt.customer_id!==d.customer || !d.items.some(i=>i.type==='service' && i.id===appt.service_id && i.employee===appt.employee_id))) throw conflict('Choose the completed appointment, customer and assigned service.')
      const {rows:[sale]}=await c.query('INSERT INTO salon.sales(idempotency_key,customer_id,appointment_id,cashier_id) VALUES($1,$2,$3,$4) RETURNING id',[d.key,d.customer,d.appointment,actor])
      const settings=Object.fromEntries((await c.query("SELECT key,value FROM salon.settings WHERE key IN ('tax_policy','discount_policy','commission_policy')")).rows.map(r=>[r.key,r.value]))
      if (d.discount>(settings.discount_policy?.maxPercent || 0)) throw conflict('Discount exceeds the salon limit.')
      let gross=0
      for (const line of [...d.items].sort((a,b)=>a.id.localeCompare(b.id))) gross+=await insertLine(c,sale.id,line,actor,appt,settings.commission_policy)
      const discount=Math.round(gross*d.discount/100),net=gross-discount,rate=(settings.tax_policy?.ratePercent || 0)/100
      const included=settings.tax_policy?.inclusive, tax=Math.round(included?net-net/(1+rate):net*rate), total=included?net:net+tax
      if (total<=0 || d.tendered<total) throw conflict('Enter cash covering the positive sale total.')
      await c.query(`UPDATE salon.sales SET status='paid',receipt_number=$2,subtotal_cents=$3,discount_cents=$4,tax_cents=$5,total_cents=$6,tax_policy_snapshot=$7,discount_policy_snapshot=$8 WHERE id=$1`,[sale.id,'R-'+randomUUID().slice(0,12),included?gross-tax:gross,discount,tax,total,settings.tax_policy,settings.discount_policy])
      await c.query(`INSERT INTO salon.payments(sale_id,method_code,idempotency_key,amount_cents,tendered_cents,change_cents,status,recorded_by) VALUES($1,'cash',$2,$3,$4,$5,'recorded',$6)`,[sale.id,d.key,total,d.tendered,d.tendered-total,actor])
      return (await c.query(receiptSql+' WHERE s.id=$1',[sale.id])).rows[0]
    })
    res.json({item})
  })
  router.post('/sales/:id/refund',allow,requireManager,validate(z.object({id:z.uuid()}),'params'),validate(z.object({reason:z.string().trim().min(3).max(500),returnStock:z.boolean()})),async(req,res)=>{
    const d=req.validated.body
    res.json(await post(db,req,'sale.refunded',async c=>{
      const sale=(await c.query('SELECT * FROM salon.sales WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
      if (!sale) throw missing()
      if (sale.status!=='paid') throw conflict('Only a paid sale can be refunded.')
      // Serialize refunds with payroll approval so each previously posted earning is recovered once.
      await c.query('SELECT pg_advisory_xact_lock(77203902,8)')
      await c.query(`INSERT INTO salon.commission_adjustments(commission_id,amount_delta_cents,reason,approved_by)
        SELECT ce.id,-ce.amount_cents,$2,$3 FROM salon.commission_entries ce
        JOIN salon.payroll_commissions pc ON pc.commission_id=ce.id
        JOIN salon.sale_items si ON si.id=ce.sale_item_id WHERE si.sale_id=$1 AND ce.amount_cents>0`,
      [sale.id,d.reason,req.auth.user.id])
      await c.query(`INSERT INTO salon.refunds(sale_id,payment_id,idempotency_key,amount_cents,reason,approved_by)
        SELECT sale_id,id,$2,amount_cents,$3,$4 FROM salon.payments WHERE sale_id=$1 AND status='recorded'`,[sale.id,randomUUID(),d.reason,req.auth.user.id])
      if(d.returnStock) {
        const rows=(await c.query(`SELECT m.* FROM salon.inventory_movements m JOIN salon.sale_items i ON i.id=m.sale_item_id WHERE i.sale_id=$1 AND source_type='retail_sale'`,[sale.id])).rows
        for(const r of rows) await movement(c,{product:r.product_id,delta:-Number(r.quantity_delta),type:'reversal',reference:r.id,actor:req.auth.user.id,reason:d.reason,item:r.sale_item_id})
      }
      await c.query("UPDATE salon.commission_entries ce SET status='reversed',amount_cents=coalesce(amount_cents,0),policy_snapshot=coalesce(policy_snapshot,'{}') FROM salon.sale_items i WHERE i.id=ce.sale_item_id AND i.sale_id=$1",[sale.id])
      await c.query("UPDATE salon.sales SET status='refunded' WHERE id=$1",[sale.id])
      return {id:sale.id}
    }))
  })
}
