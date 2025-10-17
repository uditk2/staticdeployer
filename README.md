# Static Deployer (Cloudflare)

Static site control-plane that uploads build artifacts to Cloudflare R2, maps hostnames via Workers KV, and serves traffic through a Cloudflare Worker.

## Prerequisites
- Node.js 18 or later.
- Cloudflare account with:
  - R2 bucket for site assets.
  - Workers KV namespace for host → version mappings.
  - API Token with **Workers KV Storage:Edit** and R2 permissions.
- `wrangler` is provided via devDependencies; authenticate with `wrangler login`.

## Env Configuration
1. Copy `.env.example` to `.env` and fill every field (see definitions below).
2. The control-plane server requires the `CF_*` and `R2_*` values to be present before you run `npm run dev`.
3. For Wrangler commands, comment out the `CF_ACCOUNT_ID` / `CF_API_TOKEN` lines first and authenticate with `wrangler login`. After login, restore them so the server can start.
4. Regenerate `worker/wrangler.toml` (see **Toml Generation**) whenever you change any `WRANGLER_*`, `WORKER_NAME`, or route variables.


### Environment variable reference
- `CF_ACCOUNT_ID` / `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account that owns the KV namespace and R2 bucket.
- `CF_API_TOKEN` / `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers KV edit + R2 permissions.
- `CF_KV_NAMESPACE_ID`: KV namespace ID used by the control plane.
- `R2_ACCOUNT_ID`: Account ID hosting the R2 bucket.
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`: R2 API credentials used by the control plane uploader.
- `R2_BUCKET`: Name of the R2 bucket that stores the deployed site files.
- `R2_REGION`: R2 region (typically `auto`).
- `R2_BASE_URL`: Optional override for the R2 endpoint; not required for the current code path.
- `PUBLIC_BASE_DOMAIN`: Default domain used when constructing preview URLs in logs.
- `WRANGLER_ACCOUNT_ID`: Account injected into `worker/wrangler.toml`.
- `WRANGLER_KV_NAMESPACE_ID`: KV namespace binding for the Worker.
- `WRANGLER_R2_BUCKET_NAME`: R2 bucket binding name for the Worker.
- `WRANGLER_ROUTE_PATTERN`: Route pattern placed into `worker/wrangler.toml`.
- `WRANGLER_ZONE_NAME`: Zone name paired with the route pattern.
- `WORKER_NAME`: Worker name written to `worker/wrangler.toml`.
- `REDIRECT_DOMAIN`: Worker runtime env; redirects `www.<domain>` to the apex.
- `ROUTE_PATTERN` / `ROUTE_ZONE_NAME`: Worker runtime hints that mirror the Wrangler route (informational, not read by the Worker).

## Local Deployment
- Install deps: `npm install`
- Start the API: `npm run dev` (listens on `http://localhost:3000`)
- Bundle your static site as a zip (you can zip the entire build folder; the server auto-detects a single top-level directory and uses it as the content root).
- Publish a build:
  ```bash
  curl -F tenant=<tenant> \
       -F host=<host.example.com> \
       -F archive=@dist.zip \
       http://localhost:3000/publish
  ```
- Update an existing mapping:
  ```bash
  curl -H "Content-Type: application/json" \
       -d '{"host":"<host.example.com>","tenant":"<tenant>","version":"<build>"}' \
       http://localhost:3000/mapping
  ```
- Unpublish a site (removes host mapping, keeps R2 files):
  ```bash
  curl -X POST -H "Content-Type: application/json" \
       -d '{"host":"<host.example.com>"}' \
       http://localhost:3000/unpublish
  ```

## Request Params
- `POST /publish` (`multipart/form-data`)
  - Fields: `tenant`, `host`, optional `version`, optional `root` (defaults to `index.html`)
  - File: `archive` (zip containing the site root)
  - Response: `{ ok, uploaded, mapping, url }`
- `POST /mapping` (`application/json`)
  - Body: `{ host, tenant, version, root? }`
- `POST /unpublish` (`application/json`)
  - Body: `{ host }`
  - Response: `{ ok, host, mapping }` (mapping is null if host wasn't mapped)

## Worker Deployment
- Ensure `CF_ACCOUNT_ID` / `CF_API_TOKEN` are commented out in `.env`, then run `wrangler login` once to authenticate.
- Regenerate `worker/wrangler.toml` (see below).
- Preview locally: `npm run worker:dev`
- Deploy to Cloudflare: `npm run worker:deploy`
- After deployment, point DNS or Cloudflare routes to the Worker hostname/pattern.

## Toml Generation
`worker/wrangler.toml` is generated from `worker/wrangler.toml.template` via `worker/generate-config.js`.

```bash
npm run worker:config
```

The script reads `.env`, loads every variable into `process.env`, and substitutes any `${VAR_NAME}` placeholders it finds in the template. Keep placeholders limited to the vars you actually set, and regenerate whenever those values change.

## Known Issues
- Wrangler commands ignore `wrangler login` when `CF_API_TOKEN` is present; comment those lines before running Wrangler, then re-enable them for the server.
