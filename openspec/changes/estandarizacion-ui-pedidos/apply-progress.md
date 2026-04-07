# Apply Progress: estandarizacion-ui-pedidos (Pass 1)

## Status

in_progress

## Phase 1 tasks completed

- [x] 1.1 `orderItemNormalizer.js`
- [x] 1.2 `useOrderComposerState.js`
- [x] 1.3 `orderPayloadContract.js`

## Catalog derivation resolution (`requiresDentalSelection`)

- Backend product payload (`GET /api/productos`) currently returns product + category metadata (`categoria_nombre`, `categoria_tipo`) but does not expose an authoritative boolean flag such as `requiresDentalSelection`.
- Implemented frontend resolver `checkRequiresOdontogram(product)` in `frontend/src/modules/orders/composer/orderItemNormalizer.js`.
- Resolution order:
  1. Use explicit booleans when present (`requiresDentalSelection`, `requires_dental_selection`, `requires_odontogram`).
  2. Fallback to category type mapping (`fija`, `implante` => true; `removible`, `especialidad` => false).
  3. Fallback to name/category keyword heuristics.
  4. Conservative default => `true`.

## Shared component extraction done in pass 1

- Extracted `frontend/src/components/orders/OrderClinicalPanel.jsx` as a presentational component for:
  - dental status strip
  - color selector
  - quantity control (read-only when resolver marks dental)
  - notes textarea
- Integrated the component into quick modal flow in `frontend/src/pages/CatalogoCliente.jsx`.

## Composer wiring started

- `frontend/src/pages/NuevoPedido.jsx` now uses `useOrderComposerState` as SSOT for cart items.
- Quantity input is blocked (`disabled/readOnly`) when `item.requiresDentalSelection === true`.
- Dental quantity now derives from selected pieces through the normalizer.
- Submit guard now validates missing dental pieces only for products resolved as dental.

## Lightweight validation

- No full build executed.
- Validation scope focused on syntax/contract consistency in modified frontend modules.

## Notes / risks observed in this pass

- Styling remains coupled to `order-modal-*` class naming in `global.css`; extracted panel is reusable, but style tokens still carry quick-modal-specific prefixes and should be neutralized in a later pass.
- Resolver currently depends on heuristics for products without explicit backend capability flags; this should be replaced by authoritative backend metadata in a future phase.

---

## Pass 2 technical progress (UI/UX side-by-side)

### Layout delivery in `NuevoPedido`

- Implemented a visible two-pane composer experience in `frontend/src/pages/NuevoPedido.jsx` for step 2:
  - Left pane: reusable catalog + selected-items list (`OrderCatalogPane`).
  - Right pane: embedded clinical editing flow (no modal dependency) with:
    - `OrderClinicalPanel`
    - inline `OdontogramaInteractive`
    - live `OrderPricingSummary` (subtotal + total from normalized state)
- Desktop/tablet now uses stable side-by-side composition via shared `OrderComposerLayout`.
- Mobile now collapses to progressive pane switching (`ui.mobileStep`), preserving the same composer state engine from pass 1.

### Shared presentational components added

- Added `frontend/src/components/orders/OrderPricingSummary.jsx`.
- Added `frontend/src/components/orders/OrderCatalogPane.jsx`.
- Added `frontend/src/components/orders/OrderComposerLayout.jsx`.

### Styling decoupling from quick-modal coupling

- Refactored `OrderClinicalPanel.jsx` to consume neutral `order-composer-*` classes and removed quick-modal-oriented class coupling inside the component.
- Extended `frontend/src/styles/global.css` with reusable `order-composer-*` tokens (shell, panes, status strip, clinical panel, pricing summary, mobile switcher).
- Preserved compatibility by keeping existing `order-modal-*` styles intact for quick modal flow in `CatalogoCliente` while enabling page-scale reuse.

### Task progress update

- Marked Phase 2 tasks 2.1, 2.2, 2.3, 2.4 as complete in `openspec/changes/estandarizacion-ui-pedidos/tasks.md`.

### Targeted validation

- No full build executed.
- Validation scope focused on frontend JSX/CSS integration paths touched in this pass and preservation of existing modal usage path.

### Risks after pass 2

- Mobile UX still depends on manual pane-switch controls in step 2; follow-up should validate touch flow density with real-device checks.
- `CatalogoCliente` still has heavy `order-modal-*` wrappers; full unification to the same shell can happen in a later migration pass.

---

## Pass 3 technical progress (quick modal unification + payload lock)

### Composer unification in `CatalogoCliente`

- Refactored `frontend/src/pages/CatalogoCliente.jsx` quick-order modal internals to the same shared composer architecture used in `NuevoPedido`:
  - `useOrderComposerState` as canonical item state.
  - `OrderComposerLayout` for desktop two-pane and mobile progressive step switching.
  - `OrderClinicalPanel` + `OrderPricingSummary` as shared presentational blocks.
- Removed legacy modal shell usage from this page (`order-modal-layout-v2`, `order-modal-bento-v2`, `order-modal-fields-v2`, `order-modal-odonto-v2`) and moved modal body composition to `order-composer-*` classes.

### Sacred payload preflight lock before API call

- Hardened `frontend/src/modules/orders/mutations/useCreateOrderMutation.js` to always run:
  1. `buildOrderPayload(payloadDraft)`
  2. `ensureOrderPayloadContract(payload)`
  3. `createOrder(...)` only after contract pass
- Updated `frontend/src/modules/orders/composer/orderPayloadContract.js` to enforce a preflight quantity lock in payload formatting:
  - If `requiresDentalSelection === true`, outgoing `cantidad` is overwritten with `piezas_dentales.length`.
  - `subtotal` is recomputed from locked quantity and unit price.
  - Contract validation blocks network submission on any invariant violation.

### Submission path consolidation

- Updated `frontend/src/pages/NuevoPedido.jsx` submit path to pass canonical composer `items` directly into mutation preflight, removing page-local payload mapping and preserving SSOT contract routing.
- Updated quick modal submission to pass canonical composer item into the same mutation preflight path.

### Task progress update (pass 3)

- Marked as complete in `openspec/changes/estandarizacion-ui-pedidos/tasks.md`:
  - 3.1
  - 4.1
  - 4.2
  - 4.3

### Targeted validation

- No full build executed (by policy).
- Executed targeted scope checks for changed order-composer files and mutation wiring.

### Risks after pass 3

- Legacy `order-modal-*` CSS blocks still remain in `frontend/src/styles/global.css` for backward compatibility; now partially orphaned after quick modal migration and should be pruned once no surface depends on them.
- Backend consistency enforcement tasks (3.2, 3.3) and regression tests (phase 5) remain pending, so end-to-end hardening is not complete yet.
