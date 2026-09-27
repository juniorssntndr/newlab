import { useQuery } from '@tanstack/react-query';
import { fetchCashSessions } from '../api/financeApi.js';

export const useCashSessionsQuery = (enabled = true) => {
    return useQuery({
        queryKey: ['finance', 'cash-sessions', 'list'],
        queryFn: () => fetchCashSessions(),
        enabled,
        staleTime: 1000 * 30
    });
};
