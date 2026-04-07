import { billingResultSchema, comprobanteDraftSchema, pedidoBillingSnapshotSchema } from '@newlab/contracts';

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const ensureMethod = (dependency, methodName, label) => {
    if (!dependency || typeof dependency[methodName] !== 'function') {
        throw new Error(`${label}.${methodName} must be provided`);
    }
};

const assertValidCurrency = (lines, fallbackCurrency) => {
    const lineCurrencies = new Set(lines.map((line) => line?.unitPrice?.currency).filter(Boolean));
    if (!lineCurrencies.size) return fallbackCurrency;
    if (lineCurrencies.size > 1) {
        throw new BillingServiceError('INVALID_SNAPSHOT', 'Snapshot contiene monedas mixtas');
    }

    return lineCurrencies.values().next().value;
};

const buildDraftFromSnapshot = (snapshot, serie, nowDate) => {
    const lines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
    const currency = assertValidCurrency(lines, snapshot.total.currency);

    const subtotalAmount = roundMoney(lines.reduce((sum, line) => {
        const qty = Number(line.qty) || 0;
        const unit = Number(line.unitPrice?.amount) || 0;
        return sum + (qty * unit);
    }, 0));

    const igvAmount = roundMoney(lines.reduce((sum, line) => {
        const qty = Number(line.qty) || 0;
        const unit = Number(line.unitPrice?.amount) || 0;
        const taxRate = Number(line.taxRate) || 0;
        return sum + (qty * unit * taxRate);
    }, 0));

    const fallbackTotal = roundMoney(subtotalAmount + igvAmount);
    const totalAmount = roundMoney(Number(snapshot.total.amount) || fallbackTotal);

    return {
        orderId: snapshot.orderId,
        serie,
        issueDateIso: nowDate.toISOString(),
        subtotal: {
            amount: subtotalAmount,
            currency
        },
        igv: {
            amount: igvAmount,
            currency
        },
        total: {
            amount: totalAmount,
            currency
        },
        lines
    };
};

const parseContract = (schema, data, code, message) => {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        throw new BillingServiceError(code, message, 400, parsed.error.issues);
    }

    return parsed.data;
};

export class BillingServiceError extends Error {
    constructor(code, message, status = 400, details = undefined) {
        super(message);
        this.name = 'BillingServiceError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

export const makeBillingService = ({ billingRepository, billingProviderAcl, now = () => new Date() }) => {
    ensureMethod(billingRepository, 'getOrderSnapshot', 'billingRepository');
    ensureMethod(billingRepository, 'resolveInvoiceSeries', 'billingRepository');
    ensureMethod(billingRepository, 'saveDraft', 'billingRepository');
    ensureMethod(billingRepository, 'markInvoiceResult', 'billingRepository');
    ensureMethod(billingProviderAcl, 'issueComprobante', 'billingProviderAcl');
    ensureMethod(billingProviderAcl, 'getComprobanteStatus', 'billingProviderAcl');

    return {
        previewDraft: async (orderId) => {
            if (!orderId) {
                throw new BillingServiceError('ORDER_ID_REQUIRED', 'orderId es requerido', 400);
            }

            const snapshotRaw = await billingRepository.getOrderSnapshot(orderId);
            if (!snapshotRaw) {
                throw new BillingServiceError('ORDER_NOT_FOUND', 'Pedido no encontrado para facturacion', 404);
            }

            const snapshot = parseContract(
                pedidoBillingSnapshotSchema,
                snapshotRaw,
                'INVALID_SNAPSHOT',
                'Snapshot de facturacion invalido'
            );

            const seriesResolution = await billingRepository.resolveInvoiceSeries({
                orderId: snapshot.orderId,
                customerDocument: snapshot.customerDocument
            });

            return parseContract(
                comprobanteDraftSchema,
                buildDraftFromSnapshot(snapshot, seriesResolution.serie, now()),
                'INVALID_DRAFT',
                'Borrador de comprobante invalido'
            );
        },
        createInvoice: async (snapshotInput) => {
            const snapshot = parseContract(
                pedidoBillingSnapshotSchema,
                snapshotInput,
                'INVALID_SNAPSHOT',
                'Snapshot de facturacion invalido'
            );

            const seriesResolution = await billingRepository.resolveInvoiceSeries({
                orderId: snapshot.orderId,
                customerDocument: snapshot.customerDocument
            });

            const draft = parseContract(
                comprobanteDraftSchema,
                buildDraftFromSnapshot(snapshot, seriesResolution.serie, now()),
                'INVALID_DRAFT',
                'Borrador de comprobante invalido'
            );

            const providerHandlesDraftPersistence = Boolean(billingProviderAcl?.handlesDraftPersistence);
            let persistedInvoiceId;
            let draftForIssue = draft;

            if (!providerHandlesDraftPersistence) {
                const savedDraft = await billingRepository.saveDraft(draft, {
                    tipoComprobante: seriesResolution.tipoComprobante
                });
                if (!savedDraft?.draftId) {
                    throw new BillingServiceError('DRAFT_NOT_PERSISTED', 'No se pudo guardar el borrador de facturacion', 500);
                }

                persistedInvoiceId = String(savedDraft.draftId);
                draftForIssue = {
                    ...draft,
                    correlativo: savedDraft.correlativo ? String(savedDraft.correlativo) : draft.correlativo
                };
            }

            const providerResultRaw = await billingProviderAcl.issueComprobante(draftForIssue, { seriesResolution });
            const providerResult = parseContract(
                billingResultSchema,
                providerHandlesDraftPersistence
                    ? providerResultRaw
                    : {
                        ...providerResultRaw,
                        invoiceId: persistedInvoiceId
                    },
                'INVALID_PROVIDER_RESULT',
                'Respuesta de facturacion invalida'
            );

            await billingRepository.markInvoiceResult(providerResult.invoiceId, providerResult);
            return providerResult;
        },
        syncInvoiceStatus: async (invoiceId) => {
            if (!invoiceId) {
                throw new BillingServiceError('INVOICE_ID_REQUIRED', 'invoiceId es requerido', 400);
            }

            const providerResultRaw = await billingProviderAcl.getComprobanteStatus(invoiceId);
            const providerResult = parseContract(
                billingResultSchema,
                {
                    ...providerResultRaw,
                    invoiceId: String(invoiceId)
                },
                'INVALID_PROVIDER_RESULT',
                'Respuesta de estado SUNAT invalida'
            );

            await billingRepository.markInvoiceResult(providerResult.invoiceId, providerResult);
            return providerResult;
        }
    };
};
