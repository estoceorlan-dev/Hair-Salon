import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomBytes, randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { createApp } from '../src/app.js'
import { parseEnvironment } from '../src/config/env.js'
import { cookieOptions, createAuthService } from '../src/modules/auth/auth.service.js'
import { passwordSchema, registrationSchema } from '../src/modules/auth/auth.schemas.js'

const quiet = { info() {}, error() {} }
const config = parseEnvironment({ JWT_SECRET: randomBytes(48).toString('base64url') })
async function start(t, app) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  return `http://127.0.0.1:${server.address().port}`
}
test('new passwords enforce bcrypt byte limits and registration cannot select a role', () => {
  assert.equal(passwordSchema.safeParse('x'.repeat(12)).success, true)
  assert.equal(passwordSchema.safeParse('short').success, false)
  assert.equal(passwordSchema.safeParse('é'.repeat(37)).success, false)
  assert.equal(registrationSchema.safeParse({ displayName: 'Customer', email: 'a@example.test', password: 'x'.repeat(12), role: 'manager' }).success, false)
})
test('production requires HTTPS, database, and private JWT configuration; cookies are protected', () => {
  assert.throws(() => parseEnvironment({ NODE_ENV: 'production' }), /Invalid server configuration/)
  const prod = parseEnvironment({ NODE_ENV: 'production', APP_ORIGIN: 'https://salon.example',
    DATABASE_URL: 'postgresql://localhost/salon', JWT_SECRET: randomBytes(48).toString('base64url'), TRUST_PROXY_HOPS: '1' })
  assert.deepEqual(cookieOptions(prod), { httpOnly: true, secure: true, sameSite: 'lax', path: '/api' })
  assert.equal(cookieOptions(config).secure, false)
})
test('expired, forged, wrong-audience, and malformed session claims are rejected before database access', async () => {
  let queries = 0
  const service = createAuthService({ pool: { query() { queries++; throw new Error('Unexpected query') } } }, config)
  const payload = { sid: randomUUID(), v: 0 }
  const options = { algorithm: 'HS256', issuer: 'romel-hair-salon', audience: 'romel-web', subject: randomUUID(), expiresIn: 60 }
  for (const token of [
    'invalid', jwt.sign(payload, config.jwtSecret, { ...options, expiresIn: -1 }),
    jwt.sign(payload, randomBytes(48).toString('base64url'), options),
    jwt.sign(payload, config.jwtSecret, { ...options, audience: 'other-app' }),
    jwt.sign({ ...payload, v: '0' }, config.jwtSecret, options),
    jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256', issuer: options.issuer, audience: options.audience, subject: options.subject }),
    jwt.sign({ ...payload, sid: '-'.repeat(36) }, config.jwtSecret, options),
  ]) await assert.rejects(service.authenticate(token), (error) => error.status === 401)
  assert.equal(queries, 0)
})
test('public account writes require a trusted origin, custom browser header, and JSON', async (t) => {
  const base = await start(t, createApp({ config, database: {}, logger: quiet }))
  const data = JSON.stringify({ email: 'person@example.test', password: 'invalid-password' })
  for (const [headers, expected] of [
    [{ 'Content-Type': 'application/json' }, 403],
    [{ Origin: 'http://evil.example', 'X-Romel-Request': 'browser', 'Content-Type': 'application/json' }, 403],
    [{ Origin: config.appOrigin, 'Content-Type': 'application/json' }, 403],
    [{ Origin: config.appOrigin, 'X-Romel-Request': 'browser', 'Content-Type': 'text/plain' }, 415],
    [{ Origin: config.appOrigin, 'X-Romel-Request': 'browser', 'Content-Type': 'application/json' }, 503],
  ]) assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers, body: data })).status, expected)
})
test('account attempts are rate limited with safe JSON responses', async (t) => {
  const base = await start(t, createApp({ config, database: {}, logger: quiet }))
  let result
  for (let n = 0; n < 21; n++) result = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { Origin: config.appOrigin, 'X-Romel-Request': 'browser', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'person@example.test', password: 'incorrect-password' }),
  })
  assert.equal(result.status, 429)
  assert.equal((await result.json()).error.code, 'TOO_MANY_ATTEMPTS')
  assert.ok(result.headers.get('retry-after'))
})
