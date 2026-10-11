import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { randomBytes, randomUUID } from 'node:crypto'
import { transaction } from '../../db/connection.js'
import { HttpError } from '../../middleware/errors.js'

export const sessionCookie = 'romel_session'
const issuer = 'romel-hair-salon'
const audience = 'romel-web'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const invalidLogin = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
const invalidSession = () => new HttpError(401, 'SESSION_EXPIRED', 'Your session ended. Please sign in again.')
const userSql = `SELECT u.id,u.email,u.display_name,u.password_hash,u.is_active,u.is_demo,
  u.token_version,r.code AS role,r.name AS role_name,
  e.id AS employee_id,e.is_active AS employee_active,
  c.id AS customer_id,c.is_active AS customer_active,
  ARRAY(SELECT p.code FROM salon.role_permissions rp JOIN salon.permissions p
    ON p.id=rp.permission_id WHERE rp.role_id=r.id ORDER BY p.code) AS permissions
  FROM salon.users u JOIN salon.roles r ON r.id=u.role_id
  LEFT JOIN salon.employees e ON e.user_id=u.id
  LEFT JOIN salon.customers c ON c.user_id=u.id`

export function publicUser(row) {
  return {
    id: row.id, email: row.email, displayName: row.display_name,
    role: row.role, roleName: row.role_name, permissions: row.permissions,
    employeeId: row.employee_id, customerId: row.customer_id,
  }
}

export function cookieOptions(config) {
  return { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/api' }
}

export function createAuthService(database, config) {
  // A process-local random dummy hash makes unknown emails run the same bcrypt cost.
  const dummyHash = bcrypt.hash(randomBytes(24).toString('base64url'), 12)
  const eligible = (user) => user?.is_active &&
    !(config.nodeEnv === 'production' && user.is_demo) &&
    (user.role === 'customer' ? user.customer_active === true : user.employee_active === true)
  function pool() {
    if (!database.pool || !config.jwtSecret)
      throw new HttpError(503, 'AUTH_NOT_CONFIGURED', 'Account access is not configured. Complete the local authentication setup.')
    return database.pool
  }
  async function audit(client, actorId, action, reference) {
    await client.query(`INSERT INTO salon.activity_logs(actor_id,action,entity_type,entity_reference)
      VALUES($1,$2,'account',$3)`, [actorId, action, reference])
  }
  function duplicate(error) {
    if (error.code === '23505')
      return new HttpError(409, 'ACCOUNT_CONFLICT', 'This email is already registered.')
    return error
  }
  async function issue(client, row) {
    const sid = randomUUID()
    const seconds = config.sessionTtlSeconds
    const token = jwt.sign({ sid, v: row.token_version }, config.jwtSecret, {
      algorithm: 'HS256', issuer, audience, subject: row.id, expiresIn: seconds,
    })
    const expiresAt = new Date(jwt.decode(token).exp * 1000)
    await client.query(`INSERT INTO salon.auth_sessions(id,user_id,token_version,expires_at)
      VALUES($1,$2,$3,$4)`, [sid, row.id, row.token_version, expiresAt])
    return { token, user: publicUser(row), expiresAt: expiresAt.toISOString() }
  }
  async function insertAccount(client, data, role, hash) {
    const { rows } = await client.query(`INSERT INTO salon.users(role_id,email,display_name,password_hash)
      SELECT id,$2,$3,$4 FROM salon.roles WHERE code=$1 RETURNING id`,
    [role, data.email, data.displayName, hash])
    const id = rows[0].id
    if (role === 'customer') {
      await client.query(`INSERT INTO salon.customers(user_id,display_name,email,phone)
        VALUES($1,$2,$3,$4)`, [id, data.displayName, data.email, data.phone || null])
    } else {
      await client.query(`INSERT INTO salon.employees(user_id,employee_code,display_name,job_kind)
        VALUES($1,$2,$3,$4)`, [id, 'EMP-' + randomUUID(), data.displayName, role])
    }
    return (await client.query(userSql + ' WHERE u.id=$1', [id])).rows[0]
  }
  return {
    async login(data) {
      const db = pool()
      const row = (await db.query(userSql + ' WHERE u.email=$1', [data.email])).rows[0]
      const matches = await bcrypt.compare(data.password, row?.password_hash || await dummyHash)
      if (!matches || !eligible(row)) throw invalidLogin()
      return transaction(db, async (client) => {
        const fresh = (await client.query(userSql + ' WHERE u.id=$1 FOR UPDATE OF u', [row.id])).rows[0]
        if (!eligible(fresh) || fresh.password_hash !== row.password_hash) throw invalidLogin()
        const result = await issue(client, fresh)
        await audit(client, fresh.id, 'auth.login', fresh.id)
        return result
      })
    },
    async register(data) {
      const db = pool()
      const hash = await bcrypt.hash(data.password, 12)
      try {
        return await transaction(db, async (client) => {
          const row = await insertAccount(client, data, 'customer', hash)
          await audit(client, row.id, 'auth.register', row.id)
          return issue(client, row)
        })
      } catch (error) { throw duplicate(error) }
    },
    async authenticate(token) {
      if (!token) throw new HttpError(401, 'AUTH_REQUIRED', 'Please sign in to continue.')
      const db = pool()
      let claims
      try {
        claims = jwt.verify(token, config.jwtSecret, {
          algorithms: ['HS256'], issuer, audience, maxAge: config.sessionTtlSeconds,
        })
        if (!uuidPattern.test(claims.sub) || !uuidPattern.test(claims.sid) || !Number.isInteger(claims.v) || claims.v < 0 ||
          !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.exp <= claims.iat ||
          claims.exp - claims.iat > config.sessionTtlSeconds || claims.iat > Math.floor(Date.now() / 1000)) throw invalidSession()
      } catch { throw invalidSession() }
      const row = (await db.query(userSql + ` JOIN salon.auth_sessions s ON s.user_id=u.id
        WHERE u.id=$1 AND s.id=$2 AND s.revoked_at IS NULL AND s.expires_at>now()
        AND s.token_version=u.token_version AND u.token_version=$3`,
      [claims.sub, claims.sid, claims.v])).rows[0]
      if (!eligible(row)) throw invalidSession()
      return { user: publicUser(row), sessionId: claims.sid, expiresAt: new Date(claims.exp * 1000).toISOString() }
    },
    async logout(auth) {
      await transaction(pool(), async (client) => {
        await client.query('UPDATE salon.auth_sessions SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL', [auth.sessionId])
        await audit(client, auth.user.id, 'auth.logout', auth.user.id)
      })
    },
    async changePassword(auth, data) {
      await transaction(pool(), async (client) => {
        const row = (await client.query('SELECT password_hash FROM salon.users WHERE id=$1 FOR UPDATE', [auth.user.id])).rows[0]
        if (!await bcrypt.compare(data.currentPassword, row.password_hash)) throw invalidLogin()
        const hash = await bcrypt.hash(data.newPassword, 12)
        await client.query('UPDATE salon.users SET password_hash=$2,token_version=token_version+1,updated_at=now() WHERE id=$1', [auth.user.id, hash])
        await client.query('UPDATE salon.auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [auth.user.id])
        await audit(client, auth.user.id, 'auth.password_changed', auth.user.id)
      })
    },
    async employees(query) {
      const sql = userSql + ` WHERE r.code<>'customer' AND (u.display_name ILIKE $1 OR u.email ILIKE $1)
        AND ($2='all' OR (u.is_active AND e.is_active)=($2='active'))`
      const params = ['%' + query.q + '%', query.status]
      const total = (await pool().query(`SELECT count(*)::int AS total FROM (${sql}) accounts`, params)).rows[0].total
      const rows = (await pool().query(sql + ' ORDER BY lower(u.display_name),u.id LIMIT $3 OFFSET $4',
        [...params, query.pageSize, (query.page - 1) * query.pageSize])).rows
      return { employees: rows.map((row) => ({ ...publicUser(row), isActive: row.is_active && row.employee_active })),
        total, page: query.page, pageSize: query.pageSize }
    },
    async createEmployee(actor, data) {
      const hash = await bcrypt.hash(data.password, 12)
      try {
        return await transaction(pool(), async (client) => {
          const row = await insertAccount(client, data, data.role, hash)
          await audit(client, actor.id, 'auth.employee_created', row.id)
          return { ...publicUser(row), isActive: true }
        })
      } catch (error) { throw duplicate(error) }
    },
    async updateEmployee(actor, id, data) {
      const hash = data.password ? await bcrypt.hash(data.password, 12) : null
      try {
        return await transaction(pool(), async (client) => {
          // Serialize changes so two managers cannot simultaneously disable the last two.
          await client.query('SELECT pg_advisory_xact_lock(77203902,3)')
          const row = (await client.query(userSql + ' WHERE u.id=$1 FOR UPDATE OF u', [id])).rows[0]
          if (!row || row.role === 'customer') throw new HttpError(404, 'NOT_FOUND', 'Employee account not found.')
          const role = data.role ?? row.role
          const active = data.isActive ?? row.is_active
          if (row.role === 'manager' && row.is_active && (!active || role !== 'manager')) {
            const count = (await client.query(`SELECT count(*)::int AS n FROM salon.users u
              JOIN salon.roles r ON r.id=u.role_id JOIN salon.employees e ON e.user_id=u.id
              WHERE r.code='manager' AND u.is_active AND e.is_active`)).rows[0].n
            if (count <= 1) throw new HttpError(409, 'LAST_MANAGER', 'Keep at least one active manager account.')
          }
          await client.query(`UPDATE salon.users SET display_name=$2,email=$3,role_id=(SELECT id FROM salon.roles WHERE code=$4),
            is_active=$5,password_hash=COALESCE($6,password_hash),token_version=token_version+1,updated_at=now() WHERE id=$1`,
          [id, data.displayName ?? row.display_name, data.email ?? row.email, role, active, hash])
          await client.query('UPDATE salon.employees SET display_name=$2,job_kind=$3,is_active=$4,updated_at=now() WHERE user_id=$1',
            [id, data.displayName ?? row.display_name, role, active])
          await client.query('UPDATE salon.auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [id])
          await audit(client, actor.id, 'auth.employee_updated', id)
          const updated = (await client.query(userSql + ' WHERE u.id=$1', [id])).rows[0]
          return { ...publicUser(updated), isActive: updated.is_active && updated.employee_active }
        })
      } catch (error) { throw duplicate(error) }
    },
  }
}
