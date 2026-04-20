import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { updateFinanceMovement } from '../api/financeApi.js';
import { invalidateFinanceMovementLists } from './invalidateFinanceQueries.js';

export const useUpdateFinanceMovementMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ movementId, payload }) => updateFinanceMovement({ movementId, payload, headers: getHeaders() }),
        onSuccess: async () => {
            await invalidateFinanceMovementLists(queryClient);
        }
    });
};
