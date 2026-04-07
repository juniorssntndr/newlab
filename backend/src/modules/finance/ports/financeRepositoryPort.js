const notImplemented = (methodName) => {
    throw new Error(`financeRepository.${methodName} must be implemented`);
};

export const financeRepositoryPort = {
    listFinanceOrders: () => notImplemented('listFinanceOrders'),
    listActiveAccounts: () => notImplemented('listActiveAccounts'),
    listMovements: () => notImplemented('listMovements'),
    resolveCuentaFinanciera: () => notImplemented('resolveCuentaFinanciera'),
    createMovement: () => notImplemented('createMovement'),
    getOrderByIdWithClinic: () => notImplemented('getOrderByIdWithClinic'),
    listPaymentsByOrderId: () => notImplemented('listPaymentsByOrderId'),
    listOrderItems: () => notImplemented('listOrderItems'),
    registerPayment: () => notImplemented('registerPayment'),
    getClinicById: () => notImplemented('getClinicById'),
    listPendingOrdersByClinic: () => notImplemented('listPendingOrdersByClinic'),
    registerBulkPayments: () => notImplemented('registerBulkPayments'),
    getPaymentWithOrderCodeById: () => notImplemented('getPaymentWithOrderCodeById'),
    conciliatePayment: () => notImplemented('conciliatePayment')
};
