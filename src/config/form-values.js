export const nullable = (value) => value?.trim() || null
export const cents = (value) => value === '' ? null : Math.round(Number(value) * 100)
export const pesos = (value) => value == null ? '' : Number(value) / 100
export function commissionFrom(d) {
  return !d.commissionBasis ? null : { basis: d.commissionBasis,
    ratePercent: d.commissionRate === '' ? null : Number(d.commissionRate), amountCents: cents(d.commissionAmount), notes: d.commissionNotes }
}
