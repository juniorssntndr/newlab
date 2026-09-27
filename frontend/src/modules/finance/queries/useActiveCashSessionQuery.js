import { useQuery } from '@tanstack/react-query';
import { fetchActiveCashSession } from '../api/financeApi.js';

export const useActiveCashSessionQuery = (enabled = true) => {
    return useQuery({
        queryKey: ['finance', 'cash-session', 'active'],
        queryFn: () => fetchActiveCashSession(),
        enabled,
        staleTime: 1000 * 15,
        refetchInterval: 1000 * 30
    });
};
