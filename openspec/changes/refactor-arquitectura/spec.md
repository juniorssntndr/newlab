# Refactor Arquitectura Specification

## Purpose

Definir contratos y reglas de comportamiento para desacoplar backend/frontend, centralizar server-state en TanStack Query y encapsular APISPERU mediante ACL en facturacion.

## Requirement 1: Shared Contracts in `packages/contracts`

El sistema MUST exponer contratos TypeScript versionables y validados en runtime (zod) para estados y payloads fiscales.

```ts
export type CurrencyCode = "PEN" | "USD";

export enum OrderStatus { PENDING="PENDING", APPROVED="APPROVED", BILLED="BILLED", CANCELLED="CANCELLED" }
export enum PaymentStatus { UNPAID="UNPAID", PARTIAL="PARTIAL", PAID="PAID", REFUNDED="REFUNDED" }
export enum InvoiceStatus { DRAFT="DRAFT", GENERATED="GENERATED", SENT="SENT", REJECTED="REJECTED" }

export interface MoneyDto { amount: number; currency: CurrencyCode; }
export interface BillingLineDto { sku: string; description: string; qty: number; unitPrice: MoneyDto; taxRate: number; }
export interface PedidoBillingSnapshotDto {
  orderId: string; customerDocument: string; customerName: string;
  status: OrderStatus; paymentStatus: PaymentStatus; lines: BillingLineDto[]; total: MoneyDto;
}
export interface ComprobanteDraftDto {
  orderId: string; serie: string; correlativo?: string; issueDateIso: string;
  subtotal: MoneyDto; igv: MoneyDto; total: MoneyDto; lines: BillingLineDto[];
}
export interface BillingResultDto {
  invoiceId: string; invoiceStatus: InvoiceStatus; sunatTicket?: string; pdfUrl?: string; xmlUrl?: string;
}
```

#### Scenario: Contract consumed by backend and frontend
- GIVEN `pedidos` and frontend hooks import from `packages/contracts`
- WHEN a fiscal payload is created or read
- THEN compile-time types MUST match the shared interfaces
- AND runtime validation MUST reject invalid enums or monetary shapes

#### Scenario: Backward compatibility guard
- GIVEN a new field is needed in `ComprobanteDraftDto`
- WHEN added without optional marker
- THEN CI contract checks SHALL fail for non-updated consumers

## Requirement 2: Billing Shell/Signature Contracts

El backend MUST aplicar puertos explicitos para Controller, Service y Repository/ACL en facturacion.

```ts
export interface ControllerAnalyticalSignature<TParams, TBody, TResult> {
  execute(ctx: { requestId: string; actorId: string; now: Date }, input: { params: TParams; body: TBody }): Promise<{
    ok: boolean; status: number; data?: TResult; errorCode?: string; errorMessage?: string;
  }>;
}

export interface BillingService {
  createInvoice(snapshot: PedidoBillingSnapshotDto): Promise<BillingResultDto>;
  syncInvoiceStatus(invoiceId: string): Promise<BillingResultDto>;
  previewDraft(orderId: string): Promise<ComprobanteDraftDto>;
}

export interface BillingRepositoryPort {
  getOrderSnapshot(orderId: string): Promise<PedidoBillingSnapshotDto>;
  saveDraft(draft: ComprobanteDraftDto): Promise<{ draftId: string }>;
  markInvoiceResult(orderId: string, result: BillingResultDto): Promise<void>;
}

export interface BillingProviderAcl {
  issueComprobante(draft: ComprobanteDraftDto): Promise<BillingResultDto>;
  getComprobanteStatus(invoiceId: string): Promise<BillingResultDto>;
}
```

#### Scenario: APISPERU payload isolation
- GIVEN APISPERU changes field names
- WHEN adapter mapping is updated
- THEN `BillingService` and route controllers MUST keep unchanged signatures

## Requirement 3: TanStack Query Cache Policy (`orders`/`finance`)

Frontend server-state SHALL belong to TanStack Query; contexts MUST NOT own orders/finance fetching.

- Query keys MUST be:
  - `orders.list(filters)` and `orders.detail(orderId)`
  - `finance.accounts(filters)`, `finance.payments(orderId)`, `finance.kpis(range)`
- Refetch MUST occur on `window focus`, `network reconnect`, and explicit user refresh.
- Polling MAY be enabled only per-query (opt-in), default disabled.
- Optimistic mutation SHOULD apply to low-risk local-first actions (`approveOrder`, `markPaymentReceived`) with rollback on error.
- Invalidate MUST occur after successful mutations:
  - `approveOrder` -> invalidate `orders.list`, `orders.detail`, `finance.kpis`
  - `createInvoice` -> invalidate `orders.detail`, `finance.payments`, `finance.kpis`
  - `registerPayment` -> invalidate `finance.payments`, `finance.accounts`, `orders.detail`

#### Scenario: Mutation-driven consistency
- GIVEN user registers a payment
- WHEN mutation resolves successfully
- THEN cache MUST optimistically update target payment row
- AND listed keys MUST be invalidated for authoritative refetch

## Requirement 4: Technical Acceptance Criteria

La migracion SHALL considerarse valida solo si cumple todos los criterios medibles:

1. `backend/src/routes/pedidos.js`, `backend/src/routes/finanzas.js`, `backend/src/routes/dashboard.js` MUST contain zero SQL strings and zero APISPERU direct calls.
2. `frontend/src/state/NotificationContext.jsx` MUST remove global fixed polling (`5000ms`) and rely on query invalidation/focus/reconnect.
3. `packages/contracts` MUST be the only source for shared billing/order enums y DTOs usados por backend y frontend.
4. Billing ACL tests MUST verify mapping in both directions (domain <-> provider) with >= 90% statement coverage in ACL module.
5. End-to-end finance/order flow MUST pass with unchanged external endpoint contracts (status codes + response shape).

#### Scenario: Migration gate
- GIVEN CI pipeline for `refactor-arquitectura`
- WHEN any criterion 1-5 fails
- THEN release SHALL be blocked until compliance is restored
