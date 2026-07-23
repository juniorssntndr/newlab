import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBillingPhase2Service } from '../application/services/billingPhase2Service.js';

const issuer = {
    token: 'token', ruc: '20111111111', razonSocial: 'AFINIX SAC', nombreComercial: 'AFINIX',
    ubigeo: '150101', direccionFiscal: 'Av. Empresa 123'
};

const invoice = {
    id: 10, estado_sunat: 'aceptado', tipo_comprobante: '01', serie: 'F001', correlativo: 20,
    fecha_emision: '2026-07-12', total_venta: 118, monto_acreditado: 0,
    cliente_ruc: '20123456789', cliente_razon_social: 'CLINICA TEST SAC',
    cliente_direccion: 'Av. Cliente 123', cliente_ubigeo: '150101'
};

test('credit note uses /note contract fields and persists accepted CDR', async () => {
    let sentPayload;
    let persisted;
    const repository = {
        getCreditNoteByIdempotency: async () => null,
        getInvoiceFiscalContext: async () => invoice,
        saveCreditNoteDraft: async () => ({ id: 30, correlativo: 1 }),
        getIssuerConfig: async () => issuer,
        markCreditNoteResult: async (_id, result) => { persisted = result; },
        markCreditNoteFailure: async () => {}
    };
    const provider = {
        issueCreditNote: async ({ payload }) => {
            sentPayload = payload;
            return { hash: 'HASH', sunatResponse: { success: true, cdrResponse: { accepted: true, code: '0', description: 'Aceptado' } } };
        }
    };
    const service = makeBillingPhase2Service({ billingRepository: repository, billingProviderAcl: provider });
    const result = await service.createCreditNote('10', {
        monto: 118, motivo: 'ANULACION TOTAL', codMotivo: '01', idempotencyKey: 'note-key-123'
    });

    assert.equal(sentPayload.tipoDoc, '07');
    assert.equal(sentPayload.numDocfectado, 'F001-20');
    assert.equal(sentPayload.serie, 'FF01');
    assert.equal(persisted.accepted, true);
    assert.equal(result.status, 'aceptado');
});

test('voiding remains pending until its ticket is accepted', async () => {
    let invoiceWasVoided = false;
    const repository = {
        getVoidingByIdempotency: async () => null,
        getInvoiceFiscalContext: async () => invoice,
        saveVoidingDraft: async () => ({ id: 40, correlativo: 1 }),
        getIssuerConfig: async () => issuer,
        markVoidingSent: async () => {},
        getVoiding: async () => ({ id: 40, comprobante_id: 10, motivo: 'ERROR DE DATOS', provider_ticket: 'TICKET-40' }),
        markVoidingStatus: async (_voiding, result) => { invoiceWasVoided = result.accepted; }
    };
    const provider = {
        sendVoided: async () => ({ hash: 'HASH', sunatResponse: { success: true, ticket: 'TICKET-40' } }),
        getVoidedStatus: async () => ({ success: true, cdrResponse: { accepted: true, code: '0', description: 'Baja aceptada' } })
    };
    const service = makeBillingPhase2Service({ billingRepository: repository, billingProviderAcl: provider });
    const queued = await service.requestVoiding('10', { motivo: 'ERROR DE DATOS', idempotencyKey: 'void-key-123' });
    assert.equal(queued.status, 'pendiente');
    assert.equal(invoiceWasVoided, false);

    const synced = await service.syncVoidingStatus('40');
    assert.equal(synced.status, 'aceptado');
    assert.equal(invoiceWasVoided, true);
});

test('daily summary sends eligible boletas and tracks asynchronous result', async () => {
    let details;
    let storedStatus;
    const repository = {
        getSummaryByIdempotency: async () => null,
        listBoletasForSummary: async () => [{
            id: 50, serie: 'B001', correlativo: 5, total_venta: 59,
            total_gravada: 50, total_igv: 9, cliente_documento: '12345678', cliente_tipo_doc: '1'
        }],
        saveSummaryDraft: async () => ({ id: 60, correlativo: 1 }),
        getIssuerConfig: async () => issuer,
        markSummarySent: async () => {},
        getSummary: async () => ({ id: 60, provider_ticket: 'TICKET-60' }),
        markSummaryStatus: async (_id, result) => { storedStatus = result; }
    };
    const provider = {
        sendSummary: async ({ payload }) => {
            details = payload.details;
            return { hash: 'HASH', sunatResponse: { success: true, ticket: 'TICKET-60' } };
        },
        getSummaryStatus: async () => ({ success: true, cdrResponse: { accepted: true, code: '0', description: 'Resumen aceptado' } })
    };
    const service = makeBillingPhase2Service({ billingRepository: repository, billingProviderAcl: provider });
    const queued = await service.createDailySummary({ fechaResumen: '2026-07-12', idempotencyKey: 'summary-key-123' });
    assert.equal(queued.status, 'pendiente');
    assert.equal(details[0].serieNro, 'B001-5');

    const synced = await service.syncSummaryStatus('60');
    assert.equal(synced.status, 'aceptado');
    assert.equal(storedStatus.accepted, true);
});
