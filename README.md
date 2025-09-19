Static Deployer (Cloudflare)

Overview
- Control-plane HTTP API to publish static sites to Cloudflare R2 and set host mappings in KV.
- Cloudflare Worker serves content from R2 based on host -> {tenant, version} mapping.

Architecture
- Upload: API receives a ZIP, extracts, uploads to `r2://<bucket>/sites/{tenant}/{version}/...`.
- Mapping: API writes KV key `host:{host}` -> `{ tenant, version, root }`.
- Serving: Worker looks up mapping, fetches `sites/{tenant}/{version}/{path}` from R2 and returns with proper cache headers.

Env Setup
- Copy .env.example to .env and fill values for control-plane:
  - `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_KV_NAMESPACE_ID`
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
  - Cloudflare API Token must include scope: Account -> Workers KV Storage:Edit (Edit is required for writes; Read is optional but recommended).
  - Alternatively, you may use Global API Key auth by setting `CF_EMAIL` and `CF_API_KEY` (only if you omit `CF_API_TOKEN`).

Run API
- `npm install`
- `npm run dev` (defaults to `http://localhost:3000`)

Curl Example
- Publish
  - `curl -F tenant=mytenant -F host=mytenant.yourdomain.com -F archive=@dist.zip http://localhost:3000/publish`
- Update mapping
  - `curl -H 'Content-Type: application/json' -d '{"host":"mytenant.yourdomain.com","tenant":"mytenant","version":"abc123"}' http://localhost:3000/mapping`

HTTP APIs
- POST `/publish` (multipart/form-data)
  - fields: `tenant`, `host`, optional: `version`, `root` (default `index.html`)
  - file: `archive` (ZIP of site root)
  - returns: `{ ok, uploaded, mapping, url }`
- POST `/mapping` (application/json)
  - body: `{ host, tenant, version, root? }`

Worker
- Edit `worker/wrangler.toml` and set `account_id`, KV namespace and R2 bucket bindings.
- Deploy: `npm run worker:deploy`

Token quick-checks
- Verify token can access your KV namespace (replace envs appropriately):
  - `curl -H "Authorization: Bearer $CF_API_TOKEN" \ 
     "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/keys?limit=1"`
  - Expect HTTP 200. A 403 Authentication error means wrong token, missing scope, or account/namespace mismatch.
 - If using Global API Key, use headers instead:
   - `curl -H "X-Auth-Email: $CF_EMAIL" -H "X-Auth-Key: $CF_API_KEY" \ 
      "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/keys?limit=1"`

Notes
- R2 access uses AWS S3 SDK v3 against R2 endpoint (S3-compatible).
- Cache policy: short for HTML, long immutable for assets.

E2E Test Script
- Runs an end-to-end flow: create sample site, ZIP, call `/publish`, then verify content via HTTP.
- Configure env:
  - `API_BASE` (default `http://localhost:3000`)
  - `PUBLIC_BASE_DOMAIN` (used to craft default host if `TEST_HOST` not set)
  - `TEST_TENANT`, `TEST_HOST`, `TEST_VERSION` (optional overrides)
  - `VERIFY_URL` (optional; defaults to `https://<TEST_HOST>/`)
- Execute: `npm run test:flow`
- Note: Verification requires your DNS/route to point the host to the Worker (or use a workers.dev route and set `VERIFY_URL` accordingly).
