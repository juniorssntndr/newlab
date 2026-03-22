import { InvoiceStatus } from '@newlab/contracts';

const normalizeSunatState = (value) => String(value || '').trim().toLowerCase();

const mapProviderStateToInvoiceStatus = (stateValue) => {
    const state = normalizeSunatState(stateValue);
    if (state.includes('acept')) return InvoiceStatus.SENT;
    if (state.includes('rechaz') || state.includes('error')) return InvoiceStatus.REJECTED;
    if (state.includes('generad') || state.includes('pendiente') || state.includes('proces')) return InvoiceStatus.GENERATED;
    return InvoiceStatus.GENERATED;
};

export const mapIssueResponseToBillingResult = ({ providerResponse }) => {
    const success = Boolean(providerResponse?.sunatResponse?.success);

    return {
        invoiceStatus: success ? InvoiceStatus.SENT : InvoiceStatus.GENERATED,
        sunatTicket: providerResponse?.sunatResponse?.cdrResponse?.id || providerResponse?.sunatTicket,
        pdfUrl: providerResponse?.links?.pdf,
        xmlUrl: providerResponse?.links?.xml
    };
};

export const mapStatusResponseToBillingResult = ({ providerResponse }) => ({
    invoiceStatus: mapProviderStateToInvoiceStatus(providerResponse?.estadoCpe || providerResponse?.status),
    sunatTicket: providerResponse?.sunatTicket,
    pdfUrl: providerResponse?.links?.pdf,
    xmlUrl: providerResponse?.links?.xml
});
