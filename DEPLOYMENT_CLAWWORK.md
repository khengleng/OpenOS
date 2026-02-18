# Deploying OpenOS + ClawWork on Railway

This repository is structured as a monorepo where ClawWork is an internal subsystem:

- Frontend service: OpenOS (Next.js) at repo root `.`
- Backend service: ClawWork (FastAPI) at `external/ClawWork`

## Recommended Railway Architecture

1. Create two Railway services from the same repo:
- `openos-web` (root directory `.`)
- `clawwork-api` (root directory `external/ClawWork`, Dockerfile build)

2. Keep `clawwork-api` as an internal service when possible:
- Prefer Railway private networking and internal host URL between services.
- Expose publicly only if required.

3. Frontend calls ClawWork only through Next.js server routes:
- Browser -> `/api/clawwork/*` (same-origin)
- Next.js server route -> ClawWork API (internal URL + optional bearer token)

This removes browser-to-backend direct calls and keeps credentials server-side.

## Environment Variables

Templates in repo:
- OpenOS template: `.env.railway.example`
- ClawWork template: `external/ClawWork/.env.railway.example`

### `clawwork-api` (backend)

Required:
- `OPENAI_API_KEY`
- `E2B_API_KEY` (if using code execution)

Recommended security settings:
- `CLAWWORK_ENV=production`
- `CLAWWORK_REQUIRE_AUTH=true`
- `CLAWWORK_REQUIRE_READ_AUTH=true`
- `CLAWWORK_REQUIRE_TENANT_CONTEXT=true`
- `CLAWWORK_API_TOKEN=<strong-random-token>`
- `CLAWWORK_CORS_ORIGINS=https://<your-openos-domain>`
- `CLAWWORK_ALLOWED_ENV_KEYS=OPENAI_API_KEY,E2B_API_KEY,WEB_SEARCH_API_KEY,ANTHROPIC_API_KEY`
- `CLAWWORK_RATE_LIMIT_ENABLED=true`
- `CLAWWORK_RATE_LIMIT_WINDOW_SEC=60`
- `CLAWWORK_READ_RATE_LIMIT=240`
- `CLAWWORK_WRITE_RATE_LIMIT=60`

Optional:
- `WEB_SEARCH_API_KEY`
- `PYTHONUNBUFFERED=1`

### `openos-web` (frontend)

Required for proxy:
- `CLAWWORK_INTERNAL_URL=http(s)://<clawwork-internal-or-public-url>`

If backend auth is enabled:
- `CLAWWORK_API_TOKEN=<same-token-as-backend>`

Recommended proxy throttling:
- `CLAWWORK_PROXY_RATE_LIMIT_WINDOW_SEC=60`
- `CLAWWORK_PROXY_READ_RATE_LIMIT=120`
- `CLAWWORK_PROXY_WRITE_RATE_LIMIT=30`

Optional backwards compatibility:
- `NEXT_PUBLIC_CLAWWORK_API_URL=<fallback-public-url>`

## Security Model Implemented

- CORS is allowlist-based (`CLAWWORK_CORS_ORIGINS`) instead of wildcard.
- Write endpoints in ClawWork can require token auth (`CLAWWORK_REQUIRE_AUTH=true`).
- Read endpoints can also require token auth (`CLAWWORK_REQUIRE_READ_AUTH=true`).
- Browser no longer sends provider API keys in launch requests.
- Artifact file serving now validates path traversal and extension.
- Next.js `/api/clawwork/*` now performs auth checks, rate limiting, and structured audit logging.
- ClawWork mutation endpoints now emit structured audit logs and enforce backend-side rate limits.
- Tenant separation is enforced via `X-Tenant-Id` from the authenticated OpenOS proxy, with per-tenant storage under `livebench/data/tenants/<hash>/`.

## CI/CD Notes

- Keep both services connected to the same branch for atomic releases.
- Trigger deploys on merge to `main`.
- Use Railway environment groups to share non-secret config safely.
- Rotate `CLAWWORK_API_TOKEN` periodically.

## Local Development

1. Start backend:
```bash
cd external/ClawWork
source venv/bin/activate
python livebench/api/server.py
```

2. Start frontend:
```bash
npm run dev
```

3. Set local envs:
- In frontend: `CLAWWORK_INTERNAL_URL=http://localhost:8000`
- In backend: `CLAWWORK_ENV=development` (or set `CLAWWORK_REQUIRE_AUTH=false` locally)
