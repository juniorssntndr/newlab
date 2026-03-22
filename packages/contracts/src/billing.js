export const createBillingLine = ({ sku, description, qty, unitPrice, taxRate }) => ({
  sku,
  description,
  qty,
  unitPrice,
  taxRate
});

export const createPedidoBillingSnapshot = ({
  orderId,
  customerDocument,
  customerName,
  status,
  paymentStatus,
  lines,
  total
}) => ({
  orderId,
  customerDocument,
  customerName,
  status,
  paymentStatus,
  lines,
  total
});

export const createComprobanteDraft = ({
  orderId,
  serie,
  correlativo,
  issueDateIso,
  subtotal,
  igv,
  total,
  lines
}) => ({
  orderId,
  serie,
  correlativo,
  issueDateIso,
  subtotal,
  igv,
  total,
  lines
});

export const createBillingResult = ({
  invoiceId,
  invoiceStatus,
  sunatTicket,
  pdfUrl,
  xmlUrl
}) => ({
  invoiceId,
  invoiceStatus,
  sunatTicket,
  pdfUrl,
  xmlUrl
});
