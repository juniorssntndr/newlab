import { financeKeys } from '../queries/financeKeys.js';
import { ordersKeys } from '../../orders/queries/orderKeys.js';

export const invalidateAfterRegisterPayment = async (queryClient, orderId) => {
    const invalidations = [
        queryClient.invalidateQueries({
            queryKey: financeKeys.accounts(),
            refetchType: 'active'
        })
    ];

    if (orderId) {
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

        invalidations.push(queryClient.invalidateQueries({
            queryKey: financeKeys.detail(orderId),
            exact: true,
            refetchType: 'active'
        }));
    }

    await Promise.all(invalidations);
};
