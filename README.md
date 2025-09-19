Static Deployer (Cloudflare)

Overview
- Control-plane HTTP API publishes static sites to Cloudflare R2 and writes host mappings in KV.
- Cloudflare Worker serves content from R2 using `host -> { tenant, version, root }` mapping.

Architecture
- Upload: API receives a ZIP, extracts, uploads to `r2://<bucket>/sites/{tenant}/{version}/...`.
- Mapping: API writes KV key `host:{host}` -> `{ tenant, version, root }`.
- Serving: Worker reads mapping, fetches `sites/{tenant}/{version}/{path}` from R2, sets cache headers.

Env Setup (Control Plane)
- Copy `.env.example` to `.env` and fill:
  - `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_KV_NAMESPACE_ID`
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- API token scope: Account → Workers KV Storage:Edit (Read recommended). Alternatively use Global API Key via `CF_EMAIL` + `CF_API_KEY` if you omit `CF_API_TOKEN`.

Run API
- `npm install`
- `npm run dev` (listens on `http://localhost:3000`)

HTTP APIs
- POST `/publish` (multipart/form-data)
  - fields: `tenant`, `host`, optional `version`, `root` (default `index.html`)
  - file: `archive` (ZIP of site root)
  - returns: `{ ok, uploaded, mapping, url }`
- POST `/mapping` (application/json)
  - body: `{ host, tenant, version, root? }`

Curl Examples
- Publish: `curl -F tenant=mytenant -F host=mytenant.yourdomain.com -F archive=@dist.zip http://localhost:3000/publish`
- Update mapping: `curl -H 'Content-Type: application/json' -d '{"host":"mytenant.yourdomain.com","tenant":"mytenant","version":"abc123"}' http://localhost:3000/mapping`

Cloudflare Worker Deployment
- Prerequisites
  - Cloudflare account with a zone (for custom domains) or use `*.workers.dev`.
  - Wrangler is already in devDependencies; use npm scripts or `npx wrangler`.
- Configure bindings (names must match code):
  - KV namespace binding `HOSTMAP` → stores `host:*` mappings.
  - R2 bucket binding `SITES_BUCKET` → stores uploaded site content.
- Create resources (one-time):
  - KV: `npx wrangler kv namespace create HOSTMAP`
  - R2: `npx wrangler r2 bucket create <your-bucket>`
  - Copy produced IDs/names into `worker/wrangler.toml` under `[[kv_namespaces]]` and `[[r2_buckets]]`.
- Edit `worker/wrangler.toml`:
  - Set `account_id` to your Cloudflare account.
  - Configure `routes` for your zone or set `workers_dev = true` for `*.workers.dev`.
  - Ensure bindings:
    - `[[kv_namespaces]] binding = "HOSTMAP" id = "<KV_NAMESPACE_ID>"`
    - `[[r2_buckets]] binding = "SITES_BUCKET" bucket_name = "<R2_BUCKET>"`
- Develop locally
  - `npm run worker:dev` (uses your wrangler config and bindings)
  - Optional: `npx wrangler dev --local` to emulate KV/R2 locally.
- Deploy
  - `npm run worker:deploy`
  - Verify route is active in Cloudflare dashboard and DNS proxied (orange cloud) for custom domains.
- Serve flow
  - After a successful `/publish`, visiting `https://<host>/path` returns `sites/{tenant}/{version}/path` from R2.
  - Directory requests try `<path>/index.html`; site-level `404.html` is used when present.

Token Quick-Checks
- Verify token can read KV (replace envs appropriately):
  - `curl -H "Authorization: Bearer $CF_API_TOKEN" "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/keys?limit=1"`
  - Expect HTTP 200. A 403 means wrong token, missing scope, or account/namespace mismatch.
- Using Global API Key instead:
  - `curl -H "X-Auth-Email: $CF_EMAIL" -H "X-Auth-Key: $CF_API_KEY" "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/keys?limit=1"`

Notes
- R2 accessed via AWS S3 SDK v3 (S3-compatible endpoint).
- Cache policy: short for HTML (60s), long immutable for assets (1y).

E2E Test Script
- End-to-end flow: make sample site, ZIP, call `/publish`, verify via HTTP.
- Configure env: `API_BASE`, `PUBLIC_BASE_DOMAIN`, optional `TEST_*` overrides and `VERIFY_URL`.
- Run: `npm run test:flow` (your host must resolve to the Worker; for workers.dev set `VERIFY_URL`).
