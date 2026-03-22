# Delta for Orders Composer and Cart Domain

## ADDED Requirements

### Requirement: Single Source of Truth for Item State

The system MUST derive each order item from one canonical state object and MUST NOT allow `cantidad`, `piezas`, `subtotal`, or payload fields to be edited independently in divergent flows. The hard rule is mandatory in all order-entry surfaces:

`if (item.product.requiresDentalSelection) { item.cantidad = item.piezas.length }`

For products with `requiresDentalSelection = true`, `cantidad` SHALL be read-only and derived from selected valid pieces. For products with `requiresDentalSelection = false`, `cantidad` MAY be user-editable but MUST remain a positive integer.

#### Scenario: Dental product quantity derivation

- GIVEN an item with `requiresDentalSelection = true` and three valid selected pieces
- WHEN item state is recomputed after a piece add/remove event
- THEN `cantidad` equals `3` and cannot be manually overridden
- AND displayed subtotal uses derived `cantidad`

#### Scenario: Non-dental manual quantity

- GIVEN an item with `requiresDentalSelection = false`
- WHEN the user sets `cantidad = 4`
- THEN `cantidad` remains `4` after recomputation
- AND no piece-count derivation is applied

### Requirement: Multi-Item Composer Invariants

The system MUST maintain cart-level invariants so item and aggregate values cannot drift between UI and submission payload. For every item, `subtotal` SHALL equal `resolvedCantidad * unitPrice` (with the project pricing precision rule). Cart total SHALL be the sum of normalized item subtotals. Payload formatting MUST be generated from normalized items, not raw transient UI fields.

#### Scenario: Consistent aggregate recomputation

- GIVEN a cart with mixed dental and non-dental items
- WHEN one dental piece is removed from an item
- THEN that item `cantidad`, `subtotal`, and cart total are recomputed in the same state transition
- AND payload preview reflects the new normalized values

#### Scenario: No drift across composer surfaces

- GIVEN the same normalized item set in `NuevoPedido` and quick-catalog flow
- WHEN both build the payload for mutation
- THEN both payloads are structurally and numerically equivalent
- AND no UI-local field bypasses normalization

### Requirement: Secure Mutation and Payload Contract

Before any React Query mutation, the client MUST run a preflight formatter+validator over normalized items and MUST block submission on contract violations. The contract SHALL reject payloads where `cantidad`, `piezas`, and `subtotal` are inconsistent. This explicitly mitigates the current quick-catalog vulnerability where manually altered quantity can bypass piece-derived rules and reach backend submission.

Minimum validation rules:
- Dental item: `cantidad` MUST equal `piezas.length`, and `piezas.length` MUST be `>= 1`.
- Non-dental item: `cantidad` MUST be integer `>= 1`, and `piezas` SHALL be empty or omitted.
- Any item: `subtotal` MUST equal computed subtotal from normalized quantity and unit price.

#### Scenario: Block inconsistent dental payload

- GIVEN a dental item with two selected pieces and outgoing `cantidad = 5`
- WHEN mutation preflight validation runs
- THEN submission is blocked with a contract error
- AND no network request is sent

#### Scenario: Allow valid normalized payload

- GIVEN a cart where all items satisfy quantity, pieces, and subtotal rules
- WHEN the mutation preflight runs
- THEN formatted payload is emitted to the mutation
- AND backend receives normalized values only

### Requirement: Measurable Acceptance Gates

The change SHALL be accepted only if all gates pass:
1. `NuevoPedido` and quick-catalog produce identical normalized item payload semantics for quantity and subtotal.
2. `NuevoPedido` supports empty-state entry and selected-product entry without branching payload logic.
3. Dental products never expose writable `cantidad` and always persist quantity equal to selected pieces.
4. Non-dental products preserve manual quantity editing without violating payload validation.

#### Scenario: Release gate verification

- GIVEN automated and manual checks mapped to the four gates
- WHEN the change is evaluated for release
- THEN all four gates pass with evidence per flow
- AND any failed gate blocks release
