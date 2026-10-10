# Local Setup - Phases 0, 1, and 2

## Prerequisites

Use Node 22.18+ in the 22.x line, or Node 24.x, with npm. `.nvmrc` records the runtime used here (22.18.0). The installed Vite package requires Node 20.19+ or 22.12+; this project standardizes on the newer tested runtime.

PostgreSQL 18.3 binaries are installed at `C:\Program Files\PostgreSQL\18\bin`. Phase 2 uses them for a workspace cluster on `127.0.0.1:5433`, containing separate development/demo/test databases owned by a dedicated non-superuser application role.

## Install and development startup

Run from `C:\Romel Hair salon`:

```powershell
npm ci
npm --prefix server ci
npm run db:local:setup
npm run db:seed:demo -- --date=2026-10-12
npm run dev:all
```

`db:local:setup` initializes/starts PostgreSQL, creates the role and three databases, applies migrations, records their environment identities, and generates connection URLs in ignored `server/.env`. Repeating setup retains data and credentials. It refuses to replace existing URLs pointing elsewhere. Leave `JWT_SECRET` empty until Phase 3.

The cluster, bootstrap credentials, logs, and demo account credentials live in ignored `.local-runtime/`. The API uses `romel_salon_dev`; seeding explicitly targets `romel_salon_demo`; integration tests explicitly target `romel_salon_test`. Setup uses SCRAM password authentication. [PostgreSQL initdb options](https://www.postgresql.org/docs/18/app-initdb.html)

If the binary path differs, set `$env:PG_BIN` to the installed directory before setup. If port 5433 is occupied, set `$env:ROMEL_PG_PORT` to an available port before the first setup; the chosen port is retained in local metadata. Existing PostgreSQL service databases on port 5432 are outside this setup.

Open **http://localhost:5173**. Vite binds to loopback and proxies `/api` to `http://127.0.0.1:3000`; keep the default backend port while using this proxy. `dev:all` starts both processes and stops the other if one exits. Press Ctrl+C to stop them.

To run them in separate terminals, use `npm run dev` and `npm run dev:server`. After a computer restart, run `npm run db:local:start` before starting the application. `npm run db:local:stop` stops only the workspace cluster. Restart the API after editing `.env`.

## Database commands

```powershell
# Development migrations; no seed or reset runs here.
npm run db:migrate
npm run db:status

# Select the separate demo database explicitly.
npm run db:migrate -- --target=demo
npm run db:seed:demo -- --date=2026-10-12

# Remove only the marked local demo dataset, then reload it.
npm run db:reset:demo -- --confirm=romel_salon_demo
npm run db:seed:demo -- --date=2026-10-12

# Tests reset only the dedicated marked test database.
npm test
npm run test:db
```

Migrations are transactionally applied and checksum-tracked; add a new numbered file instead of modifying applied SQL. Fixtures have stable IDs, a reference date, and a seed checksum. A seed rerun does nothing when that version is already present. An edited seed version requires an explicit demo reset or a new seed version.

Reset requires the exact name, loopback connection, matching database identity, and non-production environment. It preserves schema/migration metadata and reference definitions while clearing fictitious business data and old settings-author links. It never accepts the development database as a target. Generated passwords persist in `.local-runtime/demo-accounts.json`, and demo users are not usable for sign-in until Phase 3.

## Connection checks

- `GET /api/live`: 200 when Express is running.
- `GET /api/health`: 503 with `database.status: not_configured` when the URL is empty; 503 with `unavailable` when the database cannot be reached; 200 only after `SELECT 1` succeeds.
- Settings -> Connection status calls health through the frontend API client and distinguishes API failure from database setup pending.
- `POST /api/payments` (and nested payment paths) returns 501 `PAYMENTS_NOT_IMPLEMENTED`. No checkout/provider operations exist.

After local setup, readiness should be 200. To use an already configured PostgreSQL instance instead, privately set the three URLs in `server/.env`, create dedicated databases with the documented names, and migrate each target. Fresh migrations intentionally mark databases as production; only an explicitly designated demo/test database may have its `salon.database_identity.environment` changed to permit fixtures. Never relabel a real-data database to bypass the guard.

Business screens still use UI fixtures. Connecting the database does not enable checkout, reserved bookings, or authentication.

## Build and serve the preview through Express

```powershell
npm run lint
npm test
npm run build
npm start
```

Open **http://localhost:3000**. Express serves `dist/` and `/api` together; `/app/pos` and other frontend URLs support direct reload. Unknown API routes return JSON 404, and missing asset files return 404 rather than HTML. Stop `dev:all` before `npm start` because both use port 3000. The final integrated presentation remains Phase 10.

`npm run preview` is also available for a Vite build check and proxies `/api`, but requires the backend to run separately. Vite preview is intended for local previews. [Vite guide](https://vite.dev/guide/static-deploy.html)

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Port 3000/5173 is occupied | Stop the previous project process; do not terminate an unknown process. If changing backend port, update the Vite proxy too. |
| Settings reports no connection | Start `npm run dev:all`; inspect the API terminal for startup/config errors. |
| Readiness is 503 | Run `db:local:start` or `db:local:setup`; restart the API after adding/editing connection URLs. |
| Configuration validation fails | Fix the named variable in `.env`; use a valid HTTP origin with no path/trailing slash and a valid timezone. |
| Browser shows an older build | Rebuild `dist/`, then restart Express. |
| Preview route redirects to entry | Choose employee/customer preview first; real authentication is future work. |
| Payment controls are disabled | Intended: all providers and checkout are placeholders. |

## Data persistence and recovery

Data persists in `.local-runtime/postgres` across app/cluster restarts. Keep that directory and the ignored credentials files together; Git stores schema/seed source, not the local database or passwords. The demo can be recreated through its guarded reset/seed commands; development data is never reset by these commands. A tested business backup/restore procedure remains part of Phases 9-10.

See the [schema and data dictionary](database-model.md) for constraints, nullable definitions, and fixture contents.
