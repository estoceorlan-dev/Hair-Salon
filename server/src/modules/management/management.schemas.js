import { z } from 'zod'

const name = z.string().trim().min(2).max(100)
const note = z.string().trim().max(2000).nullable()
const money = z.number().int().min(0).max(99999999999).nullable()
const phone = z.string().trim().regex(/^[+()\d .-]{5,30}$/, 'Use 5–30 phone characters.')
  .refine((v) => v.replace(/\D/g, '').length >= 5, 'Include at least five phone digits.').nullable()
const ids = z.array(z.uuid()).max(200).refine((v) => new Set(v).size === v.length, 'Remove duplicate staff.')
export const listSchema = z.object({
  q: z.string().trim().max(100).default(''),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  category: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict()
export const customerSchema = z.object({
  displayName: name, email: z.string().trim().toLowerCase().email().max(254).nullable(),
  phone, notes: note, preferredEmployeeId: z.uuid().nullable(), isActive: z.boolean(),
  duplicateReason: z.string().trim().min(10).max(500).optional(),
}).strict()
export const serviceSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,40}$/), name,
  category: z.string().trim().min(1).max(100), priceCents: money,
  durationMinutes: z.number().int().min(5).max(1440).nullable(),
  isActive: z.boolean(), employeeIds: ids,
}).strict()
export const commissionSchema = z.object({
  basis: z.enum(['service_subtotal', 'fixed_per_service']),
  ratePercent: z.number().min(0).max(100).nullable(), amountCents: money,
  notes: z.string().trim().max(1000),
}).strict().refine((v) => v.basis === 'service_subtotal'
  ? v.ratePercent !== null && v.amountCents === null : v.amountCents !== null && v.ratePercent === null,
'Supply a percentage or a fixed amount matching the basis.')
export const profileSchema = z.object({ phone, notes: note, basePayCents: money,
  commissionPolicy: commissionSchema.nullable(),
}).strict()
export const availabilitySchema = z.object({
  startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }),
  available: z.boolean(), reason: note,
}).strict().refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), 'End must follow start.')
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable()
export const hourSchema = z.object({ weekday: z.number().int().min(0).max(6),
  opensAt: time, closesAt: time, isClosed: z.boolean().nullable(),
  definitionState: z.enum(['placeholder', 'demo', 'confirmed']),
}).strict().refine((v) => v.definitionState === 'placeholder'
  ? v.opensAt === null && v.closesAt === null && v.isClosed === null
  : v.isClosed === true ? v.opensAt === null && v.closesAt === null
    : v.isClosed === false && v.opensAt !== null && v.closesAt !== null && v.opensAt < v.closesAt,
'Set closed, or provide opening and closing times; leave placeholders unset.')
export const hoursSchema = z.object({ hours: z.array(hourSchema).length(7)
  .refine((v) => new Set(v.map((d) => d.weekday)).size === 7, 'Provide each weekday once.') }).strict()
export const closureSchema = z.object({ closedOn: z.iso.date(), reason: z.string().trim().min(2).max(500) }).strict()
const booking = z.object({ leadMinutes: z.number().int().min(0).max(525600),
  horizonDays: z.number().int().min(1).max(730), cancellationHours: z.number().min(0).max(8760),
  notes: z.string().trim().max(1000) }).strict()
const receipt = z.object({ salonName: name, address: z.string().trim().max(500),
  phone: z.string().trim().max(30), footer: z.string().trim().max(1000) }).strict()
const tax = z.object({ ratePercent: z.number().min(0).max(100),
  inclusive: z.boolean(), notes: z.string().trim().max(1000) }).strict()
const discount = z.object({ maxPercent: z.number().min(0).max(100),
  notes: z.string().trim().max(1000) }).strict()
const payroll = z.object({ basis: z.enum(['monthly', 'daily', 'hourly', 'per_period']),
  notes: z.string().trim().max(1000) }).strict()
const periods = z.array(z.object({ startsOn: z.iso.date(), endsOn: z.iso.date() }).strict()
  .refine((v) => v.startsOn <= v.endsOn, 'Period end must follow start.')).max(100)
  .refine((v) => { const sorted = [...v].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
    return sorted.every((p, i) => !i || p.startsOn > sorted[i - 1].endsOn) }, 'Payroll periods cannot overlap.')
export const settingSchemas = { booking_policy: booking, receipt_details: receipt, tax_policy: tax,
  discount_policy: discount, payroll_policy: payroll, commission_policy: commissionSchema, payroll_periods: periods }
export const settingSchema = z.object({ key: z.enum(Object.keys(settingSchemas)),
  value: z.unknown(), definitionState: z.enum(['placeholder', 'demo', 'confirmed']) }).strict()
  .superRefine((v, ctx) => {
    if (v.definitionState === 'placeholder') {
      if (v.value !== null) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Placeholders must remain null.' })
      return
    }
    const result = settingSchemas[v.key].safeParse(v.value)
    if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: ['value', ...issue.path] })
  })
