import test from 'node:test';
import assert from 'node:assert/strict';

import { mapDraftToApisperuPayload } from '../../../infrastructure/apisperu/mappers/toProvider.js';
import { mapIssueResponseToBillingResult, mapStatusResponseToBillingResult } from '../../../infrastructure/apisperu/mappers/fromProvider.js';
import { makeApisperuBillingAcl } from '../infrastructure/adapters/apisperuBillingAcl.js';
import {
    draftFixture,
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

test('ACL issues invoice and syncs status using repository/provider ports', async () => {
    const billingRepository = {
        getOrderSnapshot: async () => snapshotFixture,
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
        }
    };

    const acl = makeApisperuBillingAcl({ billingRepository, apisperuAdapter });
    const issueResult = await acl.issueComprobante(draftFixture);
    const statusResult = await acl.getComprobanteStatus('55');

    assert.equal(issueResult.invoiceStatus, 'SENT');
    assert.equal(statusResult.invoiceStatus, 'SENT');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].type, 'send');
    assert.equal(calls[0].input.payload.serie, 'F001');
    assert.equal(calls[1].type, 'status');
    assert.equal(calls[1].input.correlativo, '123');
});

test('ACL throws when repository cannot resolve order snapshot', async () => {
    const acl = makeApisperuBillingAcl({
        billingRepository: {
            getOrderSnapshot: async () => null,
            resolveInvoiceSeries: async () => ({ serie: 'F001', tipoComprobante: '01' }),
            getIssuerConfig: async () => issuerFixture,
            getInvoiceProviderReference: async () => null
        },
        apisperuAdapter: {
            sendInvoice: async () => issueProviderResponseFixture,
            getInvoiceStatus: async () => statusProviderResponseFixture
        }
    });

    await assert.rejects(
        () => acl.issueComprobante(draftFixture),
        /No se encontro el pedido para emitir comprobante/
    );
});
