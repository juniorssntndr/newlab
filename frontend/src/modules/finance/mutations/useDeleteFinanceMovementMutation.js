import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { deleteFinanceMovement } from '../api/financeApi.js';
import { invalidateFinanceMovementLists } from './invalidateFinanceQueries.js';

export const useDeleteFinanceMovementMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (movementId) => deleteFinanceMovement({ movementId, headers: getHeaders() }),
        onSuccess: async () => {
            await invalidateFinanceMovementLists(queryClient);
        }
    });
};
