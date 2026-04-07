import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { updateOrderDeliveryDate } from '../api/ordersApi.js';
import { invalidateOrderDetailAndLists } from './invalidateOrdersQueries.js';

export const useUpdateOrderDeliveryDateMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ orderId, payload }) => updateOrderDeliveryDate({ orderId, payload, headers: getHeaders() }),
        onSuccess: async (_data, variables) => {
            await invalidateOrderDetailAndLists(queryClient, variables?.orderId);
        }
    });
};
