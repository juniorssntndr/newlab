import { financeKeys } from '../queries/financeKeys.js';
import { dashboardKeys } from '../../dashboard/queries/dashboardKeys.js';
import { ordersKeys } from '../../orders/queries/orderKeys.js';

export const invalidateFinanceLists = async (queryClient) => {
    await Promise.all([
        queryClient.invalidateQueries({
            queryKey: financeKeys.all,
            refetchType: 'active'
        }),
        queryClient.invalidateQueries({
            queryKey: dashboardKeys.all,
            refetchType: 'active'
        }),
        queryClient.invalidateQueries({
            queryKey: ordersKeys.lists(),
            refetchType: 'active'
        }),
        queryClient.invalidateQueries({
            queryKey: ['notifications'],
            refetchType: 'active'
        })
    ]);
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
        invalidations.push(queryClient.invalidateQueries({
            queryKey: ordersKeys.detail(orderId),
            exact: true,
            refetchType: 'active'
        }));
    }

    await Promise.all(invalidations);
};

export const invalidateFinanceMovementLists = async (queryClient) => {
    await Promise.all([
        queryClient.invalidateQueries({
            queryKey: financeKeys.movements(),
            refetchType: 'active'
        }),
        queryClient.invalidateQueries({
            queryKey: financeKeys.all,
            refetchType: 'active'
        }),
        queryClient.invalidateQueries({
            queryKey: dashboardKeys.all,
            refetchType: 'active'
        })
    ]);
};

export const invalidateFinanceAccountState = async (queryClient, clinicId) => {
    const invalidations = [
        queryClient.invalidateQueries({
            queryKey: financeKeys.all,
            refetchType: 'active'
        }),
        queryClient.invalidateQueries({
            queryKey: dashboardKeys.all,
            refetchType: 'active'
        })
    ];

    if (clinicId) {
        invalidations.push(queryClient.invalidateQueries({
            queryKey: financeKeys.accountState(clinicId),
            exact: true,
            refetchType: 'active'
        }));
        invalidations.push(queryClient.invalidateQueries({
            queryKey: ['finance', 'cobranzas', 'clinica', clinicId],
            exact: true,
            refetchType: 'active'
        }));
    }

    await Promise.all(invalidations);
};
