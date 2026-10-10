import { Router } from 'express'
import { HttpError } from '../../middleware/errors.js'

export function paymentRoutes() {
  const router = Router()
  router.use((req, res, next) =>
    next(
      new HttpError(
        501,
        'PAYMENTS_NOT_IMPLEMENTED',
        'Payment processing has not been configured.',
      ),
    ),
  )
  return router
}
