# Business Rule Placeholders

The user requested that definitions remain placeholders for now. The entries below record what needs a decision; they do not assert final salon policy. Sample UI prices, statistics, stock levels, and time slots are illustrative.

## Confirmed implementation constraints

- Use React/Vite + Express + PostgreSQL; retain custom CSS for the foundation.
- Use PHP display currency and `Asia/Manila` as the project's date/time context.
- Keep GCash, Maya, and card visible but disabled. Do not collect payment details, generate QR/payment links, verify transactions, or claim payment success.
- Keep cash checkout pending as well. Phase 2 includes only explicitly fictitious historical cash records for future report tests; no live sale/payment workflow is enabled.
- Set undecided numeric/policy values to `null`, not invented rates. `src/config/business-rules.js` is a UI placeholder, not the future authoritative pricing engine.
- The API must report actual database readiness; UI sample access must not be presented as secure login or saved booking.

## Decisions to complete before dependent phases

| Rule area | Definition placeholder | Current safe behavior | Needed before |
| --- | --- | --- | --- |
| Opening hours/closures | TBD; source document suggests Mon-Sat 9 AM-7 PM | Show sample slots only; do not enforce as final policy | Phase 5 |
| Service price/duration | TBD by service and effective date | Clearly label sample prices and durations | Phases 4-5 |
| Staff-service eligibility/capacity | TBD | No real availability claims | Phase 5 |
| Booking lead time, cancellation/no-show | TBD | Preview selections only, nothing reserved | Phase 5 |
| Reservation/status transitions | TBD | No persisted status changes | Phase 5 |
| Product units and conversions | TBD | Existing stock is sample data | Phase 6 |
| Consumption quantities/posting event | TBD, including performed but unpaid services | No automatic deductions | Phases 6-7 |
| Low-stock thresholds/recipients | TBD | Sample alert counts only | Phase 6 |
| Taxes/discounts/rounding | TBD, including inclusive/exclusive pricing | Tax says "To be defined"; estimated subtotal only | Phase 7 |
| Cash tender/change/receipt fields | TBD | Disabled payment processing | Phase 7 |
| GCash/Maya payment confirmation | TBD: provider integration or other approved workflow | Disabled display-only labels; API rejects processing | Separately scheduled payment setup |
| Card payment handling | TBD: approved provider and acceptance policy | Disabled label; no card-number inputs | Separately scheduled payment setup |
| Payment status/retry/refund/void | TBD, including idempotency and reversal policy | No payment persistence or success response | Phase 7/payment setup |
| Customer/staff attribution | TBD: walk-ins, preferred stylist, multi-staff work | UI fixture identities only | Phases 4-7 |
| Commission basis/rate/eligibility | TBD; amount/rate/timing/reversal rules | `commissionPolicy: null`; no calculation | Phases 7-8 |
| Payroll period/base pay/adjustments | TBD; approval and payout ownership | `payrollPeriod: null`; no calculation | Phase 8 |
| Report periods/revenue definition | TBD; gross/net/refund/unpaid treatment | Existing dashboard totals are samples | Phase 8 |
| Permissions and record visibility | Proposed matrix; final exceptions TBD | UI preview routing only | Phase 3 |
| Performance/capacity/recovery targets | TBD with representative dataset | Foundation smoke checks only | Phases 9-10 |

## Future checkout contract to review

The eventual workflow is: identify customer and staff -> validate service completion/items -> calculate authoritative totals -> follow the agreed payment process -> atomically post sale/payment/stock/commissions -> render a receipt. Whether consumption should occur at completion or payment, and how unpaid work/refunds are treated, remain TBD. Do not implement the earlier plan's paid-checkout timing as a confirmed rule.

## Phase 0 presentation scenario

For this milestone: enter employee preview -> navigate all modules -> open Settings and check the API connection -> add sample POS items -> show disabled Cash/GCash/Maya/Card -> exit -> explore customer booking preview. Expected result: no payment, booking, inventory, commission, or payroll data is written.

The later persisted scenario is: create a booking -> staff completes service -> finalize an approved checkout flow -> inspect stock/history/commission/report changes -> review payroll. Expected quantities, amounts, and timings are **TBD fixtures**, to be recorded after rule confirmation and before Phase 9. See [presentation-guide.md](presentation-guide.md).
