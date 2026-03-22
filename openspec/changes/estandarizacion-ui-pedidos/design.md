# Design: Estandarizacion UI Pedidos

## Technical Approach

Implement a shared order-composer architecture that separates domain state from UI rendering and is reused by `NuevoPedido` (page flow) and `CatalogoCliente` quick modal (single-product flow). The design aligns with proposal/spec by enforcing one normalized item model, deriving `cantidad` for dental products from selected pieces, and validating payload invariants before mutation. The desktop experience uses a stable side-by-side shell (catalog left, clinical right); mobile switches to progressive disclosure while preserving the same domain transitions.

## Architecture Decisions

| Decision | Options | Tradeoff | Selected |
|---|---|---|---|
| Composer architecture | Keep logic in pages; custom hook + presentational components; global store | In-page logic duplicates rules; global store increases coupling | Custom hook + Container/Presentational split for local, reusable orchestration |
| Clinical panel reuse | Duplicate quick modal form in `NuevoPedido`; extract `OrderClinicalPanel`; full form-builder abstraction | Duplication causes drift; form-builder is overkill now | Extract `OrderClinicalPanel` + `OrderPricingSummary` as shared presentational blocks |
| Responsive behavior | Pure CSS collapse; mobile wizard; accordion-only | Pure CSS cannot encode step intent; accordion can lose sequence | Mobile wizard/progressive disclosure backed by `ui.mobileStep`, with accordion sections inside each step |
| Payload safety | Validate only backend; frontend preflight + backend guard | Backend-only delays feedback; frontend-only is bypassable | Both: frontend preflight contract + backend recomputation/validation |

## Data Flow

`OrderComposerContainer` owns business state and delegates view concerns:

1. Load bootstrap data (`clinicas`, `productos`, `categorias`) and initialize context.
2. Add/select product -> create normalized draft item (`requiresDentalSelection`, `resolvedCantidad`, `subtotal`).
3. `OrderClinicalPanel` emits edits (`onDentalChange`, `onColorChange`, `onNotesChange`, `onQuantityChange`).
4. Container recomputes item via normalizer in a single transition.
5. `OrderPricingSummary` and cart totals render from normalized items only.
6. Submit -> `buildOrderPayload` + `validateOrderPayloadContract` -> `useCreateOrderMutation`.

ASCII ownership:

    NuevoPedido/CatalogoCliente (containers)
                  |
          useOrderComposerState
                  |
    +-------------+----------------+
    |                              |
OrderCatalogPane            OrderClinicalPanel
    |                              |
    +--------- OrderPricingSummary-+
                  |
          buildOrderPayload -> useCreateOrderMutation

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/modules/orders/composer/useOrderComposerState.js` | Create | Container hook with canonical item/cart state, selected item, and mobile step state |
| `frontend/src/modules/orders/composer/orderItemNormalizer.js` | Create | Derive `requiresDentalSelection`, `cantidad`, `subtotal`, and bridge metadata in one function |
| `frontend/src/modules/orders/composer/orderPayloadContract.js` | Create | Frontend preflight formatter/validator enforcing spec invariants |
| `frontend/src/components/orders/OrderComposerLayout.jsx` | Create | Presentational shell for two-pane desktop + mobile step wrapper |
| `frontend/src/components/orders/OrderCatalogPane.jsx` | Create | Presentational product list/search/category pane |
| `frontend/src/components/orders/OrderClinicalPanel.jsx` | Create | Shared clinical form panel extracted from quick modal fields block |
| `frontend/src/components/orders/OrderPricingSummary.jsx` | Create | Shared subtotal/total section from normalized values |
| `frontend/src/pages/NuevoPedido.jsx` | Modify | Replace step-local inline forms with composer container and shared components |
| `frontend/src/pages/CatalogoCliente.jsx` | Modify | Keep modal wrapper but swap internals to shared composer + `OrderClinicalPanel` |
| `frontend/src/modules/orders/mutations/useCreateOrderMutation.js` | Modify | Enforce preflight payload contract before API call |
| `backend/src/validation/schemas.js` | Modify | Add `superRefine` consistency checks for dental/non-dental quantity rules |
| `backend/src/modules/orders/infrastructure/repositories/orderPgRepository.js` | Modify | Recompute item subtotal and reject inconsistent quantity/pieces payloads |
| `frontend/src/styles/global.css` | Modify | Rename/extend modal classes to neutral `order-composer-*` layout classes reused by page/modal |

## Interfaces / Contracts

```js
// frontend/src/modules/orders/composer/orderTypes.js (JSDoc typedefs)
/** @typedef {{
 * id: string,
 * producto_id: number,
 * nombre: string,
 * precio_unitario: number,
 * piezas_dentales: string[],
 * requiresDentalSelection: boolean,
 * cantidadEditable: boolean,
 * cantidadManual: number|null,
 * cantidad: number,
 * subtotal: number,
 * color_vita: string,
 * notas: string,
 * es_puente: boolean,
 * pieza_inicio: string|null,
 * pieza_fin: string|null
 * }} ComposerItem */
```

Rules encoded in normalizer/contract:
- If `requiresDentalSelection === true`, then `cantidad = piezas_dentales.length` and quantity input is read-only.
- If `requiresDentalSelection === false`, then `cantidad` comes from `cantidadManual` (`>= 1`).
- `subtotal` is always recomputed as `cantidad * precio_unitario`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Item normalizer and payload contract invariants | New node tests in `frontend/src/modules/orders/composer/*.test.js` for dental/non-dental/bridge cases |
| Integration | `NuevoPedido` and quick modal emit equivalent payloads from same input | Shared fixture-based tests around `buildOrderPayload` and simulated edits |
| E2E | Mobile wizard and desktop side-by-side submission path | Extend existing HTTP flow checks to assert backend rejects inconsistent quantity and accepts normalized payload |

## Migration / Rollout

No data migration required. Rollout is incremental by surface:
1. Introduce composer domain + shared components behind current pages.
2. Migrate `CatalogoCliente` modal internals first (already has mature UX baseline).
3. Migrate `NuevoPedido` to full-page composer.
4. Enable backend strict checks after frontend preflight is active in both surfaces.

## Open Questions

- [ ] Confirm authoritative product capability field for `requiresDentalSelection` (explicit DB flag vs category/name heuristic).
- [ ] Decide if express surcharge (`es_urgente`) belongs in the normalized item contract or order-level metadata only.
