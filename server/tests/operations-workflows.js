import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import sharp from 'sharp'
import { fixtureId } from '../src/db/demo-seed.js'

export async function verifyOperations(t, { request, sessions, pool }) {
  const serviceId = fixtureId('service:haircut')
  const employeeId = sessions.stylist.data.user.employeeId
  const send = (role, path, method, body) => request(path, { ...sessions[role], method, body })

  await t.test('simultaneous bookings reserve one slot and cancellation makes it available again', async () => {
    const day = new Date(Date.now() + 7 * 86400000)
    if (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1)
    const date = day.toISOString().slice(0, 10)
    const url = '/slots?' + new URLSearchParams({ serviceId, employeeId, date })
    const list = await send('customer', url)
    assert.equal(list.status, 200)
    const startsAt = (await list.json()).items[0].start
    const fields = { serviceId, employeeId, startsAt }
    const requests = await Promise.all([send('customer', '/appointments', 'POST', fields),
      send('manager', '/appointments', 'POST', { ...fields, customerId: sessions.customer.data.user.customerId })])
    assert.deepEqual(requests.map(r => r.status).sort(), [201, 409])
    const { item } = await requests.find(r => r.status === 201).json()
    assert.equal(item.customer_id, sessions.customer.data.user.customerId)
    assert.equal((await send('beautician', '/appointments/' + item.id, 'PATCH', { status: 'in_progress' })).status, 404)
    assert.equal((await send('customer', '/appointments/' + item.id, 'PATCH', { status: 'cancelled' })).status, 200)
    assert.ok((await (await send('customer', url)).json()).items.some(s => s.start === startsAt))
  })

  await t.test('stock movements, concurrent cash checkout, rollback and refund reconcile', async () => {
    const product = await send('manager', '/inventory', 'POST', { sku: 'WORKFLOW', name: 'Retail test',
      category: 'Hair', unit: 'bottle', minimum: 2, price: 1250 })
    assert.equal(product.status, 200)
    const id = (await product.json()).item.id
    const stock = async () => Number((await pool.query('SELECT quantity FROM salon.stock_balances WHERE product_id=$1', [id])).rows[0].quantity)
    const adjust = (delta) => send('manager', '/inventory/' + id + '/movements', 'POST', { delta, reason: 'Stock count' })
    assert.equal((await adjust(5)).status, 200)
    assert.equal((await adjust(-6)).status, 409)
    assert.equal(await stock(), 5)
    const order = { key: randomUUID(), customer: null, appointment: null, discount: 0, tendered: 3000,
      items: [{ type: 'product', id, qty: 2, employee: null }] }
    assert.equal((await send('cashier', '/sales', 'POST', { ...order, tendered: 100 })).status, 409)
    assert.equal(await stock(), 5)
    const responses = await Promise.all([send('cashier', '/sales', 'POST', order), send('cashier', '/sales', 'POST', order)])
    assert.deepEqual(responses.map(r => r.status), [200, 200])
    const [first, replay] = await Promise.all(responses.map(r => r.json()))
    assert.equal(first.item.id, replay.item.id)
    assert.equal(Number(first.item.total_cents), 2500)
    assert.equal(Number(first.item.change_cents), 500)
    assert.equal(await stock(), 3)
    const refundPath = '/sales/' + first.item.id + '/refund'
    const refund = { reason: 'Unopened return', returnStock: true }
    assert.equal((await send('cashier', refundPath, 'POST', refund)).status, 403)
    assert.equal((await send('manager', refundPath, 'POST', refund)).status, 200)
    assert.equal((await send('manager', refundPath, 'POST', refund)).status, 409)
    assert.equal(await stock(), 5)
    const payments = await pool.query('SELECT count(*)::int AS count FROM salon.payments WHERE sale_id=$1', [first.item.id])
    assert.equal(payments.rows[0].count, 1)
  })

  await t.test('manager reports reconcile and reviewed payroll can be paid once', async () => {
    const date = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
    const report = await send('manager', '/reports?from=' + date + '&to=' + date)
    assert.equal(report.status, 200)
    const { daily, payments } = await report.json()
    assert.ok(daily.length)
    assert.equal(Number(daily[0].net), payments.reduce((sum, p) => sum + Number(p.net), 0))
    for (const path of ['/dashboard', '/activity-logs', '/payroll']) {
      assert.equal((await send('manager', path)).status, 200)
    }
    const created = await send('manager', '/payroll', 'POST', { from: '2035-02-01', to: '2035-02-15' })
    assert.equal(created.status, 201)
    const path = '/payroll/' + (await created.json()).id
    const draft = await send('manager', path)
    assert.equal(draft.status, 200)
    const { items } = await draft.json()
    assert.ok(items.length)
    const approved = await send('manager', path + '/approve', 'POST', { items: items.map(r => ({
      id: r.id, base: 10000, adjustment: 0, note: '', expectedCommission: Number(r.commission), expectedCarry: Number(r.carry)
    })) })
    assert.equal(approved.status, 200)
    for (let attempt = 0; attempt < 2; attempt++) assert.equal((await send('manager', path + '/pay', 'POST', {})).status, 200)
    const paid = await (await send('manager', path)).json()
    assert.equal(paid.run.status, 'paid')
    assert.equal(paid.items.length, items.length)
  })

  await t.test('image uploads round trip through a signed S3 endpoint and replacement removes the old object', async (test) => {
    const objects = new Map()
    const storage = createServer(async (req, res) => {
      const key = new URL(req.url, 'http://localhost').pathname
      if (!req.headers.authorization?.startsWith('AWS4-HMAC-SHA256') || !/^\/test-images\/[\da-f-]+\.webp$/.test(key)) {
        res.writeHead(403).end()
        return
      }
      if (req.method === 'PUT') {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        objects.set(key, Buffer.concat(chunks))
        res.end()
      } else if (req.method === 'GET' && objects.has(key)) res.end(objects.get(key))
      else if (req.method === 'DELETE') {
        objects.delete(key)
        res.writeHead(204).end()
      } else res.writeHead(404).end()
    }).listen(0, '127.0.0.1')
    await once(storage, 'listening')
    test.after(() => new Promise(resolve => { storage.close(resolve); storage.closeAllConnections() }))
    const vars = { NEON_STORAGE_BUCKET: 'test-images', AWS_ENDPOINT_URL_S3: 'http://127.0.0.1:' + storage.address().port,
      AWS_REGION: 'ap-southeast-1', AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test' }
    for (const [key, value] of Object.entries(vars)) {
      const before = process.env[key]
      process.env[key] = value
      test.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before })
    }
    const url = '/images/' + serviceId
    const png = await sharp(randomBytes(256 * 256 * 3), { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer()
    const upload = { image: png.toString('base64') }
    assert.equal((await send('customer', url, 'PUT', upload)).status, 403)
    assert.equal((await send('manager', url, 'PUT', { image: 'dGVzdA==' })).status, 422)
    assert.equal((await send('manager', url, 'PUT', upload)).status, 200)
    const firstKey = [...objects.keys()][0]
    assert.equal((await send('manager', url, 'PUT', upload)).status, 200)
    assert.equal(objects.size, 1)
    assert.equal(objects.has(firstKey), false)
    const download = await send('customer', url)
    assert.equal(download.status, 200)
    assert.equal(download.headers.get('content-type'), 'image/webp')
    assert.equal((await sharp(Buffer.from(await download.arrayBuffer())).metadata()).format, 'webp')
  })
}
