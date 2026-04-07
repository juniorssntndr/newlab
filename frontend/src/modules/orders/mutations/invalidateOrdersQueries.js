import { ordersKeys } from '../queries/orderKeys.js';

export const invalidateOrdersLists = async (queryClient) => {
    await queryClient.invalidateQueries({
        queryKey: ordersKeys.lists(),
        refetchType: 'active'
    });
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
