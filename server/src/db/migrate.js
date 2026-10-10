import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import path from 'node:path'

const migrationsDirectory = fileURLToPath(
  new URL('../../migrations/', import.meta.url),
)
export const databaseToolLock = [77203902, 2]

export async function readMigrations(directory = migrationsDirectory) {
  const files = (await readdir(directory))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
  const versions = new Set()
  return Promise.all(
    files.map(async (name) => {
      const version = name.slice(0, 3)
      if (versions.has(version))
        throw new Error(`Duplicate migration version ${version}.`)
      versions.add(version)
      const sql = (await readFile(path.join(directory, name), 'utf8')).replace(
        /\r\n/g,
        '\n',
      )
      return {
        version,
        name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      }
    }),
  )
}

export async function migrate(pool, migrations) {
  const files = migrations ?? (await readMigrations())
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', databaseToolLock)
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version text PRIMARY KEY, name text NOT NULL, checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now())`)
    const { rows } = await client.query(
      'SELECT version, name, checksum FROM public.schema_migrations ORDER BY version',
    )
    for (const recorded of rows) {
      const file = files.find((entry) => entry.version === recorded.version)
      if (
        !file ||
        file.name !== recorded.name ||
        file.checksum !== recorded.checksum
      ) {
        throw new Error(
          `Applied migration ${recorded.version} differs from the repository. Add a new migration instead of editing history.`,
        )
      }
    }
    const applied = []
    for (const file of files) {
      if (rows.some((entry) => entry.version === file.version)) continue
      if (rows.some((entry) => entry.version > file.version))
        throw new Error(
          'New migrations must follow the existing version history.',
        )
      await client.query('BEGIN')
      try {
        await client.query(file.sql)
        await client.query(
          'INSERT INTO public.schema_migrations(version,name,checksum) VALUES ($1,$2,$3)',
          [file.version, file.name, file.checksum],
        )
        await client.query('COMMIT')
        applied.push(file.name)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
    return applied
  } finally {
    await client
      .query('SELECT pg_advisory_unlock($1, $2)', databaseToolLock)
      .catch(() => {})
    client.release()
  }
}
