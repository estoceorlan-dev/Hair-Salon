import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import { loadEnvironment } from '../src/config/env.js'
import { assertFixtureDatabase, commandPool, transaction } from '../src/db/connection.js'
import { migrate } from '../src/db/migrate.js'
import { employeeSchema } from '../src/modules/auth/auth.schemas.js'

let pool
try {
  const config = loadEnvironment()
  pool = commandPool(config.databaseUrl)
  const client = await pool.connect()
  try { await assertFixtureDatabase(client, config.databaseUrl, 'development', config.nodeEnv) }
  finally { client.release() }
  await migrate(pool)
  if (!config.jwtSecret) {
    const envPath = fileURLToPath(new URL('../.env', import.meta.url))
    const source = await readFile(envPath, 'utf8')
    const line = 'JWT_SECRET=' + randomBytes(48).toString('base64url')
    const updated = /^JWT_SECRET=.*$/m.test(source)
      ? source.replace(/^JWT_SECRET=.*$/m, line)
      : source.trimEnd() + '\n' + line + '\n'
    await writeFile(envPath, updated, { mode: 0o600 })
  }
  const credentialsPath = fileURLToPath(new URL('../../.local-runtime/manager-account.json', import.meta.url))
  await transaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(77203902,3)')
    const count = (await client.query('SELECT count(*)::int AS n FROM salon.users')).rows[0].n
    if (count > 0) {
      console.info('Existing accounts retained; no account or password was changed.')
      return
    }
    const account = existsSync(credentialsPath)
      ? JSON.parse(await readFile(credentialsPath, 'utf8'))
      : { displayName: 'Local Manager', email: 'manager@romel.local', role: 'manager', password: randomBytes(24).toString('base64url') }
    const data = employeeSchema.parse(account)
    if (data.role !== 'manager') throw new Error('The bootstrap account must be a manager.')
    await mkdir(fileURLToPath(new URL('../../.local-runtime/', import.meta.url)), { recursive: true })
    await writeFile(credentialsPath, JSON.stringify(data, null, 2), { mode: 0o600 })
    const id = randomUUID()
    await client.query(`INSERT INTO salon.users(id,role_id,email,display_name,password_hash)
      SELECT $1,id,$2,$3,$4 FROM salon.roles WHERE code='manager'`,
    [id, data.email, data.displayName, await bcrypt.hash(data.password, 12)])
    await client.query(`INSERT INTO salon.employees(user_id,employee_code,display_name,job_kind)
      VALUES($1,$2,$3,'manager')`, [id, 'EMP-' + randomUUID(), data.displayName])
    await client.query(`INSERT INTO salon.activity_logs(actor_id,action,entity_type,entity_reference)
      VALUES($1::uuid,'auth.local_bootstrap','account',$1::text)`, [id])
    console.info('First local manager created. Credentials are in ignored .local-runtime/manager-account.json.')
  })
  console.info('Local authentication configured. Restart the API to load its private JWT secret.')
} catch (error) {
  console.error(error.code ? `Local authentication setup failed (${error.code}). No credentials are logged.`
    : 'Local authentication setup failed. Use the marked local development database and check configuration; no credentials are logged.')
  process.exitCode = 1
} finally { if (pool) await pool.end() }
