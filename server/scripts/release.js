import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import { commandPool, transaction } from '../src/db/connection.js'
import { migrate } from '../src/db/migrate.js'
import { employeeSchema } from '../src/modules/auth/auth.schemas.js'

// Release tooling runs outside the web process with a direct, session-affine connection.
const command = process.argv[2]
let pool
try {
  if (!['migrate', 'first-manager'].includes(command)) {
    throw new Error('Choose migrate or first-manager.')
  }
  const connection = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
  if (!connection) throw new Error('Set DATABASE_URL_UNPOOLED or DIRECT_DATABASE_URL for this release.')
  const url = new URL(connection)
  if (url.hostname.split('.')[0].endsWith('-pooler')) throw new Error('Select the direct Neon connection for release commands.')
  pool = commandPool(url.href)
  if (command === 'migrate') {
    const applied = await migrate(pool)
    console.info(applied.length ? `Applied ${applied.join(', ')}` : 'All migrations already applied.')
  } else {
    await transaction(pool, async client => {
      await client.query('SELECT pg_advisory_xact_lock(77203902,3)')
      const existing = await client.query(`SELECT 1 FROM salon.users u
        JOIN salon.roles r ON r.id=u.role_id WHERE r.code='manager' AND NOT u.is_demo LIMIT 1`)
      if (existing.rowCount) {
        console.info('A manager already exists.')
        return
      }
      const input = employeeSchema.safeParse({
        role: 'manager', displayName: process.env.MANAGER_NAME,
        email: process.env.MANAGER_EMAIL, password: process.env.MANAGER_PASSWORD,
      })
      if (!input.success) throw new Error('Supply MANAGER_NAME, MANAGER_EMAIL and a password of at least 12 characters and at most 72 UTF-8 bytes.')
      const { displayName, email, password } = input.data
      const hash = await bcrypt.hash(password, 12)
      const { rows: [user] } = await client.query(`INSERT INTO salon.users(role_id,email,display_name,password_hash)
        SELECT id,$1,$2,$3 FROM salon.roles WHERE code='manager' RETURNING id`, [email, displayName, hash])
      await client.query(`INSERT INTO salon.employees(user_id,employee_code,display_name,job_kind)
        VALUES($1,$2,$3,'manager')`, [user.id, 'EMP-' + randomUUID(), displayName])
      await client.query(`INSERT INTO salon.activity_logs(actor_id,action,entity_type,entity_reference)
        VALUES($1::uuid,'auth.first_manager','account',$1::text)`, [user.id])
      console.info('First manager created.')
    })
  }
} catch (error) {
  console.error(error.code ? `Release command failed (${error.code}). Check the connection and schema.` : error.message)
  process.exitCode = 1
} finally {
  await pool?.end()
}
