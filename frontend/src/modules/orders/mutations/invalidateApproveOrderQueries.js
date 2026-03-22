import { ordersKeys } from '../queries/orderKeys.js';
import { financeKeys } from '../../finance/queries/financeKeys.js';

export const invalidateAfterApproveOrder = async (queryClient, orderId) => {
    const invalidations = [
        queryClient.invalidateQueries({
            queryKey: ordersKeys.lists(),
            refetchType: 'active'
        }),
        queryClient.invalidateQueries({
            queryKey: [...financeKeys.all, 'kpis'],
            refetchType: 'active'
        })
    ];

    if (orderId) {
        invalidations.push(queryClient.invalidateQueries({
            queryKey: ordersKeys.detail(orderId),
            exact: true,
            refetchType: 'active'
        }));
    }

    await Promise.all(invalidations);
};
