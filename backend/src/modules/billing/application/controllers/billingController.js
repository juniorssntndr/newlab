import { BillingServiceError } from '../services/billingService.js';

const buildContext = (ctx = {}) => ({
    requestId: ctx.requestId || 'n/a',
    actorId: ctx.actorId || 'system',
    now: ctx.now instanceof Date ? ctx.now : new Date()
});

const toControllerError = (error) => {
    if (error instanceof BillingServiceError) {
        return {
            status: error.status || 400,
            code: error.code || 'BILLING_ERROR',
            message: error.message,
            details: error.details
        };
    }

    return {
        status: 500,
        code: 'UNEXPECTED_ERROR',
        message: 'Error interno de facturacion'
    };
};

const makeAnalyticalSignature = (handler, successStatus = 200) => ({
    execute: async (ctx, input) => {
        try {
            const data = await handler(buildContext(ctx), input || {});
            return {
                ok: true,
                status: successStatus,
                data
            };
        } catch (error) {
            const mapped = toControllerError(error);
            const result = {
                ok: false,
                status: mapped.status,
                errorCode: mapped.code,
                errorMessage: mapped.message
            };

            if (mapped.details) {
                result.details = mapped.details;
            }

            return result;
        }
    }
});

const extractOrderId = (input = {}) => input?.params?.orderId || input?.params?.pedidoId || input?.body?.orderId;
const extractInvoiceId = (input = {}) => input?.params?.invoiceId || input?.params?.comprobanteId || input?.body?.invoiceId;

const extractSnapshotInput = (input = {}) => {
    if (input?.body?.snapshot) {
        return input.body.snapshot;
    }

    return input?.body;
};

export const makeBillingController = ({ billingService }) => ({
    previewDraft: makeAnalyticalSignature(async (_ctx, input) => {
        const orderId = extractOrderId(input);
        return billingService.previewDraft(orderId);
    }),
    createInvoice: makeAnalyticalSignature(async (_ctx, input) => {
        const snapshot = extractSnapshotInput(input);
        return billingService.createInvoice(snapshot);
    }, 201),
    syncInvoiceStatus: makeAnalyticalSignature(async (_ctx, input) => {
        const invoiceId = extractInvoiceId(input);
        return billingService.syncInvoiceStatus(invoiceId);
    })
});
