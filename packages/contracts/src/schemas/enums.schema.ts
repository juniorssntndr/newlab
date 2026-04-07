import { z } from 'zod';

export const currencyCodeSchema = z.enum(['PEN', 'USD']);
export const orderStatusSchema = z.enum(['PENDING', 'APPROVED', 'BILLED', 'CANCELLED']);
export const paymentStatusSchema = z.enum(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED']);
export const invoiceStatusSchema = z.enum(['DRAFT', 'GENERATED', 'SENT', 'REJECTED']);
