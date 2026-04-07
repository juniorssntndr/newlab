# Proposal: Refactor arquitectura backend/frontend

## Intent

Reducir acoplamiento y drift. Hoy `backend/src/routes/pedidos.js`, `backend/src/routes/finanzas.js` y `backend/src/routes/dashboard.js` mezclan HTTP, SQL y side-effects; en frontend hay fetch manual repetido, polling fijo cada 5s en `frontend/src/state/NotificationContext.jsx:149` y constantes duplicadas.

## Scope

### In Scope
- Backend por modulos con `controller -> service -> repository` y adapters.
- Server-state frontend con cache, dedupe y revalidacion por eventos.
- Contratos compartidos para estados y payloads fiscales.

### Out of Scope
- Reescribir la UI o migrar a SSR.
- Cambiar schema principal o reemplazar Postgres/APISPERU.

## Approach

### Decisiones
- **Backend**: controllers traducen HTTP; services orquestan; repositories concentran SQL; adapters encapsulan APISPERU y side-effects.
- **Billing anti-corruption**: `BillingService` + `ApisperuAdapter` + mappers internos (`PedidoBillingSnapshot`, `ComprobanteDraft`) para que `pedidos` y `finanzas` no dependan del payload externo.
- **Frontend**: TanStack Query como dueno del server-state. Contexts quedan para auth/UI. El polling fijo se reemplaza por invalidacion, focus/reconnect y polling opt-in.
- **Contracts**: enums y DTOs estables en `packages/contracts`, compartidos y validados con `zod`.

### Migration Strategy
- F1: extraer repositories/services sin cambiar rutas.
- F2: introducir query client y hooks por dominio.
- F3: mover facturacion a `BillingService`.
- F4: eliminar constantes duplicadas y fetches ad hoc.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/routes/pedidos.js` | Modified | mover SQL/reglas fuera del router |
| `backend/src/routes/finanzas.js` | Modified | separar pagos y cuentas |
| `backend/src/routes/dashboard.js` | Modified | extraer queries |
| `backend/src/services/apisperu.js` | Modified | quedar detras de ACL |
| `frontend/src/state/AuthContext.jsx` | Modified | sesion, no data fetching |
| `frontend/src/pages/*.jsx` | Modified | migrar fetch a hooks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Adopcion de query cache | Med | pilotear en pedidos/finanzas |
| Mas modulos | Med | convenciones por dominio |
| Drift parcial | High | mantener rutas y contratos versionados |

## Rollback Plan

Mantener endpoints y payloads actuales. Si una extraccion falla, la ruta vuelve temporalmente al flujo legacy sin romper el contrato externo.

## Dependencies

- TanStack Query.
- Workspace interno para `contracts`.

## Success Criteria

- [ ] `pedidos`, `finanzas` y `dashboard` dejan de contener SQL y side-effects directos.
- [ ] Frontend deduplica requests y elimina polling global de 5s.
- [ ] Estados y DTOs fiscales viven en contratos.
- [ ] Facturacion usa ACL propio y oculta detalles APISPERU al dominio.
