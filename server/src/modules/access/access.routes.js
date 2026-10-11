import { Router } from 'express'
import { authenticate, requirePermission, trustedWrite } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errors.js'
import { validate } from '../../middleware/validate.js'
import { idSchema } from '../auth/auth.schemas.js'
import { paymentRoutes } from '../payments/payments.routes.js'
import { listSchema } from '../management/management.schemas.js'

export function accessRoutes(service, database, config) {
  const router = Router()
  router.use(authenticate(service), trustedWrite(config))
  const schedule = requirePermission('appointments.manage', 'appointments.assigned', 'appointments.own')
  const scope = (user) => {
    if (user.permissions.includes('appointments.manage')) return [null, null]
    if (user.permissions.includes('appointments.assigned') && user.employeeId) return [user.employeeId, null]
    if (user.permissions.includes('appointments.own') && user.customerId) return [null, user.customerId]
    throw new HttpError(403, 'FORBIDDEN', 'Appointment access is unavailable.')
  }
  const appointmentSql = `SELECT a.id,a.booking_reference,a.starts_at,a.ends_at,a.status,
    a.service_name_snapshot AS service_name,c.display_name AS customer_name,e.display_name AS employee_name
    FROM salon.appointments a JOIN salon.customers c ON c.id=a.customer_id
    JOIN salon.employees e ON e.id=a.employee_id
    WHERE ($1::uuid IS NULL OR a.employee_id=$1) AND ($2::uuid IS NULL OR a.customer_id=$2)`
  router.get('/appointments', schedule, async (req, res) => {
    const { rows } = await database.pool.query(appointmentSql + ' ORDER BY a.starts_at DESC,a.id LIMIT 100', scope(req.auth.user))
    res.json({ appointments: rows })
  })
  router.get('/appointments/:id', schedule, validate(idSchema, 'params'), async (req, res) => {
    const { rows } = await database.pool.query(appointmentSql + ' AND a.id=$3', [...scope(req.auth.user), req.validated.params.id])
    if (!rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Appointment not found.')
    res.json({ appointment: rows[0] })
  })
  router.get('/me/earnings', requirePermission('earnings.own'), async (req, res) => {
    if (!req.auth.user.employeeId) throw new HttpError(403, 'FORBIDDEN', 'An employee profile is required.')
    const { rows } = await database.pool.query(`SELECT ce.id,ce.amount_cents,ce.status,ce.created_at,
      si.description_snapshot AS service_name FROM salon.commission_entries ce
      JOIN salon.sale_items si ON si.id=ce.sale_item_id WHERE ce.employee_id=$1 ORDER BY ce.created_at DESC,ce.id LIMIT 100`, [req.auth.user.employeeId])
    res.json({ earnings: rows, definitionState: 'placeholder' })
  })
  const history = async (customerId, page = 1, pageSize = 100) => (await database.pool.query(`SELECT s.id,s.receipt_number,s.sold_at,s.status,s.total_cents,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('name',i.description_snapshot,'quantity',i.quantity,'lineTotalCents',i.line_total_cents::text) ORDER BY i.id)
      FROM salon.sale_items i WHERE i.sale_id=s.id),'[]'::jsonb) AS items
    FROM salon.sales s WHERE s.customer_id=$1 AND s.status='paid' ORDER BY s.sold_at DESC,s.id LIMIT $2 OFFSET $3`, [customerId, pageSize, (page - 1) * pageSize])).rows
  router.get('/me/history', requirePermission('history.own'), async (req, res) => {
    if (!req.auth.user.customerId) throw new HttpError(403, 'FORBIDDEN', 'A customer profile is required.')
    res.json({ history: await history(req.auth.user.customerId) })
  })
  router.get('/customers/:id/history', requirePermission('customers.manage', 'history.own'), validate(idSchema, 'params'), validate(listSchema, 'query'), async (req, res) => {
    const id = req.validated.params.id
    if (!req.auth.user.permissions.includes('customers.manage') && id !== req.auth.user.customerId)
      throw new HttpError(404, 'NOT_FOUND', 'Customer history not found.')
    const found = await database.pool.query('SELECT id FROM salon.customers WHERE id=$1', [id])
    if (!found.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Customer history not found.')
    const { page, pageSize } = req.validated.query
    const count = (await database.pool.query("SELECT count(*)::int AS total FROM salon.sales WHERE customer_id=$1 AND status='paid'", [id])).rows[0].total
    res.json({ history: await history(id, page, pageSize), total: count, page, pageSize })
  })
  router.use('/payments', requirePermission('sales.manage'), paymentRoutes())
  const futureModules = {
    customers: 'customers.manage', services: 'services.manage', sales: 'sales.manage',
    inventory: 'inventory.manage', payroll: 'payroll.manage', reports: 'reports.view',
    settings: 'settings.manage', 'activity-logs': 'logs.view', dashboard: 'dashboard.view',
  }
  for (const [route, permission] of Object.entries(futureModules)) {
    router.use('/' + route, requirePermission(permission), (req, res, next) => next(
      new HttpError(501, 'WORKFLOW_NOT_IMPLEMENTED', 'This business workflow is planned for a later phase.'),
    ))
  }
  router.all('/appointments{/:id}', schedule, (req, res, next) => next(
    new HttpError(501, 'WORKFLOW_NOT_IMPLEMENTED', 'Booking changes are planned for Phase 5.'),
  ))
  return router
}
