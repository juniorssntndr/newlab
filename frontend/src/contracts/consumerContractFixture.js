import { InvoiceStatus, OrderStatus, PaymentStatus } from '@newlab/contracts';

const money = {
  amount: 85,
  currency: 'PEN'
};

const line = {
  sku: 'SKU-UI-01',
  description: 'Servicio frontend',
  qty: 1,
  unitPrice: money,
  taxRate: 0.18
};

export const frontendContractsFixture = {
  pedidoBillingSnapshot: {
    orderId: 'order-frontend-1',
    customerDocument: '87654321',
    customerName: 'Paciente Frontend',
    status: OrderStatus.APPROVED,
    paymentStatus: PaymentStatus.PARTIAL,
    lines: [line],
    total: {
      amount: 100.3,
      currency: 'PEN'
    }
  },
  comprobanteDraft: {
    orderId: 'order-frontend-1',
    serie: 'B001',
    issueDateIso: '2026-03-21T11:00:00.000Z',
    subtotal: money,
    igv: {
      amount: 15.3,
      currency: 'PEN'
    },
    total: {
      amount: 100.3,
      currency: 'PEN'
    },
    lines: [line]
  },
  billingResult: {
    invoiceId: 'inv-frontend-1',
    invoiceStatus: InvoiceStatus.SENT,
    sunatTicket: 'SUNAT-002',
    pdfUrl: 'https://newlab.local/invoices/inv-frontend-1.pdf',
    xmlUrl: 'https://newlab.local/invoices/inv-frontend-1.xml'
  }
};
