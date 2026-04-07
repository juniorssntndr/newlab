import { ordersKeys } from '../../orders/queries/orderKeys.js';
import { financeKeys } from '../../finance/queries/financeKeys.js';
import { billingKeys } from '../queries/billingKeys.js';

export const invalidateAfterBillingMutation = async (queryClient, orderId) => {
    const invalidations = [
        queryClient.invalidateQueries({
            queryKey: [...financeKeys.all, 'kpis'],
            refetchType: 'active'
        })
    ];

    if (!orderId) {
        await Promise.all(invalidations);
        return;
    }

    invalidations.push(queryClient.invalidateQueries({
        queryKey: ordersKeys.detail(orderId),
        exact: true,
        refetchType: 'active'
    }));

    invalidations.push(queryClient.invalidateQueries({
        queryKey: financeKeys.paymentList(orderId),
        exact: true,
        refetchType: 'active'
    }));

    invalidations.push(queryClient.invalidateQueries({
        queryKey: financeKeys.detail(orderId),
        exact: true,
        refetchType: 'active'
    }));

    invalidations.push(queryClient.invalidateQueries({
        queryKey: billingKeys.preview(orderId),
        exact: true,
        refetchType: 'active'
    }));

    await Promise.all(invalidations);
};

export const invalidateAfterCreateInvoice = invalidateAfterBillingMutation;
