export type CurrencyCode = 'PEN' | 'USD';

export const CurrencyCodes = ['PEN', 'USD'] as const;

export enum OrderStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  BILLED = 'BILLED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED'
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  GENERATED = 'GENERATED',
  SENT = 'SENT',
  REJECTED = 'REJECTED'
}
