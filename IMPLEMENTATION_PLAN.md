# Romel Hair Salon Implementation Plan

**Primary milestone:** a working, database-backed system running on localhost for presentation.

**Optional milestone:** deploy the verified application to Render after the local presentation.

**Status:** Phases 0 and 1 implemented; Phase 0 business definitions remain placeholders by request. Phases 2-11 remain planned.

**Prepared:** October 10, 2026, Asia/Manila.

## 1. Starting Point and Scope

This plan follows [ARCHITECTURE.md](ARCHITECTURE.md), the business requirements in [reqs.txt](reqs.txt), and the existing source code. The table below records the baseline before Phases 0 and 1; their completion checklists describe the implemented foundation.

| Area | Current implementation | Work required |
| --- | --- | --- |
| Frontend | React + Vite, Lucide icons, custom CSS | Reuse the UI; add routing, real forms, API integration, and missing screens |
| Login | Buttons select an employee/customer view without verifying credentials | Implement accounts, authentication, and role permissions |
| Dashboard | Hard-coded statistics | Calculate metrics from persisted records |
| Appointments | Static employee list; customer confirmation only changes React state | Persist bookings and enforce availability |
| POS | In-memory cart; payment button has no checkout handler | Persist transactions, payments, receipts, stock changes, and commissions |
| Inventory | Static stock list; restock controls are placeholders | Implement stock records, movements, and low-stock alerts |
| Other modules | Customers appears in navigation but falls through to Dashboard; Settings is a placeholder | Build customer/service/employee management, payroll, reports, settings, and activity logs |
| Backend/database | No Express application or PostgreSQL integration | Create the API, schema, migrations, and seed data |
| Project operations | Frontend scripts only; generic Vite README; no Git repository detected | Document setup, add backend scripts, and establish version control |

### Scope decisions and pending definitions

- Use **React + Vite + Express + PostgreSQL**, as specified by the architecture and existing code. The earlier Flutter recommendation in `reqs.txt` is superseded for this implementation.
- Implement manager, receptionist/cashier, stylist/beautician, and customer permissions. A customer account is separate from an employee account; walk-in customer records do not require login accounts.
- Use PHP currency and `Asia/Manila` business dates. Default opening hours are Monday-Saturday, 9:00 AM-7:00 PM, with configurable closures and staff schedules.
- Current payment scope: show disabled Cash, GCash, Maya, and Card options only. Payment processing, manual verification, provider integration, and final payment policies are deferred until separately defined and implemented.
- The prototype's unconditional 12% VAT has been removed. Tax/discount rules remain undefined (`null`) until confirmed; POS shows an estimated subtotal without claiming a finalized payable amount.
- Keep base-pay, commission, adjustment, and pay-period definitions as placeholders. Agree the calculation before implementing payroll; attendance-driven pay and statutory deduction automation require separate requirements.
- Include dashboard low-stock notifications, print/PDF reports, and customer booking in the local scope. Email/SMS delivery, loyalty campaigns, and live online payments are future enhancements.
- Localhost booking is demonstrated on the presentation computer. Public internet booking becomes available only after optional hosting is completed.

## 2. Delivery Sequence

Complete the phases in order. Each exit criterion is a checkpoint before moving to dependent work. Implement only the schema and API needed by the current phase, while maintaining the overall data model.

| Phase | Outcome | Dependencies |
| --- | --- | --- |
| 0 | Confirm scope and business rules | Existing requirements and UI |
| 1 | Establish frontend/backend project foundation | Phase 0 |
| 2 | Create PostgreSQL schema, migrations, and demo fixtures | Phase 1 |
| 3 | Implement authentication and access control | Phase 2 |
| 4 | Manage customers, services, employees, and settings | Phase 3 |
| 5 | Complete appointment and customer booking workflows | Phase 4 |
| 6 | Implement inventory and service consumption rules | Phase 4; complete after Phase 5 in this sequence |
| 7 | Connect POS, payments, receipts, stock, and commissions | Phases 5-6 |
| 8 | Complete payroll, reports, analytics, and activity logs | Phase 7 |
| 9 | Verify integrated workflows and presentation readiness | Phases 3-8 |
| 10 | Package, run, and rehearse localhost presentation | Phase 9 |
| 11 | Optional Render deployment | Phase 10 |

**Main project completion is Phase 10.** Phase 11 does not block the localhost presentation. Re-estimate effort after Phase 0 and after the first persisted booking/checkout workflow; no calendar deadline is assumed.

## Phase 0 - Confirm Requirements and Business Rules

**Goal:** turn the architecture and analyst requirements into an implementable scope.

**Completed with requested placeholders:** workflow mapping, proposed permissions, decision register, and a preview/persisted presentation scenario are documented. No undecided financial or operational policy is treated as confirmed.

- [x] List screens and map each requirement to a workflow and proposed responsible role in `docs/requirements.md`.
- [x] Record a proposed permissions matrix in `docs/role-permissions.md`; confirm policy before implementing server authorization.
- [x] Record placeholders for prices, durations, eligibility, product units, consumption, minimum stock, and booking capacity.
- [x] Record placeholders for operating hours, lead time, cancellation/rescheduling, absence, and booking/status rules.
- [x] Document the future checkout workflow and placeholders; show payment labels only, with all processing disabled.
- [x] Record consumption/commission posting timing as TBD, including performed-but-unpaid services. Do not enforce paid-checkout timing as settled policy.
- [x] Record placeholders for payroll, base pay, commissions, reversals, and approval.
- [x] Write current preview and future persisted presentation scenarios; future expected financial/stock results remain TBD.

**Deliverables:** `docs/requirements.md`, `docs/role-permissions.md`, and `docs/business-rules.md`.

**Exit criterion:** every local-scope requirement has a workflow and future acceptance criterion; unsettled rules are explicitly marked TBD with safe preview behavior and the phase that needs a decision.

## Phase 1 - Establish the Project Foundation

**Goal:** keep the existing frontend and add a maintainable backend alongside it.

- [x] Initialize Git and ignore secrets, backups, logs, dependencies, and build output.
- [x] Retain root frontend; add `server/package.json` and its lockfile.
- [x] Create Express config, health route/controller/service, shared validation, safe errors, and request IDs/logging.
- [x] Install Express, `pg`, JWT, bcrypt, dotenv, Zod, cookies, Helmet, and rate-limit dependencies. Actual login/rate-limit application belongs to Phase 3.
- [x] Add React Router, Axios, and relative `/api` client. Chart library remains deferred to reporting.
- [x] Retain custom CSS and update the architecture decision.
- [x] Configure Vite development proxy and coordinated `dev:all` startup.
- [x] Add database-aware `/api/health` and separate `/api/live`; missing/unavailable database returns 503 readiness.
- [x] Add validated `.env.example`; record Node 22.18.0 and local PostgreSQL 18 in setup docs.
- [x] Add shared loading, empty, validation, success, and error UI states; route missing modules to placeholders.

Proposed structure:

```text
src/                         # Existing React application
  components/                # Reusable UI and existing screens
  pages/                     # Additional routed screens
  api/                       # Axios client and resource calls
  auth/                      # Session provider and route guards
server/
  package.json
  package-lock.json
  .env.example
  src/
    app.js                   # Express application and middleware
    server.js                # Startup and shutdown
    config/
    db/
    middleware/
    modules/                 # Auth, appointments, sales, inventory, etc.
  migrations/
  seeds/
  tests/
docs/
  requirements.md
  business-rules.md
  local-deployment.md
  presentation-guide.md
```

**Exit criterion:** the React app reaches the Express health endpoint through the Vite proxy, and configuration errors produce clear startup messages.

**Verification:** lint/build and seven foundation tests pass. Live HTTP checks confirm the Vite proxy, API liveness, 503 readiness with no database credentials, blocked payments, built frontend route fallback, and invalid-configuration startup failure. Browser visual verification was unavailable because no browser control surface was connected.

## Phase 2 - Design and Initialize PostgreSQL

**Goal:** create persistent storage that protects relationships and transaction integrity.

- [ ] Create local development, demo, and test databases with a dedicated application database user.
- [ ] Produce an ER diagram/data dictionary and numbered, version-tracked migrations. A fresh database must be reproducible without manual table edits.
- [ ] Model users, employee profiles, customer profiles, roles/permissions, services, staff-service eligibility, business hours, and settings.
- [ ] Model appointments with customer, service, assigned staff, start/end timestamps, status, and booking reference.
- [ ] Model products, service-product consumption rules, stock balances, and append-only inventory movements with actor, reason, and source reference.
- [ ] Model sales, sale items, staff attribution, payments, receipt numbers, refunds/voids, and unique checkout idempotency keys.
- [ ] Model commission entries, payroll runs/items, pay-period approval/payment status, notifications, and activity logs.
- [ ] Use foreign keys, uniqueness, check constraints, and indexes for date/staff/customer searches. Protect staff time ranges against overlapping active appointments at database level.
- [ ] Use fixed-precision money or integer centavos, explicit decimal stock units, and server-side rounding. Store timestamps consistently and group reports by Manila business dates.
- [ ] Preserve price, duration, consumption, and commission snapshots where needed so later catalog edits do not rewrite history. Deactivate referenced records instead of deleting them.
- [ ] Add deterministic demo data: accounts for each role, customers, staff, services, products, historical sales, appointments, low stock, and an open payroll period.
- [ ] Separate repeatable demo reset/seed tools from non-destructive production migrations. Make demo reset refuse to run outside the designated demo database.

**Exit criterion:** migrations create a fresh database, demo data loads repeatably, and invalid relationships/duplicate bookings are rejected.

## Phase 3 - Authentication and Role Access

**Goal:** replace the view-selection login with verified identity and server-enforced permissions.

- [ ] Implement login, logout, current-session lookup, manager-managed employee accounts, and customer registration linked to customer records.
- [ ] Hash passwords with bcrypt; validate credentials; use expiring JWTs in HTTP-only cookies with a defined logout/revocation strategy.
- [ ] Configure cookies for local HTTP and hosted HTTPS, and enforce trusted origins/CSRF protection on state-changing cookie-authenticated requests.
- [ ] Enforce permissions on every API operation. Frontend guards control navigation but are not the authorization boundary.
- [ ] Restrict service staff to their assigned appointments and permitted personal earnings; restrict customers to their own bookings/history.
- [ ] Replace the fixed manager name in the header with the authenticated profile and role. Restore sessions safely on reload and handle expiry.
- [ ] Remove hard-coded login credentials and prevent demo accounts from being automatically created in a hosted production database.

**Exit criterion:** each role sees the correct screens; unauthenticated, forbidden, expired-session, and cross-customer API requests are rejected.

## Phase 4 - Customer, Service, Employee, and Settings Management

**Goal:** provide the records and configuration needed by bookings and checkout.

- [ ] Build customer list/search/create/edit screens, contact details, preferred stylist, duplicate-handling rules, and a service-history view populated by completed transactions.
- [ ] Build service catalog CRUD with categories, prices, durations, active status, and eligible staff. Use this same catalog in POS and customer booking.
- [ ] Build employee profiles, roles, availability, active status, base-pay inputs, and commission rules.
- [ ] Build manager-only settings for opening hours/closures, booking policy, receipt details, tax/discount behavior, enabled payment methods, and payroll periods.
- [ ] Replace placeholder navigation with actual routes; add pagination/filtering and consistent form validation.
- [ ] Record changes to sensitive settings and master records in the activity log.

**Exit criterion:** changes survive reload/server restart and immediately affect availability, POS choices, and role-appropriate screens.

## Phase 5 - Appointments and Customer Booking

**Goal:** replace static schedules and simulated confirmation with persistent bookings.

- [ ] Add staff appointment list/calendar views with date, status, and stylist filters; support receptionist-created appointments and walk-ins.
- [ ] Complete the customer flow: authenticate, select a service and optional preferred stylist, retrieve availability, submit, and show the persisted booking reference.
- [ ] Calculate availability from service duration, eligible/available staff, existing bookings, closures, and business hours. Reject past dates and services that finish after closing.
- [ ] Validate and reserve availability atomically in PostgreSQL. A second concurrent request for the same staff/time must receive a conflict and refreshed options.
- [ ] Define and enforce transitions such as pending -> confirmed -> in progress -> completed, plus cancellation/no-show; release capacity according to the rules from Phase 0.
- [ ] Support authorized rescheduling/cancellation and customer viewing of their own bookings. Prevent edits from overwriting already completed/paid work.
- [ ] Connect appointment status and assigned staff to the subsequent POS workflow.

**Exit criterion:** a customer booking appears for the receptionist and assigned stylist, survives restart, and cannot double-book the same staff time range.

## Phase 6 - Inventory and Consumption Rules

**Goal:** make stock traceable and prepare safe automatic deductions at checkout.

- [ ] Replace mock inventory with product records, units, stock balance, minimum level, and computed status.
- [ ] Implement manager-authorized restocking and adjustments, each producing an inventory movement with a reason and actor.
- [ ] Map services to measurable product consumption, including unit conversion/rounding rules. Distinguish service consumables from retail product quantities.
- [ ] Implement a reusable stock-posting service with transactions and row locking so simultaneous checkouts cannot oversell.
- [ ] Show low-stock notifications in Inventory and Dashboard; update/resolve them after restocking without generating duplicate alerts.
- [ ] Define reversal rules: reversing a retail sale may return resalable stock; refunding a performed service must not automatically return consumed supplies.

**Exit criterion:** stock changes are persisted and auditable; service consumption requirements are calculable; negative stock and unauthorized adjustments are rejected.

## Phase 7 - POS, Payments, Receipts, and Integrated Posting

**Goal:** deliver the main end-to-end business transaction.

- [ ] Load services/products from the shared catalogs; support search, quantity updates/removal, customer selection, assigned staff, and appointment-linked checkout.
- [ ] Validate prices, quantities, discounts, taxes, service completion, and payment methods on the server; ignore client-supplied final totals.
- [ ] Confirm payment definitions before implementing checkout. Cash tender/change, e-wallet verification/integration, and card handling remain TBD; GCash/Maya/Card stay display-only until their separate setup is requested and completed.
- [ ] Finalize the sale, payment record, stock movements, commission entries, appointment payment link, and activity log in one PostgreSQL transaction. Keep receipt rendering outside the commit so a printing failure can be retried.
- [ ] Ensure idempotent checkout: double-clicks/retries return the original result rather than duplicate sales, inventory deductions, or commissions.
- [ ] Prevent an appointment from being paid twice and distinguish a completed service from its payment status.
- [ ] Produce unique receipts, a print-friendly receipt view, transaction history, and receipt reprint.
- [ ] Implement manager-authorized void/refund workflows with reason, payment reversal, correct stock treatment, and commission adjustments. Preserve original records.
- [ ] Refresh Dashboard, Inventory, customer history, and appointment payment state after a successful checkout.

**Exit criterion:** one paid service/product sale produces exactly one payment, receipt, expected stock deduction, and commission entry. A failed checkout changes none of them.

## Phase 8 - Payroll, Reports, Analytics, and Activity Logs

**Goal:** turn the operational records into useful management information.

- [ ] Build payroll period selection, base-pay inputs, earned commissions, documented additions/deductions, manager approval, cash payout recording, and printable payroll summaries.
- [ ] Freeze approved payroll calculations and prevent an earning from being included twice. Handle reversals after payout through a documented adjustment in a later period.
- [ ] Generate daily, weekly, and monthly reports with date filters, gross/net sales, refunds, payment method breakdown, and service/product totals.
- [ ] Add service-demand and stylist-performance charts, backed by report APIs. Select one chart library rather than installing both alternatives in the architecture.
- [ ] Replace hard-coded Dashboard values with database aggregates for today's sales/appointments, new customers, and low-stock alerts.
- [ ] Provide downloadable CSV and a print layout that can be saved as PDF for sales/payroll reports; include a dedicated PDF generator only if required by the final format.
- [ ] Add manager-only activity log filtering by actor, action, and date. Cover login events, account changes, bookings, checkout, refunds, stock adjustments, payroll approval, and settings changes without logging secrets.
- [ ] Make revenue/report definitions consistent and document how cancelled, unpaid, and refunded transactions are treated.

**Exit criterion:** report totals reconcile with transaction/payment records, and a seeded payroll example matches a documented manual calculation.

## Phase 9 - Integration Verification and Presentation Readiness

**Goal:** verify the workflows that protect business data and make the presentation reliable.

- [ ] Add targeted backend tests for role/ownership checks, availability/overlap, money rounding, stock posting, idempotent checkout, transaction rollback, refunds, and payroll inclusion rules.
- [ ] Run database integration tests against a separate test database, including concurrent booking and last-unit stock checkout cases.
- [ ] Run frontend lint/build checks and a browser smoke test of login -> booking -> service completion -> checkout -> stock/history/report updates -> payroll.
- [ ] Verify pagination/filtering, invalid input, session expiry, empty datasets, API/network failures, and readable errors without false success messages.
- [ ] Check booking date boundaries, closures, long services, and report periods using `Asia/Manila`.
- [ ] Verify responsive layouts on the presentation laptop and a narrow/mobile viewport; check labels, keyboard navigation, focus, and print output.
- [ ] Agree a representative demo dataset and measure response times. Target ordinary booking/checkout/report requests within a few seconds; record the dataset and machine used.
- [ ] Test persistence across browser refresh and backend/PostgreSQL restart; rehearse database backup and restore into a separate demo database.
- [ ] Remove runtime dependencies on external fonts, CDNs, or placeholder APIs needed by the demo. Install dependencies before presentation day and verify the local presentation without internet.
- [ ] Update `README.md`, API documentation, the requirement checklist, and known limitations; keep demo reset clearly separated from normal startup.

**Exit criterion:** all critical business tests and the full presentation scenario pass, with no unresolved blocker for local-scope features.

## Phase 10 - Localhost Deployment and Presentation

**Goal:** run the built frontend and API together on the presentation computer, backed by local PostgreSQL.

### Deployment design

- Development: Vite on `http://localhost:5173`, proxying `/api` to Express on port `3000`; PostgreSQL on local port `5432`.
- Presentation: Express serves both the built `dist/` frontend and `/api` at **`http://localhost:3000`**. Configure local presentation binding to loopback, API routes before the SPA fallback, and direct-route refresh support.
- Load configuration from `server/.env` using a documented path. Set `DATABASE_URL` to the dedicated demo database, `JWT_SECRET` to a generated secret, `PORT=3000`, `HOST=127.0.0.1`, `APP_ORIGIN=http://localhost:3000`, and `APP_TIMEZONE=Asia/Manila`. Select the intended local HTTP cookie behavior explicitly.
- Keep PostgreSQL running independently of the web app. A configured connection string does not create or start the database server.
- Vite's preview command is useful for a local build check. The planned presentation uses Express to serve the complete application. Vite documents that preview is not a production server. [Vite deployment guide](https://vite.dev/guide/static-deploy.html)

### Scripts to implement

Phase 1 added `dev:server`, `dev:all`, `start`, and `test` alongside the existing frontend scripts. Database migration and seed scripts remain **planned for Phase 2** and must exist before using the full presentation runbook below:

| Root script | Planned behavior |
| --- | --- |
| `dev:server` | Run the Express backend in watch mode via `server/package.json` |
| `dev:all` | Start Vite and the backend together with coordinated shutdown |
| `start` | Run `npm --prefix server start`; backend serves `dist/` and the API |
| `db:migrate` | Run versioned backend migrations against the configured database |
| `db:seed:demo` | Load demo fixtures with safeguards against production use |
| `test` | Run the critical automated business/API tests |

### First-time presentation setup

- [ ] Install the documented Node runtime and PostgreSQL; ensure PostgreSQL client tools are available for backup/restore.
- [ ] Create the application database user and the dedicated demo database; copy `server/.env.example` to `server/.env` and fill the local values.
- [ ] Implement and document the planned scripts; ensure `server/package-lock.json` is committed before using `npm ci`.
- [ ] Run these commands from the project root **after the preceding implementation phases are complete**:

```powershell
npm ci
npm --prefix server ci
npm run db:migrate
npm run db:seed:demo
npm run lint
npm test
npm run build
npm start
```

- [ ] Open `http://localhost:3000`, confirm `/api/health`, and test refreshing a protected route. Keep the start process running throughout the demonstration.
- [ ] Create and verify a demo database backup; document how to restore the pre-presentation state. Do not reseed on every normal startup.
- [ ] Write `docs/local-deployment.md` with first-time setup, everyday start/stop instructions, environment settings, backup/restore, and fixes for occupied ports/database connection failures.

### Presentation rehearsal

Use prepared fictitious customer data and role-specific demo accounts. Seed dates relative to the presentation date so appointments and dashboard cards remain useful.

1. Log in as manager; show database-backed sales, appointments, and low-stock metrics.
2. Switch to customer; book an available service and retain the booking reference.
3. Switch to receptionist/stylist; find the booking, demonstrate an overlapping-slot rejection, and mark the service completed.
4. Open the booking in POS; finalize cash/e-wallet payment and display or print the receipt.
5. Show the resulting stock movement, customer service history, commission entry, and updated daily report.
6. Restock a low product as manager and show the alert resolving.
7. Generate the payroll preview and demonstrate restricted access from another role.
8. Restart the application and show that the data persists.

- [ ] Write `docs/presentation-guide.md` with account roles, demo steps, expected results, and recovery instructions. Keep actual passwords out of public documentation.
- [ ] Rehearse on the actual laptop/projector, with print/PDF output and internet disconnected.
- [ ] Keep a known-good build, verified backup, and presentation screenshots available as recovery artifacts.

**Exit criterion:** the full scenario completes from the built application on localhost, all required data persists in PostgreSQL, and another developer can reproduce setup using the documentation.

## Phase 11 - Optional/Future Render Deployment

**Goal:** publish the verified application without changing its core workflows.

The proposed first hosted topology is **one Render Node web service serving the React build and Express API, plus Render Postgres**. This reuses the presentation arrangement and relative `/api` URLs. A separate static frontend can be considered later if there is a clear need.

- [ ] Create a remote Git repository and push the verified code/lockfiles without environment files, backups, or secrets. Link the intended deployment branch to Render.
- [ ] Create Render Postgres and the web service in the same region; use the database's internal URL as backend `DATABASE_URL`. Validate the connection/TLS configuration for the selected driver and URL. [Render Postgres connections](https://render.com/docs/postgresql-creating-connecting)
- [ ] Set the service root to the repository root. Use a build command of `npm ci && npm --prefix server ci && npm run build` and a start command of `npm start`, after these scripts exist.
- [ ] Configure Express to bind to `HOST=0.0.0.0` and the platform-provided `PORT` rather than a hard-coded local port. [Render web service port binding](https://render.com/docs/web-services#port-binding)
- [ ] Set hosted secrets/configuration in Render: production mode, database URL, new JWT secret, public HTTPS app origin, Manila timezone, and secure-cookie behavior. Keep backend secrets out of frontend build variables.
- [ ] Configure trusted proxy handling for HTTPS cookies, request origin checks, login rate limiting, and `/api/health` as the deployment health check.
- [ ] Run versioned migrations before releasing traffic. Paid services can use `npm run db:migrate` as a pre-deploy command. For a free demonstration service, document a controlled migration run from a trusted machine before deployment; do not assume pre-deploy hooks or shell access are available. [Render deploy commands](https://render.com/docs/deploys#pre-deploy-command)
- [ ] Bootstrap a manager account using a controlled one-time process. Load fictitious fixtures only into a separate hosted demo database; disable demo reset and remove fixed demo accounts for real salon use.
- [ ] Review the selected service/database plans before launch. Free web services currently sleep after 15 idle minutes, and free Postgres expires after 30 days and has no managed backups. A continuing salon deployment needs suitable paid resources and a tested backup/restore process. Recheck these limits when deploying. [Render free-instance limits](https://render.com/docs/free)
- [ ] Persist business records in Postgres. Keep receipts regenerable from records, and use durable storage for future uploads; Render's default filesystem is ephemeral. [Render filesystem behavior](https://render.com/docs/deploys#ephemeral-filesystem)
- [ ] Verify HTTPS login, customer ownership, direct-route refresh, booking conflict handling, checkout, report totals, and persistence after redeploy. Check deployment/runtime logs without exposing secrets.
- [ ] Document deployment/redeployment, monitoring, backups, and rollback. Use compatible schema changes: rolling back application code does not automatically reverse database migrations.
- [ ] Add `render.yaml` only after the service/database configuration is verified; keep secrets in Render rather than in the manifest.

**Exit criterion:** the hosted URL passes the local workflow smoke tests over HTTPS, records survive redeployment, and operating costs, backup ownership, and recovery steps are documented.

## 3. Requirement Coverage and Final Acceptance

| Requirement | Implementation phase | Evidence required for localhost completion |
| --- | --- | --- |
| Unique employee login and access control | 3 | Valid login works; forbidden API requests fail |
| Record and process payments | 7 | Persisted cash/e-wallet transaction and receipt; configurable card record type |
| Automatic stock update after transactions | 6-7 | Exact service/retail movements posted once |
| Low-stock notification | 6, 8 | Manager alert reflects threshold and resolves after restock |
| Daily/weekly/monthly sales reports | 8 | Date-filtered totals reconcile with persisted payments/refunds |
| Customer database/history/preferred stylist | 4, 7 | Profile edits and completed service history persist |
| Customer booking | 5, 10 | Persisted booking, availability checks, and conflict rejection on localhost |
| Payroll and commissions | 7-8 | Documented calculation matches payroll output; no duplicate earnings |
| Service demand and stylist analytics | 8 | Charts reflect seeded and newly completed transactions |
| Service/employee/settings management | 4 | Authorized changes affect dependent workflows |
| Activity logs | 3-8 | Important state changes have actor/action/time/reason records |
| Usability, security, performance, reliability | 9-10 | Role checks, measured response times, usable layouts, offline demo, restart and restore checks |

### Completion checklist

- [ ] The visible UI uses API/database data for all local-scope workflows.
- [ ] Authentication and role/customer ownership are enforced by the backend.
- [ ] Booking, checkout, stock, and payroll integrity checks pass.
- [ ] Reports reconcile with the underlying records; PDF/print output is readable.
- [ ] Local setup, startup, backup/restore, and demo instructions are reproducible.
- [ ] The built application is successfully presented at `http://localhost:3000`.
- [ ] Remaining enhancements and any Render deployment are recorded separately from completed local work.

### Future enhancements after the presentation

Prioritize these after Phase 10, based on salon needs: Render hosting/public booking, email/SMS reminders, a payment gateway with verified webhooks, loyalty/promotions, attendance-driven payroll, additional payroll rules, supplier/purchase management, and multi-branch support. Keep the PostgreSQL schema, APIs, and configuration extensible without making these features prerequisites for the localhost milestone.
