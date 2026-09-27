import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openCashSession, closeCashSession, reopenCashSession } from '../api/financeApi.js';

export const useOpenCashSessionMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ payload }) => openCashSession({ payload }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['finance', 'cash-session'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'cash-sessions'] });
        }
    });
};

export const useCloseCashSessionMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sesionId, payload }) => closeCashSession({ sesionId, payload }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['finance', 'cash-session'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'cash-sessions'] });
        }
    });
};

export const useReopenCashSessionMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sesionId, payload }) => reopenCashSession({ sesionId, payload }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['finance', 'cash-session'] });
            queryClient.invalidateQueries({ queryKey: ['finance', 'cash-sessions'] });
        }
    });
};
