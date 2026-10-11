import { HttpError } from './errors.js'

export function trustedWrite(config) {
  const origins = new Set([config.appOrigin])
  if (config.nodeEnv !== 'production') {
    const appPort = new URL(config.appOrigin).port
    for (const host of ['localhost', '127.0.0.1']) {
      origins.add(`http://${host}:${appPort}`)
      origins.add(`http://${host}:${config.port}`)
      origins.add(`http://${host}:4173`)
    }
  }
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    if (!origins.has(req.get('origin')) || req.get('x-romel-request') !== 'browser')
      return next(new HttpError(403, 'UNTRUSTED_REQUEST', 'This request did not come from the salon application.'))
    if (!req.is('application/json'))
      return next(new HttpError(415, 'JSON_REQUIRED', 'Send the request as application/json.'))
    next()
  }
}

export function authenticate(service) {
  return async (req, res, next) => {
    req.auth = await service.authenticate(req.cookies.romel_session)
    next()
  }
}

export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.auth?.user) return next(new HttpError(401, 'AUTH_REQUIRED', 'Please sign in to continue.'))
    if (!permissions.some((permission) => req.auth.user.permissions.includes(permission)))
      return next(new HttpError(403, 'FORBIDDEN', 'Your account cannot access this page or action.'))
    next()
  }
}

export function requireManager(req, res, next) {
  if (req.auth.user.role !== 'manager') return next(new HttpError(403, 'FORBIDDEN', 'Manager access is required.'))
  next()
}
