# Requirements and Workflow Map

## Delivery agreement

Phases 0-4 establish the scope, application/database foundation, verified sessions, registration, account controls, role/ownership enforcement, and persisted customer/service/employee/settings management. Undefined business definitions remain placeholders. Appointments, personal earnings, and customer history have scoped read APIs. POS/customer choices use the database service catalog; dashboard figures remain samples. Simulated booking time slots have been removed. Checkout, booking changes, and providers belong to later phases. See [Phase 4 behavior](master-data.md).

GCash, Maya, and card appear in POS but are disabled and display-only. Cash checkout is also pending. There are no provider SDKs, QR codes, payment links, provider credentials, card-detail fields, or payment recording endpoints. Synthetic historical cash records are database fixtures only.

## Technology decisions

- Frontend: retain React + Vite and Lucide; use React Router for routes and Axios with relative `/api` requests.
- Styling: retain the existing custom CSS and color palette. Tailwind in the original architecture is deferred; a rewrite is not required.
- Backend: Node + Express REST API with configuration, validation, safe errors, request logging, and a PostgreSQL pool.
- Persistence: PostgreSQL 18.3 workspace cluster on port 5433; dedicated dev/demo/test databases, generated credentials, versioned migrations, and guarded fixtures/reset are implemented. Readiness is 200 when connected, 503 otherwise.
- Authentication: revocable JWT sessions in HttpOnly cookies, bcrypt account/password controls, strict-origin JSON writes, rate limiting, and database-backed permissions are implemented in Phase 3. Undefined permissions remain denied.
- Deployment: localhost first. Render remains an optional future phase. PHP currency and `Asia/Manila` display dates are the project defaults.

## Screens and requirements

| Requirement / screen | Proposed responsible role | Workflow | Current milestone | Later acceptance criterion |
| --- | --- | --- | --- | --- |
| Account entry | All users | Authenticate -> role workspace -> logout | Employee/customer preview selector; no real login | Verify identity; reject forbidden requests and expired sessions |
| Dashboard | Manager; limited cashier view TBD | Review sales, appointments, customers, and alerts | Existing sample dashboard | Aggregates match saved records and allowed role scope |
| Customers | Manager, cashier | Find/create customer -> profile -> preferred stylist/history | Dedicated placeholder route | Records/history persist and unauthorized access fails |
| Services | Manager | Define service -> price/duration -> eligible staff | Dedicated placeholder route | One catalog feeds booking and POS; preserve transaction snapshots |
| Employees | Manager | Manage profile -> role -> availability -> pay inputs | Dedicated placeholder route | Employee changes affect access and scheduling correctly |
| Appointments | Manager, cashier, assigned staff | Check schedule -> book/reschedule -> complete/cancel | Sample appointment screen | Persist bookings; reject overlapping active staff reservations |
| Customer booking | Customer | Choose service -> date/time -> review booking | UI preview explicitly says nothing is reserved | Validate availability and save an owned booking/reference |
| POS / payments | Manager, cashier | Select customer/staff/items -> total -> payment -> receipt | Cart preview; disabled Cash/GCash/Maya/Card labels | Confirm payment policy first; atomic, idempotent checkout |
| Inventory | Manager; staff visibility TBD | View stock -> restock/adjust -> track consumption | Existing sample screen | Trace each stock change; prevent invalid/negative stock |
| Low-stock notifications | Manager | Threshold reached -> alert -> restock -> resolve | Existing sample alerts | Alerts track configured thresholds without duplicates |
| Payroll / commissions | Manager; own earnings for staff TBD | Select period -> calculate -> approve -> pay | Dedicated placeholder route | Agreed formula reconciles; no duplicate commission inclusion |
| Reports / analytics | Manager; limited cashier reports TBD | Select period -> sales/service/staff analysis -> print/export | Dedicated placeholder route | Daily/weekly/monthly totals reconcile; readable PDF/CSV output |
| Settings | Manager | Configure salon/business policies | Placeholder settings and live connection check | Server validates settings and records authorized changes |
| Activity logs | Manager | Review actions by actor/date | Dedicated placeholder route; API request logging only | Business events have actor/action/time/reason without secrets |

## Foundation acceptance criteria

1. Frontend and backend install independently from committed lockfiles.
2. `npm run dev:all` starts Vite on port 5173 and Express on port 3000.
3. Settings reaches `/api/health` through Vite; an absent/unavailable database reports 503, while liveness reports 200.
4. Invalid environment settings fail startup clearly without printing secrets.
5. API errors use JSON; unknown API routes never return the frontend HTML.
6. Navigation has real URLs, missing modules show placeholders, and preview exit clears the selection. This is not security enforcement.
7. GCash/Maya/Card and checkout cannot submit payments. The placeholder API returns 501 for payment requests.
8. Shared loading, empty, validation, error, and success components are available; unset rules have no invented business defaults.
9. The build runs locally through Express with direct-route refresh support. Persistent business workflows remain future work.

## Non-functional targets for later acceptance

Use simple, responsive screens; enforce identity/role/ownership at the API; preserve data across restarts; back up and restore PostgreSQL; measure normal requests/reports against a representative dataset. Availability, capacity, response-time thresholds, and training/operating procedures are placeholders until agreed. See [business-rules.md](business-rules.md).

## Excluded from this milestone

Provider payments, business booking/checkout writes, automatic consumption at service/checkout, payroll calculation, publicly hosted booking, email/SMS, loyalty campaigns, and cloud deployment remain future work. Phase 2 atomically maintains stock when an explicit movement is inserted; it does not choose a service consumption policy. Phase 3 adds identity and scoped reads.
