import { loadEnvironment } from './config/env.js'
import { createDatabase } from './db/pool.js'
import { createApp } from './app.js'

try {
  const config = loadEnvironment()
  const database = createDatabase(config)
  const app = createApp({ database })
  const server = app.listen(config.port, config.host, () => {
    console.info(`Romel API listening at http://${config.host}:${config.port}`)
    if (!config.databaseUrl)
      console.info(
        'Database connection pending Phase 2; /api/health returns 503 until configured.',
      )
  })
  server.on('error', async (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Port ${config.port} is already in use.`
        : 'Unable to start the API listener.',
    )
    await database.close()
    process.exitCode = 1
  })

  let stopping = false
  const shutdown = () => {
    if (stopping) return
    stopping = true
    const timeout = setTimeout(() => process.exit(1), 5000)
    timeout.unref()
    server.close(async () => {
      await database.close()
      clearTimeout(timeout)
    })
    server.closeIdleConnections()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
