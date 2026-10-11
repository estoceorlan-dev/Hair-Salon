# Romel Hair Salon

React + Vite frontend, Express API, and PostgreSQL salon management system. Phases 0-3 are implemented, including verified sessions, role access, customer registration, and manager-managed employee accounts. Business rules remain placeholders. GCash, Maya, card, and cash checkout remain disabled/display-only.

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
- [Implemented role access](docs/role-permissions.md)
- [Authentication and account setup](docs/authentication.md)
- [Business-rule placeholders](docs/business-rules.md)
- [Database model and data dictionary](docs/database-model.md)
- [Local setup and troubleshooting](docs/local-deployment.md)
- [Foundation presentation guide](docs/presentation-guide.md)

## Implementation boundaries

`src/` contains the UI, session provider, permission guards, account forms, shared feedback, placeholder configuration, and Axios client. `server/` contains authentication/access services, configuration, PostgreSQL, middleware, health/payment placeholder routes, four migrations, local setup tooling, guarded fixtures/reset, and database integration tests. Separate lockfiles make installs reproducible.

Sign-in uses revocable database-backed JWT sessions in HttpOnly cookies. The UI reads only authorized appointments, personal earnings, and customer history; other business screens remain samples/placeholders. Payment endpoints require an authorized account and still return 501. Provider flags remain disabled. Render remains optional Phase 11.

`npm run db:migrate` changes schema without seeding/resetting; `npm run db:seed:demo` loads the dedicated local demo once. To explicitly rebuild only that demo dataset, use `npm run db:reset:demo -- --confirm=romel_salon_demo`, then seed again. See setup docs for target selection and safeguards.

The foundation uses Express route/controller/service modules, React Router's declarative routes, and Vite's proxy. Technical references: [Express error handling](https://expressjs.com/en/5x/guide/error-handling/), [React Router installation](https://reactrouter.com/start/declarative/installation), [PostgreSQL connection pooling](https://node-postgres.com/apis/pool), and [Vite server options](https://vite.dev/config/server-options).
