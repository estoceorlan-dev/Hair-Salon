# Authentication and Access - Phase 3

## Local sign-in

Run `npm run db:local:setup`, then `npm run auth:local:setup` and restart the API. The authentication command generates a private JWT secret in ignored `server/.env` and creates the first manager only when the marked local development database has no accounts. Its generated credentials are in ignored `.local-runtime/manager-account.json`. Repeating it retains accounts, passwords, and the secret. It refuses production, remote, demo, test, and unmarked databases.

Open `http://localhost:5173` and sign in with those local credentials. A manager can create employee accounts under **Employee Accounts**. Customers use **Create an account** on the entry page. Registration always creates a new linked customer profile; it cannot select an employee role or claim an existing walk-in/customer record. Existing profile linking, email verification, password recovery, and invitations remain future work.

Demo accounts are separate from development accounts. To use them, explicitly set `DATABASE_URL` to the existing `DEMO_DATABASE_URL` value privately in `server/.env`, migrate that target, and restart the API. Credentials are in ignored `.local-runtime/demo-accounts.json`; return `DATABASE_URL` to the development URL afterward. Do not run local authentication bootstrap while targeting the demo. Production rejects all `is_demo` accounts, including already issued sessions.

## Sessions and password controls

- New account/password hashes use bcrypt cost 12. Passwords require 12 characters and at most 72 UTF-8 bytes; fixture hashes from Phase 2 retain their existing cost.
- JWTs use HS256, an explicit issuer/audience, user/session UUIDs, token version, and expiry. The default lifetime is eight hours; `SESSION_TTL_SECONDS` accepts 60-86400 seconds. There is no refresh token or silent extension.
- The JWT is carried only by an HttpOnly, SameSite=Lax cookie scoped to `/api`. React stores the returned profile in memory. It restores identity from `/api/auth/session`, clears it on expiry/401, and rechecks on window focus. Legacy preview storage no longer grants access.
- Every protected request checks the database session, expiry/revocation, current user role/grants, token version, and active employee/customer profile. Logout revokes the current session. Password changes revoke every session. Manager edits revoke all sessions for the affected account, including email/name edits.
- Managers can create/edit accounts, reset passwords, change employee roles, and deactivate/reactivate accounts. An advisory lock protects the last active manager against concurrent demotion/deactivation. No account deletion API exists.
- Authentication/account-change actions are recorded in the append-only activity log without passwords, hashes, tokens, or submitted credential bodies.

## Request protection and hosted configuration

All implemented writes require `application/json`, an exact trusted `Origin`, and `X-Romel-Request: browser`. The browser supplies Origin; Axios supplies the custom header. The application does not enable cross-origin CORS. This applies to login and registration as well as cookie-authenticated changes, preventing login CSRF and cross-origin form submissions. SameSite cookies provide an additional layer. This follows [OWASP's custom-header and origin guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Development accepts the configured origin plus localhost/127.0.0.1 at the configured UI/API ports and preview port 4173. Production accepts only `APP_ORIGIN`, requires it to use HTTPS, requires `DATABASE_URL` and a 32+ character `JWT_SECRET`, and uses Secure cookies/HSTS. `TRUST_PROXY_HOPS` defaults to 0; set it to 1 only behind a single trusted reverse proxy, such as the future Render service. [Express production security](https://expressjs.com/en/advanced/best-practice-security.html), [JWT verification options](https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback)

Account login/registration/password attempts share an IP limit of 20 requests per 15 minutes. The current limiter is in memory for a single localhost/server process; multiple hosted instances require a shared store. API responses have `Cache-Control: no-store`. Public liveness/readiness expose no accounts; unknown APIs return JSON 404.

## API contracts

| Method / endpoint | Access / behavior |
| --- | --- |
| `POST /api/auth/login` | Email/password; sets session cookie; returns safe user profile and expiry |
| `POST /api/auth/register` | Name/email/password, optional phone; creates only a customer and signs in |
| `GET /api/auth/session` | Verified session; current profile/grants/expiry |
| `POST /api/auth/logout` | Verified session; revoke this device and clear cookie |
| `POST /api/auth/password` | Current/new password; revoke every device and clear cookie |
| `GET /api/employee-accounts` | Manager with employees.manage; safe account list |
| `POST /api/employee-accounts` | Manager; name/email/password and employee role |
| `PATCH /api/employee-accounts/:id` | Manager; name/email/role/isActive/password changes; revoke affected sessions |
| `GET /api/appointments`, `GET /api/appointments/:id` | Managers/cashiers: salon schedule; stylists/beauticians: assigned; customers: own |
| `GET /api/me/earnings` | Permitted employee's own recorded commissions; undefined amounts remain null |
| `GET /api/me/history` | Customer's own paid service history |
| `GET /api/customers/:id/history` | Manager/cashier or matching customer; other customer IDs return 404 |

Lists currently show at most 100 recent records. Ownership comes from the verified database profile, never supplied customer/employee query parameters. Business create/update booking, master-data, checkout, inventory, payroll, reports, and settings endpoints remain disabled with 501 after authorization. Unauthenticated requests return 401; forbidden requests return 403. Payment endpoints require sales access and still return 501; providers stay disabled in the schema/UI.

## Verification

`npm test` covers configuration, token validation, request origins/content types, rate limiting, validation, and the existing foundation. `npm run test:db` serially resets only `romel_salon_test`, then tests real login/session restoration, registration, bcrypt storage, ownership/tampered IDs, forbidden roles, disabled payment APIs, logout replay, JWT/database expiry, manager changes, all-device password revocation, last-manager protection, and production demo rejection alongside the Phase 2 integrity/concurrency suite.

Authentication does not settle tax, payment, booking, consumption, or payroll rules. See the [access matrix](role-permissions.md) and [business definitions](business-rules.md).
