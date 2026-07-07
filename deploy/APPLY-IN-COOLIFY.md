# Aplicar ahora en Coolify (5 minutos)

Producción sigue en **"Welcome to nginx!"** hasta que apliques estos cambios en el panel.

1. Abrir [panel.affinixlab.com](https://panel.affinixlab.com/) → servicio **frontend** (`affinixlab.com`) → **Configuration → General**.

2. Copiar exactamente:

| Campo | Valor |
|-------|--------|
| Is it a static site? | **Sí** |
| Is it a SPA? | **Sí** |
| Install Command | `npm ci` |
| Build Command | `npm run build --workspace=newlab-frontend` |
| Publish Directory | `frontend/dist` |
| Start Command | *(borrar / vacío)* |
| Watch Paths | `frontend/**` |
| Custom Nginx Configuration | *(vacío)* |

3. **Environment Variables** → pegar desde [`coolify-frontend.env.example`](coolify-frontend.env.example):

```
VITE_SITE_ORIGIN=https://affinixlab.com
VITE_API_URL=https://bak.affinixlab.com/api
```

4. Quitar **Custom Docker Options** innecesarias (SYS_ADMIN, fuse, etc.).

5. **Save** → **Redeploy** (no Restart).

6. Verificar desde tu máquina:

```bash
cd backend
SMOKE_BACKEND_URL=https://bak.affinixlab.com SMOKE_FRONTEND_URL=https://affinixlab.com npm run smoke
```

Debe mostrar: `OK: backend health`, `OK: frontend home`, `OK: frontend login route`.

Guía completa: [`docs/deploy-coolify-frontend.md`](../docs/deploy-coolify-frontend.md)
