import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  assertFixtureDatabase,
  databaseConnectionInfo,
} from '../src/db/connection.js'
import { readMigrations } from '../src/db/migrate.js'
import { referenceDate, resetDemo, fixtureId } from '../src/db/demo-seed.js'

test('fixture guards reject production, remote hosts, and development databases before querying', async () => {
  const neverQuery = {
    async query() {
      throw new Error('Guard should reject before querying')
    },
  }
  for (const [url, nodeEnv] of [
    ['postgresql://localhost/romel_salon_demo', 'production'],
    ['postgresql://example.org/romel_salon_demo', 'development'],
    ['postgresql://localhost/romel_salon_dev', 'development'],
  ])
    await assert.rejects(
      assertFixtureDatabase(neverQuery, url, 'demo', nodeEnv),
      /Fixture operations require/,
    )
})

test('a matching connection name is insufficient without an explicit matching database marker', async () => {
  const client = {
    async query() {
      return {
        rows: [
          {
            application: 'romel-hair-salon',
            environment: 'production',
            database_name: 'romel_salon_demo',
          },
        ],
      }
    },
  }
  await assert.rejects(
    assertFixtureDatabase(
      client,
      'postgresql://localhost/romel_salon_demo',
      'demo',
      'development',
    ),
    /identity/,
  )
  await assert.rejects(
    resetDemo({}, { confirmation: 'another_database' }),
    /explicit confirmation/,
  )
  assert.deepEqual(
    databaseConnectionInfo('postgresql://127.0.0.1:5433/romel_salon_demo'),
    { database: 'romel_salon_demo', local: true },
  )
  assert.throws(
    () =>
      databaseConnectionInfo(
        'postgresql://localhost/romel_salon_demo?host=example.org',
      ),
    /overrides/,
  )
})

test('migration checksums are independent of Windows line endings and duplicate versions fail', async (t) => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'romel-migration-files-'),
  )
  const first = path.join(directory, '001_example.sql')
  const second = path.join(directory, '001_duplicate.sql')
  t.after(async () => {
    await unlink(first)
    await unlink(second).catch(() => {})
    await rmdir(directory)
  })
  await writeFile(first, 'SELECT 1;\n')
  const original = (await readMigrations(directory))[0].checksum
  await writeFile(first, 'SELECT 1;\r\n')
  assert.equal((await readMigrations(directory))[0].checksum, original)
  await writeFile(second, 'SELECT 2;\n')
  await assert.rejects(readMigrations(directory), /Duplicate migration/)
})

test('fixture identifiers repeat deterministically and impossible calendar dates are rejected', () => {
  assert.equal(fixtureId('user:manager'), fixtureId('user:manager'))
  assert.notEqual(fixtureId('user:manager'), fixtureId('user:cashier'))
  assert.equal(referenceDate('2026-10-10'), '2026-10-10')
  for (const value of ['2026-02-30', '2026-99-99', '10/10/2026'])
    assert.throws(() => referenceDate(value), /valid reference date/)
})
