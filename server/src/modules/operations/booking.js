import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { validate } from '../../middleware/validate.js'
import { requirePermission } from '../../middleware/auth.js'
import { post, conflict, missing } from './shared.js'

const slotQuery = z.object({serviceId:z.uuid(), employeeId:z.uuid(), date:z.iso.date()})
const booking = z.object({serviceId:z.uuid(), employeeId:z.uuid(), startsAt:z.iso.datetime(), customerId:z.uuid().optional()})
const states = {pending:['confirmed','cancelled','no_show'],confirmed:['in_progress','cancelled','no_show'],in_progress:['completed']}
const manage = requirePermission('appointments.manage','appointments.own')
const id = validate(z.object({id:z.uuid()}),'params')

async function slots(db, service, employee, day, exclude=null) {
  return (await db.query(`WITH config AS (
    SELECT s.duration_minutes,h.opens_at,h.closes_at,($3::date+h.opens_at) AT TIME ZONE 'Asia/Manila' AS opening,
    ($3::date+h.closes_at) AT TIME ZONE 'Asia/Manila' AS closing,
    (SELECT value FROM salon.settings WHERE key='booking_policy') AS policy
    FROM salon.services s JOIN salon.employee_services es ON es.service_id=s.id
    JOIN salon.employees e ON e.id=es.employee_id JOIN salon.business_hours h ON h.weekday=extract(dow FROM $3::date)
    WHERE s.id=$1 AND e.id=$2 AND e.is_active AND s.is_active AND s.duration_minutes IS NOT NULL AND h.is_closed=false
    AND NOT EXISTS(SELECT FROM salon.closures WHERE closed_on=$3::date)
  ), times AS (SELECT start,start+duration_minutes*interval '1 minute' AS finish,policy
    FROM config CROSS JOIN LATERAL generate_series(opening,closing-duration_minutes*interval '1 minute',interval '15 minutes') start)
    SELECT start FROM times WHERE start>=now()+coalesce((policy->>'leadMinutes')::int,0)*interval '1 minute'
    AND (policy->>'horizonDays' IS NULL OR start<=now()+(policy->>'horizonDays')::int*interval '1 day')
    AND NOT EXISTS(SELECT FROM salon.appointments a WHERE employee_id=$2 AND a.id IS DISTINCT FROM $4::uuid AND status NOT IN ('cancelled','no_show') AND starts_at<finish AND ends_at>start)
    AND NOT EXISTS(SELECT FROM salon.employee_availability WHERE employee_id=$2 AND NOT available AND starts_at<finish AND ends_at>start)
    AND (NOT EXISTS(SELECT FROM salon.employee_availability WHERE employee_id=$2 AND available AND (starts_at AT TIME ZONE 'Asia/Manila')::date <= $3 AND (ends_at AT TIME ZONE 'Asia/Manila')::date >= $3)
      OR EXISTS(SELECT FROM salon.employee_availability WHERE employee_id=$2 AND available AND starts_at<=start AND ends_at>=finish))
    ORDER BY start`, [service,employee,day,exclude])).rows
}
async function editable(client, req) {
  const {rows:[row]}=await client.query('SELECT * FROM salon.appointments WHERE id=$1 FOR UPDATE',[req.params.id])
  const user=req.auth.user
  if (!row || (!user.permissions.includes('appointments.manage') && row.customer_id!==user.customerId && row.employee_id!==user.employeeId)) throw missing()
  if (!states[row.status]) throw conflict('This appointment is closed.')
  if (user.role==='customer') {
    const {rows:[policy]}=await client.query("SELECT value FROM salon.settings WHERE key='booking_policy'")
    if (new Date(row.starts_at)-Date.now() <= (policy?.value?.cancellationHours || 0)*3600000 || row.status==='in_progress') throw conflict('Contact the salon to change this appointment.')
  }
  return row
}
export function bookingRoutes(router,db) {
  router.get('/slots',manage,validate(slotQuery,'query'),async(req,res)=>{
    const q=req.validated.query
    res.json({items:await slots(db,q.serviceId,q.employeeId,q.date)})
  })
  async function reserve(req,res) {
    const d=req.validated.body, user=req.auth.user
    const item=await post(db,req,req.params.id?'booking.rescheduled':'booking.created',async c=>{
      const old=req.params.id?await editable(c,req):null
      if (old?.status==='in_progress') throw conflict('This appointment has started.')
      const customer=user.role==='customer'?user.customerId:old?.customer_id || d.customerId
      if (!(await c.query('SELECT id FROM salon.customers WHERE id=$1 AND is_active FOR SHARE',[customer])).rowCount) throw conflict('Choose an active customer.')
      await c.query('SELECT id FROM salon.employees WHERE id=$1 FOR UPDATE',[d.employeeId])
      const day=new Date(Date.parse(d.startsAt)+8*3600000).toISOString().slice(0,10)
      const available=await slots(c,d.serviceId,d.employeeId,day,old?.id)
      if (!available.some(s=>s.start.getTime()===Date.parse(d.startsAt))) throw conflict('This time is unavailable. Choose another slot.')
      const values=[d.serviceId,d.employeeId,d.startsAt,customer]
      const sql=old?`UPDATE salon.appointments a SET service_id=s.id,employee_id=$2,starts_at=$3,ends_at=$3::timestamptz+s.duration_minutes*interval '1 minute',service_name_snapshot=s.name,price_cents_snapshot=s.price_cents,duration_minutes_snapshot=s.duration_minutes,updated_at=now()
      FROM salon.services s WHERE s.id=$1 AND a.customer_id=$4 AND a.id=$5 RETURNING a.*`:
      `INSERT INTO salon.appointments(service_id,employee_id,starts_at,ends_at,customer_id,booking_reference,source,created_by,status,service_name_snapshot,price_cents_snapshot,duration_minutes_snapshot)
      SELECT s.id,$2,$3,$3::timestamptz+s.duration_minutes*interval '1 minute',$4,$5,$6,$7,'confirmed',s.name,s.price_cents,s.duration_minutes FROM salon.services s WHERE s.id=$1 RETURNING *`
      return (await c.query(sql,[...values,...(old?[old.id]:['R-'+randomUUID().slice(0,12),user.role==='customer'?'customer':'staff',user.id])])).rows[0]
    })
    res.status(req.params.id?200:201).json({item})
  }
  router.post('/appointments',manage,validate(booking),reserve)
  router.put('/appointments/:id',manage,id,validate(booking),reserve)
  router.patch('/appointments/:id',requirePermission('appointments.manage','appointments.assigned','appointments.own'),id,validate(z.object({status:z.enum(['confirmed','in_progress','completed','cancelled','no_show'])})),async(req,res)=>{
    res.json({item:await post(db,req,'booking.status',async c=>{
      const row=await editable(c,req), next=req.validated.body.status
      if (!states[row.status].includes(next) || (req.auth.user.role==='customer' && next!=='cancelled')) throw conflict('This status change is unavailable.')
      return (await c.query('UPDATE salon.appointments SET status=$1,updated_at=now() WHERE id=$2 RETURNING *',[next,row.id])).rows[0]
    })})
  })
}
