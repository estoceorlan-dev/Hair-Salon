# Local Setup - Phases 0 and 1

## Prerequisites

Use Node 22.18+ in the 22.x line, or Node 24.x, with npm. `.nvmrc` records the runtime used here (22.18.0). The installed Vite package requires Node 20.19+ or 22.12+; this project standardizes on the newer tested runtime.

PostgreSQL 18 is installed/running on the development machine. No application database/user/schema is created in this milestone, and no existing database is modified. PostgreSQL credentials are optional for running the UI/API foundation.

## Install and development startup

Run from `C:\Romel Hair salon`:

```powershell
npm ci
npm --prefix server ci
Copy-Item -LiteralPath server/.env.example -Destination server/.env
npm run dev:all
```

Copy the example only on initial setup; retain an existing `.env`. The API also runs without this file using validated defaults. Leave `DATABASE_URL` and `JWT_SECRET` empty until their respective phases. Real environment files are ignored by Git.

Open **http://localhost:5173**. Vite binds to loopback and proxies `/api` to `http://127.0.0.1:3000`; keep the default backend port while using this proxy. `dev:all` starts both processes and stops the other if one exits. Press Ctrl+C to stop them.

To run them in separate terminals, use `npm run dev` and `npm run dev:server`.

## Connection checks

- `GET /api/live`: 200 when Express is running.
- `GET /api/health`: 503 with `database.status: not_configured` when the URL is empty; 503 with `unavailable` when the database cannot be reached; 200 only after `SELECT 1` succeeds.
- Settings -> Connection status calls health through the frontend API client and distinguishes API failure from database setup pending.
- `POST /api/payments` (and nested payment paths) returns 501 `PAYMENTS_NOT_IMPLEMENTED`. No checkout/provider operations exist.

Phase 2 will define the dedicated app user/database and migrations. Later, set a valid `postgresql://USER:PASSWORD@HOST:5432/DATABASE` URL privately in `server/.env`. Do not guess existing credentials, expose them in screenshots, or seed an existing database.

## Build and serve the preview through Express

```powershell
npm run lint
npm test
npm run build
npm start
```

Open **http://localhost:3000**. Express serves `dist/` and `/api` together; `/app/pos` and other frontend URLs support direct reload. Unknown API routes return JSON 404, and missing asset files return 404 rather than HTML. Stop `dev:all` before `npm start` because both use port 3000. This is a built UI/API preview; the database-backed presentation remains Phase 10.

`npm run preview` is also available for a Vite build check and proxies `/api`, but requires the backend to run separately. Vite preview is intended for local previews. [Vite guide](https://vite.dev/guide/static-deploy.html)

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Port 3000/5173 is occupied | Stop the previous project process; do not terminate an unknown process. If changing backend port, update the Vite proxy too. |
| Settings reports no connection | Start `npm run dev:all`; inspect the API terminal for startup/config errors. |
| Readiness is 503 | Expected before Phase 2. An optional configured URL must point to a reachable PostgreSQL database. |
| Configuration validation fails | Fix the named variable in `.env`; use a valid HTTP origin with no path/trailing slash and a valid timezone. |
| Browser shows an older build | Rebuild `dist/`, then restart Express. |
| Preview route redirects to entry | Choose employee/customer preview first; real authentication is future work. |
| Payment controls are disabled | Intended: all providers and checkout are placeholders. |

Backup/restore and guarded seed/reset instructions will be added when Phase 2 creates an application database. Do not run nonexistent `db:migrate` or `db:seed:demo` scripts yet.
