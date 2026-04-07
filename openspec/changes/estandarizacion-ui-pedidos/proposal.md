# Proposal: Estandarizacion UI Pedidos

## Intent

Unify `NuevoPedido` with the stronger side-by-side quick-catalog UX and remove quantity/pricing drift. Both order-entry flows must express the same clinical decision model, even when no product is preselected.

## Scope

### In Scope
- Standardize `NuevoPedido` as a full-page composer: product chooser/list on one side, shared clinical-details/pricing panel on the other, plus empty and transition states when no product is selected.
- Define quantity rules: dental-selection products derive read-only `cantidad` from valid selected pieces/bridge units; manual-quantity products keep editable quantity.
- Extract shared clinical/panel UI from `CatalogoCliente` instead of duplicating the quick modal layout in `NuevoPedido`.
- Standardize FE/BE payload semantics so `NuevoPedido` and quick modal submit the same quantity and subtotal contract.

### Out of Scope
- Reworking order status, approvals, or unrelated order detail screens.
- Changing tax formulas, pricing strategy, or historical orders.

## Approach

Create a shared order-composer domain layer plus reusable presentation shell.

- `frontend/src/modules/orders/composer/*` derives `requiresDentalSelection`, resolved `cantidad`, preview totals, and normalized item payload.
- `frontend/src/components/orders/*` hosts reusable product-summary, clinical-panel, pricing-summary, and side-by-side layout primitives extracted from the quick modal.
- `frontend/src/pages/NuevoPedido.jsx` becomes the page container for selection-first ordering; `frontend/src/pages/CatalogoCliente.jsx` becomes a thin wrapper over the same primitives for preselected products.
- `backend/src/validation/schemas.js` and `backend/src/modules/orders/infrastructure/repositories/orderPgRepository.js` enforce the shared quantity contract before persistence.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/pages/NuevoPedido.jsx` | Modified | Move to shared side-by-side composer with empty state support |
| `frontend/src/pages/CatalogoCliente.jsx` | Modified | Reuse shared panels for quick ordering |
| `frontend/src/components/orders/*` | New/Modified | Shared clinical and pricing presentation blocks |
| `frontend/src/modules/orders/composer/*` | New | Shared quantity, subtotal, and payload derivation |
| `backend/src/validation/schemas.js` | Modified | Validate manual vs derived quantity semantics |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Product capability rules are incomplete | Med | Add explicit resolver and fallback audit by product/category |
| Multi-item `NuevoPedido` regression | Med | Migrate item-by-item through shared composer payload tests |
| Visual reuse causes desktop/mobile drift | Low | Preserve quick-modal mobile step behavior inside shared shell |

## Rollback Plan

Keep page/modal wrappers isolated so the shared composer can be reverted per flow; revert backend validation independently if it blocks legitimate orders.

## Dependencies

- Existing odontogram utilities and `OdontogramaInteractive`.
- Product capability mapping for `requiresDentalSelection` and bridge-count rules.

## Success Criteria

- [ ] `NuevoPedido` and quick modal produce identical item payload rules for quantity and subtotal.
- [ ] `NuevoPedido` supports ordering from an empty state and from a selected product without branching UI logic.
- [ ] Dental-selection products never allow manual quantity edits and persist correct totals.
- [ ] Non-dental products still support manual quantity without UX regression.
