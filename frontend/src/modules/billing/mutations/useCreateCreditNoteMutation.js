import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { createCreditNote } from '../api/billingApi.js';
import { invalidateAfterBillingMutation } from './invalidateBillingQueries.js';

export const useCreateCreditNoteMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ orderId, invoiceId, payload }) => createCreditNote({
            invoiceId,
            payload,
            headers: getHeaders()
        }),
        onSuccess: async (_data, variables) => {
            await invalidateAfterBillingMutation(queryClient, variables?.orderId);
        }
    });
};
