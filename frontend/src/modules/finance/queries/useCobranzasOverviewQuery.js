import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchCobranzasOverview } from '../api/financeApi.js';

export const useCobranzasOverviewQuery = (enabled = true) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: ['finance', 'cobranzas', 'overview'],
        queryFn: () => fetchCobranzasOverview({ headers: getHeaders() }),
        enabled,
        staleTime: 10 * 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchInterval: 20 * 1000
    });
};
