import { Router } from 'express'
import { authenticate, requireManager, requirePermission, trustedWrite } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { HttpError } from '../../middleware/errors.js'
import { transaction } from '../../db/connection.js'
import { idSchema } from '../auth/auth.schemas.js'
import { listSchema, customerSchema, serviceSchema, profileSchema, availabilitySchema,
  hoursSchema, closureSchema, settingSchema } from './management.schemas.js'

const missing = () => new HttpError(404, 'NOT_FOUND', 'Record not found.')
const conflict = (message) => new HttpError(409, 'RECORD_CONFLICT', message)
const serviceSelect = `SELECT s.*, ARRAY(SELECT es.employee_id FROM salon.employee_services es
  WHERE es.service_id=s.id ORDER BY es.employee_id) AS employee_ids FROM salon.services s`
const publicCatalog = `SELECT s.id,s.code,s.name,s.category,s.price_cents,s.duration_minutes,s.is_demo,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',e.display_name) ORDER BY e.display_name)
  FROM salon.employee_services es JOIN salon.employees e ON e.id=es.employee_id
  WHERE es.service_id=s.id AND e.is_active AND e.job_kind IN ('stylist','beautician')), '[]'::jsonb) AS employees
  FROM salon.services s`
async function audit(client, req, action, reference, details = {}) {
  await client.query(`INSERT INTO salon.activity_logs(actor_id,action,entity_type,entity_reference,details)
    VALUES($1,$2,$3,$4,$5)`, [req.auth.user.id, action, action.split('.')[0], reference, JSON.stringify(details)])
}
export function managementRoutes(auth, database, config) {
  const router = Router()
  router.use(authenticate(auth), trustedWrite(config))
  const db = database.pool
  const customers = requirePermission('customers.manage')
  const services = requirePermission('services.manage')
  const employees = [requirePermission('employees.manage'), requireManager]
  const settings = [requirePermission('settings.manage'), requireManager]
  const ids = validate(idSchema, 'params')
  async function write(req, action, fn) {
    try {
      return await transaction(db, async (client) => {
        const row = await fn(client)
        await audit(client, req, action, row.id || row.key || 'salon', row.audit || {})
        delete row.audit
        return row
      })
    } catch (err) {
      if (err.code === '23505') throw conflict('This code or date is already in use.')
      if (err.code === '23503') throw conflict('A linked record no longer exists. Refresh and try again.')
      throw err
    }
  }
  async function paged(sql, params, query) {
    const count = await db.query(`SELECT count(*)::int AS total FROM (${sql}) records`, params)
    const rows = await db.query(`SELECT * FROM (${sql}) records ORDER BY lower(display_name),id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize])
    return { items: rows.rows, total: count.rows[0].total, page: query.page, pageSize: query.pageSize }
  }
  router.get('/catalog', requirePermission('sales.manage', 'appointments.own', 'services.manage'), validate(listSchema, 'query'), async (req, res) => {
    const q = req.validated.query
    const where = ` WHERE s.is_active AND (s.name ILIKE $1 OR s.code ILIKE $1) AND ($2='' OR s.category=$2)`
    const values = ['%' + q.q + '%', q.category]
    const count = await db.query('SELECT count(*)::int AS total FROM salon.services s' + where, values)
    const rows = await db.query(publicCatalog + where + ' ORDER BY lower(s.name),s.id LIMIT $3 OFFSET $4',
      [...values, q.pageSize, (q.page - 1) * q.pageSize])
    res.json({ items: rows.rows, total: count.rows[0].total, page: q.page, pageSize: q.pageSize })
  })
  router.get('/staff-options', requirePermission('customers.manage', 'services.manage'), async (req, res) => {
    res.json({ items: (await db.query(`SELECT id,display_name FROM salon.employees
      WHERE is_active AND job_kind IN ('stylist','beautician') ORDER BY lower(display_name),id`)).rows })
  })
  router.get('/customers', customers, validate(listSchema, 'query'), async (req, res) => {
    const q = req.validated.query
    res.json(await paged(`SELECT c.*,e.display_name AS preferred_employee_name FROM salon.customers c
      LEFT JOIN salon.employees e ON e.id=c.preferred_employee_id
      WHERE (c.display_name ILIKE $1 OR c.email ILIKE $1 OR c.phone ILIKE $1)
      AND ($2='all' OR c.is_active=($2='active'))`, ['%' + q.q + '%', q.status], q))
  })
  async function saveCustomer(req) {
    const d = req.validated.body, id = req.validated.params?.id
    return write(req, id ? 'customer.updated' : 'customer.created', async (client) => {
      // Serialize duplicate review, including simultaneous walk-in submissions.
      await client.query('SELECT pg_advisory_xact_lock(77203902,4)')
      const before = id ? (await client.query('SELECT * FROM salon.customers WHERE id=$1 FOR UPDATE', [id])).rows[0] : null
      if (id && !before) throw missing()
      if (d.preferredEmployeeId && d.preferredEmployeeId !== before?.preferred_employee_id) {
        const staff = await client.query(`SELECT id FROM salon.employees WHERE id=$1 AND is_active AND job_kind IN ('stylist','beautician') FOR SHARE`, [d.preferredEmployeeId])
        if (!staff.rowCount) throw conflict('Choose an active stylist or beautician.')
      }
      const duplicates = (await client.query(`SELECT id,display_name FROM salon.customers WHERE ($1::uuid IS NULL OR id<>$1)
        AND (lower(display_name)=lower($2) OR ($3::text IS NOT NULL AND lower(email)=$3)
        OR ($4::text IS NOT NULL AND regexp_replace(phone,'[^0-9]','','g')=regexp_replace($4,'[^0-9]','','g')))
        ORDER BY id LIMIT 10`, [id || null, d.displayName, d.email, d.phone])).rows
      const identityChanged = !before || before.display_name !== d.displayName || before.email !== d.email || before.phone !== d.phone
      if (duplicates.length && identityChanged && !d.duplicateReason)
        throw new HttpError(409, 'DUPLICATE_CUSTOMER', 'Possible duplicate customer. Review existing records or enter a reason to keep a separate profile.', { matches: duplicates })
      const values = [d.displayName, d.email, d.phone, d.preferredEmployeeId, d.notes, d.isActive]
      const sql = id ? `UPDATE salon.customers SET display_name=$1,email=$2,phone=$3,preferred_employee_id=$4,notes=$5,is_active=$6,updated_at=now() WHERE id=$7 RETURNING *`
        : `INSERT INTO salon.customers(display_name,email,phone,preferred_employee_id,notes,is_active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`
      const row = (await client.query(sql, id ? [...values, id] : values)).rows[0]
      if (!row.is_active && row.user_id) await client.query('UPDATE salon.auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [row.user_id])
      return { ...row, audit: { fields: Object.keys(d).filter((k) => k !== 'duplicateReason'),
        duplicateIds: duplicates.map((r) => r.id), duplicateReason: d.duplicateReason || null } }
    })
  }
  router.post('/customers', customers, validate(customerSchema), async (req, res) => res.status(201).json({ item: await saveCustomer(req) }))
  router.put('/customers/:id', customers, ids, validate(customerSchema), async (req, res) => res.json({ item: await saveCustomer(req) }))
  router.get('/services', services, validate(listSchema, 'query'), async (req, res) => {
    const q = req.validated.query
    res.json(await paged(`SELECT records.*,name AS display_name FROM (${serviceSelect}) records
      WHERE (name ILIKE $1 OR code ILIKE $1) AND ($2='all' OR is_active=($2='active')) AND ($3='' OR category=$3)`,
    ['%' + q.q + '%', q.status, q.category], q))
  })
  async function saveService(req) {
    const d = req.validated.body, id = req.validated.params?.id
    return write(req, id ? 'service.updated' : 'service.created', async (client) => {
      const before = id ? (await client.query('SELECT * FROM salon.services WHERE id=$1 FOR UPDATE', [id])).rows[0] : null
      if (id && !before) throw missing()
      if (d.employeeIds.length) {
        const found = await client.query(`SELECT id FROM salon.employees WHERE id=ANY($1::uuid[]) AND is_active AND job_kind IN ('stylist','beautician') FOR SHARE`, [d.employeeIds])
        if (found.rowCount !== d.employeeIds.length) throw conflict('Eligible staff must be active stylists or beauticians.')
      }
      const values = [d.code, d.name, d.category, d.priceCents, d.durationMinutes, d.isActive]
      const sql = id ? `UPDATE salon.services SET code=$1,name=$2,category=$3,price_cents=$4,duration_minutes=$5,is_active=$6,updated_at=now() WHERE id=$7 RETURNING *`
        : `INSERT INTO salon.services(code,name,category,price_cents,duration_minutes,is_active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`
      const row = (await client.query(sql, id ? [...values, id] : values)).rows[0]
      await client.query('DELETE FROM salon.employee_services WHERE service_id=$1', [row.id])
      await client.query('INSERT INTO salon.employee_services(service_id,employee_id) SELECT $1,unnest($2::uuid[])', [row.id, d.employeeIds])
      return { ...row, employee_ids: d.employeeIds, audit: { before, after: d } }
    })
  }
  router.post('/services', services, validate(serviceSchema), async (req, res) => res.status(201).json({ item: await saveService(req) }))
  router.put('/services/:id', services, ids, validate(serviceSchema), async (req, res) => res.json({ item: await saveService(req) }))
  router.get('/employee-profiles', ...employees, validate(listSchema, 'query'), async (req, res) => {
    const q = req.validated.query
    res.json(await paged(`SELECT e.*,u.email FROM salon.employees e LEFT JOIN salon.users u ON u.id=e.user_id
      WHERE (e.display_name ILIKE $1 OR e.employee_code ILIKE $1) AND ($2='all' OR e.is_active=($2='active'))`, ['%' + q.q + '%', q.status], q))
  })
  router.put('/employee-profiles/:id', ...employees, ids, validate(profileSchema), async (req, res) => {
    const d = req.validated.body, id = req.validated.params.id
    res.json({ item: await write(req, 'employee.profile_updated', async (client) => {
      const before = (await client.query('SELECT * FROM salon.employees WHERE id=$1 FOR UPDATE', [id])).rows[0]
      if (!before) throw missing()
      const row = (await client.query(`UPDATE salon.employees SET phone=$2,notes=$3,base_pay_cents=$4,
        commission_policy=$5,updated_at=now() WHERE id=$1 RETURNING *`, [id, d.phone, d.notes, d.basePayCents,
        d.commissionPolicy ? JSON.stringify(d.commissionPolicy) : null])).rows[0]
      return { ...row, audit: { before: { basePayCents: before.base_pay_cents, commissionPolicy: before.commission_policy }, after: d } }
    }) })
  })
  router.get('/employee-profiles/:id/availability', ...employees, ids, validate(listSchema, 'query'), async (req, res) => {
    const id = req.validated.params.id, q = req.validated.query
    if (!(await db.query('SELECT id FROM salon.employees WHERE id=$1', [id])).rowCount) throw missing()
    const total = (await db.query('SELECT count(*)::int AS n FROM salon.employee_availability WHERE employee_id=$1', [id])).rows[0].n
    const rows = await db.query('SELECT * FROM salon.employee_availability WHERE employee_id=$1 ORDER BY starts_at DESC,id LIMIT $2 OFFSET $3', [id, q.pageSize, (q.page - 1) * q.pageSize])
    res.json({ items: rows.rows, total, page: q.page, pageSize: q.pageSize })
  })
  router.post('/employee-profiles/:id/availability', ...employees, ids, validate(availabilitySchema), async (req, res) => {
    const d = req.validated.body, id = req.validated.params.id
    res.status(201).json({ item: await write(req, 'availability.created', async (client) => {
      if (!(await client.query('SELECT id FROM salon.employees WHERE id=$1 AND is_active FOR UPDATE', [id])).rowCount) throw missing()
      const overlap = await client.query(`SELECT id FROM salon.employee_availability WHERE employee_id=$1 AND starts_at<$3 AND ends_at>$2`, [id, d.startsAt, d.endsAt])
      if (overlap.rowCount) throw conflict('This interval overlaps an existing availability entry. Remove the old entry first.')
      return { ...(await client.query(`INSERT INTO salon.employee_availability(employee_id,starts_at,ends_at,available,reason)
        VALUES($1,$2,$3,$4,$5) RETURNING *`, [id, d.startsAt, d.endsAt, d.available, d.reason])).rows[0], audit: d }
    }) })
  })
  router.delete('/availability/:id', ...employees, ids, async (req, res) => {
    await write(req, 'availability.removed', async (client) => {
      const row = (await client.query('DELETE FROM salon.employee_availability WHERE id=$1 RETURNING *', [req.validated.params.id])).rows[0]
      if (!row) throw missing()
      return { id: row.id, audit: row }
    }); res.status(204).end()
  })
  router.get('/settings', ...settings, async (req, res) => {
    const [values, hours, closures, payments] = await Promise.all([
      db.query('SELECT * FROM salon.settings ORDER BY key'), db.query('SELECT * FROM salon.business_hours ORDER BY weekday'),
      db.query('SELECT id,closed_on::text,reason FROM salon.closures ORDER BY closed_on'), db.query('SELECT code,label,enabled FROM salon.payment_methods ORDER BY code'),
    ])
    res.json({ settings: values.rows, hours: hours.rows, closures: closures.rows, payments: payments.rows })
  })
  router.put('/settings', ...settings, validate(settingSchema), async (req, res) => {
    const d = req.validated.body
    res.json({ item: await write(req, 'settings.updated', async (client) => {
      const before = (await client.query('SELECT * FROM salon.settings WHERE key=$1 FOR UPDATE', [d.key])).rows[0]
      const row = (await client.query(`UPDATE salon.settings SET value=$2,definition_state=$3,updated_by=$4,updated_at=now() WHERE key=$1 RETURNING *`,
        [d.key, JSON.stringify(d.value), d.definitionState, req.auth.user.id])).rows[0]
      if (!row) throw missing()
      return { ...row, audit: { before, after: d } }
    }) })
  })
  router.put('/settings/hours', ...settings, validate(hoursSchema), async (req, res) => {
    await write(req, 'settings.hours_updated', async (client) => {
      const before = (await client.query('SELECT * FROM salon.business_hours ORDER BY weekday FOR UPDATE')).rows
      for (const d of req.validated.body.hours) await client.query(`UPDATE salon.business_hours SET opens_at=$2,closes_at=$3,is_closed=$4,definition_state=$5 WHERE weekday=$1`,
        [d.weekday, d.opensAt, d.closesAt, d.isClosed, d.definitionState])
      return { key: 'business_hours', audit: { before, after: req.validated.body.hours } }
    }); res.json({ saved: true })
  })
  router.post('/settings/closures', ...settings, validate(closureSchema), async (req, res) => {
    const d = req.validated.body
    res.status(201).json({ item: await write(req, 'settings.closure_created', async (client) => ({
      ...(await client.query('INSERT INTO salon.closures(closed_on,reason,created_by) VALUES($1,$2,$3) RETURNING id', [d.closedOn, d.reason, req.auth.user.id])).rows[0], audit: d,
    })) })
  })
  router.delete('/settings/closures/:id', ...settings, ids, async (req, res) => {
    await write(req, 'settings.closure_removed', async (client) => {
      const row = (await client.query('DELETE FROM salon.closures WHERE id=$1 RETURNING *', [req.validated.params.id])).rows[0]
      if (!row) throw missing()
      return { id: row.id, audit: row }
    }); res.status(204).end()
  })
  return router
}
