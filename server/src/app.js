import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { requestLogger } from './middleware/request-logger.js'
import { apiNotFound, errorHandler } from './middleware/errors.js'
import { healthRoutes } from './modules/health/health.routes.js'
import { paymentRoutes } from './modules/payments/payments.routes.js'

export function createApp({
  database,
  logger = console,
  distPath = fileURLToPath(new URL('../../dist', import.meta.url)),
}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(requestLogger(logger))
  app.use(
    helmet({
      strictTransportSecurity: false,
      contentSecurityPolicy: {
        directives: { 'upgrade-insecure-requests': null },
      },
    }),
  )
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use('/api', healthRoutes(database))
  app.use('/api/payments', paymentRoutes())
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
