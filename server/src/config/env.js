import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.enum(['127.0.0.1', '0.0.0.0', 'localhost']).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z
    .url()
    .default('http://localhost:5173')
    .refine((value) => {
      const url = new URL(value)
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value
    }, 'Use an HTTP(S) origin without a path or trailing slash'),
  APP_TIMEZONE: z
    .string()
    .default('Asia/Manila')
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value })
        return true
      } catch {
        return false
      }
    }, 'Use a valid IANA timezone'),
  DATABASE_URL: optionalText.refine((value) => {
    if (!value) return true
    try {
      const url = new URL(value)
      return (
        ['postgres:', 'postgresql:'].includes(url.protocol) &&
        Boolean(url.hostname)
      )
    } catch {
      return false
    }
  }, 'Use a PostgreSQL connection URL or leave empty'),
  DB_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(10000)
    .default(2000),
  JWT_SECRET: optionalText.refine(
    (value) => !value || value.length >= 32,
    'Must contain at least 32 characters when configured',
  ),
})

export function parseEnvironment(environment) {
  const result = environmentSchema.safeParse(environment)
  if (!result.success) {
    // Report names and validation guidance, never the supplied values/secrets.
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new Error(`Invalid server configuration:\n${issues.join('\n')}`)
  }
  const value = result.data
  return {
    nodeEnv: value.NODE_ENV,
    host: value.HOST,
    port: value.PORT,
    appOrigin: value.APP_ORIGIN,
    timezone: value.APP_TIMEZONE,
    databaseUrl: value.DATABASE_URL,
    dbConnectionTimeoutMs: value.DB_CONNECTION_TIMEOUT_MS,
    jwtSecret: value.JWT_SECRET,
  }
}

export function loadEnvironment() {
  dotenv.config({
    path: fileURLToPath(new URL('../../.env', import.meta.url)),
    quiet: true,
  })
  return parseEnvironment(process.env)
}
