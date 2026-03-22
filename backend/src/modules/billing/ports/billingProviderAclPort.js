const notImplemented = (methodName) => {
    throw new Error(`billingProviderAcl.${methodName} must be implemented`);
};

export const billingProviderAclPort = {
    issueComprobante: () => notImplemented('issueComprobante'),
    getComprobanteStatus: () => notImplemented('getComprobanteStatus')
};
