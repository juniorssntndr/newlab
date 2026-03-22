export const CurrencyCodes = Object.freeze(['PEN', 'USD']);

export const OrderStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  BILLED: 'BILLED',
  CANCELLED: 'CANCELLED'
});

export const PaymentStatus = Object.freeze({
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED'
});

export const InvoiceStatus = Object.freeze({
  DRAFT: 'DRAFT',
  GENERATED: 'GENERATED',
  SENT: 'SENT',
  REJECTED: 'REJECTED'
});
