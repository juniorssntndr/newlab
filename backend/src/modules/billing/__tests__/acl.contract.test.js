import test from 'node:test';
import assert from 'node:assert/strict';

import { mapDraftToApisperuPayload } from '../../../infrastructure/apisperu/mappers/toProvider.js';
import { mapIssueResponseToBillingResult, mapStatusResponseToBillingResult } from '../../../infrastructure/apisperu/mappers/fromProvider.js';
import { makeApisperuBillingAcl } from '../infrastructure/adapters/apisperuBillingAcl.js';
import {
    draftFixture,
    draftWithoutReceptorFixture,
    snapshotFixture,
    issuerFixture,
    issueProviderResponseFixture,
    statusProviderResponseFixture
} from './fixtures/billingAclFixtures.js';

test('maps domain draft to APISPERU payload contract', () => {
    const payload = mapDraftToApisperuPayload({
        draft: draftFixture,
        snapshot: snapshotFixture,
        issuer: issuerFixture,
        tipoComprobante: '01'
    });

    assert.equal(payload.tipoDoc, '01');
    assert.equal(payload.serie, 'F001');
    assert.equal(payload.client.numDoc, snapshotFixture.customerDocument);
    assert.equal(payload.client.rznSocial, snapshotFixture.customerName);
    assert.equal(payload.company.ruc, issuerFixture.ruc);
    assert.equal(payload.details.length, 1);
    assert.equal(payload.details[0].descripcion, draftFixture.lines[0].description);
    assert.equal(payload.mtoImpVenta, 118);
    assert.equal(payload.legends[0].code, '1000');
});

test('maps provider issue/status responses to billing domain contract', () => {
    const issueResult = mapIssueResponseToBillingResult({ providerResponse: issueProviderResponseFixture });
    const statusResult = mapStatusResponseToBillingResult({ providerResponse: statusProviderResponseFixture });

    assert.equal(issueResult.invoiceStatus, 'SENT');
    assert.equal(issueResult.sunatTicket, 'TICKET-123');
    assert.equal(issueResult.pdfUrl, 'https://cdn.example.com/invoice.pdf');
    assert.equal(statusResult.invoiceStatus, 'SENT');
    assert.equal(statusResult.xmlUrl, 'https://cdn.example.com/invoice.xml');
});

test('maps the documented APISPERU invoice response including hash and CDR', () => {
    const result = mapIssueResponseToBillingResult({
        providerResponse: {
            xml: 'base64-xml-content',
            hash: 'CPE-HASH-123',
            sunatResponse: {
                success: true,
                cdrZip: 'base64-cdr-content',
                cdrResponse: {
                    id: 'F001-123',
                    code: 0,
                    description: 'La Factura numero F001-123 ha sido aceptada'
                }
            }
        }
    });

    assert.equal(result.invoiceStatus, 'SENT');
    assert.equal(result.hash, 'CPE-HASH-123');
    assert.equal(result.cdrCode, '0');
    assert.match(result.cdrDescription, /aceptada/);
});

test('maps a SUNAT rejection as rejected instead of generated', () => {
    const result = mapIssueResponseToBillingResult({
        providerResponse: {
            sunatResponse: {
                success: false,
                cdrResponse: {
                    code: '2335',
                    description: 'El documento fue rechazado'
                }
            }
        }
    });

    assert.equal(result.invoiceStatus, 'REJECTED');
    assert.equal(result.cdrCode, '2335');
});

test('ACL issues invoice via receptor en draft (sin re-fetch de snapshot)', async () => {
    let snapshotFetchCount = 0;
    const billingRepository = {
        getOrderSnapshot: async () => { snapshotFetchCount++; return snapshotFixture; },
        resolveInvoiceSeries: async () => ({ serie: 'F001', tipoComprobante: '01' }),
        getIssuerConfig: async () => issuerFixture,
        getInvoiceProviderReference: async () => ({
            invoiceId: '55',
            tipoComprobante: '01',
            serie: 'F001',
            correlativo: '123'
        })
    };

    const calls = [];
    const apisperuAdapter = {
        sendInvoice: async (input) => {
            calls.push({ type: 'send', input });
            return issueProviderResponseFixture;
        },
        getInvoiceStatus: async (input) => {
            calls.push({ type: 'status', input });
            return statusProviderResponseFixture;
        },
        sendCreditNote: async () => ({}),
        sendVoided: async () => ({}),
        getVoidedStatus: async () => ({}),
        sendSummary: async () => ({}),
        getSummaryStatus: async () => ({})
    };

    const acl = makeApisperuBillingAcl({ billingRepository, apisperuAdapter });

    // Con receptor en draft: getOrderSnapshot NO debe llamarse
    const issueResult = await acl.issueComprobante(draftFixture);
    assert.equal(issueResult.invoiceStatus, 'SENT');
    assert.equal(snapshotFetchCount, 0, 'getOrderSnapshot no debe llamarse cuando draft.receptor está presente');
    assert.equal(calls[0].input.payload.client.numDoc, draftFixture.receptor.documento);
    assert.equal(calls[0].input.payload.client.rznSocial, draftFixture.receptor.razonSocial);

    // Sincronización de estado funciona normalmente
    const statusResult = await acl.getComprobanteStatus('55');
    assert.equal(statusResult.invoiceStatus, 'SENT');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].input.payload.serie, 'F001');
    assert.equal(calls[1].input.correlativo, '123');
    assert.equal(calls[1].input.ruc, issuerFixture.ruc);
});

test('ACL issues invoice sin receptor en draft (usa getOrderSnapshot como fallback)', async () => {
    let snapshotFetchCount = 0;
    const billingRepository = {
        getOrderSnapshot: async () => { snapshotFetchCount++; return snapshotFixture; },
        resolveInvoiceSeries: async () => ({ serie: 'F001', tipoComprobante: '01' }),
        getIssuerConfig: async () => issuerFixture,
        getInvoiceProviderReference: async () => null
    };

    const apisperuAdapter = {
        sendInvoice: async () => issueProviderResponseFixture,
        getInvoiceStatus: async () => statusProviderResponseFixture,
        sendCreditNote: async () => ({}),
        sendVoided: async () => ({}),
        getVoidedStatus: async () => ({}),
        sendSummary: async () => ({}),
        getSummaryStatus: async () => ({})
    };

    const acl = makeApisperuBillingAcl({ billingRepository, apisperuAdapter });
    const issueResult = await acl.issueComprobante(draftWithoutReceptorFixture);
    assert.equal(issueResult.invoiceStatus, 'SENT');
    assert.equal(snapshotFetchCount, 1, 'getOrderSnapshot debe llamarse cuando no hay receptor en draft');
});

test('ACL usa seriesResolution de opts cuando se provee (evita resolveInvoiceSeries extra)', async () => {
    let seriesResolveCalls = 0;
    const billingRepository = {
        getOrderSnapshot: async () => null,
        resolveInvoiceSeries: async () => { seriesResolveCalls++; return { serie: 'F001', tipoComprobante: '01' }; },
        getIssuerConfig: async () => issuerFixture,
        getInvoiceProviderReference: async () => null
    };

    const apisperuAdapter = {
        sendInvoice: async () => issueProviderResponseFixture,
        getInvoiceStatus: async () => statusProviderResponseFixture,
        sendCreditNote: async () => ({}),
        sendVoided: async () => ({}),
        getVoidedStatus: async () => ({}),
        sendSummary: async () => ({}),
        getSummaryStatus: async () => ({})
    };

    const acl = makeApisperuBillingAcl({ billingRepository, apisperuAdapter });
    await acl.issueComprobante(draftFixture, { seriesResolution: { serie: 'F001', tipoComprobante: '01' } });
    assert.equal(seriesResolveCalls, 0, 'resolveInvoiceSeries no debe llamarse cuando opts.seriesResolution está presente');
});

test('ACL throws when repository cannot resolve order snapshot (draft sin receptor)', async () => {
    const acl = makeApisperuBillingAcl({
        billingRepository: {
            getOrderSnapshot: async () => null,
            resolveInvoiceSeries: async () => ({ serie: 'F001', tipoComprobante: '01' }),
            getIssuerConfig: async () => issuerFixture,
            getInvoiceProviderReference: async () => null
        },
        apisperuAdapter: {
            sendInvoice: async () => issueProviderResponseFixture,
            getInvoiceStatus: async () => statusProviderResponseFixture,
            sendCreditNote: async () => ({}),
            sendVoided: async () => ({}),
            getVoidedStatus: async () => ({}),
            sendSummary: async () => ({}),
            getSummaryStatus: async () => ({})
        }
    });

    // Sin receptor en draft, el ACL intenta getOrderSnapshot → null → lanza error
    await assert.rejects(
        () => acl.issueComprobante(draftWithoutReceptorFixture),
        /No se encontro el pedido para emitir comprobante/
    );
});
