import { randomUUID } from 'node:crypto'

export function requestLogger(logger) {
  return (req, res, next) => {
    req.requestId = randomUUID()
    res.setHeader('X-Request-Id', req.requestId)
    const started = performance.now()
    res.on('finish', () =>
      logger.info(
        JSON.stringify({
          event: 'request',
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(performance.now() - started),
        }),
      ),
    )
    next()
  }
}
