import { financeKeys } from '../queries/financeKeys.js';

export const invalidateFinanceLists = async (queryClient) => {
    await queryClient.invalidateQueries({
        queryKey: financeKeys.lists(),
        refetchType: 'active'
    });
};

export const invalidateFinanceDetailAndLists = async (queryClient, orderId) => {
    const invalidations = [invalidateFinanceLists(queryClient)];

    if (orderId) {
        invalidations.push(queryClient.invalidateQueries({
            queryKey: financeKeys.detail(orderId),
            exact: true,
            refetchType: 'active'
        }));
        invalidations.push(queryClient.invalidateQueries({
            queryKey: financeKeys.paymentList(orderId),
            exact: true,
            refetchType: 'active'
        }));
    }

    await Promise.all(invalidations);
};

export const invalidateFinanceMovementLists = async (queryClient) => {
    await queryClient.invalidateQueries({
        queryKey: financeKeys.movements(),
        refetchType: 'active'
    });
};

export const invalidateFinanceAccountState = async (queryClient, clinicId) => {
    if (!clinicId) {
        return;
    }

    await queryClient.invalidateQueries({
        queryKey: financeKeys.accountState(clinicId),
        exact: true,
        refetchType: 'active'
    });
};
