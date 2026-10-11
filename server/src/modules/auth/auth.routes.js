import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { validate } from '../../middleware/validate.js'
import { authenticate, requireManager, requirePermission, trustedWrite } from '../../middleware/auth.js'
import { cookieOptions, sessionCookie } from './auth.service.js'
import { changePasswordSchema, employeeSchema, employeeUpdateSchema, idSchema, loginSchema, registrationSchema } from './auth.schemas.js'

export function authRoutes(service, config) {
  const router = Router()
  const protect = authenticate(service)
  const writes = trustedWrite(config)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many account attempts. Try again in 15 minutes.' } },
  })
  const setSession = (res, result, status = 200) => res
    .cookie(sessionCookie, result.token, { ...cookieOptions(config), maxAge: config.sessionTtlSeconds * 1000 })
    .status(status).json({ user: result.user, expiresAt: result.expiresAt })
  router.post('/login', writes, limiter, validate(loginSchema), async (req, res) => {
    setSession(res, await service.login(req.validated.body))
  })
  router.post('/register', writes, limiter, validate(registrationSchema), async (req, res) => {
    setSession(res, await service.register(req.validated.body), 201)
  })
  router.get('/session', protect, (req, res) => res.json({ user: req.auth.user, expiresAt: req.auth.expiresAt }))
  router.post('/logout', protect, writes, async (req, res) => {
    await service.logout(req.auth)
    res.clearCookie(sessionCookie, cookieOptions(config)).status(204).end()
  })
  router.post('/password', protect, writes, limiter, validate(changePasswordSchema), async (req, res) => {
    await service.changePassword(req.auth, req.validated.body)
    res.clearCookie(sessionCookie, cookieOptions(config)).status(204).end()
  })
  return router
}

export function employeeAccountRoutes(service, config) {
  const router = Router()
  router.use(authenticate(service), requireManager, requirePermission('employees.manage'), trustedWrite(config))
  router.get('/', async (req, res) => res.json({ employees: await service.employees() }))
  router.post('/', validate(employeeSchema), async (req, res) => {
    res.status(201).json({ employee: await service.createEmployee(req.auth.user, req.validated.body) })
  })
  router.patch('/:id', validate(idSchema, 'params'), validate(employeeUpdateSchema), async (req, res) => {
    res.json({ employee: await service.updateEmployee(req.auth.user, req.validated.params.id, req.validated.body) })
  })
  return router
}
