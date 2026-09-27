import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchClinicDebtDetail } from '../api/financeApi.js';

export const useClinicDebtDetailQuery = (clinicaId, enabled = true) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: ['finance', 'cobranzas', 'clinica', clinicaId],
        queryFn: () => fetchClinicDebtDetail({ clinicaId, headers: getHeaders() }),
        enabled: Boolean(clinicaId) && enabled,
        staleTime: 1000 * 30
    });
};
