import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { respondOrderApproval } from '../api/ordersApi.js';
import { invalidateAfterApproveOrder } from './invalidateApproveOrderQueries.js';

export const useApproveOrderMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ orderId, approvalId, payload }) => respondOrderApproval({ orderId, approvalId, payload, headers: getHeaders() }),
        onSuccess: async (_data, variables) => {
            await invalidateAfterApproveOrder(queryClient, variables?.orderId);
        }
    });
};
