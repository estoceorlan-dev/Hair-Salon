import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { loadEnvironment } from '../src/config/env.js'
import { commandPool } from '../src/db/connection.js'
import { migrate } from '../src/db/migrate.js'
import { demoRoles, fixtureId, resetFixtureDatabase, seedFixtures } from '../src/db/demo-seed.js'
import { createApp } from '../src/app.js'

test('real PostgreSQL authentication, permissions, and ownership', async (t) => {
  const config = { ...loadEnvironment(), nodeEnv: 'test', jwtSecret: randomBytes(48).toString('base64url') }
  const pool = commandPool(config.testDatabaseUrl)
  t.after(() => pool.end())
  await migrate(pool)
  const passwords = Object.fromEntries(demoRoles.map((role) => [role, randomBytes(18).toString('base64url')]))
  const fixtures = { connectionString: config.testDatabaseUrl, nodeEnv: 'test', environment: 'test', date: '2026-10-12', passwords }
  await resetFixtureDatabase(pool, { ...fixtures, confirmation: 'romel_salon_test' })
  await seedFixtures(pool, fixtures)
  const app = createApp({ database: { pool }, config, logger: { info() {}, error() {} } })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  const base = `http://127.0.0.1:${server.address().port}`
  async function request(path, { cookie, method = 'GET', body, origin = config.appOrigin, header = 'browser' } = {}) {
    return fetch(base + '/api' + path, { method,
      headers: { Origin: origin, 'X-Romel-Request': header, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}),
    })
  }
  async function login(role) {
    const res = await request('/auth/login', { method: 'POST', body: { email: `${role}@demo.romel.invalid`, password: passwords[role] } })
    assert.equal(res.status, 200)
    return { cookie: res.headers.get('set-cookie').split(';')[0], data: await res.json(), headers: res.headers }
  }
  const sessions = {}
  await t.test('all roles sign in, restore only safe profile fields, and have distinct session IDs', async () => {
    for (const role of demoRoles) {
      const session = await login(role)
      sessions[role] = session
      assert.equal(session.data.user.role, role)
      assert.match(session.headers.get('set-cookie'), /HttpOnly/)
      assert.match(session.headers.get('set-cookie'), /SameSite=Lax/)
      assert.match(session.headers.get('set-cookie'), /Path=\/api/)
      assert.equal(session.headers.get('cache-control'), 'no-store')
      assert.equal(JSON.stringify(session.data).includes(passwords[role]), false)
      assert.equal('password_hash' in session.data.user, false)
      assert.equal('token' in session.data, false)
      const restored = await request('/auth/session', session)
      assert.equal(restored.status, 200)
      assert.deepEqual((await restored.json()).user, session.data.user)
    }
    assert.equal((await request('/employee-accounts')).status, 401)
    const bad = await request('/auth/login', { method: 'POST', body: { email: 'manager@demo.romel.invalid', password: 'incorrect-password' } })
    assert.equal(bad.status, 401)
  })
  await t.test('staff records and customer history remain scoped when IDs/query parameters are tampered with', async () => {
    for (const role of ['stylist', 'beautician', 'customer']) {
      const session = sessions[role]
      const response = await request('/appointments?employeeId=' + sessions.manager.data.user.employeeId + '&customerId=' + randomUUID(), session)
      assert.equal(response.status, 200)
      const actual = (await response.json()).appointments.map((row) => row.id).sort()
      const expected = await pool.query(`SELECT id FROM salon.appointments WHERE ${role === 'customer' ? 'customer_id' : 'employee_id'}=$1`,
        [role === 'customer' ? session.data.user.customerId : session.data.user.employeeId])
      assert.deepEqual(actual, expected.rows.map((row) => row.id).sort())
    }
    const stylist = sessions.stylist
    const foreign = (await pool.query('SELECT id FROM salon.appointments WHERE employee_id<>$1 LIMIT 1', [stylist.data.user.employeeId])).rows[0]
    assert.equal((await request('/appointments/' + foreign.id, stylist)).status, 404)
    const otherCustomer = (await pool.query('SELECT id FROM salon.customers WHERE id<>$1 LIMIT 1', [sessions.customer.data.user.customerId])).rows[0].id
    assert.equal((await request('/customers/' + otherCustomer + '/history', sessions.customer)).status, 404)
    assert.equal((await request('/me/history', sessions.customer)).status, 200)
    for (const role of ['stylist', 'beautician']) {
      const res = await request('/me/earnings?employeeId=' + sessions.manager.data.user.employeeId, sessions[role])
      assert.equal(res.status, 200)
      const ids = (await res.json()).earnings.map((row) => row.id).sort()
      const expected = await pool.query('SELECT id FROM salon.commission_entries WHERE employee_id=$1', [sessions[role].data.user.employeeId])
      assert.deepEqual(ids, expected.rows.map((row) => row.id).sort())
    }
  })
  await t.test('forbidden APIs deny non-managers; permitted future modules and payments remain disabled', async () => {
    for (const role of ['cashier', 'stylist', 'beautician', 'customer']) {
      for (const endpoint of ['/employee-accounts', '/settings', '/inventory', '/reports', '/payroll'])
        assert.equal((await request(endpoint, sessions[role])).status, 403)
    }
    for (const role of ['manager', 'cashier']) {
      const disabled = await request('/payments/gcash', { ...sessions[role], method: 'POST' })
      assert.equal(disabled.status, 501)
      assert.equal((await disabled.json()).error.code, 'PAYMENTS_NOT_IMPLEMENTED')
    }
    assert.equal((await request('/payments/maya', { ...sessions.customer, method: 'POST' })).status, 403)
    assert.equal((await request('/settings', sessions.manager)).status, 200)
    assert.equal((await request('/appointments', { ...sessions.customer, method: 'POST' })).status, 501)
  })
  let registered
  const registrationPassword = randomBytes(20).toString('base64url')
  await t.test('registration creates only a linked customer and stores a bcrypt hash; duplicate/privilege injection rejected', async () => {
    const fields = { displayName: 'Registered Customer', email: 'NEW@EXAMPLE.TEST', password: registrationPassword }
    const injected = await request('/auth/register', { method: 'POST', body: { ...fields, role: 'manager' } })
    assert.equal(injected.status, 422)
    const res = await request('/auth/register', { method: 'POST', body: fields })
    assert.equal(res.status, 201)
    registered = { cookie: res.headers.get('set-cookie').split(';')[0], data: await res.json() }
    assert.equal(registered.data.user.role, 'customer')
    assert.ok(registered.data.user.customerId)
    const row = (await pool.query('SELECT password_hash FROM salon.users WHERE id=$1', [registered.data.user.id])).rows[0]
    assert.notEqual(row.password_hash, registrationPassword)
    assert.equal(await bcrypt.compare(registrationPassword, row.password_hash), true)
    assert.equal((await request('/auth/register', { method: 'POST', body: fields })).status, 409)
    assert.deepEqual((await (await request('/me/history', registered)).json()).history, [])
    assert.equal((await request('/appointments/' + fixtureId('appointment:upcoming-hair'), registered)).status, 404)
  })
  await t.test('CSRF attempts fail before writes; logout revokes the captured JWT; expired sessions rejected', async () => {
    assert.equal((await request('/auth/logout', { ...registered, method: 'POST', origin: 'https://evil.example' })).status, 403)
    assert.equal((await request('/auth/logout', { ...registered, method: 'POST', header: '' })).status, 403)
    assert.equal((await request('/auth/session', registered)).status, 200)
    const logout = await request('/auth/logout', { ...registered, method: 'POST' })
    assert.equal(logout.status, 204)
    assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/)
    assert.equal((await request('/auth/session', registered)).status, 401)
    const token = jwt.sign({ sid: randomUUID(), v: 0 }, config.jwtSecret, { issuer: 'romel-hair-salon', audience: 'romel-web', subject: registered.data.user.id, expiresIn: -1 })
    assert.equal((await request('/auth/session', { cookie: 'romel_session=' + token })).status, 401)
    const sessionRow = (await pool.query('SELECT id FROM salon.auth_sessions WHERE user_id=$1 AND revoked_at IS NULL LIMIT 1', [sessions.beautician.data.user.id])).rows[0]
    await pool.query("UPDATE salon.auth_sessions SET expires_at=now()-interval '1 second',created_at=now()-interval '2 seconds' WHERE id=$1", [sessionRow.id])
    assert.equal((await request('/auth/session', sessions.beautician)).status, 401)
  })
  await t.test('manager creates/edits accounts; password/role/active changes revoke sessions; last manager protected', async () => {
    const fields = { displayName: 'New Stylist', email: 'staff@example.test', role: 'stylist', password: randomBytes(20).toString('base64url') }
    const created = await request('/employee-accounts', { ...sessions.manager, method: 'POST', body: fields })
    assert.equal(created.status, 201)
    const employee = (await created.json()).employee
    assert.ok(employee.employeeId)
    const logged = await request('/auth/login', { method: 'POST', body: { email: fields.email, password: fields.password } })
    const old = { cookie: logged.headers.get('set-cookie').split(';')[0] }
    const newPassword = randomBytes(20).toString('base64url')
    const update = await request('/employee-accounts/' + employee.id, { ...sessions.manager, method: 'PATCH', body: { role: 'cashier', password: newPassword } })
    assert.equal(update.status, 200)
    assert.equal((await request('/auth/session', old)).status, 401)
    const relog = await request('/auth/login', { method: 'POST', body: { email: fields.email, password: newPassword } })
    assert.equal(relog.status, 200)
    assert.equal((await relog.json()).user.role, 'cashier')
    const cookie = relog.headers.get('set-cookie').split(';')[0]
    assert.equal((await request('/employee-accounts/' + employee.id, { ...sessions.manager, method: 'PATCH', body: { isActive: false } })).status, 200)
    assert.equal((await request('/auth/session', { cookie })).status, 401)
    assert.equal((await request('/auth/login', { method: 'POST', body: { email: fields.email, password: newPassword } })).status, 401)
    const last = await request('/employee-accounts/' + sessions.manager.data.user.id, { ...sessions.manager, method: 'PATCH', body: { role: 'stylist' } })
    assert.equal(last.status, 409)
    assert.equal((await last.json()).error.code, 'LAST_MANAGER')
    assert.equal((await request('/employee-accounts/' + sessions.customer.data.user.id, { ...sessions.manager, method: 'PATCH', body: { isActive: false } })).status, 404)
  })
  await t.test('self password change revokes every device and requires the old password', async () => {
    const another = await login('stylist')
    const password = randomBytes(20).toString('base64url')
    assert.equal((await request('/auth/password', { ...sessions.stylist, method: 'POST', body: { currentPassword: 'wrong-password', newPassword: password } })).status, 401)
    assert.equal((await request('/auth/password', { ...sessions.stylist, method: 'POST', body: { currentPassword: passwords.stylist, newPassword: password } })).status, 204)
    for (const device of [sessions.stylist, another]) assert.equal((await request('/auth/session', device)).status, 401)
    const relog = await request('/auth/login', { method: 'POST', body: { email: 'stylist@demo.romel.invalid', password } })
    assert.equal(relog.status, 200)
    const logs = (await pool.query("SELECT details FROM salon.activity_logs WHERE action LIKE 'auth.%'")).rows
    assert.ok(logs.length > 0)
    assert.equal(JSON.stringify(logs).includes(password), false)
  })
  await t.test('production rejects fixture accounts and registration cannot link an existing walk-in profile', async () => {
    const { createAuthService } = await import('../src/modules/auth/auth.service.js')
    const prod = createAuthService({ pool }, { ...config, nodeEnv: 'production' })
    await assert.rejects(prod.login({ email: 'customer@demo.romel.invalid', password: passwords.customer }), (err) => err.status === 401)
    const data = { displayName: 'Claim Attempt', email: 'claim@example.test', password: randomBytes(20).toString('base64url'), customerId: sessions.customer.data.user.customerId }
    assert.equal((await request('/auth/register', { method: 'POST', body: data })).status, 422)
  })
})
