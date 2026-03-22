export const financeKeys = {
    all: ['finance'],
    accounts: () => [...financeKeys.all, 'accounts'],
    accountList: (filters) => [...financeKeys.accounts(), filters],
    lists: () => financeKeys.accounts(),
    list: (filters) => financeKeys.accountList(filters),
    details: () => [...financeKeys.all, 'detail'],
    detail: (orderId) => [...financeKeys.details(), orderId],
    catalogs: () => [...financeKeys.all, 'catalogs'],
    movements: () => [...financeKeys.all, 'movements'],
    movementList: (filters) => [...financeKeys.movements(), filters],
    accountStates: () => [...financeKeys.all, 'account-state'],
    accountState: (clinicId) => [...financeKeys.accountStates(), clinicId],
    payments: () => [...financeKeys.all, 'payments'],
    paymentList: (orderId) => [...financeKeys.payments(), orderId],
    kpis: (range) => [...financeKeys.all, 'kpis', range]
};
