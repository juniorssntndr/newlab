import { useQuery } from '@tanstack/react-query';
import { fetchCobranzasOverview } from '../api/financeApi.js';

export const useCobranzasOverviewQuery = (enabled = true) => {
    return useQuery({
        queryKey: ['finance', 'cobranzas', 'overview'],
        queryFn: () => fetchCobranzasOverview(),
        enabled,
        staleTime: 1000 * 30
    });
};
