import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { loadEnvironment } from '../src/config/env.js'
import { assertFixtureDatabase, commandPool } from '../src/db/connection.js'
import { migrate } from '../src/db/migrate.js'
import { demoRoles, resetDemo, seedFixtures } from '../src/db/demo-seed.js'

const argumentsList = process.argv.slice(2)
const command = argumentsList.shift()
function parseOptions() {
  return Object.fromEntries(
    argumentsList.map((argument) => {
      const match = /^--(target|date|confirm)=(.+)$/.exec(argument)
      if (!match)
        throw new Error(
          'Use --target=development|demo|test, --date=YYYY-MM-DD, or --confirm=romel_salon_demo.',
        )
      return [match[1], match[2]]
    }),
  )
}

let pool
try {
  const options = parseOptions()
  if (!['migrate', 'status', 'seed-demo', 'reset-demo'].includes(command))
    throw new Error('Choose migrate, status, seed-demo, or reset-demo.')
  const config = loadEnvironment()
  const target =
    command === 'seed-demo' || command === 'reset-demo'
      ? 'demo'
      : options.target || 'development'
  if (!['development', 'demo', 'test'].includes(target))
    throw new Error('Choose a known database target.')
  if (
    (command === 'seed-demo' || command === 'reset-demo') &&
    options.target &&
    options.target !== 'demo'
  )
    throw new Error('Demo tools cannot target another environment.')
  const connectionString = {
    development: config.databaseUrl,
    demo: config.demoDatabaseUrl,
    test: config.testDatabaseUrl,
  }[target]
  pool = commandPool(connectionString)
  if (command === 'migrate') {
    const applied = await migrate(pool)
    console.info(
      `${target}: ${applied.length ? applied.join(', ') : 'all migrations already applied'}`,
    )
  } else if (command === 'status') {
    const { rows } = await pool.query(
      'SELECT version,name,applied_at FROM public.schema_migrations ORDER BY version',
    )
    console.info(`${target}: ${rows.map((row) => row.name).join(', ')}`)
  } else if (command === 'seed-demo') {
    const inspection = await pool.connect()
    try {
      await assertFixtureDatabase(
        inspection,
        connectionString,
        'demo',
        config.nodeEnv,
      )
    } finally {
      inspection.release()
    }
    const credentialsPath = fileURLToPath(
      new URL('../../.local-runtime/demo-accounts.json', import.meta.url),
    )
    let accounts
    if (existsSync(credentialsPath))
      accounts = JSON.parse(await readFile(credentialsPath, 'utf8'))
    else {
      accounts = Object.fromEntries(
        demoRoles.map((role) => [
          role,
          {
            email: `${role}@demo.romel.invalid`,
            password: randomBytes(18).toString('base64url'),
          },
        ]),
      )
      await mkdir(
        fileURLToPath(new URL('../../.local-runtime/', import.meta.url)),
        { recursive: true },
      )
      await writeFile(credentialsPath, JSON.stringify(accounts, null, 2), {
        mode: 0o600,
      })
    }
    const result = await seedFixtures(pool, {
      connectionString,
      nodeEnv: config.nodeEnv,
      date: options.date,
      passwords: Object.fromEntries(
        demoRoles.map((role) => [role, accounts[role]?.password]),
      ),
    })
    console.info(
      `Demo fixtures ${result.inserted ? 'loaded' : 'already present'}; reference date ${result.referenceDate}.`,
    )
    console.info(
      'Future demo account credentials are in ignored .local-runtime/demo-accounts.json; authentication remains Phase 3.',
    )
  } else if (command === 'reset-demo') {
    const count = await resetDemo(pool, {
      connectionString,
      nodeEnv: config.nodeEnv,
      confirmation: options.confirm,
    })
    console.info(
      `Reset ${count} demo data tables. Migrations and reference settings were retained. Run db:seed:demo to reload fixtures.`,
    )
  } else throw new Error('Choose migrate, status, seed-demo, or reset-demo.')
} catch (error) {
  console.error(
    error.code
      ? `Database command failed (${error.code}). Verify the connection and schema; credentials are not logged.`
      : error.message,
  )
  process.exitCode = 1
} finally {
  if (pool) await pool.end()
}
