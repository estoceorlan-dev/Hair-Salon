import pg from 'pg'

export const localDatabaseNames = Object.freeze({
  development: 'romel_salon_dev',
  demo: 'romel_salon_demo',
  test: 'romel_salon_test',
})

export function databaseConnectionInfo(connectionString) {
  if (!connectionString)
    throw new Error('Configure the selected database URL first.')
  const url = new URL(connectionString)
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('Use a PostgreSQL URL.')
  for (const key of url.searchParams.keys()) {
    if (
      ['host', 'hostaddr', 'port', 'database', 'dbname', 'user'].includes(
        key.toLowerCase(),
      )
    ) {
      throw new Error(
        'Database tools do not accept connection-target overrides in URL parameters.',
      )
    }
  }
  return {
    database: decodeURIComponent(url.pathname.slice(1)),
    local: ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
  }
}

export function commandPool(connectionString) {
  databaseConnectionInfo(connectionString)
  return new pg.Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 5000,
    application_name: 'romel-database-tools',
  })
}

export async function transaction(pool, work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function assertFixtureDatabase(
  client,
  connectionString,
  environment,
  nodeEnv,
) {
  const info = databaseConnectionInfo(connectionString)
  if (
    nodeEnv === 'production' ||
    !info.local ||
    info.database !== localDatabaseNames[environment]
  ) {
    throw new Error(
      `Fixture operations require the dedicated local ${environment} database.`,
    )
  }
  const { rows } = await client.query(
    'SELECT application, environment, database_name, current_database() AS connected_name FROM salon.database_identity WHERE singleton',
  )
  if (
    rows[0]?.application !== 'romel-hair-salon' ||
    rows[0]?.environment !== environment ||
    rows[0]?.database_name !== info.database ||
    rows[0]?.connected_name !== info.database
  ) {
    throw new Error('Database identity does not permit fixture operations.')
  }
}
