# Vercel and Neon deployment

The repository deploys as one Vercel project. Vite produces static assets in `dist`. Requests under `/api` run the existing Express app in a Node function on the same origin. The function connects to Neon Postgres and Neon Object Storage. [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)

## Prepare a Neon branch

This checkout is linked to project `small-moon-82681867`, branch `production`, in Singapore. `neon.ts` declares the private `salon-images` bucket. Run `neon deploy` to reconcile that configuration and refresh the branch credentials in ignored `.env.local`.

The local server loads environment files in this order: root `.env.local`, root `.env`, then `server/.env`. Variables supplied by the hosting runtime take precedence. Set `NEON_STORAGE_BUCKET=salon-images`, `DB_CONNECTION_TIMEOUT_MS=10000`, and a private `JWT_SECRET` alongside the pulled variables. The existing Node `pg` pool uses `DATABASE_URL`, and the image API uses the pulled `AWS_*` credentials.

1. Create a Neon project in a region that offers Object Storage. Singapore (`aws-ap-southeast-1`) is one option near the salon's Manila timezone. Create a separate branch for preview deployments.
2. For each branch, obtain its pooled and direct connection strings from the Neon connection dialog. Preserve the TLS query parameters. The web function uses the pooled URL and release commands use the direct URL because schema migrations hold a session advisory lock. [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
3. Link the Neon CLI to the project and select the intended branch. Create a private bucket named `salon-images` and obtain the branch's S3 endpoint, region, access key and secret key. The Neon quickstart documents credential creation and the `neon buckets create salon-images` command. [Neon Object Storage quickstart](https://neon.com/docs/storage/get-started)

## Apply migrations and create the first manager

On a trusted workstation with Node 22.18+ (22.x) or 24.x, install the API dependencies with `npm ci --prefix server`. Create an ignored file named `.env.release.local` in the project root using private values for these four entries.

```dotenv
DATABASE_URL_UNPOOLED=
MANAGER_NAME=
MANAGER_EMAIL=
MANAGER_PASSWORD=
```

Use a unique manager password of at least 12 characters and at most 72 UTF-8 bytes. Quote values containing spaces or `#`. From the project root run

```sh
node --env-file=.env.release.local server/scripts/release.js migrate
node --env-file=.env.release.local server/scripts/release.js first-manager
```

The migration command applies pending SQL files and verifies previously applied checksums. The bootstrap creates an account, employee profile and audit entry in one transaction. Running it again preserves the existing manager. Keep the manager credentials in your password manager, then remove the bootstrap variables from your release environment. Run the migration command on the matching branch before each deployment that adds migrations.

## Configure Vercel

Import the repository with the root directory set to the repository root. Select Node 22.x or 24.x. The committed `vercel.json` installs both lockfiles, builds the frontend and handles API and application routes. Choose a function region near your Neon project.

Set the following server-side variables for Production and separately for Preview. Store database URLs, signing secrets and storage credentials as Vercel secrets. Vercel applies changed settings on the next deployment. [Vercel environment variables](https://vercel.com/docs/environment-variables)

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL URL for this environment's Neon branch |
| `JWT_SECRET` | Random signing secret, at least 32 characters, unique per environment |
| `APP_ORIGIN` | Exact canonical HTTPS origin, with no trailing slash. For Preview, leave unset to use Vercel's individual deployment URL and open that URL. |
| `TRUST_PROXY_HOPS` | `1` on Vercel |
| `DB_CONNECTION_TIMEOUT_MS` | `10000` to accommodate Neon compute wake-up |
| `NEON_STORAGE_BUCKET` | `salon-images` |
| `AWS_ENDPOINT_URL_S3` | Branch-specific HTTPS storage endpoint |
| `AWS_REGION` | Neon bucket region, such as `ap-southeast-1` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Neon branch storage credential pair |

The function reads these variables at runtime. Keep the `VITE_` prefix reserved for intentionally public browser configuration. Vercel's Node runtime accepts the listed AWS variable names. [Vercel reserved environment variables](https://vercel.com/docs/environment-variables/reserved-environment-variables)

## Check the deployment

Open `/api/live` for function liveness and `/api/health` for database connectivity. Sign in on the configured origin, reload a deep link such as `/app/services`, save an image, and reload the record to verify storage with the deployed credentials. An expired session should send the browser back to sign-in. Configure the salon's services, staff assignments, business hours and prices before taking bookings.
