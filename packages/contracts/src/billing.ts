import type { InvoiceStatus, OrderStatus, PaymentStatus } from './enums';
import type { MoneyDto } from './money';

export interface BillingLineDto {
  sku: string;
  description: string;
  qty: number;
  unitPrice: MoneyDto;
  taxRate: number;
}

export interface PedidoBillingSnapshotDto {
  orderId: string;
  customerDocument: string;
  customerName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  lines: BillingLineDto[];
  total: MoneyDto;
}

export interface ComprobanteDraftDto {
  orderId: string;
  serie: string;
  correlativo?: string;
  issueDateIso: string;
  subtotal: MoneyDto;
  igv: MoneyDto;
  total: MoneyDto;
  lines: BillingLineDto[];
}

export interface BillingResultDto {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  sunatTicket?: string;
  pdfUrl?: string;
  xmlUrl?: string;
}
