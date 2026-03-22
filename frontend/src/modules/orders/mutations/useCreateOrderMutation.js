import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { createOrder } from '../api/ordersApi.js';
import { invalidateOrdersLists } from './invalidateOrdersQueries.js';

export const useCreateOrderMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) => createOrder({ payload, headers: getHeaders() }),
        onSuccess: async () => {
            await invalidateOrdersLists(queryClient);
        }
    });
};
