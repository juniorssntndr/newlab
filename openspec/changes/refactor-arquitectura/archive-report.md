# Archive Report: refactor-arquitectura

## Change Closure

- **Change**: `refactor-arquitectura`
- **Project**: `NEWLAB`
- **Archive Date**: `2026-03-22`
- **Verification Basis**: `openspec/changes/refactor-arquitectura/verify-report.md` (THIRD AND FINAL VERIFY PASS, PASS)

## Executive Summary

This change completed a full architectural migration from router-bound backend monolith patterns and page-level manual frontend fetch flows into explicit ports/adapters boundaries on backend and React Query-owned server state on frontend. The new architecture preserves external HTTP contracts while isolating APISPERU provider drift behind billing ACL and standardizing cache consistency through query-key modules and mutation invalidation policies.

QA accepted the release with no critical blockers and confirmed 5/5 compliant scenarios for the approved spec. Residual non-blocking debt was explicitly accepted into production and is tracked below.

## Scope Reviewed for Archive

- `openspec/changes/refactor-arquitectura/spec.md`
- `openspec/changes/refactor-arquitectura/design.md`
- `openspec/changes/refactor-arquitectura/tasks.md`
- `openspec/changes/refactor-arquitectura/apply-progress.md`
- `openspec/changes/refactor-arquitectura/verify-report.md`

## Backend Outcomes (Ports/Adapters Migration)

- Established `backend/src/bootstrap/compositionRoot.js` as the composition boundary for dependency wiring and runtime mode selection.
- Migrated legacy route responsibility out of `pedidos`, `finanzas`, and `dashboard` routes into module layers (`controller -> service -> repository`) while preserving external endpoint contracts.
- Implemented Billing ACL isolation with explicit ports and APISPERU adapters/mappers, including dual runtime mode via `USE_NEW_BILLING_ACL`.
- Added endpoint-level HTTP E2E evidence for `order -> payment -> invoice` lifecycle in both billing modes (`legacy-service` and `new-acl`).

## Frontend Outcomes (React Query Migration)

- Established query bootstrap and provider boundaries so TanStack Query is owner of server state for orders/finance/billing/dashboard/notifications.
- Replaced manual route/page fetch orchestration with moduleized query and mutation hooks.
- Standardized query-key families by domain and centralized invalidation utilities.
- Removed global fixed 5000ms notification polling; refresh now depends on query invalidation, focus/reconnect behavior, and explicit user refresh.

## Spec and QA Closure

- **Spec compliance**: 5/5 scenarios marked compliant in final verify pass.
- **Critical issues**: none.
- **Final verdict**: PASS, approved for archive and production continuity.

## Residual Technical Debt Accepted into Production

The following items were explicitly left incomplete but accepted as non-blocking in QA:

1. **Task 4.1** - Missing full backend unit/integration hardening for all services/controllers/repositories with endpoint contract assertions.
2. **Task 4.2** - Checklist remains unchecked despite prior coverage evidence; ACL test evidence and checklist state are misaligned and require reconciliation.
3. **Task 4.3** - Missing dedicated frontend integration suite for invalidation + optimistic rollback behaviors beyond targeted tests.
4. **Task 4.5** - Legacy dead code/constants/wiring cleanup remains pending and should be executed after downstream stabilization.
5. **QA warning** - `/api/facturacion/:comprobanteId/status` is not yet covered in the same route-level E2E matrix used for `/emitir` under both billing modes.

## Architectural Conventions to Preserve (Long-Term)

1. **Custom hook/query module pattern**
   - Each domain owns `api/`, `queries/`, and `mutations/` modules.
   - UI pages/components MUST consume domain hooks, not raw `fetch`/axios orchestration.

2. **Query Key Factories**
   - Query keys MUST be generated through domain key factories (`ordersKeys`, `financeKeys`, `billingKeys`, `dashboardKeys`, etc.).
   - Mutations MUST invalidate through centralized helpers, never ad-hoc key literals in pages.

3. **`USE_NEW_BILLING_ACL` fallback strategy**
   - `USE_NEW_BILLING_ACL=true` MUST route billing flows through new ACL/controller path.
   - `USE_NEW_BILLING_ACL=false` MUST preserve operational fallback through legacy APISPERU service path.
   - This panic-button behavior is a production safety seam and MUST remain testable.

4. **`compositionRoot.js` as backend composition boundary**
   - Concrete infrastructure wiring and runtime mode resolution MUST remain centralized in `backend/src/bootstrap/compositionRoot.js`.
   - Route files remain transport adapters; dependency construction MUST NOT drift back into route handlers.

## Lessons Learned

- Strangler migration with compatibility facades can preserve contracts while progressively enforcing clean architecture boundaries.
- Feature-flagged coexistence (`new-acl` vs `legacy-service`) reduced migration risk and enabled measurable acceptance evidence.
- Query-key governance is a first-class architecture concern; cache inconsistency defects were resolved only after centralizing key/invalidation ownership.

## Post-Archive Recommendation

- This change is architecturally closed.
- Remaining debt should be handled as a new, explicit hardening/cleanup change to avoid re-opening closed scope.
