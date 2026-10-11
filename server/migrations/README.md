# Versioned Database Migrations

`001` creates identity, role, profile, catalog, and placeholder configuration tables. `002` creates appointment, stock, sales/payment, commission, payroll, and logging storage. `003` adds integrity triggers. `004` adds revocable authentication sessions and conservative role grants; it does not enable financial/booking writes.

Run `npm run db:migrate` from the project root; select another configured database with `-- --target=demo` or `-- --target=test`. Each file executes transactionally under a migration lock and is recorded in `public.schema_migrations` with its SHA-256 checksum. Windows and Unix line endings are normalized before hashing.

Applied migrations are immutable. Add a new numbered SQL file for changes. Migrations never run seeds, drop application data, or infer business policies. Newly migrated databases default to a production identity so fixture/reset commands are denied until a dedicated local demo/test database is explicitly provisioned.

See [database model](../../docs/database-model.md) and [local setup](../../docs/local-deployment.md).
