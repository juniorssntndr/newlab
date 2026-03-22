import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { conciliatePayment } from '../api/financeApi.js';
import { invalidateFinanceDetailAndLists } from './invalidateFinanceQueries.js';

export const useConciliatePaymentMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ paymentId, payload }) => conciliatePayment({ paymentId, payload, headers: getHeaders() }),
        onSuccess: async (_data, variables) => {
            await invalidateFinanceDetailAndLists(queryClient, variables?.orderId);
        }
    });
};
