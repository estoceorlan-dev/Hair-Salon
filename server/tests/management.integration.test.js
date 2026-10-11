import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomBytes, randomUUID } from 'node:crypto'
import { loadEnvironment } from '../src/config/env.js'
import { commandPool } from '../src/db/connection.js'
import { migrate } from '../src/db/migrate.js'
import { demoRoles, fixtureId, resetFixtureDatabase, seedFixtures } from '../src/db/demo-seed.js'
import { createApp } from '../src/app.js'

test('Phase 4 persisted master records, settings, and access', async (t) => {
  const config = { ...loadEnvironment(), nodeEnv: 'test', jwtSecret: randomBytes(48).toString('base64url') }
  const pool = commandPool(config.testDatabaseUrl)
  t.after(() => pool.end())
  await migrate(pool)
  const passwords = Object.fromEntries(demoRoles.map((r) => [r, randomBytes(18).toString('base64url')]))
  const fixture = { connectionString: config.testDatabaseUrl, nodeEnv: 'test', environment: 'test', date: '2026-10-12', passwords }
  await resetFixtureDatabase(pool, { ...fixture, confirmation: 'romel_salon_test' })
  await pool.query("UPDATE salon.settings SET value='null',definition_state='placeholder',updated_by=NULL WHERE key NOT IN ('currency','timezone')")
  await seedFixtures(pool, fixture)
  const servers = []
  async function start() {
    const server = createApp({ database: { pool }, config, logger: { info() {}, error() {} } }).listen(0, '127.0.0.1')
    await once(server, 'listening'); servers.push(server)
    return `http://127.0.0.1:${server.address().port}/api`
  }
  let base = await start()
  t.after(async () => { for (const s of servers) { if (s.listening) await new Promise((resolve) => { s.close(resolve); s.closeAllConnections() }) } })
  const cookies = {}
  async function request(path, role = 'manager', method = 'GET', body, extra = {}) {
    const res = await fetch(base + path, { method, headers: { Origin: config.appOrigin, 'X-Romel-Request': 'browser',
      'Content-Type': 'application/json', ...(cookies[role] ? { Cookie: cookies[role] } : {}), ...extra },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) })
    return { status: res.status, data: res.status === 204 ? null : await res.json(), cookie: res.headers.get('set-cookie') }
  }
  for (const role of demoRoles) {
    const result = await request('/auth/login', role, 'POST', { email: `${role}@demo.romel.invalid`, password: passwords[role] })
    assert.equal(result.status, 200); cookies[role] = result.cookie.split(';')[0]
  }
  const stylist = fixtureId('employee:stylist')
  // Obtain the real fixture profile ID without coupling to seed naming.
  const staffId = (await pool.query("SELECT id FROM salon.employees WHERE job_kind='stylist' LIMIT 1")).rows[0].id
  let customer, service
  const customerData = { displayName: 'Phase Four Customer', email: 'phase4@example.test', phone: '+63 917 111 2233',
    notes: 'Prefers short hair', preferredEmployeeId: staffId, isActive: true }
  const serviceData = { code: 'PHASE4-CUT', name: 'Phase Four Cut', category: 'Hair', priceCents: 45050, durationMinutes: 45, isActive: true, employeeIds: [staffId] }
  await t.test('role checks, trusted writes, and strict validation guard every new module', async () => {
    assert.equal((await request('/customers', 'anonymous')).status, 401)
    for (const role of ['cashier', 'stylist', 'beautician', 'customer']) {
      for (const path of ['/settings', '/services', '/employee-profiles']) assert.equal((await request(path, role)).status, 403)
      assert.equal((await request('/settings', role, 'PUT', {})).status, 403)
    }
    for (const role of ['customer', 'stylist', 'beautician']) assert.equal((await request('/customers', role)).status, 403)
    for (const role of ['manager', 'cashier', 'customer']) assert.equal((await request('/catalog', role)).status, 200)
    assert.equal((await request('/customers', 'manager', 'POST', customerData, { Origin: 'https://evil.example' })).status, 403)
    assert.equal((await request('/customers', 'manager', 'POST', { ...customerData, userId: randomUUID() })).status, 422)
    assert.equal((await request('/customers?page=0')).status, 422)
    assert.equal((await request('/services/not-an-id', 'manager', 'PUT', serviceData)).status, 422)
  })
  await t.test('customers persist, paginate, preserve history and require explicit duplicate review', async () => {
    const created = await request('/customers', 'cashier', 'POST', customerData)
    assert.equal(created.status, 201, JSON.stringify(created.data)); customer = created.data.item
    assert.equal(customer.user_id, null)
    const duplicate = await request('/customers', 'manager', 'POST', { ...customerData, displayName: 'Other Person', phone: '+639171112233' })
    assert.equal(duplicate.status, 409); assert.equal(duplicate.data.error.code, 'DUPLICATE_CUSTOMER')
    assert.equal((await request('/customers', 'manager', 'POST', { ...customerData, duplicateReason: 'Reviewed: different family member.' })).status, 201)
    const list = await request('/customers?q=Phase%20Four&pageSize=1&page=2')
    assert.equal(list.data.total, 2); assert.equal(list.data.items.length, 1)
    assert.equal((await request('/customers/' + customer.id, 'cashier', 'PUT', { ...customerData, notes: 'Updated contact notes' })).status, 200)
    assert.equal((await request('/customers/' + customer.id + '/history', 'customer')).status, 404)
    const ownId = (await pool.query("SELECT c.id FROM salon.customers c JOIN salon.users u ON u.id=c.user_id WHERE u.email='customer@demo.romel.invalid'")).rows[0].id
    const history = await request('/customers/' + ownId + '/history', 'cashier')
    assert.equal(history.status, 200); assert.ok(history.data.history.length > 0)
    assert.ok(history.data.history.every((s) => s.status === 'paid'))
    const parallel = await Promise.all([1, 2].map(() => request('/customers', 'cashier', 'POST', { ...customerData, displayName: 'Concurrent Walk In', email: null, phone: null })))
    assert.deepEqual(parallel.map((r) => r.status).sort(), [201, 409])
  })
  await t.test('catalog prices, durations, eligibility and deactivation are reflected in customer and POS reads', async () => {
    const created = await request('/services', 'manager', 'POST', serviceData)
    assert.equal(created.status, 201, JSON.stringify(created.data)); service = created.data.item
    assert.equal((await request('/services', 'manager', 'POST', serviceData)).status, 409)
    for (const role of ['cashier', 'customer']) {
      const catalog = await request('/catalog?q=Phase%20Four', role)
      assert.equal(catalog.data.items[0].price_cents, '45050'); assert.equal(catalog.data.items[0].employees[0].id, staffId)
      assert.equal('base_pay_cents' in catalog.data.items[0].employees[0], false)
    }
    const invalid = await request('/services/' + service.id, 'manager', 'PUT', { ...serviceData, employeeIds: [randomUUID()] })
    assert.equal(invalid.status, 409)
    assert.equal((await request('/catalog?q=Phase%20Four')).data.items[0].employees.length, 1)
    assert.equal((await request('/services/' + service.id, 'manager', 'PUT', { ...serviceData, priceCents: -1 })).status, 422)
    assert.equal((await request('/services/' + service.id, 'manager', 'PUT', { ...serviceData, isActive: false })).status, 200)
    assert.equal((await request('/catalog?q=Phase%20Four', 'customer')).data.total, 0)
    assert.equal((await request('/services?status=inactive&q=PHASE4')).data.total, 1)
    assert.equal((await request('/services/' + service.id, 'manager', 'PUT', { ...serviceData, priceCents: null, durationMinutes: null, employeeIds: [] })).status, 200)
    assert.equal((await request('/catalog?q=Phase%20Four')).data.items[0].price_cents, null)
  })
  await t.test('employee profile inputs, overlapping availability and inactive staff eligibility', async () => {
    const payload = { phone: '09170000000', notes: null, basePayCents: 2000000, commissionPolicy: { basis: 'service_subtotal', ratePercent: 10, amountCents: null, notes: 'Configuration only' } }
    assert.equal((await request('/employee-profiles/' + staffId, 'manager', 'PUT', payload)).status, 200)
    assert.equal((await request('/employee-profiles/' + stylist, 'cashier', 'PUT', payload)).status, 403)
    assert.equal((await request('/employee-profiles/' + staffId, 'manager', 'PUT', { ...payload, basePayCents: -1 })).status, 422)
    const interval = { startsAt: '2040-02-01T09:00:00+08:00', endsAt: '2040-02-01T17:00:00+08:00', available: true, reason: 'Test shift' }
    const parallel = await Promise.all([1, 2].map(() => request('/employee-profiles/' + staffId + '/availability', 'manager', 'POST', interval)))
    assert.deepEqual(parallel.map((r) => r.status).sort(), [201, 409])
    const entry = parallel.find((r) => r.status === 201).data.item
    assert.equal((await request('/availability/' + entry.id, 'manager', 'DELETE')).status, 204)
    assert.equal((await request('/employee-profiles/' + staffId + '/availability', 'manager', 'POST', { ...interval, endsAt: interval.startsAt })).status, 422)
    await pool.query('UPDATE salon.employees SET is_active=false WHERE id=$1', [staffId])
    assert.equal((await request('/services/' + service.id, 'manager', 'PUT', serviceData)).status, 409)
    await pool.query('UPDATE salon.employees SET is_active=true WHERE id=$1', [staffId])
  })
  await t.test('settings, hours, closures and periods persist while payments and undefined policies stay disabled', async () => {
    const initial = await request('/settings'); assert.equal(initial.status, 200, JSON.stringify(initial.data))
    assert.equal(initial.data.settings.find((s) => s.key === 'tax_policy').value, null)
    const hours = Array.from({ length: 7 }, (_, weekday) => ({ weekday, opensAt: weekday ? '09:00' : null, closesAt: weekday ? '19:00' : null, isClosed: !weekday, definitionState: 'demo' }))
    assert.equal((await request('/settings/hours', 'manager', 'PUT', { hours })).status, 200)
    assert.equal((await request('/settings/hours', 'manager', 'PUT', { hours: hours.map((h) => ({ ...h, closesAt: h.weekday ? '08:00' : null })) })).status, 422)
    const closure = await request('/settings/closures', 'manager', 'POST', { closedOn: '2040-02-29', reason: 'Salon closed' })
    assert.equal(closure.status, 201)
    assert.equal((await request('/settings/closures', 'manager', 'POST', { closedOn: '2040-02-29', reason: 'Duplicate date' })).status, 409)
    assert.equal((await request('/settings/closures', 'manager', 'POST', { closedOn: '2041-02-29', reason: 'Invalid date' })).status, 422)
    const receipt = { key: 'receipt_details', definitionState: 'demo', value: { salonName: 'Phase Four Salon', address: 'Test address', phone: '', footer: 'Thank you' } }
    assert.equal((await request('/settings', 'manager', 'PUT', receipt)).status, 200)
    assert.equal((await request('/settings', 'manager', 'PUT', { ...receipt, definitionState: 'placeholder' })).status, 422)
    assert.equal((await request('/settings', 'manager', 'PUT', { key: 'payments', value: { enabled: true }, definitionState: 'confirmed' })).status, 422)
    assert.equal((await request('/settings', 'manager', 'PUT', { key: 'tax_policy', value: { ratePercent: 101, inclusive: false, notes: '' }, definitionState: 'confirmed' })).status, 422)
    const periods = { key: 'payroll_periods', definitionState: 'demo', value: [{ startsOn: '2040-01-01', endsOn: '2040-01-15' }, { startsOn: '2040-01-15', endsOn: '2040-01-31' }] }
    assert.equal((await request('/settings', 'manager', 'PUT', periods)).status, 422)
    periods.value[1].startsOn = '2040-01-16'
    assert.equal((await request('/settings', 'manager', 'PUT', periods)).status, 200)
    assert.equal((await request('/payments/cash', 'manager', 'POST')).status, 501)
    const final = await request('/settings')
    assert.ok(final.data.payments.every((p) => p.enabled === false))
    assert.equal(final.data.settings.find((s) => s.key === 'tax_policy').value, null)
    assert.equal((await request('/settings/closures/' + closure.data.item.id, 'manager', 'DELETE')).status, 204)
  })
  await t.test('new server instance retains records and committed writes have audit trails', async () => {
    const first = servers[0]
    await new Promise((resolve) => { first.close(resolve); first.closeAllConnections() })
    base = await start()
    assert.equal((await request('/customers?q=Phase%20Four')).data.total, 2)
    const employee = (await request('/employee-profiles?q=stylist')).data.items.find((e) => e.id === staffId)
    assert.equal(employee.base_pay_cents, '2000000')
    const settings = await request('/settings')
    assert.equal(settings.data.settings.find((s) => s.key === 'receipt_details').value.salonName, 'Phase Four Salon')
    const logs = (await pool.query("SELECT action,actor_id,details FROM salon.activity_logs WHERE action NOT LIKE 'auth.%'")).rows
    for (const action of ['customer.created', 'customer.updated', 'service.created', 'service.updated', 'employee.profile_updated', 'availability.created', 'availability.removed', 'settings.updated', 'settings.hours_updated', 'settings.closure_created', 'settings.closure_removed'])
      assert.ok(logs.some((l) => l.action === action && l.actor_id), action)
    assert.ok(logs.some((l) => l.details.duplicateReason))
  })
  // Keep reference policy fixtures undefined for the next integration run.
  await pool.query("UPDATE salon.settings SET value='null',definition_state='placeholder',updated_by=NULL WHERE key NOT IN ('currency','timezone')")
})
