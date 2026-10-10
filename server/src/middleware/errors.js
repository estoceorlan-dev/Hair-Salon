export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function apiNotFound(req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'API route not found.'))
}

export function errorHandler(logger) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error)
    const known = error instanceof HttpError
    const invalidJson = error.type === 'entity.parse.failed'
    const tooLarge = error.type === 'entity.too.large'
    const status = known
      ? error.status
      : invalidJson
        ? 400
        : tooLarge
          ? 413
          : 500
    const code = known
      ? error.code
      : invalidJson
        ? 'INVALID_JSON'
        : tooLarge
          ? 'BODY_TOO_LARGE'
          : 'INTERNAL_ERROR'
    const message = known
      ? error.message
      : invalidJson
        ? 'Send valid JSON.'
        : tooLarge
          ? 'Request body is too large.'
          : 'An unexpected error occurred.'
    if (status >= 500 && status !== 501)
      logger.error(
        JSON.stringify({
          event: 'request_error',
          requestId: req.requestId,
          name: error.name,
        }),
      )
    res.status(status).json({
      error: {
        code,
        message,
        ...(known && error.details ? { details: error.details } : {}),
      },
      requestId: req.requestId,
    })
  }
}
