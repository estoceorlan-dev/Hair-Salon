import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import net from 'node:net'
import pg from 'pg'
import dotenv from 'dotenv'
import { migrate } from '../src/db/migrate.js'
import { commandPool, localDatabaseNames } from '../src/db/connection.js'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const runtimePath = path.join(projectRoot, '.local-runtime')
const clusterPath = path.join(runtimePath, 'postgres')
const metadataPath = path.join(runtimePath, 'local-postgres.json')
const envPath = path.join(projectRoot, 'server', '.env')
const adminName = 'romel_local_admin'
const appName = 'romel_app'

function binaryDirectory() {
  const directory =
    process.env.PG_BIN ||
    (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '')
  if (
    !directory ||
    !existsSync(
      path.join(
        directory,
        process.platform === 'win32' ? 'initdb.exe' : 'initdb',
      ),
    )
  ) {
    throw new Error('Set PG_BIN to the installed PostgreSQL binary directory.')
  }
  return directory
}

function run(metadata, command, args, accepted = [0]) {
  const executable = path.join(
    metadata.bin,
    command + (process.platform === 'win32' ? '.exe' : ''),
  )
  const result = spawnSync(executable, args, {
    stdio: 'ignore',
    windowsHide: true,
    timeout: 45000,
  })
  if (!accepted.includes(result.status)) {
    // initdb/pg_ctl do not receive secrets in their command arguments.
    throw new Error(
      `${command} failed; check .local-runtime/postgres.log and the PostgreSQL binary path.`,
    )
  }
  return result.status
}

async function checkPort(port) {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', () =>
      reject(
        new Error(
          `Local port ${port} is occupied. Set ROMEL_PG_PORT before first setup.`,
        ),
      ),
    )
    server.listen(port, '127.0.0.1', resolve)
  })
  await new Promise((resolve) => server.close(resolve))
}

function urlFor(metadata, user, password, database) {
  const url = new URL(`postgresql://127.0.0.1:${metadata.port}/${database}`)
  url.username = user
  url.password = password
  return url.href
}

async function start(metadata) {
  const status = run(metadata, 'pg_ctl', ['status', '-D', clusterPath], [0, 3])
  if (status === 0) return
  await checkPort(metadata.port)
  run(metadata, 'pg_ctl', [
    'start',
    '-w',
    '-t',
    '30',
    '-D',
    clusterPath,
    '-l',
    path.join(runtimePath, 'postgres.log'),
    '-o',
    `-h 127.0.0.1 -p ${metadata.port} -c timezone=Asia/Manila`,
  ])
}

async function writeConfiguration(metadata) {
  const existing = existsSync(envPath)
    ? await readFile(envPath, 'utf8')
    : await readFile(new URL('../.env.example', import.meta.url), 'utf8')
  const parsed = dotenv.parse(existing)
  const entries = {
    DATABASE_URL: urlFor(
      metadata,
      appName,
      metadata.appPassword,
      localDatabaseNames.development,
    ),
    DEMO_DATABASE_URL: urlFor(
      metadata,
      appName,
      metadata.appPassword,
      localDatabaseNames.demo,
    ),
    TEST_DATABASE_URL: urlFor(
      metadata,
      appName,
      metadata.appPassword,
      localDatabaseNames.test,
    ),
  }
  let content = existing
  for (const [key, value] of Object.entries(entries)) {
    if (parsed[key] && parsed[key] !== value)
      throw new Error(
        `Existing ${key} points elsewhere. Keep it and configure that instance, or use a separate checkout for local setup.`,
      )
    const pattern = new RegExp(`^${key}=.*$`, 'm')
    content = pattern.test(content)
      ? content.replace(pattern, `${key}=${value}`)
      : `${content.trimEnd()}\n${key}=${value}\n`
  }
  await writeFile(envPath, content, { mode: 0o600 })
}

async function provision(metadata) {
  const admin = new pg.Client({
    connectionString: urlFor(
      metadata,
      adminName,
      metadata.adminPassword,
      'postgres',
    ),
    connectionTimeoutMillis: 5000,
  })
  await admin.connect()
  try {
    const role = await admin.query(
      'SELECT 1 FROM pg_roles WHERE rolname = $1',
      [appName],
    )
    if (!role.rowCount) {
      // Names are constants, passwords are generated base64url strings, never user SQL.
      await admin.query(
        `CREATE ROLE ${appName} LOGIN PASSWORD '${metadata.appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
      )
    }
    for (const name of Object.values(localDatabaseNames)) {
      const existing = await admin.query(
        'SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1',
        [name],
      )
      if (existing.rowCount && existing.rows[0].owner !== appName)
        throw new Error(`Refusing to modify ${name}: unexpected owner.`)
      if (!existing.rowCount)
        await admin.query(
          `CREATE DATABASE ${name} OWNER ${appName} TEMPLATE template0 ENCODING 'UTF8'`,
        )
    }
  } finally {
    await admin.end()
  }
  for (const [environment, name] of Object.entries(localDatabaseNames)) {
    const pool = commandPool(
      urlFor(metadata, appName, metadata.appPassword, name),
    )
    try {
      const applied = await migrate(pool)
      await pool.query(
        'UPDATE salon.database_identity SET environment=$1 WHERE singleton AND database_name=$2',
        [environment, name],
      )
      console.info(
        `${name}: ${applied.length} migrations applied; ${environment} identity verified.`,
      )
    } finally {
      await pool.end()
    }
  }
}

try {
  const action = process.argv[2]
  if (!['setup', 'start', 'stop'].includes(action))
    throw new Error('Choose setup, start, or stop.')
  let metadata
  if (existsSync(metadataPath)) {
    metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
    if (metadata.clusterPath !== clusterPath)
      throw new Error(
        'Local cluster metadata belongs to a different workspace.',
      )
  } else {
    if (action !== 'setup') throw new Error('Run npm run db:local:setup first.')
    const existing = existsSync(envPath)
      ? dotenv.parse(await readFile(envPath, 'utf8'))
      : {}
    if (
      existing.DATABASE_URL ||
      existing.DEMO_DATABASE_URL ||
      existing.TEST_DATABASE_URL
    )
      throw new Error(
        'Existing database URLs are configured. Use them rather than creating a second instance in this checkout.',
      )
    const port = Number(process.env.ROMEL_PG_PORT || 5433)
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new Error('ROMEL_PG_PORT must be a valid unprivileged port.')
    await checkPort(port)
    if (existsSync(clusterPath))
      throw new Error(
        'An unrecognized local cluster directory exists; inspect it manually before setup.',
      )
    metadata = {
      clusterPath,
      bin: binaryDirectory(),
      port,
      adminPassword: randomBytes(32).toString('base64url'),
      appPassword: randomBytes(32).toString('base64url'),
    }
    await mkdir(runtimePath, { recursive: true })
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), {
      mode: 0o600,
    })
  }
  if (action === 'stop') {
    if (run(metadata, 'pg_ctl', ['status', '-D', clusterPath], [0, 3]) === 0)
      run(metadata, 'pg_ctl', [
        'stop',
        '-w',
        '-t',
        '30',
        '-m',
        'fast',
        '-D',
        clusterPath,
      ])
    console.info('Workspace PostgreSQL stopped.')
  } else {
    if (!existsSync(path.join(clusterPath, 'PG_VERSION'))) {
      if (action !== 'setup')
        throw new Error('Run local setup to initialize this cluster.')
      const passwordPath = path.join(runtimePath, 'bootstrap-password.tmp')
      await writeFile(passwordPath, metadata.adminPassword + '\n', {
        mode: 0o600,
      })
      try {
        run(metadata, 'initdb', [
          '-D',
          clusterPath,
          '--username=' + adminName,
          '--pwfile=' + passwordPath,
          '--auth-host=scram-sha-256',
          '--auth-local=scram-sha-256',
          '--encoding=UTF8',
          '--locale=C',
        ])
      } finally {
        await unlink(passwordPath)
      }
    }
    await start(metadata)
    if (action === 'setup') {
      await writeConfiguration(metadata)
      await provision(metadata)
    }
    console.info(
      `Workspace PostgreSQL is running on 127.0.0.1:${metadata.port}. Credentials are stored only in ignored local files.`,
    )
  }
} catch (error) {
  console.error(
    error.code
      ? `Local database setup failed (${error.code}). Check the local log and configuration.`
      : error.message,
  )
  process.exitCode = 1
}
