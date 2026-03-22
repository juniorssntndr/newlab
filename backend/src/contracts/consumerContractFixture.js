import { InvoiceStatus, OrderStatus, PaymentStatus } from '@newlab/contracts';

const money = {
  amount: 120,
  currency: 'PEN'
};

const line = {
  sku: 'SKU-001',
  description: 'Servicio de prueba',
  qty: 1,
  unitPrice: money,
  taxRate: 0.18
};

export const backendContractsFixture = {
  pedidoBillingSnapshot: {
    orderId: 'order-backend-1',
    customerDocument: '12345678',
    customerName: 'Paciente Backend',
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
    lines: [line],
    total: money
  },
  comprobanteDraft: {
    orderId: 'order-backend-1',
    serie: 'F001',
    issueDateIso: '2026-03-21T10:00:00.000Z',
    subtotal: money,
    igv: {
      amount: 21.6,
      currency: 'PEN'
    },
    total: {
      amount: 141.6,
      currency: 'PEN'
    },
    lines: [line]
  },
  billingResult: {
    invoiceId: 'inv-backend-1',
    invoiceStatus: InvoiceStatus.GENERATED,
    sunatTicket: 'SUNAT-001',
    pdfUrl: 'https://newlab.local/invoices/inv-backend-1.pdf',
    xmlUrl: 'https://newlab.local/invoices/inv-backend-1.xml'
  }
};
