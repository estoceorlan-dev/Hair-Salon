import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
const databaseUrl = optionalText.refine((value) => {
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
}, 'Use a PostgreSQL connection URL or leave empty')
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
  DATABASE_URL: databaseUrl,
  DEMO_DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
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
  SESSION_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(28800),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(1).default(0),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== 'production') return
  for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
    if (!value[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' })
  }
  if (!value.APP_ORIGIN.startsWith('https://'))
    ctx.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'Use an HTTPS origin in production' })
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
    demoDatabaseUrl: value.DEMO_DATABASE_URL,
    testDatabaseUrl: value.TEST_DATABASE_URL,
    dbConnectionTimeoutMs: value.DB_CONNECTION_TIMEOUT_MS,
    jwtSecret: value.JWT_SECRET,
    sessionTtlSeconds: value.SESSION_TTL_SECONDS,
    trustProxyHops: value.TRUST_PROXY_HOPS,
  }
}

export function loadEnvironment() {
  dotenv.config({
    path: fileURLToPath(new URL('../../.env', import.meta.url)),
    quiet: true,
  })
  return parseEnvironment(process.env)
}
