# Romel Hair Salon

React + Vite frontend, Express API, and PostgreSQL salon management system. Phases 0-4 are implemented: verified sessions, role access, customer records/history, a shared service catalog, employee accounts/profiles/availability, and manager settings. Undefined business rules remain placeholders. GCash, Maya, card, and cash checkout remain disabled/display-only.

## Local development

Use Node 22.18+ (22.x) or 24.x. From the project root:

```powershell
npm ci
npm --prefix server ci
npm run db:local:setup
npm run auth:local:setup
npm run db:seed:demo -- --date=2026-10-12
npm run dev:all
```

Open **http://localhost:5173** and sign in using the generated manager credentials in ignored `.local-runtime/manager-account.json`. The UI/API start together; Ctrl+C stops them. Local database setup uses the installed PostgreSQL 18 binaries and an isolated cluster on loopback port 5433. Authentication setup generates an ignored JWT secret and first local manager; repeating it preserves accounts. After a computer restart, use `npm run db:local:start`; use `db:local:stop` to stop that cluster.

Settings persists manager configuration through Vite's `/api` proxy. `/api/live` reports API liveness; `/api/health` returns 200 with a reachable database, or 503 if unavailable/unconfigured. Development, demo, and test databases are separate. The seed has explicitly fictitious historical cash records; no live payment workflow is enabled. Existing installations should run `npm run db:migrate` and `npm run db:migrate -- --target=demo` to apply Phase 4 without resetting records.

## Checks and built preview

```powershell
npm run lint
npm test
npm run test:db
npm run build
npm start
```

Stop the development API first to free port 3000. Open **http://localhost:3000** for the built frontend and API served together. Database-backed transactions and the final presentation are later milestones.

## Project documents

- [Implementation phases](IMPLEMENTATION_PLAN.md)
- [Architecture](ARCHITECTURE.md)
- [Requirement/workflow map](docs/requirements.md)
- [Implemented role access](docs/role-permissions.md)
- [Authentication and account setup](docs/authentication.md)
- [Phase 4 management screens and API contracts](docs/master-data.md)
- [Business-rule placeholders](docs/business-rules.md)
- [Database model and data dictionary](docs/database-model.md)
- [Local setup and troubleshooting](docs/local-deployment.md)
- [Foundation presentation guide](docs/presentation-guide.md)

## Implementation boundaries

`src/` contains the UI, session provider, permission guards, master-record/settings forms, shared catalog, feedback and Axios client. `server/` contains authentication/access and management APIs, configuration, PostgreSQL, middleware, health/payment placeholder routes, five migrations, local setup tooling, guarded fixtures/reset, and database integration tests. Separate lockfiles make installs reproducible.

Sign-in uses revocable database-backed JWT sessions in HttpOnly cookies. Customer/service/employee/settings changes are persisted and audited. POS and customer service choices use the active catalog; booking reservations, inventory operations, checkout and financial calculations remain later work. Dashboard figures remain samples. Payment endpoints require an authorized account and still return 501. Provider flags remain disabled. Render remains optional Phase 11.

`npm run db:migrate` changes schema without seeding/resetting; `npm run db:seed:demo` loads the dedicated local demo once. To explicitly rebuild only that demo dataset, use `npm run db:reset:demo -- --confirm=romel_salon_demo`, then seed again. See setup docs for target selection and safeguards.

The foundation uses Express route/controller/service modules, React Router's declarative routes, and Vite's proxy. Technical references: [Express error handling](https://expressjs.com/en/5x/guide/error-handling/), [React Router installation](https://reactrouter.com/start/declarative/installation), [PostgreSQL connection pooling](https://node-postgres.com/apis/pool), and [Vite server options](https://vite.dev/config/server-options).
