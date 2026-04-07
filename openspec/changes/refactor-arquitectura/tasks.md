# Tasks: Refactor arquitectura backend/frontend

## Phase 1: Base setup / Contracts

- [x] 1.1 Align monorepo workspaces and JS/TS resolution in root `package.json`, root `tsconfig` (or `tsconfig.base.json`), and app configs so `packages/contracts` imports work in backend/frontend without breaking current build scripts.
- [x] 1.2 Create `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, and `packages/contracts/src/index.ts` with explicit exports consumed by both apps.
- [x] 1.3 Implement shared enums/DTOs in `packages/contracts/src/enums.ts`, `packages/contracts/src/money.ts`, and `packages/contracts/src/billing.ts` per spec R1.
- [x] 1.4 Add zod guards in `packages/contracts/src/schemas/enums.schema.ts`, `packages/contracts/src/schemas/money.schema.ts`, and `packages/contracts/src/schemas/billing.schema.ts`; re-export from `src/index.ts`.
- [x] 1.5 Add contract compatibility checks in workspace CI scripts (`package.json` scripts and existing CI config) to fail when required DTO fields change without consumer updates.
- [x] 1.6 Validation checkpoint: verify backend and frontend compile/import from `packages/contracts` and keep existing runtime/start commands unchanged.

## Phase 2: Backend migration (Repository -> Service -> Controller)

- [x] 2.1 Create backend composition root in `backend/src/bootstrap/compositionRoot.js` and route registrar in `backend/src/bootstrap/registerRoutes.js`; wire `backend/src/index.js` to bootstrap only.
- [x] 2.2 Extract Orders module skeleton (`backend/src/modules/orders/...`) with `orderRepositoryPort.js`, `orderPgRepository.js`, `orderService.js`, `orderController.js`, and `orderRoutes.js`.
- [x] 2.3 Migrate `backend/src/routes/pedidos.js` endpoint-by-endpoint into orders module while keeping `backend/src/routes/legacy/pedidos.js` facade behavior and unchanged external response shape.
  - [x] 2.3.a Migrated `GET /api/pedidos` and `GET /api/pedidos/:id` to Orders module (`controller -> service -> repository`) and delegated from legacy route facade.
  - [x] 2.3.b Migrate remaining mutation endpoints in `backend/src/routes/pedidos.js` (`POST /`, status/aprobacion/responsable/fecha-entrega patches) to Orders module.
- [x] 2.4 Extract Finance module skeleton (`backend/src/modules/finance/...`) and migrate logic from `backend/src/routes/finanzas.js` to repository/service/controller layers.
  - [x] 2.4.a Created Finance module skeleton (`financeRepositoryPort`, `financePgRepository`, `financeService`, `financeController`, `financeRoutes`) and wired composition root + `/api/finanzas-v2` seam.
  - [x] 2.4.b Migrated endpoint set to `controller -> service -> repository` and delegated from legacy facade: `GET /api/finanzas`, `GET /api/finanzas/catalogos`, `GET /api/finanzas/movimientos`, `POST /api/finanzas/movimientos`, `GET /api/finanzas/:id`, `POST /api/finanzas/:id/pagos`.
  - [x] 2.4.c Migrate remaining finance endpoints (`GET /api/finanzas/estado-cuenta/:clinica_id`, `POST /api/finanzas/pagos-masivos`, `PATCH /api/finanzas/pagos/:pagoId/conciliar`) and remove SQL fallback blocks from legacy facade.
- [x] 2.5 Extract Dashboard module skeleton (`backend/src/modules/dashboard/...`) and move SQL from `backend/src/routes/dashboard.js` into `dashboardPgRepository.js`.
- [x] 2.6 Build Billing ports/contracts in `backend/src/modules/billing/ports/{billingRepositoryPort.js,billingProviderAclPort.js}` and implement `billingService.js` + `billingController.js` with analytical signature.
- [x] 2.7 Implement APISPERU ACL in `backend/src/infrastructure/apisperu/apisperuAdapter.js`, `backend/src/infrastructure/apisperu/mappers/toProvider.js`, `backend/src/infrastructure/apisperu/mappers/fromProvider.js`, and `backend/src/modules/billing/infrastructure/adapters/apisperuBillingAcl.js`.
- [x] 2.8 Add coexistence seam: keep `backend/src/services/apisperu.js` as fallback behind env flag while ACL adoption is validated.
- [x] 2.9 Validation checkpoint: prove `backend/src/routes/pedidos.js`, `backend/src/routes/finanzas.js`, and `backend/src/routes/dashboard.js` contain no SQL strings and no direct APISPERU calls.

## Phase 3: Frontend refactor (Context/fetch -> React Query, route by route)

- [x] 3.1 Create `frontend/src/bootstrap/queryClient.js` with focus/reconnect refetch enabled and polling disabled by default; add `frontend/src/bootstrap/appProviders.jsx` with `QueryClientProvider` + existing providers.
- [x] 3.2 Create shared HTTP client in `frontend/src/services/http/apiClient.js` and keep auth headers/error mapping compatible with current pages.
- [x] 3.3 Build Orders hooks (`frontend/src/modules/orders/api/ordersApi.js`, `queries/useOrdersListQuery.js`, `queries/useOrderDetailQuery.js`, `mutations/useApproveOrderMutation.js`) with keys and invalidations from spec R3.
- [x] 3.4 Migrate orders pages in `frontend/src/pages/*.jsx` route-by-route from manual fetch to orders hooks, preserving UI props and rendering behavior.
  - [x] 3.4.a Migrated `Pedidos.jsx` list + filters to `useOrdersListQuery`.
  - [x] 3.4.b Migrated `DetallePedido.jsx` read/mutation flows to Orders query + mutation hooks.
  - [x] 3.4.c Migrated create-order UI (`NuevoPedido.jsx` and quick order in `CatalogoCliente.jsx`) to `useCreateOrderMutation`.
  - [x] 3.4.d Migrated remaining pages with direct order fetches (`FacturarPedido.jsx`, `Calendario.jsx`, `CalendarioCliente.jsx`).
- [x] 3.5 Build Finance hooks (`frontend/src/modules/finance/api/financeApi.js`, query hooks, `useRegisterPaymentMutation.js`) with optimistic updates + rollback.
- [x] 3.6 Migrate finance pages route-by-route to finance hooks; keep temporary fallback fetch path behind feature toggle until parity is validated.
  - [x] 3.6.a Migrated `Finanzas.jsx` list + billing-tab reads to finance query hooks.
  - [x] 3.6.b Migrated `DetalleFinanza.jsx` finance detail/catalog reads + payment registration to finance query/mutation hooks.
  - [x] 3.6.c Migrated `CajaGastos.jsx` and `ModalPagoMasivo.jsx` finance reads/mutations to finance hooks.
  - [x] 3.6.d Add/validate explicit feature-toggle fallback path for finance reads during parity rollout.
  - [x] 3.6.e Migrate `Dashboard.jsx` reporting reads to dashboard query hooks with parameterized keys and analytics-friendly cache policy.
- [x] 3.7 Build Billing hooks (`frontend/src/modules/billing/api/billingApi.js`, `queries/useBillingPreviewQuery.js`, `mutations/useCreateInvoiceMutation.js`) and wire invalidation of orders/finance keys.
- [x] 3.8 Refactor `frontend/src/state/NotificationContext.jsx` to remove global 5000ms polling and rely on query invalidation, focus, reconnect, and explicit user refresh.
- [x] 3.9 Validation checkpoint: verify contexts no longer own orders/finance fetching and polling is opt-in per query only.

## Phase 4: Verification, hardening, and cleanup

- [ ] 4.1 Add backend unit/integration tests for services/controllers/repositories in each module and assert unchanged endpoint status codes + response shapes.
- [ ] 4.2 Add ACL contract tests for domain<->provider mappers with fixtures and enforce >=90% statement coverage for billing ACL module.
- [ ] 4.3 Add frontend integration tests for query key invalidation, optimistic mutation behavior, and rollback on mutation errors.
- [x] 4.4 Run end-to-end order->payment->invoice flow and confirm acceptance criteria R4.1-R4.5 all pass.
- [ ] 4.5 Remove dead legacy fetch/constants and obsolete wiring only after all checkpoints pass; update implementation notes in `openspec/changes/refactor-arquitectura/`.
