import pg from 'pg'

export function createDatabase(config, logger = console) {
  const pool = config.databaseUrl
    ? new pg.Pool({
        connectionString: config.databaseUrl,
        max: 5,
        connectionTimeoutMillis: config.dbConnectionTimeoutMs,
        query_timeout: config.dbConnectionTimeoutMs,
        // Neon's transaction pooler rejects statement_timeout in the startup packet.
        statement_timeout: new URL(config.databaseUrl).hostname.split('.')[0].endsWith('-pooler')
          ? undefined
          : config.dbConnectionTimeoutMs,
        idleTimeoutMillis: 10000,
      })
    : null

  pool?.on('error', () =>
    logger.error(JSON.stringify({ event: 'database_pool_error' })),
  )

  return {
    pool,
    async checkReadiness() {
      if (!pool) return { status: 'not_configured' }
      try {
        await pool.query('SELECT 1')
        return { status: 'ready' }
      } catch {
        return { status: 'unavailable' }
      }
    },
    async close() {
      if (pool) await pool.end()
    },
  }
}
