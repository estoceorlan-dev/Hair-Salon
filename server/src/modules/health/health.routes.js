import { Router } from 'express'
import { createHealthService } from './health.service.js'
import { createHealthController } from './health.controller.js'

export function healthRoutes(database) {
  const router = Router()
  const controller = createHealthController(createHealthService(database))
  router.get('/health', controller.readiness)
  router.get('/live', controller.liveness)
  return router
}
