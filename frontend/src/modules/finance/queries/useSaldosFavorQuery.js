import { useQuery } from '@tanstack/react-query';
import { fetchSaldosFavorByClinica } from '../api/financeApi.js';

export const useSaldosFavorQuery = (clinicaId, enabled = true) => {
    return useQuery({
        queryKey: ['finance', 'saldos-favor', clinicaId],
        queryFn: () => fetchSaldosFavorByClinica({ clinicaId }),
        enabled: Boolean(clinicaId) && enabled,
        staleTime: 1000 * 30
    });
};
