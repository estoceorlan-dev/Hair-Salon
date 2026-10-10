# Fictitious Demo Fixtures

The executable seed lives in `src/db/demo-seed.js`. Run `npm run db:seed:demo -- --date=2026-10-12` from the root. Without `--date`, the first load uses the current Manila date. Subsequent loads preserve the original reference date and skip existing fixtures.

Stable UUIDs and a seed checksum/version prevent duplicate imports. Amounts and schedules are illustrative. Commission, payroll, consumption, tax/discount policies, and role grants remain undefined. All payment methods are disabled; the two historical cash entries are explicitly marked demo records and do not process money.

Only the local, marked `romel_salon_demo` database can be seeded by the CLI. Fixture operations are denied in production and against other targets. Generated account passwords are stored in ignored `.local-runtime/demo-accounts.json`; no authentication endpoint exists yet.

To clear and reload fictitious records, use `npm run db:reset:demo -- --confirm=romel_salon_demo`, followed by the seed command. Schema/migration history and reference definitions remain; business history and old settings-author links are cleared. Normal migrations and application startup never reset or seed.
