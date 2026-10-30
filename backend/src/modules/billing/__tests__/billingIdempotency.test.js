import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBillingService } from '../application/services/billingService.js';
import { snapshotFixture, issuerFixture } from './fixtures/billingAclFixtures.js';

test('BillingService Idempotency: does not call provider or burn correlativo when already issued', async () => {
    let issueCalls = 0;
    const mockBillingRepository = {
        async getOrderSnapshot(orderId) {
            return {
                ...snapshotFixture,
                orderId: String(orderId),
                status: 'APPROVED',
                paymentStatus: 'PAID',
                lines: [
                    {
                        sku: 'SRV001',
                        description: 'Corona zirconio',
                        qty: 1,
                        unitPrice: { amount: 100, currency: 'PEN' },
                        taxRate: 0.18
                    }
                ],
                total: { amount: 118, currency: 'PEN' }
            };
        },
        async resolveInvoiceSeries() {
            return { tipoComprobante: '01', serie: 'F001' };
        },
        async saveDraft(draft, options) {
            // Simulate existing accepted invoice in database for this order
            return {
                draftId: '999',
                correlativo: '100',
                serie: 'F001',
                tipoComprobante: '01',
                reused: true,
                alreadyIssued: true,
                invoiceRecord: {
                    id: 999,
                    correlativo: 100,
                    serie: 'F001',
                    tipo_comprobante: '01',
                    estado_sunat: 'aceptado',
                    xml_url: 'https://facturacion.apisperu.com/xml/F001-100.xml',
                    pdf_url: 'https://facturacion.apisperu.com/pdf/F001-100.pdf',
                    cdr_url: 'https://facturacion.apisperu.com/cdr/F001-100.cdr',
                    hash_cpe: 'hash123',
                    cdr_code: '0',
                    cdr_description: 'La Factura F001-100 ha sido aceptada'
                }
            };
        },
        async markInvoiceResult() {}
    };

    const mockBillingProviderAcl = {
        async issueComprobante() {
            issueCalls++;
            throw new Error('Should NOT be called for already issued invoice!');
        },
        async getComprobanteStatus() {}
    };

    const billingService = makeBillingService({
        billingRepository: mockBillingRepository,
        billingProviderAcl: mockBillingProviderAcl
    });

    const result = await billingService.createInvoice({
        orderId: '100',
        customerDocument: '20123456789',
        customerName: 'Clinica Test SAC',
        status: 'APPROVED',
        paymentStatus: 'PAID',
        lines: [
            {
                sku: 'SRV001',
                description: 'Corona zirconio',
                qty: 1,
                unitPrice: { amount: 100, currency: 'PEN' },
                taxRate: 0.18
            }
        ],
        total: { amount: 118, currency: 'PEN' }
    }, { idempotencyKey: 'retry-key-1' });

    assert.equal(issueCalls, 0, 'issueComprobante must NOT be called');
    assert.equal(result.invoiceId, '999');
    assert.equal(result.invoiceStatus, 'SENT');
    assert.equal(result.xmlUrl, 'https://facturacion.apisperu.com/xml/F001-100.xml');
    assert.equal(result.pdfUrl, 'https://facturacion.apisperu.com/pdf/F001-100.pdf');
    assert.equal(result.cdrUrl, 'https://facturacion.apisperu.com/cdr/F001-100.cdr');
});

test('BillingService Idempotency: reuses existing correlativo when retrying unconfirmed draft', async () => {
    let issueCalls = 0;
    let issuedCorrelativo = null;

    const mockBillingRepository = {
        async getOrderSnapshot(orderId) {
            return {
                ...snapshotFixture,
                orderId: String(orderId),
                status: 'APPROVED',
                paymentStatus: 'PAID',
                lines: [
                    {
                        sku: 'SRV001',
                        description: 'Corona zirconio',
                        qty: 1,
                        unitPrice: { amount: 100, currency: 'PEN' },
                        taxRate: 0.18
                    }
                ],
                total: { amount: 118, currency: 'PEN' }
            };
        },
        async resolveInvoiceSeries() {
            return { tipoComprobante: '01', serie: 'F001' };
        },
        async saveDraft(draft, options) {
            // Reused draft with existing correlativo 105 (no new correlativo generated)
            return {
                draftId: '555',
                correlativo: '105',
                serie: 'F001',
                tipoComprobante: '01',
                reused: true,
                alreadyIssued: false
            };
        },
        async markInvoiceResult() {}
    };

    const mockBillingProviderAcl = {
        async issueComprobante(draft) {
            issueCalls++;
            issuedCorrelativo = draft.correlativo;
            return {
                invoiceId: '555',
                invoiceStatus: 'SENT',
                pdfUrl: 'https://facturacion.apisperu.com/demo.pdf'
            };
        },
        async getComprobanteStatus() {}
    };

    const billingService = makeBillingService({
        billingRepository: mockBillingRepository,
        billingProviderAcl: mockBillingProviderAcl
    });

    const result = await billingService.createInvoice({
        orderId: '100',
        customerDocument: '20123456789',
        customerName: 'Clinica Test SAC',
        status: 'APPROVED',
        paymentStatus: 'PAID',
        lines: [
            {
                sku: 'SRV001',
                description: 'Corona zirconio',
                qty: 1,
                unitPrice: { amount: 100, currency: 'PEN' },
                taxRate: 0.18
            }
        ],
        total: { amount: 118, currency: 'PEN' }
    }, { idempotencyKey: 'retry-key-pending' });

    assert.equal(issueCalls, 1);
    assert.equal(issuedCorrelativo, '105', 'Must reuse correlativo 105 instead of burning a new one');
    assert.equal(result.invoiceId, '555');
    assert.equal(result.invoiceStatus, 'SENT');
});
