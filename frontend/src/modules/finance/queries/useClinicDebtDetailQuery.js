import { useQuery } from '@tanstack/react-query';
import { fetchClinicDebtDetail } from '../api/financeApi.js';

export const useClinicDebtDetailQuery = (clinicaId, enabled = true) => {
    return useQuery({
        queryKey: ['finance', 'cobranzas', 'clinica', clinicaId],
        queryFn: () => fetchClinicDebtDetail({ clinicaId }),
        enabled: Boolean(clinicaId) && enabled,
        staleTime: 1000 * 30
    });
};
