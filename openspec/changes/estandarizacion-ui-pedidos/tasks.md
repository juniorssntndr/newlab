# Tasks: Estandarizacion UI Pedidos

## Phase 1: Composer Foundation and Contracts

- [x] 1.1 Create `frontend/src/modules/orders/composer/orderItemNormalizer.js` to centralize `requiresDentalSelection`, resolved `cantidad`, and `subtotal = cantidad * precio_unitario` in one pure function.
- [x] 1.2 Create `frontend/src/modules/orders/composer/useOrderComposerState.js` with canonical cart/item state (SSOT), selected item handling, and atomic recompute transitions for piece/quantity edits.
- [x] 1.3 Create `frontend/src/modules/orders/composer/orderPayloadContract.js` with `buildOrderPayload` + `validateOrderPayloadContract` to enforce dental/non-dental quantity and subtotal invariants before mutation.

## Phase 2: Shared Clinical Panel Extraction

- [x] 2.1 Create `frontend/src/components/orders/OrderClinicalPanel.jsx` by extracting the quick modal clinical fields (`piezas_dentales`, puente, color, notas, quantity control) into a presentational component with callback props.
- [x] 2.2 Create `frontend/src/components/orders/OrderPricingSummary.jsx` to render item subtotal and cart totals from normalized data only (no local math in views).
- [x] 2.3 Create `frontend/src/components/orders/OrderCatalogPane.jsx` and `frontend/src/components/orders/OrderComposerLayout.jsx` for desktop two-pane shell and mobile step container.
- [x] 2.4 Update `frontend/src/styles/global.css` with reusable `order-composer-*` classes shared by page and modal layouts.

## Phase 3: Secure Mutations and Backend Consistency

- [x] 3.1 Modify `frontend/src/modules/orders/mutations/useCreateOrderMutation.js` to run payload contract preflight and block network calls on invariant violations.
- [ ] 3.2 Modify `backend/src/validation/schemas.js` with consistency checks: dental `cantidad === piezas.length`, non-dental `cantidad >= 1`, and computed subtotal integrity.
- [ ] 3.3 Modify `backend/src/modules/orders/infrastructure/repositories/orderPgRepository.js` to recompute line subtotals server-side and reject inconsistent payloads.

## Phase 4: Surface Migration (NuevoPedido + Quick Modal)

- [x] 4.1 Refactor `frontend/src/pages/NuevoPedido.jsx` to composer container + shared components, supporting empty-state entry and selected-product entry without branching payload logic.
- [x] 4.2 Add mobile/desktop behavior in `NuevoPedido`: desktop side-by-side catalog/clinical panel and mobile progressive step flow backed by composer `ui.mobileStep`.
- [x] 4.3 Refactor `frontend/src/pages/CatalogoCliente.jsx` quick modal internals to the same composer state, `OrderClinicalPanel`, and `OrderPricingSummary` abstractions.

## Phase 5: Regression and Acceptance Gates

- [ ] 5.1 Add unit tests in `frontend/src/modules/orders/composer/orderItemNormalizer.test.js` for dental derivation, non-dental manual quantity, bridge-piece transitions, and subtotal recomputation.
- [ ] 5.2 Add unit tests in `frontend/src/modules/orders/composer/orderPayloadContract.test.js` for preflight rejection of inconsistent dental payloads and acceptance of valid normalized payloads.
- [ ] 5.3 Add integration tests in `frontend/src/modules/orders/composer/buildOrderPayload.integration.test.js` proving `NuevoPedido` and quick modal emit equivalent payloads from the same normalized fixture.
- [ ] 5.4 Add backend/API regression tests (existing orders test suite) for the multi-piece quantity bug: reject tampered dental quantity, accept corrected piece-derived payload, and verify persisted subtotals/totals.
