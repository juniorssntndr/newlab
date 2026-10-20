import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { requestOrderDesign } from '../api/ordersApi.js';
import { invalidateOrderDetailAndLists } from './invalidateOrdersQueries.js';

export const useRequestOrderDesignMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ orderId }) => requestOrderDesign({ orderId, headers: getHeaders() }),
        onSuccess: async (_data, variables) => {
            await invalidateOrderDetailAndLists(queryClient, variables?.orderId);
        }
    });
};
