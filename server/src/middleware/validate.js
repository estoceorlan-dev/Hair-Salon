import { HttpError } from './errors.js'

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      return next(
        new HttpError(
          422,
          'VALIDATION_ERROR',
          'Check the submitted fields.',
          result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      )
    }
    req.validated = { ...req.validated, [source]: result.data }
    next()
  }
}
