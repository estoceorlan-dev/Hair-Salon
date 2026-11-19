import { createApp } from '../server/src/app.js'
import { parseEnvironment } from '../server/src/config/env.js'
import { createDatabase } from '../server/src/db/pool.js'

// Reuse the pool across requests handled by this function instance.
const config = parseEnvironment({
  ...process.env,
  APP_ORIGIN: process.env.APP_ORIGIN || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`),
})
export default createApp({ config, database: createDatabase(config) })
