import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { createFinanceMovement } from '../api/financeApi.js';
import { invalidateFinanceMovementLists } from './invalidateFinanceQueries.js';

export const useCreateFinanceMovementMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload) => createFinanceMovement({ payload, headers: getHeaders() }),
        onSuccess: async () => {
            await invalidateFinanceMovementLists(queryClient);
        }
    });
};
