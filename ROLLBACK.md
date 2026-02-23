# Rollback Runbook

## Goal

Recover service quickly if a deploy introduces critical errors.

## Triggers

- API health endpoint failing (`/api/health`).
- Login/pedidos/finanzas broken in production.
- Error rate spike detected in Sentry.

## 1) Immediate containment (5 minutes)

- Pause new production deploys from `main`.
- Announce incident in team channel with timestamp and affected scope.
- Identify latest good deployment IDs in Render and Vercel.

## 2) Application rollback (10 minutes)

### Render (backend)

1. Open service in Render.
2. Deploys tab -> select latest successful stable deploy.
3. Click **Rollback**.
4. Verify `GET /api/health`.

### Vercel (frontend)

1. Open project in Vercel.
2. Deployments tab -> choose last stable deployment.
3. Click **Promote to Production**.
4. Verify login page and dashboard load.

## 3) Database rollback strategy

- Prefer **forward-fix** migrations when possible.
- If a migration is destructive and breaks app, restore from Supabase PITR/backups to a new branch database, validate, then swap connection string.
- Never run ad-hoc destructive SQL directly on production without backup snapshot.

## 4) Validation checklist after rollback

- Health endpoint returns 200.
- Can login with admin account.
- Can list pedidos and open detail.
- Can register and list pagos in finanzas.
- Smoke workflow passes against production.

## 5) Post-incident actions

- Create incident report (root cause, impact window, fix).
- Add regression test/checklist for failure mode.
- Link incident to next sprint hardening task.
