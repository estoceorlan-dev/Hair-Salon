import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { once } from 'node:events'
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { createApp } from '../src/app.js'
import { parseEnvironment } from '../src/config/env.js'
import { createDatabase } from '../src/db/pool.js'
import { validate } from '../src/middleware/validate.js'
import { errorHandler } from '../src/middleware/errors.js'

const quiet = { info() {}, error() {} }

async function start(t, app) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeAllConnections()
      }),
  )
  return `http://127.0.0.1:${server.address().port}`
}

function appFor(status) {
  return createApp({
    database: {
      async checkReadiness() {
        return { status }
      },
    },
    logger: quiet,
    distPath: path.join(os.tmpdir(), 'romel-no-build-here'),
  })
}

test('liveness stays healthy while an unconfigured database makes readiness 503', async (t) => {
  const database = createDatabase(parseEnvironment({}))
  t.after(() => database.close())
  const base = await start(t, createApp({ database, logger: quiet }))
  assert.equal((await fetch(`${base}/api/live`)).status, 200)
  const response = await fetch(`${base}/api/health`)
  assert.equal(response.status, 503)
  assert.equal((await response.json()).database.status, 'not_configured')
})

test('ready and unavailable database results are reflected in HTTP readiness', async (t) => {
  for (const [status, expected] of [
    ['ready', 200],
    ['unavailable', 503],
  ]) {
    const base = await start(t, appFor(status))
    const response = await fetch(`${base}/api/health`)
    assert.equal(response.status, expected)
    assert.equal((await response.json()).database.status, status)
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }
})

test('payment requests require a verified account before reaching the disabled workflow', async (t) => {
  const base = await start(t, appFor('not_configured'))
  for (const endpoint of [
    '/api/payments',
    '/api/payments/gcash',
    '/api/payments/maya',
    '/api/payments/card',
  ]) {
    const response = await fetch(base + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'AUTH_REQUIRED')
  }
})

test('unknown APIs and malformed JSON use safe JSON errors with request IDs', async (t) => {
  const base = await start(t, appFor('not_configured'))
  const missing = await fetch(`${base}/api/does-not-exist`, {
    headers: { Accept: 'text/html' },
  })
  assert.equal(missing.status, 404)
  assert.match(missing.headers.get('content-type'), /application\/json/)
  const body = await missing.json()
  assert.equal(body.error.code, 'NOT_FOUND')
  assert.equal(body.requestId, missing.headers.get('x-request-id'))
  const malformed = await fetch(`${base}/api/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{secret: hidden}',
  })
  assert.equal(malformed.status, 400)
  const error = await malformed.json()
  assert.equal(error.error.code, 'INVALID_JSON')
  assert.equal(JSON.stringify(error).includes('hidden'), false)
})

test('SPA refresh works while missing assets and API paths remain 404', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'romel-foundation-'))
  const indexPath = path.join(directory, 'index.html')
  await writeFile(indexPath, '<html><body>Romel test preview</body></html>')
  t.after(async () => {
    await unlink(indexPath)
    await rmdir(directory)
  })
  const base = await start(
    t,
    createApp({
      database: {
        async checkReadiness() {
          return { status: 'ready' }
        },
      },
      logger: quiet,
      distPath: directory,
    }),
  )
  const route = await fetch(`${base}/app/pos`, {
    headers: { Accept: 'text/html' },
  })
  assert.equal(route.status, 200)
  assert.match(await route.text(), /Romel test preview/)
  assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404)
  assert.equal((await fetch(`${base}/api/missing`)).status, 404)
})

test('validation reports fields, and unexpected errors do not disclose secrets', async (t) => {
  const app = express()
  app.use(express.json())
  app.post(
    '/example',
    validate(z.object({ quantity: z.number().positive() })),
    (req, res) => res.json(req.validated.body),
  )
  app.get('/failure', () => {
    throw new Error('postgresql://secret-password@private-host')
  })
  app.use(errorHandler(quiet))
  const base = await start(t, app)
  const invalid = await fetch(`${base}/example`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"quantity":-1}',
  })
  assert.equal(invalid.status, 422)
  assert.equal((await invalid.json()).error.details[0].field, 'quantity')
  const failure = await fetch(`${base}/failure`)
  assert.equal(failure.status, 500)
  assert.equal((await failure.text()).includes('secret-password'), false)
})

test('configuration accepts placeholders and rejects invalid values without disclosure', () => {
  assert.equal(
    parseEnvironment({ DATABASE_URL: '', JWT_SECRET: '' }).databaseUrl,
    undefined,
  )
  for (const environment of [
    { PORT: 'invalid' },
    { APP_TIMEZONE: 'bad/timezone' },
    { APP_ORIGIN: 'http://localhost:5173/path' },
    { DATABASE_URL: 'mysql://user:private-secret@localhost/db' },
    { JWT_SECRET: 'private-secret' },
  ]) {
    assert.throws(
      () => parseEnvironment(environment),
      (error) =>
        error.message.startsWith('Invalid server configuration:') &&
        !error.message.includes('private-secret'),
    )
  }
})
