# Romel Hair Salon

React + Vite frontend, Express API, and PostgreSQL storage foundation for the salon management system. Phases 0-2 are implemented. Business rules remain placeholders; screens use sample data and preview access. GCash, Maya, card, and cash checkout remain disabled/display-only.

## Local development

Use Node 22.18+ (22.x) or 24.x. From the project root:

```powershell
npm ci
npm --prefix server ci
npm run db:local:setup
npm run db:seed:demo -- --date=2026-10-12
npm run dev:all
```

Open **http://localhost:5173**. The UI/API start together; Ctrl+C stops them. Local database setup uses the installed PostgreSQL 18 binaries, creates an isolated cluster on loopback port 5433, and generates ignored connection settings. After a computer restart, use `npm run db:local:start`; use `db:local:stop` to stop that cluster. Leave the JWT secret unset until Phase 3.

Settings checks the API through Vite's `/api` proxy. `/api/live` reports API liveness; `/api/health` returns 200 with a reachable database, or 503 if unavailable/unconfigured. Development, demo, and test databases are separate. The seed has explicitly fictitious historical cash records; no live payment workflow is enabled.

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
- [Proposed role permissions](docs/role-permissions.md)
- [Business-rule placeholders](docs/business-rules.md)
- [Database model and data dictionary](docs/database-model.md)
- [Local setup and troubleshooting](docs/local-deployment.md)
- [Foundation presentation guide](docs/presentation-guide.md)

## Implementation boundaries

`src/` contains the UI, routes, shared feedback, placeholder configuration, and Axios client. `server/` contains configuration, the PostgreSQL pool, middleware, health/payment placeholder routes, three versioned migrations, local setup tooling, guarded fixtures/reset, and database integration tests. Separate lockfiles make installs reproducible.

The sessionStorage preview selection is a navigation convenience, not authentication. PostgreSQL now holds sample accounts/appointments/sales/stock history for later implementation; the UI does not yet read or write these records. All `/api/payments` requests return 501, and provider flags are disabled in the schema. Verified identity/authorization is Phase 3; Render remains optional Phase 11.

`npm run db:migrate` changes schema without seeding/resetting; `npm run db:seed:demo` loads the dedicated local demo once. To explicitly rebuild only that demo dataset, use `npm run db:reset:demo -- --confirm=romel_salon_demo`, then seed again. See setup docs for target selection and safeguards.

The foundation uses Express route/controller/service modules, React Router's declarative routes, and Vite's proxy. Technical references: [Express error handling](https://expressjs.com/en/5x/guide/error-handling/), [React Router installation](https://reactrouter.com/start/declarative/installation), [PostgreSQL connection pooling](https://node-postgres.com/apis/pool), and [Vite server options](https://vite.dev/config/server-options).
