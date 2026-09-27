import { ordersKeys } from '../queries/orderKeys.js';
import { dashboardKeys } from '../../dashboard/queries/dashboardKeys.js';
import { financeKeys } from '../../finance/queries/financeKeys.js';

export const invalidateOrdersLists = async (queryClient) => {
    await Promise.all([
        queryClient.invalidateQueries({
            queryKey: ordersKeys.lists(),
            refetchType: 'active'
        }),
        queryClient.invalidateQueries({
            queryKey: dashboardKeys.all,
            refetchType: 'active'
        }),
        queryClient.invalidateQueries({
            queryKey: financeKeys.all,
            refetchType: 'active'
        }),
        queryClient.invalidateQueries({
            queryKey: ['notifications'],
            refetchType: 'active'
        })
    ]);
};

export const invalidateOrderDetailAndLists = async (queryClient, orderId) => {
    const invalidations = [invalidateOrdersLists(queryClient)];

    if (orderId) {
        invalidations.push(queryClient.invalidateQueries({
            queryKey: ordersKeys.detail(orderId),
            exact: true,
            refetchType: 'active'
        }));
    }

    await Promise.all(invalidations);
};
