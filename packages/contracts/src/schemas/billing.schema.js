import { z } from 'zod';
import { invoiceStatusSchema, orderStatusSchema, paymentStatusSchema } from './enums.schema.js';
import { moneySchema } from './money.schema.js';

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
  customerAddress: z.object({
    ubigeo: z.string().optional(),
    direccion: z.string().optional()
  }).optional(),
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  lines: z.array(billingLineSchema),
  total: moneySchema
});

export const receptorSchema = z.object({
  tipoDoc: z.string().optional(),
  documento: z.string().min(1),
  razonSocial: z.string().min(1),
  direccion: z.string().optional(),
  ubigeo: z.string().optional(),
});

export const comprobanteDraftSchema = z.object({
  orderId: z.string().min(1),
  serie: z.string().min(1),
  correlativo: z.string().min(1).optional(),
  issueDateIso: z.string().datetime(),
  subtotal: moneySchema,
  igv: moneySchema,
  total: moneySchema,
  lines: z.array(billingLineSchema),
  receptor: receptorSchema.optional()
});

export const billingResultSchema = z.object({
  invoiceId: z.string().min(1),
  invoiceStatus: invoiceStatusSchema,
  sunatTicket: z.string().min(1).optional(),
  pdfUrl: z.string().url().optional(),
  xmlUrl: z.string().url().optional(),
  cdrUrl: z.string().url().optional(),
  hash: z.string().min(1).optional(),
  cdrCode: z.string().min(1).optional(),
  cdrDescription: z.string().min(1).optional()
});
