import { makeApisperuAdapter } from '../../../../infrastructure/apisperu/apisperuAdapter.js';
import { mapDraftToApisperuPayload } from '../../../../infrastructure/apisperu/mappers/toProvider.js';
import { mapIssueResponseToBillingResult, mapStatusResponseToBillingResult } from '../../../../infrastructure/apisperu/mappers/fromProvider.js';

const ensureMethod = (dependency, methodName, label) => {
    if (!dependency || typeof dependency[methodName] !== 'function') {
        throw new Error(`${label}.${methodName} must be provided`);
    }
};

export const makeApisperuBillingAcl = ({
    billingRepository,
    apisperuAdapter = makeApisperuAdapter(),
    toProviderMapper = mapDraftToApisperuPayload,
    issueResultMapper = mapIssueResponseToBillingResult,
    statusResultMapper = mapStatusResponseToBillingResult
}) => {
    ensureMethod(billingRepository, 'getOrderSnapshot', 'billingRepository');
    ensureMethod(billingRepository, 'resolveInvoiceSeries', 'billingRepository');
    ensureMethod(billingRepository, 'getIssuerConfig', 'billingRepository');
    ensureMethod(billingRepository, 'getInvoiceProviderReference', 'billingRepository');
    ensureMethod(apisperuAdapter, 'sendInvoice', 'apisperuAdapter');
    ensureMethod(apisperuAdapter, 'getInvoiceStatus', 'apisperuAdapter');

    return {
        issueComprobante: async (draft) => {
            const [snapshot, issuer] = await Promise.all([
                billingRepository.getOrderSnapshot(draft.orderId),
                billingRepository.getIssuerConfig()
            ]);

            if (!snapshot) {
                throw new Error('No se encontro el pedido para emitir comprobante');
            }

            const seriesResolution = await billingRepository.resolveInvoiceSeries({
                orderId: draft.orderId,
                customerDocument: snapshot.customerDocument,
                serieHint: draft.serie
            });

            const payload = toProviderMapper({
                draft: {
                    ...draft,
                    serie: seriesResolution.serie
                },
                snapshot,
                issuer,
                tipoComprobante: seriesResolution.tipoComprobante
            });

            const providerResponse = await apisperuAdapter.sendInvoice({
                token: issuer.token,
                payload,
                entorno: issuer.entorno
            });

            return issueResultMapper({ providerResponse });
        },
        getComprobanteStatus: async (invoiceId) => {
            const [reference, issuer] = await Promise.all([
                billingRepository.getInvoiceProviderReference(invoiceId),
                billingRepository.getIssuerConfig()
            ]);

            if (!reference) {
                throw new Error('No se encontro comprobante para sincronizar estado');
            }

            const providerResponse = await apisperuAdapter.getInvoiceStatus({
                token: issuer.token,
                entorno: issuer.entorno,
                tipoComprobante: reference.tipoComprobante,
                serie: reference.serie,
                correlativo: reference.correlativo
            });

            return statusResultMapper({ providerResponse });
        }
    };
};
