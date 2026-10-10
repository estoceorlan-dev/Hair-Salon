import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import bcrypt from 'bcrypt'
import { assertFixtureDatabase, transaction } from './connection.js'
import { databaseToolLock } from './migrate.js'

export const fixtureVersion = 'demo_v1'
export const fixtureChecksum = createHash('sha256')
  .update(
    readFileSync(new URL('./demo-seed.js', import.meta.url), 'utf8').replace(
      /\r\n/g,
      '\n',
    ),
  )
  .digest('hex')
export function fixtureId(key) {
  const hex = createHash('sha256').update(`romel-demo-v1:${key}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export function referenceDate(value) {
  const date =
    value ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  const parsed = new Date(date + 'T00:00:00Z')
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new Error('Use a valid reference date in YYYY-MM-DD format.')
  return date
}

function workingDayOffset(anchor, delta) {
  let offset = delta
  while (
    new Date(
      new Date(anchor + 'T00:00:00Z').getTime() + offset * 86400000,
    ).getUTCDay() === 0
  )
    offset += Math.sign(delta)
  return offset
}

export const demoRoles = [
  'manager',
  'cashier',
  'stylist',
  'beautician',
  'customer',
]

export async function seedFixtures(
  pool,
  { connectionString, nodeEnv, environment = 'demo', date, passwords },
) {
  if (!['demo', 'test'].includes(environment))
    throw new Error('Fixtures are only supported in demo/test databases.')
  return transaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1,$2)', databaseToolLock)
    await assertFixtureDatabase(client, connectionString, environment, nodeEnv)
    const existing = await client.query(
      'SELECT checksum, reference_date::text FROM salon.seed_runs WHERE seed_key=$1',
      [fixtureVersion],
    )
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== fixtureChecksum)
        throw new Error(
          'Fixture version changed; add a new seed version or explicitly reset the demo.',
        )
      return { inserted: false, referenceDate: existing.rows[0].reference_date }
    }
    const populated = await client.query(
      `SELECT EXISTS(SELECT 1 FROM salon.users) OR EXISTS(SELECT 1 FROM salon.services) OR EXISTS(SELECT 1 FROM salon.products) OR EXISTS(SELECT 1 FROM salon.sales) OR EXISTS(SELECT 1 FROM salon.appointments) AS populated`,
    )
    if (populated.rows[0].populated)
      throw new Error(
        'Refusing to seed a database containing business records without a seed marker.',
      )
    const anchor = referenceDate(date)
    if (
      !passwords ||
      demoRoles.some(
        (role) =>
          typeof passwords[role] !== 'string' || passwords[role].length < 16,
      )
    )
      throw new Error('Supply generated fixture passwords for every demo role.')
    for (const role of demoRoles) {
      const hash = await bcrypt.hash(passwords[role], 10)
      await client.query(
        `INSERT INTO salon.users(id,role_id,email,display_name,password_hash,is_demo)
        SELECT $1,id,$2,$3,$4,true FROM salon.roles WHERE code=$5`,
        [
          fixtureId('user:' + role),
          `${role}@demo.romel.invalid`,
          `Demo ${role}`,
          hash,
          role,
        ],
      )
      if (role !== 'customer')
        await client.query(
          `INSERT INTO salon.employees(id,user_id,employee_code,display_name,job_kind) VALUES ($1,$2,$3,$4,$5)`,
          [
            fixtureId('employee:' + role),
            fixtureId('user:' + role),
            'DEMO-' + role.toUpperCase(),
            'Demo ' + role,
            role,
          ],
        )
    }
    for (const [name, account] of [
      ['Alex Sample', true],
      ['Jamie Sample', false],
    ]) {
      await client.query(
        `INSERT INTO salon.customers(id,user_id,display_name,email,preferred_employee_id) VALUES ($1,$2,$3,$4,$5)`,
        [
          fixtureId('customer:' + name),
          account ? fixtureId('user:customer') : null,
          name,
          account ? 'customer@demo.romel.invalid' : null,
          fixtureId('employee:stylist'),
        ],
      )
    }
    const services = [
      ['haircut', 'Haircut & Blowdry', 'Hair', 35000, 45, 'stylist'],
      ['color', 'Hair Coloring', 'Hair', 150000, 120, 'stylist'],
      ['treatment', 'Rebond & Treatment', 'Hair', 350000, 240, 'stylist'],
      ['nails', 'Manicure & Pedicure', 'Beauty', 50000, 60, 'beautician'],
    ]
    for (const [code, name, category, price, duration, staff] of services) {
      await client.query(
        'INSERT INTO salon.services(id,code,name,category,price_cents,duration_minutes,is_demo) VALUES ($1,$2,$3,$4,$5,$6,true)',
        [fixtureId('service:' + code), code, name, category, price, duration],
      )
      await client.query(
        'INSERT INTO salon.employee_services(employee_id,service_id) VALUES ($1,$2)',
        [fixtureId('employee:' + staff), fixtureId('service:' + code)],
      )
    }
    for (const [sku, name, unit, retail, price, stock, minimum] of [
      ['DEMO-SHAMPOO', 'Sample shampoo', 'ml', false, null, 250, 500],
      ['DEMO-COLOR', 'Sample hair color', 'ml', false, null, 300, 100],
      ['DEMO-SERUM', 'Sample retail serum', 'bottle', true, 85000, 10, 3],
    ]) {
      await client.query(
        'INSERT INTO salon.products(id,sku,name,category,stock_unit,is_retail,retail_price_cents,minimum_stock,is_demo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)',
        [
          fixtureId('product:' + sku),
          sku,
          name,
          retail ? 'Retail' : 'Consumables',
          unit,
          retail,
          price,
          minimum,
        ],
      )
      await client.query(
        `INSERT INTO salon.inventory_movements(id,product_id,quantity_delta,source_type,source_reference,actor_id,reason,occurred_at) VALUES ($1,$2,$3,'opening',$4,$5,'Synthetic opening stock fixture',$6::date::timestamptz)`,
        [
          fixtureId('opening:' + sku),
          fixtureId('product:' + sku),
          stock,
          fixtureVersion,
          fixtureId('user:manager'),
          anchor,
        ],
      )
    }
    await client.query(
      `INSERT INTO salon.service_products(service_id,product_id,quantity,definition_state) VALUES ($1,$2,NULL,'placeholder'),($3,$4,NULL,'placeholder')`,
      [
        fixtureId('service:haircut'),
        fixtureId('product:DEMO-SHAMPOO'),
        fixtureId('service:color'),
        fixtureId('product:DEMO-COLOR'),
      ],
    )
    await client.query(`UPDATE salon.business_hours SET opens_at=CASE WHEN weekday=0 THEN NULL ELSE '09:00'::time END,
      closes_at=CASE WHEN weekday=0 THEN NULL ELSE '19:00'::time END,is_closed=(weekday=0),definition_state='demo'`)
    for (const [key, service, staff, dayOffset, hour, status] of [
      ['upcoming-haircut', 'haircut', 'stylist', 1, '10:00', 'confirmed'],
      ['upcoming-nails', 'nails', 'beautician', 1, '11:00', 'pending'],
      ['history-haircut', 'haircut', 'stylist', -2, '10:00', 'completed'],
      ['history-nails', 'nails', 'beautician', -1, '11:00', 'completed'],
    ]) {
      const record = services.find((entry) => entry[0] === service)
      const day = workingDayOffset(anchor, dayOffset)
      await client.query(
        `INSERT INTO salon.appointments(id,booking_reference,customer_id,employee_id,service_id,starts_at,ends_at,status,source,service_name_snapshot,price_cents_snapshot,duration_minutes_snapshot,created_by)
        VALUES ($1,$2,$3,$4,$5,(($6::date+$7::integer)+$8::time) AT TIME ZONE 'Asia/Manila',
        ((($6::date+$7::integer)+$8::time) AT TIME ZONE 'Asia/Manila')+make_interval(mins=>$9),$10,'demo',$11,$12,$9,$13)`,
        [
          fixtureId('appointment:' + key),
          'DEMO-' + key,
          fixtureId('customer:Alex Sample'),
          fixtureId('employee:' + staff),
          fixtureId('service:' + service),
          anchor,
          day,
          hour,
          record[4],
          status,
          record[1],
          record[3],
          fixtureId('user:cashier'),
        ],
      )
    }
    for (const [key, service, staff, dayOffset] of [
      ['history-haircut', 'haircut', 'stylist', -2],
      ['history-nails', 'nails', 'beautician', -1],
    ]) {
      const record = services.find((entry) => entry[0] === service)
      const day = workingDayOffset(anchor, dayOffset)
      await client.query(
        `INSERT INTO salon.sales(id,idempotency_key,receipt_number,customer_id,appointment_id,cashier_id,subtotal_cents,discount_cents,tax_cents,total_cents,tax_policy_snapshot,is_demo,sold_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,$7,'{"fixture_only":true,"policy_confirmed":false}',true,(($8::date+$9::integer)+'12:00'::time) AT TIME ZONE 'Asia/Manila')`,
        [
          fixtureId('sale:' + key),
          'DEMO-' + key,
          'DEMO-RECEIPT-' + key,
          fixtureId('customer:Alex Sample'),
          fixtureId('appointment:' + key),
          fixtureId('user:cashier'),
          record[3],
          anchor,
          day,
        ],
      )
      await client.query(
        `INSERT INTO salon.sale_items(id,sale_id,service_id,description_snapshot,unit_price_cents,quantity,line_total_cents,consumption_snapshot) VALUES ($1,$2,$3,$4,$5,1,$5,NULL)`,
        [
          fixtureId('sale-item:' + key),
          fixtureId('sale:' + key),
          fixtureId('service:' + service),
          record[1],
          record[3],
        ],
      )
      await client.query(
        'INSERT INTO salon.sale_item_staff(sale_item_id,employee_id) VALUES ($1,$2)',
        [fixtureId('sale-item:' + key), fixtureId('employee:' + staff)],
      )
      await client.query(
        'INSERT INTO salon.commission_entries(id,sale_item_id,employee_id) VALUES ($1,$2,$3)',
        [
          fixtureId('commission:' + key),
          fixtureId('sale-item:' + key),
          fixtureId('employee:' + staff),
        ],
      )
      await client.query(
        `INSERT INTO salon.payments(id,sale_id,method_code,idempotency_key,amount_cents,status,is_demo,recorded_by,recorded_at) SELECT $1,id,'cash',$2,total_cents,'recorded',true,cashier_id,sold_at FROM salon.sales WHERE id=$3`,
        [
          fixtureId('payment:' + key),
          'DEMO-PAYMENT-' + key,
          fixtureId('sale:' + key),
        ],
      )
      await client.query("UPDATE salon.sales SET status='paid' WHERE id=$1", [
        fixtureId('sale:' + key),
      ])
    }
    await client.query(
      'INSERT INTO salon.payroll_runs(id,period_start,period_end) VALUES ($1,$2::date-7,$2::date+7)',
      [fixtureId('payroll:open'), anchor],
    )
    for (const role of ['manager', 'cashier', 'stylist', 'beautician'])
      await client.query(
        'INSERT INTO salon.payroll_items(id,payroll_run_id,employee_id) VALUES ($1,$2,$3)',
        [
          fixtureId('payroll-item:' + role),
          fixtureId('payroll:open'),
          fixtureId('employee:' + role),
        ],
      )
    await client.query(
      `INSERT INTO salon.notifications(id,recipient_user_id,kind,product_id,dedupe_key,message) VALUES ($1,$2,'low_stock',$3,'DEMO-LOW-SHAMPOO','Sample shampoo is below its illustrative threshold.')`,
      [
        fixtureId('notification:low'),
        fixtureId('user:manager'),
        fixtureId('product:DEMO-SHAMPOO'),
      ],
    )
    await client.query(
      `INSERT INTO salon.activity_logs(id,actor_id,action,entity_type,entity_reference,reason,details) VALUES ($1,$2,'demo.seeded','seed',$3,'Fictitious fixtures; no live payments or finalized business rules','{"fixture_only":true}')`,
      [fixtureId('activity:seed'), fixtureId('user:manager'), fixtureVersion],
    )
    await client.query(
      'INSERT INTO salon.seed_runs(seed_key,reference_date,checksum) VALUES ($1,$2,$3)',
      [fixtureVersion, anchor, fixtureChecksum],
    )
    return { inserted: true, referenceDate: anchor }
  })
}

export async function resetFixtureDatabase(
  pool,
  { connectionString, nodeEnv, confirmation, environment },
) {
  if (!['demo', 'test'].includes(environment))
    throw new Error('Reset supports only dedicated demo/test databases.')
  if (
    confirmation !==
    (environment === 'demo' ? 'romel_salon_demo' : 'romel_salon_test')
  )
    throw new Error(
      `Reset requires explicit confirmation of the ${environment} database name.`,
    )
  return transaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1,$2)', databaseToolLock)
    await assertFixtureDatabase(client, connectionString, environment, nodeEnv)
    const referenceTables = [
      'roles',
      'permissions',
      'role_permissions',
      'settings',
      'business_hours',
      'payment_methods',
    ]
    const referenceRecords = []
    for (const table of referenceTables) {
      const { rows } = await client.query(`SELECT * FROM salon.${table}`)
      referenceRecords.push({ table, rows })
    }
    const { rows } = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='salon' AND tablename <> 'database_identity' ORDER BY tablename`,
    )
    if (rows.some((row) => !/^[a-z_]+$/.test(row.tablename)))
      throw new Error('Unexpected table name in the application schema.')
    await client.query(
      `TRUNCATE ${rows.map((row) => 'salon."' + row.tablename + '"').join(',')} RESTART IDENTITY`,
    )
    for (const { table, rows: records } of referenceRecords) {
      for (const record of records) {
        if (table === 'settings') {
          record.updated_by = null // The old fixture account is removed by the reset.
          record.value = JSON.stringify(record.value)
        }
        const keys = Object.keys(record)
        if (keys.some((key) => !/^[a-z_]+$/.test(key)))
          throw new Error('Unexpected reference column.')
        await client.query(
          `INSERT INTO salon.${table} (${keys.join(',')}) VALUES (${keys.map((_, index) => '$' + (index + 1)).join(',')})`,
          keys.map((key) => record[key]),
        )
      }
    }
    // Business history is reset; reference definitions and migration history survive.
    return rows.length
  })
}

export async function resetDemo(pool, options) {
  return resetFixtureDatabase(pool, { ...options, environment: 'demo' })
}
