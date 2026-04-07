import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { registerBulkPayment } from '../api/financeApi.js';
import { invalidateFinanceAccountState, invalidateFinanceLists } from './invalidateFinanceQueries.js';

export const useRegisterBulkPaymentMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) => registerBulkPayment({ payload, headers: getHeaders() }),
        onSuccess: async (_data, variables) => {
            await Promise.all([
                invalidateFinanceLists(queryClient),
                invalidateFinanceAccountState(queryClient, variables?.clinica_id)
            ]);
        }
    });
};
