const notImplemented = (methodName) => {
    throw new Error(`billingRepository.${methodName} must be implemented`);
};

export const billingRepositoryPort = {
    getOrderSnapshot: () => notImplemented('getOrderSnapshot'),
    resolveInvoiceSeries: () => notImplemented('resolveInvoiceSeries'),
    saveDraft: () => notImplemented('saveDraft'),
    markInvoiceResult: () => notImplemented('markInvoiceResult'),
    getIssuerConfig: () => notImplemented('getIssuerConfig'),
    getInvoiceProviderReference: () => notImplemented('getInvoiceProviderReference'),
    getInvoiceFiscalContext: () => notImplemented('getInvoiceFiscalContext'),
    getCreditNoteByIdempotency: () => notImplemented('getCreditNoteByIdempotency'),
    saveCreditNoteDraft: () => notImplemented('saveCreditNoteDraft'),
    markCreditNoteResult: () => notImplemented('markCreditNoteResult'),
    saveVoidingDraft: () => notImplemented('saveVoidingDraft'),
    getVoidingByIdempotency: () => notImplemented('getVoidingByIdempotency'),
    getVoiding: () => notImplemented('getVoiding'),
    markVoidingSent: () => notImplemented('markVoidingSent'),
    markVoidingStatus: () => notImplemented('markVoidingStatus'),
    listBoletasForSummary: () => notImplemented('listBoletasForSummary'),
    saveSummaryDraft: () => notImplemented('saveSummaryDraft'),
    getSummaryByIdempotency: () => notImplemented('getSummaryByIdempotency'),
    getSummary: () => notImplemented('getSummary'),
    markSummarySent: () => notImplemented('markSummarySent'),
    markSummaryStatus: () => notImplemented('markSummaryStatus')
};
