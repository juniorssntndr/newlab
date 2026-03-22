const notImplemented = (methodName) => {
    throw new Error(`billingRepository.${methodName} must be implemented`);
};

export const billingRepositoryPort = {
    getOrderSnapshot: () => notImplemented('getOrderSnapshot'),
    resolveInvoiceSeries: () => notImplemented('resolveInvoiceSeries'),
    saveDraft: () => notImplemented('saveDraft'),
    markInvoiceResult: () => notImplemented('markInvoiceResult'),
    getIssuerConfig: () => notImplemented('getIssuerConfig'),
    getInvoiceProviderReference: () => notImplemented('getInvoiceProviderReference')
};
