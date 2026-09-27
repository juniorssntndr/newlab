import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aplicarSaldoFavor } from '../api/financeApi.js';

export const useAplicarSaldoFavorMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ payload }) => aplicarSaldoFavor({ payload }),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['finance'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['order'] });
        }
    });
};
