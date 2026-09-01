import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerSaldoFavor } from '../api/financeApi.js';

export const useRegisterSaldoFavorMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ clinicaId, payload }) => registerSaldoFavor({ clinicaId, payload }),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['finance', 'saldos-favor', variables.clinicaId] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'accounts'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'movements'] });
        }
    });
};
