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
    const cdr = providerResponse?.sunatResponse?.cdrResponse || {};
    const cdrCode = cdr?.code ?? cdr?.responseCode;
    const cdrDescription = cdr?.description ?? cdr?.responseDescription;

    return {
        invoiceStatus: success ? InvoiceStatus.SENT : InvoiceStatus.REJECTED,
        sunatTicket: String(cdr?.id || providerResponse?.sunatTicket || '').trim() || undefined,
        pdfUrl: providerResponse?.links?.pdf,
        xmlUrl: providerResponse?.links?.xml,
        cdrUrl: providerResponse?.links?.cdr,
        hash: providerResponse?.hash || undefined,
        cdrCode: cdrCode === undefined || cdrCode === null ? undefined : String(cdrCode),
        cdrDescription: cdrDescription ? String(cdrDescription) : undefined
    };
};

export const mapStatusResponseToBillingResult = ({ providerResponse }) => ({
    invoiceStatus: mapProviderStateToInvoiceStatus(providerResponse?.estadoCpe || providerResponse?.status),
    sunatTicket: providerResponse?.sunatTicket,
    pdfUrl: providerResponse?.links?.pdf,
    xmlUrl: providerResponse?.links?.xml
});
