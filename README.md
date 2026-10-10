# Romel Hair Salon

React + Vite frontend and Express API foundation for the salon management system. Phases 0 and 1 are implemented. Business rules remain placeholders; screens use sample data and preview access. GCash, Maya, card, and cash checkout are disabled/display-only.

## Local development

Use Node 22.18+ (22.x) or 24.x. From the project root:

```powershell
npm ci
npm --prefix server ci
npm run dev:all
```

Open **http://localhost:5173**. Both services start together; Ctrl+C stops them. Configuration is optional for the foundation: copy `server/.env.example` to `server/.env` for overrides, leaving database credentials and the JWT secret empty until their later phases.

Settings checks the API through Vite's `/api` proxy. `/api/live` returns 200; `/api/health` returns 503 until the optional PostgreSQL connection is ready. PostgreSQL 18 is running locally, but this milestone does not create/modify an application database.

## Checks and built preview

```powershell
npm run lint
npm test
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
- [Local setup and troubleshooting](docs/local-deployment.md)
- [Foundation presentation guide](docs/presentation-guide.md)

## Implementation boundaries

`src/` contains the UI, routes, shared feedback, placeholder configuration, and Axios client. `server/` contains validated configuration, the PostgreSQL pool, middleware, and health/payment placeholder routes. Separate lockfiles make both installs reproducible.

The sessionStorage preview selection is a navigation convenience, not authentication. There are no real user accounts, saved bookings, checkout, provider SDKs, or business activity records. All `/api/payments` requests return 501. Database schema/seeds are Phase 2, verified identity/authorization is Phase 3, and Render deployment is optional Phase 11.

The foundation uses Express route/controller/service modules, React Router's declarative routes, and Vite's proxy. Technical references: [Express error handling](https://expressjs.com/en/5x/guide/error-handling/), [React Router installation](https://reactrouter.com/start/declarative/installation), [PostgreSQL connection pooling](https://node-postgres.com/apis/pool), and [Vite server options](https://vite.dev/config/server-options).
