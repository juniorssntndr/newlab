# Despliegue frontend en Coolify (affinixlab.com)

Guía para servir el build de Vite (`frontend/dist`) con nginx en Coolify. Si ves **"Welcome to nginx!"**, el contenedor está vivo pero **no recibe los archivos compilados**.

Panel: [panel.affinixlab.com](https://panel.affinixlab.com/)

---

## Checklist rápido (servicio frontend)

| Campo | Valor correcto |
|-------|----------------|
| **Is it a static site?** | Sí |
| **Is it a SPA?** | Sí |
| **Static Image** | `nginx:alpine` (default Coolify) |
| **Base Directory** | `/` |
| **Install Command** | `npm ci` |
| **Build Command** | `npm run build --workspace=newlab-frontend` |
| **Publish Directory** | `frontend/dist` |
| **Start Command** | *(vacío)* |
| **Watch Paths** | `frontend/**` |
| **Custom Nginx Configuration** | *(vacío al recuperar; Coolify genera SPA con la casilla)* |
| **Custom Docker Options** | *(ninguna; quitar SYS_ADMIN, fuse, etc.)* |

Dominios:

- `https://affinixlab.com`
- `https://www.affinixlab.com`

Tras guardar → **Redeploy** (no solo Restart).

---

## Variables de entorno (build)

Copiar desde [`deploy/coolify-frontend.env.example`](../deploy/coolify-frontend.env.example):

```ini
VITE_SITE_ORIGIN=https://affinixlab.com
VITE_API_URL=https://bak.affinixlab.com/api
```

`VITE_*` se inyectan en **build time**. Cualquier cambio requiere **Redeploy**.

Backend en producción: `https://bak.affinixlab.com` (health: `/api/health`).

---

## Verificación post-deploy

1. Logs de deploy: `npm ci` OK → `vite build` OK → copia a nginx sin errores.
2. Navegador:
   - `https://affinixlab.com/` → landing AFINIX (no página nginx)
   - `https://affinixlab.com/login` → login (sin 404)
3. Smoke desde local:

```bash
cd backend
SMOKE_BACKEND_URL=https://bak.affinixlab.com SMOKE_FRONTEND_URL=https://affinixlab.com npm run smoke
```

---

## Backend (mismo VPS)

Servicio separado en Coolify. Checklist:

| Variable | Valor |
|----------|--------|
| `DATABASE_URL` | Postgres URL **interna** de Coolify |
| `JWT_SECRET` | secreto largo |
| `FRONTEND_ORIGIN` | `https://affinixlab.com,https://www.affinixlab.com` |
| `PORT` | respetar `$PORT` de Coolify |

Dominio público: `https://bak.affinixlab.com`  
Health: `GET /api/health` → `{"status":"ok"}`

Volumen persistente recomendado: `uploads_volume:/app/uploads`

---

## Opción B: proxy `/api` en el mismo dominio

Si prefieres `VITE_API_URL=/api` (sin URL absoluta al backend), usa la plantilla [`deploy/nginx-spa-with-api-proxy.conf.example`](../deploy/nginx-spa-with-api-proxy.conf.example) en **Custom Nginx Configuration**, sustituyendo `BACKEND_INTERNAL_HOST` por el hostname interno del contenedor backend en la red Docker de Coolify.

Solo aplicar **después** de que la landing cargue con Publish Directory correcto.

---

## Plan B: Dockerfile (si static site sigue fallando)

Build autocontenido con nginx + SPA:

```bash
# En Coolify: Build Pack → Dockerfile
# Dockerfile path: deploy/Dockerfile.frontend
```

Ver [`deploy/Dockerfile.frontend`](../deploy/Dockerfile.frontend).

---

## Troubleshooting

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| "Welcome to nginx!" | Publish Directory = `/` | Cambiar a `frontend/dist` y redeploy |
| 404 en `/login` | SPA desactivado | Activar **Is it a SPA?** |
| Login sin respuesta API | Falta `VITE_API_URL` | Añadir `https://bak.affinixlab.com/api` y redeploy |
| CORS en login / `Failed to fetch` | `FRONTEND_ORIGIN` sin `www` | `https://affinixlab.com,https://www.affinixlab.com` (o redeploy backend con expansión www) |
| Build falla en `@newlab/contracts` | Install solo en `frontend/` | `npm ci` en raíz del monorepo |
| exit code 255 al inicio Docker | Infra VPS (disco/memoria) | Revisar host Coolify; Rollback si existe |

CI GitHub (job `frontend-build`) valida que el código compila; si CI pasa y Coolify falla, el problema es configuración del servicio.

---

## Referencias

- [`frontend/.env.example`](../frontend/.env.example) — variables Vite completas
- [`docs/audit-security-and-pagination.md`](audit-security-and-pagination.md) — arquitectura Coolify + CORS
- [`docs/migration-newlab-to-coolify.md`](migration-newlab-to-coolify.md) — PostgreSQL y uploads
