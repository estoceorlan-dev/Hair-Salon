import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { requestLogger } from './middleware/request-logger.js'
import { apiNotFound, errorHandler } from './middleware/errors.js'
import { healthRoutes } from './modules/health/health.routes.js'
import { parseEnvironment } from './config/env.js'
import { createAuthService } from './modules/auth/auth.service.js'
import { authRoutes, employeeAccountRoutes } from './modules/auth/auth.routes.js'
import { accessRoutes } from './modules/access/access.routes.js'

export function createApp({
  database,
  config = parseEnvironment({}),
  logger = console,
  distPath = fileURLToPath(new URL('../../dist', import.meta.url)),
}) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxyHops)
  app.use(requestLogger(logger))
  app.use(
    helmet({
      strictTransportSecurity: config.nodeEnv === 'production' ? undefined : false,
      contentSecurityPolicy: {
        directives: config.nodeEnv === 'production' ? {} : { 'upgrade-insecure-requests': null },
      },
    }),
  )
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  const auth = createAuthService(database, config)
  app.use('/api', healthRoutes(database))
  app.use('/api/auth', authRoutes(auth, config))
  app.use('/api/employee-accounts', employeeAccountRoutes(auth, config))
  // Mount only known resource prefixes so unknown routes retain JSON 404 responses.
  const protectedApi = accessRoutes(auth, database, config)
  app.use('/api', (req, res, next) => {
    const resource = req.path.split('/')[1]
    if (['appointments', 'me', 'customers', 'services', 'sales', 'inventory', 'payroll',
      'reports', 'settings', 'activity-logs', 'dashboard', 'payments'].includes(resource))
      return protectedApi(req, res, next)
    next()
  })
  // Never let unknown API paths return the SPA's HTML.
  app.use('/api', apiNotFound)

  const indexPath = path.join(distPath, 'index.html')
  if (existsSync(indexPath)) {
    app.use(express.static(distPath))
    app.get('/{*path}', (req, res, next) => {
      if (path.extname(req.path) || !req.accepts('html')) return next()
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(indexPath)
    })
  } else {
    app.get('/', (req, res) =>
      res.json({
        status: 'running',
        message:
          'Use the Vite dev server, or run npm run build to serve the frontend here.',
      }),
    )
  }
  app.use((req, res) =>
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } }),
  )
  app.use(errorHandler(logger))
  return app
}
