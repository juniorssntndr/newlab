import { InvoiceStatus } from '@newlab/contracts';
import { consultarEstadoSunat, emitirComprobanteSunat } from '../../../../services/apisperu.js';

const mapSunatStateToInvoiceStatus = (rawState) => {
    const state = String(rawState || '').trim().toLowerCase();
    if (state.includes('acept')) return InvoiceStatus.SENT;
    if (state.includes('rechaz') || state.includes('error')) return InvoiceStatus.REJECTED;
    return InvoiceStatus.GENERATED;
};

const inferTipoComprobante = (serie = '') => {
    const normalized = String(serie).trim().toUpperCase();
    if (normalized.startsWith('F')) return '01';
    if (normalized.startsWith('B')) return '03';
    return '03';
};

export const makeLegacyApisperuBillingAcl = ({ pool }) => ({
    handlesDraftPersistence: true,
    issueComprobante: async (draft, options = {}) => {
        const tipoComprobante = options?.seriesResolution?.tipoComprobante || inferTipoComprobante(draft?.serie);
        const comprobante = await emitirComprobanteSunat(
            pool,
            draft?.orderId,
            tipoComprobante
        );

        return {
            invoiceId: String(comprobante.id),
            invoiceStatus: mapSunatStateToInvoiceStatus(comprobante.estado_sunat),
            sunatTicket: comprobante.external_id || undefined,
            pdfUrl: comprobante.pdf_url || undefined,
            xmlUrl: comprobante.xml_url || undefined
        };
    },
    getComprobanteStatus: async (invoiceId) => {
        const providerResponse = await consultarEstadoSunat(pool, invoiceId);

        return {
            invoiceId: String(invoiceId),
            invoiceStatus: mapSunatStateToInvoiceStatus(providerResponse?.estadoCpe || providerResponse?.status),
            sunatTicket: providerResponse?.sunatTicket || undefined,
            pdfUrl: providerResponse?.links?.pdf || undefined,
            xmlUrl: providerResponse?.links?.xml || undefined
        };
    }
});
