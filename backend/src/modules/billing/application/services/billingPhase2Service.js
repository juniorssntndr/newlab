import { BillingServiceError } from './billingService.js';
import { numeroALetras, resolveUbigeoAddress } from '../../../../services/apisperu.js';

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const isoDateTime = (value = new Date()) => new Date(value).toISOString();

const assertIdempotency = (key) => {
    if (!key || String(key).length < 8) {
        throw new BillingServiceError('IDEMPOTENCY_REQUIRED', 'idempotencyKey es requerido', 400);
    }
};

const parseDocumentResult = (response) => {
    const sunat = response?.sunatResponse || {};
    const cdr = sunat?.cdrResponse || {};
    return {
        accepted: Boolean(sunat.success && (cdr.accepted ?? true)),
        hash: response?.hash,
        code: cdr.code === undefined ? undefined : String(cdr.code),
        description: cdr.description || sunat?.error?.message
    };
};

const parseAsyncStatus = (response) => {
    const cdr = response?.cdrResponse || {};
    const accepted = Boolean(response?.success && cdr?.accepted);
    const code = cdr?.code ?? response?.code ?? response?.error?.code;
    const description = cdr?.description ?? response?.error?.message;
    const stillProcessing = String(code || '') === '98';
    return {
        accepted,
        final: !stillProcessing && (accepted || Boolean(cdr?.code || response?.error || String(code || '') === '99')),
        code: code === undefined ? undefined : String(code),
        description
    };
};

const companyPayload = (issuer) => ({
    ruc: issuer.ruc,
    razonSocial: issuer.razonSocial,
    nombreComercial: issuer.nombreComercial,
    address: resolveUbigeoAddress(issuer.ubigeo, issuer.direccionFiscal, { source: 'billing.phase2.company' })
});

export const makeBillingPhase2Service = ({ billingRepository, billingProviderAcl, now = () => new Date() }) => ({
    createCreditNote: async (invoiceId, input) => {
        assertIdempotency(input.idempotencyKey);
        const priorNote = await billingRepository.getCreditNoteByIdempotency(input.idempotencyKey);
        if (priorNote && ['aceptado', 'rechazado'].includes(priorNote.estado_sunat)) {
            return { noteId: String(priorNote.id), status: priorNote.estado_sunat, reused: true };
        }
        const context = await billingRepository.getInvoiceFiscalContext(invoiceId);
        if (!context) throw new BillingServiceError('INVOICE_NOT_FOUND', 'Comprobante no encontrado', 404);
        if (context.estado_sunat !== 'aceptado') {
            throw new BillingServiceError('INVOICE_NOT_ACCEPTED', 'Solo se puede acreditar un comprobante aceptado', 409);
        }
        const monto = round(input.monto);
        const saldo = round(Number(context.total_venta) - Number(context.monto_acreditado));
        if (!monto || monto <= 0 || monto > saldo) {
            throw new BillingServiceError('INVALID_CREDIT_AMOUNT', `El monto debe ser mayor a 0 y no superar S/ ${saldo.toFixed(2)}`, 400);
        }
        const motivo = String(input.motivo || '').trim();
        if (motivo.length < 5) throw new BillingServiceError('INVALID_REASON', 'El motivo debe tener al menos 5 caracteres', 400);
        const codMotivo = String(input.codMotivo || '01').padStart(2, '0');
        if (!['01', '07'].includes(codMotivo)) {
            throw new BillingServiceError('INVALID_CREDIT_REASON_CODE', 'Código de motivo no permitido en este flujo', 400);
        }
        if (codMotivo === '01' && monto !== round(Number(context.total_venta))) {
            throw new BillingServiceError('FULL_CANCELLATION_AMOUNT_REQUIRED', 'La anulación de la operación debe acreditar el total original', 400);
        }
        const igv = round(monto / 1.18 * 0.18);
        const base = round(monto - igv);
        const serie = context.tipo_comprobante === '01' ? 'FF01' : 'BB01';
        const note = await billingRepository.saveCreditNoteDraft({
            invoiceId: Number(invoiceId), serie, tipoDocRef: context.tipo_comprobante,
            motivo, codMotivo, monto, igv, base, idempotencyKey: input.idempotencyKey
        });
        if (note.reused && ['aceptado', 'rechazado'].includes(note.estado_sunat)) {
            return { noteId: String(note.id), status: note.estado_sunat, reused: true };
        }
        const issuer = await billingRepository.getIssuerConfig();
        const document = String(context.cliente_ruc || context.cliente_dni || '00000000').replace(/\D/g, '');
        const payload = {
            ublVersion: '2.1', tipoDoc: '07', serie, correlativo: String(note.correlativo),
            fechaEmision: isoDateTime(now()), tipDocAfectado: context.tipo_comprobante,
            numDocfectado: `${context.serie}-${context.correlativo}`, codMotivo, desMotivo: motivo,
            tipoMoneda: 'PEN',
            client: {
                tipoDoc: document.length === 11 ? '6' : '1', numDoc: document,
                rznSocial: context.cliente_razon_social || context.paciente_nombre || 'CLIENTE VARIOS',
                address: resolveUbigeoAddress(context.cliente_ubigeo, context.cliente_direccion, { source: 'billing.phase2.note.client' })
            },
            company: companyPayload(issuer),
            mtoOperGravadas: base, mtoIGV: igv, totalImpuestos: igv, valorVenta: base,
            subTotal: monto, mtoImpVenta: monto,
            details: [{
                codProducto: 'NC001', unidad: 'ZZ', descripcion: motivo, cantidad: 1,
                mtoValorUnitario: base, mtoValorVenta: base, mtoBaseIgv: base,
                porcentajeIgv: 18, igv, tipAfeIgv: 10, totalImpuestos: igv, mtoPrecioUnitario: monto
            }],
            legends: [{ code: '1000', value: numeroALetras(monto) }]
        };
        try {
            const response = await billingProviderAcl.issueCreditNote({ payload });
            const result = parseDocumentResult(response);
            await billingRepository.markCreditNoteResult(note.id, result);
            return { noteId: String(note.id), status: result.accepted ? 'aceptado' : 'rechazado', ...result };
        } catch (error) {
            await billingRepository.markCreditNoteFailure(note.id, error);
            throw new BillingServiceError('NOTE_DELIVERY_FAILED', error.message || 'No se pudo enviar la nota', 502);
        }
    },
    requestVoiding: async (invoiceId, input) => {
        assertIdempotency(input.idempotencyKey);
        const priorVoiding = await billingRepository.getVoidingByIdempotency(input.idempotencyKey);
        if (priorVoiding?.provider_ticket) {
            return { voidingId: String(priorVoiding.id), status: priorVoiding.estado, ticket: priorVoiding.provider_ticket, reused: true };
        }
        const context = await billingRepository.getInvoiceFiscalContext(invoiceId);
        if (!context) throw new BillingServiceError('INVOICE_NOT_FOUND', 'Comprobante no encontrado', 404);
        if (context.estado_sunat !== 'aceptado') throw new BillingServiceError('INVOICE_NOT_ACCEPTED', 'Solo se puede dar de baja un comprobante aceptado', 409);
        const motivo = String(input.motivo || '').trim();
        if (motivo.length < 5) throw new BillingServiceError('INVALID_REASON', 'El motivo debe tener al menos 5 caracteres', 400);
        const voiding = await billingRepository.saveVoidingDraft({
            invoiceId: Number(invoiceId), motivo, issueDate: String(context.fecha_emision).slice(0, 10), idempotencyKey: input.idempotencyKey
        });
        if (voiding.reused && voiding.provider_ticket) {
            return { voidingId: String(voiding.id), status: voiding.estado, ticket: voiding.provider_ticket, reused: true };
        }
        const issuer = await billingRepository.getIssuerConfig();
        const payload = {
            correlativo: String(voiding.correlativo),
            fecGeneracion: isoDateTime(context.fecha_emision), fecComunicacion: isoDateTime(now()),
            company: companyPayload(issuer),
            details: [{ tipoDoc: context.tipo_comprobante, serie: context.serie, correlativo: String(context.correlativo), desMotivoBaja: motivo }]
        };
        const response = await billingProviderAcl.sendVoided({ payload });
        const ticket = response?.sunatResponse?.ticket;
        if (!response?.sunatResponse?.success || !ticket) throw new BillingServiceError('VOIDED_NOT_QUEUED', response?.sunatResponse?.error?.message || 'SUNAT no entregó ticket de baja', 502);
        await billingRepository.markVoidingSent(voiding.id, { ticket, hash: response.hash });
        return { voidingId: String(voiding.id), status: 'pendiente', ticket };
    },
    syncVoidingStatus: async (voidingId) => {
        const voiding = await billingRepository.getVoiding(voidingId);
        if (!voiding) throw new BillingServiceError('VOIDING_NOT_FOUND', 'Comunicación de baja no encontrada', 404);
        if (!voiding.provider_ticket) throw new BillingServiceError('VOIDING_WITHOUT_TICKET', 'La baja aún no tiene ticket', 409);
        const response = await billingProviderAcl.getVoidedStatus({ ticket: voiding.provider_ticket });
        const result = parseAsyncStatus(response);
        await billingRepository.markVoidingStatus(voiding, result);
        return { voidingId: String(voiding.id), status: result.accepted ? 'aceptado' : result.final ? 'rechazado' : 'pendiente', ...result };
    },
    createDailySummary: async (input) => {
        assertIdempotency(input.idempotencyKey);
        const priorSummary = await billingRepository.getSummaryByIdempotency(input.idempotencyKey);
        if (priorSummary?.provider_ticket) {
            return { summaryId: String(priorSummary.id), status: priorSummary.estado, ticket: priorSummary.provider_ticket, reused: true };
        }
        const summaryDate = String(input.fechaResumen || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(summaryDate)) throw new BillingServiceError('INVALID_DATE', 'fechaResumen debe usar YYYY-MM-DD', 400);
        const boletas = await billingRepository.listBoletasForSummary(summaryDate);
        if (!boletas.length) throw new BillingServiceError('NO_BOLETAS', 'No hay boletas pendientes para esa fecha', 404);
        const summary = await billingRepository.saveSummaryDraft({ summaryDate, invoiceIds: boletas.map((item) => item.id), idempotencyKey: input.idempotencyKey });
        if (summary.reused && summary.provider_ticket) {
            return { summaryId: String(summary.id), status: summary.estado, ticket: summary.provider_ticket, boletas: boletas.length, reused: true };
        }
        const issuer = await billingRepository.getIssuerConfig();
        const payload = {
            correlativo: String(summary.correlativo).padStart(3, '0'),
            fecGeneracion: isoDateTime(now()), fecResumen: isoDateTime(`${summaryDate}T12:00:00-05:00`),
            moneda: 'PEN', company: companyPayload(issuer),
            details: boletas.map((item) => ({
                tipoDoc: '03', serieNro: `${item.serie}-${item.correlativo}`, estado: '1',
                clienteTipo: String(item.cliente_tipo_doc || '1'), clienteNro: String(item.cliente_documento || '00000000'),
                total: Number(item.total_venta), mtoOperGravadas: Number(item.total_gravada), mtoIGV: Number(item.total_igv)
            }))
        };
        const response = await billingProviderAcl.sendSummary({ payload });
        const ticket = response?.sunatResponse?.ticket;
        if (!response?.sunatResponse?.success || !ticket) throw new BillingServiceError('SUMMARY_NOT_QUEUED', response?.sunatResponse?.error?.message || 'SUNAT no entregó ticket de resumen', 502);
        await billingRepository.markSummarySent(summary.id, { ticket, hash: response.hash });
        return { summaryId: String(summary.id), status: 'pendiente', ticket, boletas: boletas.length };
    },
    syncSummaryStatus: async (summaryId) => {
        const summary = await billingRepository.getSummary(summaryId);
        if (!summary) throw new BillingServiceError('SUMMARY_NOT_FOUND', 'Resumen no encontrado', 404);
        if (!summary.provider_ticket) throw new BillingServiceError('SUMMARY_WITHOUT_TICKET', 'El resumen aún no tiene ticket', 409);
        const response = await billingProviderAcl.getSummaryStatus({ ticket: summary.provider_ticket });
        const result = parseAsyncStatus(response);
        await billingRepository.markSummaryStatus(summary.id, result);
        return { summaryId: String(summary.id), status: result.accepted ? 'aceptado' : result.final ? 'rechazado' : 'pendiente', ...result };
    }
});
