import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchEmpresaFiscal } from '../api/billingApi.js';

export const useEmpresaFiscalQuery = (enabled = true) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: ['billing', 'empresa-fiscal'],
        queryFn: () => fetchEmpresaFiscal({ headers: getHeaders() }),
        staleTime: 1000 * 60 * 30, // 30 minutes
        enabled
    });
};
