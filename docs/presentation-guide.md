# Local Presentation Guide - Phases 0-3

## Current milestone

1. Run `npm run db:local:setup` and `npm run auth:local:setup`, then `npm run dev:all`. Open `http://localhost:5173`.
2. Sign in with the generated local manager account from ignored `.local-runtime/manager-account.json`. The header displays the verified name and role. Reload to restore the session.
3. Under **Employee Accounts**, create a fictional stylist/beautician/cashier, edit the role/status, or reset its password. Updated accounts must sign in again. At least one active manager must remain.
4. Sign out and sign in as the new stylist. Navigation shows assigned appointments and personal earnings only; the new account has no assigned records. A direct `/app/employees` or `/app/pos` URL is denied.
5. Sign out and use **Create an account** to register a fictional customer. The greeting uses its profile; saved bookings/history are scoped to that customer. **My Account** changes the password and ends all sessions.
6. To demonstrate the existing historical fixtures, explicitly switch the API to the separate demo database as described in [authentication setup](authentication.md). Each generated demo role has its own credentials. Show assigned bookings and personal earnings (amounts remain pending), and the registered demo customer's saved history. Return the API to development afterward.
7. As manager/cashier, open POS and review the sample cart/subtotal. Tax is undefined; Cash, GCash, Maya, Card, and the payment action remain disabled. Dashboard/inventory figures still use labeled sample data; other business pages remain placeholders.
8. Customer service/date/time selection is still a booking preview: it reserves and saves nothing. Existing saved bookings and history are separate read-only sections.

Authentication, account changes, session revocation, and scoped records are persisted. Payments, receipts, new reservations, operational stock updates, and payroll calculations remain future milestones. Demo financial history is fictional and never processes a payment. Authentication/account changes produce database audit entries without credentials.

## Later integrated presentation (Phases 4-10)

After policies and fixtures are agreed: authenticate by role -> create/review a booking -> complete service -> perform the approved checkout -> show receipt, stock/history/commission changes -> generate reconciled sales reports and payroll -> restart and verify persistence. Exact amounts, consumption quantities, rates, and expected results remain placeholders. Optional Render hosting is Phase 11.
