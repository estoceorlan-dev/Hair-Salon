import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { loadEnvironment } from '../src/config/env.js'
import {
  assertFixtureDatabase,
  commandPool,
  transaction,
} from '../src/db/connection.js'
import { migrate, readMigrations } from '../src/db/migrate.js'
import {
  demoRoles,
  fixtureId,
  resetFixtureDatabase,
  seedFixtures,
} from '../src/db/demo-seed.js'
import { createDatabase } from '../src/db/pool.js'

const config = loadEnvironment()

test('PostgreSQL schema, fixtures, and concurrency', async (t) => {
  assert.ok(
    config.testDatabaseUrl,
    'Run npm run db:local:setup or configure the dedicated TEST_DATABASE_URL first.',
  )
  const pool = commandPool(config.testDatabaseUrl)
  t.after(() => pool.end())
  await migrate(pool)
  const inspection = await pool.connect()
  try {
    await assertFixtureDatabase(
      inspection,
      config.testDatabaseUrl,
      'test',
      config.nodeEnv,
    )
  } finally {
    inspection.release()
  }
  const fixtureOptions = {
    connectionString: config.testDatabaseUrl,
    nodeEnv: config.nodeEnv,
    environment: 'test',
    date: '2026-10-12',
    passwords: Object.fromEntries(
      demoRoles.map((role) => [role, randomBytes(18).toString('base64url')]),
    ),
  }
  await resetFixtureDatabase(pool, {
    ...fixtureOptions,
    confirmation: 'romel_salon_test',
  })
  await seedFixtures(pool, fixtureOptions)

  await t.test(
    'migration reruns are no-ops; failed migration rolls back DDL and history; edits are refused',
    async () => {
      assert.deepEqual(await migrate(pool), [])
      const files = await readMigrations()
      await assert.rejects(
        migrate(pool, [
          ...files,
          {
            version: '999',
            name: '999_failure.sql',
            checksum: 'test',
            sql: 'CREATE TABLE salon.rollback_probe(id integer); SELECT missing_column;',
          },
        ]),
        (error) => error.code === '42703',
      )
      assert.equal(
        (
          await pool.query(
            "SELECT to_regclass('salon.rollback_probe') AS table_name",
          )
        ).rows[0].table_name,
        null,
      )
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM public.schema_migrations WHERE version='999'",
          )
        ).rows[0].count,
        0,
      )
      await assert.rejects(
        migrate(
          pool,
          files.map((file, index) =>
            index === 0 ? { ...file, checksum: 'edited' } : file,
          ),
        ),
        /differs from the repository/,
      )
    },
  )

  await t.test(
    'fixtures rerun without duplicates; definitions and provider flags remain unset',
    async () => {
      assert.equal((await seedFixtures(pool, fixtureOptions)).inserted, false)
      const counts =
        await pool.query(`SELECT (SELECT count(*)::int FROM salon.users) AS users,
      (SELECT count(*)::int FROM salon.sales) AS sales,(SELECT count(*)::int FROM salon.payments) AS payments,
      (SELECT count(*)::int FROM salon.commission_entries WHERE amount_cents IS NULL) AS undefined_commissions`)
      assert.deepEqual(counts.rows[0], {
        users: 5,
        sales: 2,
        payments: 2,
        undefined_commissions: 2,
      })
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int AS count FROM salon.payment_methods WHERE enabled',
          )
        ).rows[0].count,
        0,
      )
      assert.equal(
        (
          await pool.query(
            `SELECT count(*)::int AS count FROM salon.role_permissions rp
             JOIN salon.roles r ON r.id=rp.role_id JOIN salon.permissions p ON p.id=rp.permission_id
             WHERE r.code<>'manager' AND p.code IN ('inventory.manage','settings.manage','reports.view','employees.manage')`,
          )
        ).rows[0].count,
        0,
      )
      assert.equal(
        (
          await pool.query(
            "SELECT value FROM salon.settings WHERE key='tax_policy'",
          )
        ).rows[0].value,
        null,
      )
      assert.equal(
        (
          await pool.query(
            'SELECT sum(total_cents)::text AS total FROM salon.sales',
          )
        ).rows[0].total,
        '85000',
      )
    },
  )

  await t.test(
    'foreign keys and unique checkout keys reject inconsistent records',
    async () => {
      await assert.rejects(
        pool.query(
          "INSERT INTO salon.customers(display_name,preferred_employee_id) VALUES ('Invalid', $1)",
          [randomUUID()],
        ),
        (error) => error.code === '23503',
      )
      await assert.rejects(
        pool.query(
          `INSERT INTO salon.sales(idempotency_key,cashier_id) SELECT idempotency_key,cashier_id FROM salon.sales LIMIT 1`,
        ),
        (error) => error.code === '23505',
      )
      await assert.rejects(
        pool.query(
          "UPDATE salon.payment_methods SET enabled=true WHERE code='gcash'",
        ),
        (error) => error.code === '23514',
      )
    },
  )

  await t.test(
    'two concurrent requests cannot reserve the same staff/time; adjacent ranges are allowed',
    async () => {
      const first = await pool.connect()
      const second = await pool.connect()
      const sql = `INSERT INTO salon.appointments(id,booking_reference,customer_id,employee_id,service_id,starts_at,ends_at,service_name_snapshot)
      VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,'Concurrent fixture')`
      const values = [
        randomUUID(),
        randomUUID(),
        fixtureId('customer:Alex Sample'),
        fixtureId('employee:stylist'),
        fixtureId('service:haircut'),
        '2050-01-03T10:00:00+08:00',
        '2050-01-03T11:00:00+08:00',
      ]
      try {
        await first.query('BEGIN')
        await second.query('BEGIN')
        await first.query(sql, values)
        const collision = second
          .query(sql, [randomUUID(), randomUUID(), ...values.slice(2)])
          .then(
            () => null,
            (error) => error.code,
          )
        await first.query('COMMIT')
        assert.equal(await collision, '23P01')
        await second.query('ROLLBACK')
        const adjacent = [
          randomUUID(),
          randomUUID(),
          ...values.slice(2, 5),
          '2050-01-03T11:00:00+08:00',
          '2050-01-03T11:45:00+08:00',
        ]
        await first.query('BEGIN')
        await first.query(sql, adjacent)
        await first.query('DELETE FROM salon.appointments WHERE id=$1', [
          adjacent[0],
        ])
        await first.query('COMMIT')
      } finally {
        await first.query('ROLLBACK')
        await second.query('ROLLBACK')
        await first.query('DELETE FROM salon.appointments WHERE id=$1', [
          values[0],
        ])
        first.release()
        second.release()
      }
    },
  )

  await t.test(
    'last-unit concurrent stock deductions cannot oversell and duplicate retries do not re-post',
    async () => {
      const product = randomUUID()
      await pool.query(
        "INSERT INTO salon.products(id,sku,name,category,stock_unit) VALUES ($1,$2,'Concurrency product','Test','unit')",
        [product, randomUUID()],
      )
      const sql = `INSERT INTO salon.inventory_movements(product_id,quantity_delta,source_type,source_reference,actor_id,reason) VALUES ($1,$2,'adjustment',$3,$4,'Integration test')`
      const actor = fixtureId('user:manager')
      await pool.query(sql, [product, 1, 'opening', actor])
      const first = await pool.connect()
      const second = await pool.connect()
      try {
        await first.query('BEGIN')
        await second.query('BEGIN')
        await first.query(sql, [product, -1, 'first', actor])
        const collision = second
          .query(sql, [product, -1, 'second', actor])
          .then(
            () => null,
            (error) => error.code,
          )
        await first.query('COMMIT')
        assert.equal(await collision, '23514')
        await second.query('ROLLBACK')
      } finally {
        await first.query('ROLLBACK')
        await second.query('ROLLBACK')
        first.release()
        second.release()
      }
      assert.equal(
        (
          await pool.query(
            'SELECT quantity::text FROM salon.stock_balances WHERE product_id=$1',
            [product],
          )
        ).rows[0].quantity,
        '0.000',
      )
      await pool.query(sql + ' ON CONFLICT DO NOTHING', [
        product,
        -1,
        'first',
        actor,
      ])
      assert.equal(
        (
          await pool.query(
            'SELECT quantity::text FROM salon.stock_balances WHERE product_id=$1',
            [product],
          )
        ).rows[0].quantity,
        '0.000',
      )
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int AS count FROM salon.inventory_movements WHERE product_id=$1',
            [product],
          )
        ).rows[0].count,
        2,
      )
    },
  )

  await t.test(
    'historical movements/logs and finalized sale item snapshots cannot be overwritten',
    async () => {
      for (const query of [
        'UPDATE salon.inventory_movements SET quantity_delta=1',
        'DELETE FROM salon.activity_logs',
        'UPDATE salon.stock_balances SET quantity=999',
        "UPDATE salon.sale_items SET description_snapshot='Changed'",
      ])
        await assert.rejects(
          pool.query(query),
          (error) => error.code === '55000',
        )
      await transaction(pool, async (client) => {
        const id = fixtureId('service:haircut')
        await client.query(
          'UPDATE salon.services SET price_cents=99900 WHERE id=$1',
          [id],
        )
        assert.equal(
          (
            await client.query(
              'SELECT unit_price_cents::text FROM salon.sale_items WHERE service_id=$1',
              [id],
            )
          ).rows[0].unit_price_cents,
          '35000',
        )
        await client.query(
          'UPDATE salon.services SET price_cents=35000 WHERE id=$1',
          [id],
        )
      })
    },
  )

  await t.test(
    'payroll cannot claim another employee earning or include the same earning twice',
    async () => {
      await assert.rejects(
        pool.query(
          'INSERT INTO salon.payroll_commissions(payroll_item_id,employee_id,commission_id) VALUES ($1,$2,$3)',
          [
            fixtureId('payroll-item:beautician'),
            fixtureId('employee:beautician'),
            fixtureId('commission:history-haircut'),
          ],
        ),
        (error) => error.code === '23514',
      )
      await transaction(pool, async (client) => {
        const values = [
          fixtureId('payroll-item:stylist'),
          fixtureId('employee:stylist'),
          fixtureId('commission:history-haircut'),
        ]
        await client.query(
          'INSERT INTO salon.payroll_commissions(payroll_item_id,employee_id,commission_id) VALUES ($1,$2,$3)',
          values,
        )
        await client.query('SAVEPOINT duplicate_earning')
        await assert.rejects(
          client.query(
            'INSERT INTO salon.payroll_commissions(payroll_item_id,employee_id,commission_id) VALUES ($1,$2,$3)',
            values,
          ),
          (error) => error.code === '23505',
        )
        await client.query('ROLLBACK TO SAVEPOINT duplicate_earning')
        await client.query(
          'DELETE FROM salon.payroll_commissions WHERE commission_id=$1',
          [values[2]],
        )
      })
    },
  )

  await t.test('actual PostgreSQL connection reports ready', async () => {
    const database = createDatabase({
      ...config,
      databaseUrl: config.testDatabaseUrl,
    })
    try {
      assert.equal((await database.checkReadiness()).status, 'ready')
    } finally {
      await database.close()
    }
  })
})
