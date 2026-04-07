import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { createOrder } from '../api/ordersApi.js';
import { invalidateOrdersLists } from './invalidateOrdersQueries.js';
import { buildOrderPayload, ensureOrderPayloadContract } from '../composer/orderPayloadContract.js';

export const useCreateOrderMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payloadDraft) => {
            const payload = buildOrderPayload(payloadDraft);
            const validPayload = ensureOrderPayloadContract(payload);
            return createOrder({ payload: validPayload, headers: getHeaders() });
        },
        onSuccess: async () => {
            await invalidateOrdersLists(queryClient);
        }
    });
};
