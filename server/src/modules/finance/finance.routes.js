import { z } from 'zod'
import { requirePermission } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errors.js'
import { validate } from '../../middleware/validate.js'
import { transaction } from '../../db/connection.js'
import { idSchema } from '../auth/auth.schemas.js'

const rangeFields = { from: z.iso.date(), to: z.iso.date() }
const ordered = ({ from, to }) => from <= to
const range = z.object(rangeFields).strict().refine(ordered, 'Choose a valid date range.')
const logs = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional(),
  q: z.string().trim().max(100).default(''), page: z.coerce.number().int().positive().max(100000).default(1) }).strict()
  .refine(({ from, to }) => !from || !to || from <= to, 'Choose a valid date range.')
const amount = z.number().int().min(0).max(99999999999)
const approval = z.object({ items: z.array(z.object({ id: z.uuid(), base: amount, adjustment: z.number().int().min(-99999999999).max(99999999999),
  note: z.string().trim().max(500), expectedCommission: amount,
  expectedCarry: z.number().int().min(-99999999999).max(99999999999).default(0) }).strict()
  .refine((row) => row.adjustment === 0 || row.note.length > 0, 'Explain the adjustment.')).min(1).max(10000) }).strict()
const conflict = (message) => new HttpError(409, 'CONFLICT', message)
const interval = (field) => `${field} >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila') AND ${field} < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Manila')`
const recognized = "('paid','partially_refunded','refunded')"
const runSelect = 'SELECT id,period_start::text AS starts_on,(period_end-1)::text AS ends_on,status FROM salon.payroll_runs'
async function record(client, user, action, id) {
  await client.query("INSERT INTO salon.activity_logs(actor_id,action,entity_type,entity_reference) VALUES ($1,$2,'payroll',$3)", [user.id, action, id])
}

export function financeRoutes(router, db) {
  router.get('/dashboard', requirePermission('dashboard.view'), async (req, res) => {
    const today = "(now() AT TIME ZONE 'Asia/Manila')::date"
    const localDay = (field) => `(${field} AT TIME ZONE 'Asia/Manila')::date=${today}`
    const [metrics, upcoming, stock] = await Promise.all([
      db.query(`SELECT (SELECT COALESCE(sum(total_cents),0) FROM salon.sales WHERE status IN ${recognized} AND ${localDay('sold_at')}) -
        (SELECT COALESCE(sum(amount_cents),0) FROM salon.refunds WHERE ${localDay('created_at')}) AS net,
        (SELECT count(*) FROM salon.appointments WHERE status NOT IN ('cancelled','no_show') AND ${localDay('starts_at')}) AS bookings,
        (SELECT count(*) FROM salon.customers WHERE ${localDay('created_at')}) AS customers`),
      db.query(`SELECT a.id,a.starts_at,a.service_name_snapshot AS service,e.display_name AS stylist,c.display_name AS customer
        FROM salon.appointments a JOIN salon.customers c ON c.id=a.customer_id JOIN salon.employees e ON e.id=a.employee_id
        WHERE a.status IN ('pending','confirmed') AND a.starts_at>=now() ORDER BY a.starts_at,a.id LIMIT 6`),
      req.auth.user.permissions.includes('inventory.manage') ? db.query(`SELECT p.id,p.name,p.stock_unit,COALESCE(b.quantity,0) AS quantity,p.minimum_stock
        FROM salon.products p LEFT JOIN salon.stock_balances b ON b.product_id=p.id WHERE p.is_active AND COALESCE(b.quantity,0)<=p.minimum_stock
        ORDER BY COALESCE(b.quantity,0)-p.minimum_stock,p.name LIMIT 8`) : Promise.resolve({ rows: null }),
    ])
    res.json({ ...metrics.rows[0], upcoming: upcoming.rows, stock: stock.rows })
  })

  router.get('/reports', requirePermission('reports.view'), validate(range, 'query'), async (req, res) => {
    const { from, to } = req.validated.query
    const select = async (sql) => (await db.query(sql, [from, to])).rows
    const salesFilter = `s.status IN ${recognized} AND ${interval('s.sold_at')}`
    const [daily, payments, items, staff] = await Promise.all([
      select(`WITH events AS (
        SELECT (s.sold_at AT TIME ZONE 'Asia/Manila')::date AS day,1 AS sales,s.subtotal_cents AS gross,s.discount_cents AS discount,
          s.tax_cents AS tax,s.total_cents AS charged,0 AS refunded FROM salon.sales s WHERE ${salesFilter}
        UNION ALL SELECT (created_at AT TIME ZONE 'Asia/Manila')::date,0,0,0,0,0,amount_cents FROM salon.refunds WHERE ${interval('created_at')}
        ) SELECT day::text,sum(sales) AS sales,sum(gross) AS gross,sum(discount) AS discount,sum(tax) AS tax,sum(charged) AS charged,
          sum(refunded) AS refunded,sum(charged-refunded) AS net FROM events GROUP BY day ORDER BY day DESC`),
      select(`WITH events AS (SELECT p.method_code,p.amount_cents AS amount FROM salon.payments p JOIN salon.sales s ON s.id=p.sale_id
        WHERE p.status='recorded' AND ${salesFilter} UNION ALL SELECT p.method_code,-r.amount_cents FROM salon.refunds r
        JOIN salon.payments p ON p.id=r.payment_id WHERE ${interval('r.created_at')})
        SELECT method_code,sum(amount) AS net FROM events GROUP BY method_code ORDER BY method_code`),
      select(`SELECT i.description_snapshot AS name, CASE WHEN i.service_id IS NULL THEN 'Product' ELSE 'Service' END AS kind,
        sum(i.quantity) AS units,sum(i.line_total_cents) AS amount FROM salon.sale_items i JOIN salon.sales s ON s.id=i.sale_id
        WHERE ${salesFilter} GROUP BY 1,2 ORDER BY units DESC,name`),
      select(`SELECT e.display_name AS name,sum(i.quantity) AS services FROM salon.sale_item_staff t JOIN salon.employees e ON e.id=t.employee_id
        JOIN salon.sale_items i ON i.id=t.sale_item_id JOIN salon.sales s ON s.id=i.sale_id
        WHERE i.service_id IS NOT NULL AND ${salesFilter} GROUP BY e.id ORDER BY services DESC,name`),
    ])
    res.json({ daily, payments, items, staff })
  })

  router.get('/activity-logs', requirePermission('logs.view'), validate(logs, 'query'), async (req, res) => {
    const { from, to, q, page } = req.validated.query
    const result = await db.query(`SELECT l.id,l.occurred_at,l.action,l.entity_type,l.entity_reference,l.reason,COALESCE(u.display_name,'System') AS actor
      FROM salon.activity_logs l LEFT JOIN salon.users u ON u.id=l.actor_id
      WHERE ($1::date IS NULL OR l.occurred_at >= $1::date::timestamp AT TIME ZONE 'Asia/Manila')
      AND ($2::date IS NULL OR l.occurred_at < ($2::date+1)::timestamp AT TIME ZONE 'Asia/Manila')
      AND (l.action ILIKE $3 OR u.display_name ILIKE $3 OR l.entity_reference ILIKE $3) ORDER BY l.occurred_at DESC,l.id DESC LIMIT 51 OFFSET $4`,
    [from || null, to || null, '%' + q + '%', (page - 1) * 50])
    res.json({ items: result.rows.slice(0, 50), hasNext: result.rowCount > 50 })
  })

  const payroll = requirePermission('payroll.manage')
  const id = validate(idSchema, 'params')
  router.get('/payroll', payroll, async (req, res) => {
    const runs = await db.query(runSelect + ' ORDER BY period_start DESC')
    res.json({ items: runs.rows })
  })
  router.post('/payroll', payroll, validate(range), async (req, res) => {
    const { from, to } = req.validated.body
    const result = await transaction(db, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(77203902,8)")
      const overlaps = await client.query(`SELECT id,period_start=$1::date AND period_end=$2::date+1 AS exact FROM salon.payroll_runs
        WHERE status<>'voided' AND period_start<=$2::date AND period_end>$1::date`, [from, to])
      if (overlaps.rows[0]?.exact) return overlaps.rows[0].id
      if (overlaps.rowCount) throw conflict('This period overlaps another payroll run.')
      const run = (await client.query('INSERT INTO salon.payroll_runs(period_start,period_end) VALUES ($1::date,$2::date+1) RETURNING id', [from, to])).rows[0]
      await record(client, req.auth.user, 'payroll.created', run.id)
      return run.id
    })
    res.status(201).json({ id: result })
  })

  async function loadRun(client, runId, lock = false) {
    const run = (await client.query(runSelect + ' WHERE id=$1' + (lock ? ' FOR UPDATE' : ''), [runId])).rows[0]
    if (!run) throw new HttpError(404, 'NOT_FOUND', 'Payroll period not found.')
    return run
  }
  async function draftRows(client, run) {
    return (await client.query(`WITH earnings AS (
      SELECT ce.employee_id,ce.id,ce.amount_cents AS amount FROM salon.commission_entries ce
      WHERE ce.status='earned' AND ce.created_at < ($1::date+1)::timestamp AT TIME ZONE 'Asia/Manila'
        AND NOT EXISTS (SELECT 1 FROM salon.payroll_commissions pc WHERE pc.commission_id=ce.id)
    ), adjustments AS (
      SELECT ce.employee_id,sum(a.amount_delta_cents) AS amount,array_agg(a.id) AS ids
      FROM salon.commission_adjustments a JOIN salon.commission_entries ce ON ce.id=a.commission_id
      WHERE a.created_at < ($1::date+1)::timestamp AT TIME ZONE 'Asia/Manila'
        AND NOT EXISTS (SELECT 1 FROM salon.payroll_commission_adjustments link WHERE link.adjustment_id=a.id)
      GROUP BY ce.employee_id
    ) SELECT e.id,e.display_name,e.base_pay_cents AS rate,p.value->>'basis' AS basis,
      CASE WHEN p.value->>'basis'='per_period' THEN e.base_pay_cents END AS base,
      COALESCE(sum(x.amount),0) AS commission,COALESCE(array_agg(x.id) FILTER(WHERE x.id IS NOT NULL),'{}') AS entries,
      COALESCE(a.amount,0) AS carry,COALESCE(a.ids,'{}') AS adjustment_ids
      FROM salon.employees e CROSS JOIN salon.settings p LEFT JOIN earnings x ON x.employee_id=e.id
      LEFT JOIN adjustments a ON a.employee_id=e.id
      WHERE p.key='payroll_policy' AND (e.is_active OR x.id IS NOT NULL OR a.ids IS NOT NULL)
      GROUP BY e.id,p.value,a.amount,a.ids ORDER BY e.display_name,e.id`, [run.ends_on])).rows
  }
  router.get('/payroll/:id', payroll, id, async (req, res) => {
    const run = await loadRun(db, req.validated.params.id)
    const items = run.status === 'draft' ? await draftRows(db, run) : (await db.query(`SELECT i.employee_id AS id,e.display_name,i.base_pay_cents AS base,
      i.commission_cents AS commission,COALESCE((i.calculation_snapshot->>'carry')::bigint,0) AS carry,
      i.adjustment_cents-COALESCE((i.calculation_snapshot->>'carry')::bigint,0) AS adjustment,i.net_pay_cents AS net,i.calculation_snapshot->>'note' AS note
      FROM salon.payroll_items i JOIN salon.employees e ON e.id=i.employee_id WHERE i.payroll_run_id=$1 ORDER BY e.display_name,e.id`, [run.id])).rows
    res.json({ run, items })
  })
  router.post('/payroll/:id/approve', payroll, id, validate(approval), async (req, res) => {
    await transaction(db, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(77203902,8)')
      const run = await loadRun(client, req.validated.params.id, true)
      if (run.status !== 'draft') throw conflict('This payroll has already been finalized.')
      const rows = await draftRows(client, run)
      const submitted = new Map(req.validated.body.items.map((item) => [item.id, item]))
      if (rows.length !== submitted.size) throw conflict('The employee list changed. Refresh the period and review the amounts.')
      for (const row of rows) {
        const input = submitted.get(row.id)
        if (!input || Number(row.commission) !== input.expectedCommission || Number(row.carry) !== input.expectedCarry)
          throw conflict('Earnings changed. Refresh the period and review the amounts.')
        const adjustment = input.adjustment + Number(row.carry)
        const net = input.base + Number(row.commission) + adjustment
        if (net < 0) throw conflict('Net pay must be zero or greater.')
        const item = (await client.query(`INSERT INTO salon.payroll_items(payroll_run_id,employee_id,base_pay_cents,commission_cents,adjustment_cents,net_pay_cents,calculation_snapshot)
          VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(payroll_run_id,employee_id) DO UPDATE SET base_pay_cents=excluded.base_pay_cents,
          commission_cents=excluded.commission_cents,adjustment_cents=excluded.adjustment_cents,net_pay_cents=excluded.net_pay_cents,
          calculation_snapshot=excluded.calculation_snapshot RETURNING id`, [run.id,row.id,input.base,row.commission,adjustment,net,
          JSON.stringify({ rate: row.rate, basis: row.basis, note: input.note, carry: row.carry })])).rows[0]
        if (row.entries.length) await client.query('INSERT INTO salon.payroll_commissions(payroll_item_id,employee_id,commission_id) SELECT $1,$2,unnest($3::uuid[])', [item.id,row.id,row.entries])
        if (row.adjustment_ids.length) await client.query('INSERT INTO salon.payroll_commission_adjustments(payroll_item_id,adjustment_id) SELECT $1,unnest($2::uuid[])', [item.id,row.adjustment_ids])
      }
      await client.query("DELETE FROM salon.payroll_items WHERE payroll_run_id=$1 AND net_pay_cents IS NULL", [run.id])
      await client.query(`UPDATE salon.payroll_runs SET status='approved',approved_at=now(),approved_by=$2,
        policy_snapshot=jsonb_build_object('basis','manager-reviewed period pay','commissionCutoff',$3::text) WHERE id=$1`, [run.id, req.auth.user.id, run.ends_on])
      await record(client, req.auth.user, 'payroll.approved', run.id)
    })
    res.json({ status: 'approved' })
  })
  router.post('/payroll/:id/pay', payroll, id, async (req, res) => {
    await transaction(db, async (client) => {
      const run = await loadRun(client, req.validated.params.id, true)
      if (run.status === 'paid') return
      if (run.status !== 'approved') throw conflict('Approve the period before recording payouts.')
      await client.query(`INSERT INTO salon.payroll_payouts(payroll_item_id,amount_cents,recorded_by,paid_at,reference)
        SELECT id,net_pay_cents,$2,now(),'Cash' FROM salon.payroll_items WHERE payroll_run_id=$1 AND net_pay_cents>0`, [run.id,req.auth.user.id])
      await client.query("UPDATE salon.payroll_runs SET status='paid' WHERE id=$1", [run.id])
      await record(client, req.auth.user, 'payroll.paid', run.id)
    })
    res.json({ status: 'paid' })
  })
}

