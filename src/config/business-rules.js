// Confirm values before implementing the relevant business workflows.
export const businessRules = Object.freeze({
  currency: 'PHP',
  timezone: 'Asia/Manila',
  taxRate: null,
  discountPolicy: null,
  commissionPolicy: null,
  payrollPeriod: null,
  bookingLeadTimeMinutes: null,
})

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: businessRules.currency,
  }).format(value)
}
