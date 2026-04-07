import { z } from 'zod';
import { invoiceStatusSchema, orderStatusSchema, paymentStatusSchema } from './enums.schema';
import { moneySchema } from './money.schema';

export const billingLineSchema = z.object({
  sku: z.string().min(1),
  description: z.string().min(1),
  qty: z.number().positive(),
  unitPrice: moneySchema,
  taxRate: z.number().min(0)
});

export const pedidoBillingSnapshotSchema = z.object({
  orderId: z.string().min(1),
  customerDocument: z.string().min(1),
  customerName: z.string().min(1),
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  lines: z.array(billingLineSchema),
  total: moneySchema
});

export const comprobanteDraftSchema = z.object({
  orderId: z.string().min(1),
  serie: z.string().min(1),
  correlativo: z.string().min(1).optional(),
  issueDateIso: z.string().datetime(),
  subtotal: moneySchema,
  igv: moneySchema,
  total: moneySchema,
  lines: z.array(billingLineSchema)
});

export const billingResultSchema = z.object({
  invoiceId: z.string().min(1),
  invoiceStatus: invoiceStatusSchema,
  sunatTicket: z.string().min(1).optional(),
  pdfUrl: z.string().url().optional(),
  xmlUrl: z.string().url().optional()
});
