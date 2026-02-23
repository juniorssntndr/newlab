# NewLab Deployment (Vercel + Render + Supabase)

## 1) Prerequisites

- Supabase project with Postgres connection string.
- Render account for backend service.
- Vercel account for frontend.

## 2) Environment variables

### Backend (`backend/.env` for local, Render env vars for prod)

- `DATABASE_URL`: Supabase pooled or direct Postgres URL
- `JWT_SECRET`: long random secret (required in production)
- `PORT`: `3001` (local)
- `FRONTEND_ORIGIN`: frontend URL (for example `https://newlab.vercel.app`)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: service role key (server-side only)
- `SUPABASE_STORAGE_BUCKET`: bucket name for product images (default: `product-images`)
- `RATE_LIMIT_WINDOW_MS`: API rate window in ms (default 900000)
- `RATE_LIMIT_MAX`: max requests per IP in window (default 300)
- `SENTRY_DSN`: Sentry DSN for backend error tracking
- `SENTRY_ENVIRONMENT`: environment label for Sentry

Use `backend/.env.example` as reference.

### Frontend (Vercel env vars)

- `VITE_API_URL`: backend public URL + `/api`
  - Example: `https://newlab-api.onrender.com/api`
- `VITE_SENTRY_DSN`: Sentry DSN for frontend
- `VITE_SENTRY_ENVIRONMENT`: environment label for Sentry

## 3) Backend on Render

Service settings:

- Runtime: Node
- Root directory: `backend`
- Build command: `npm ci`
- Start command: `npm start`

Healthcheck URL:

- `/api/health`

## 4) Frontend on Vercel

Project settings:

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

`frontend/vercel.json` already rewrites SPA routes to `index.html`.

## 5) Post-deploy validation

- Backend health: `GET /api/health` returns `{ "status": "ok" }`
- Frontend loads and login works.
- Create one pedido and confirm unique code format `NL-00001`.
- Upload product image and verify URL resolves.

## 6) Staging / Production checklist

### Staging

- Deploy branch `develop` to staging backend and staging frontend.
- Use separate Supabase project or dedicated staging schema.
- Run smoke checks from GitHub Actions (`Smoke Post Deploy` workflow).
- Validate login, create pedido, update estado and register pago.

### Production

- Deploy only from `main` after CI green.
- Confirm env vars are set in Render and Vercel.
- Run manual smoke workflow with production URLs.
- Rotate `JWT_SECRET` and DB credentials if previously exposed.
- Confirm CORS allows only production frontend domains.
- Confirm Sentry receives backend and frontend events.

Automated smoke workflow (`.github/workflows/smoke-environments.yml`) uses these secrets:

- `STAGING_BACKEND_URL`, `STAGING_FRONTEND_URL`
- `PROD_BACKEND_URL`, `PROD_FRONTEND_URL`

## 7) Audit and financial controls

- Audit endpoint (admin only): `GET /api/audit`
- Financial anti-overpayment rule enforced in `POST /api/finanzas/:id/pagos`
- Reconciliation endpoint: `PATCH /api/finanzas/pagos/:pagoId/conciliar`
- `GET /api/finanzas/:id` now includes `pagos_pendientes_conciliacion`

## 8) Security checklist

- Rotate any leaked credentials immediately.
- Do not commit `.env` files.
- Keep `FRONTEND_ORIGIN` restricted to real frontend domains.
- Replace `JWT_SECRET` periodically.

## 9) Incident response

- Follow `ROLLBACK.md` for rollback and recovery steps.
