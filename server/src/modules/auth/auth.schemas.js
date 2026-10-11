import { z } from 'zod'

const email = z.string().trim().toLowerCase().email().max(254)
const displayName = z.string().trim().min(2).max(100)
export const passwordSchema = z.string().min(12).refine(
  (value) => Buffer.byteLength(value, 'utf8') <= 72,
  'Use at most 72 UTF-8 bytes for a password.',
)
export const loginSchema = z.object({
  email,
  password: z.string().min(1).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
}).strict()
export const registrationSchema = z.object({
  displayName, email, password: passwordSchema,
  phone: z.string().trim().max(30).optional(),
}).strict()
export const employeeSchema = z.object({
  displayName, email, password: passwordSchema,
  role: z.enum(['manager', 'cashier', 'stylist', 'beautician']),
}).strict()
export const employeeUpdateSchema = z.object({
  displayName: displayName.optional(), email: email.optional(),
  password: passwordSchema.optional(),
  role: z.enum(['manager', 'cashier', 'stylist', 'beautician']).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Submit a change.')
export const changePasswordSchema = z.object({
  currentPassword: loginSchema.shape.password,
  newPassword: passwordSchema,
}).strict()
export const idSchema = z.object({ id: z.uuid() }).strict()
