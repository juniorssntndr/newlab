import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { updateApprovalMeetLink } from '../api/ordersApi.js';
import { invalidateOrderDetailAndLists } from './invalidateOrdersQueries.js';

export const useUpdateApprovalMeetLinkMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ orderId, approvalId, payload }) => updateApprovalMeetLink({
            orderId,
            approvalId,
            payload,
            headers: getHeaders()
        }),
        onSuccess: async (_data, variables) => {
            await invalidateOrderDetailAndLists(queryClient, variables?.orderId);
        }
    });
};
