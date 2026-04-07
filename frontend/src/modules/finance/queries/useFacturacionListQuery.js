import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchFacturacionList } from '../api/financeApi.js';
import { financeKeys } from './financeKeys.js';

export const useFacturacionListQuery = (enabled = true) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: [...financeKeys.payments(), 'facturacion-list'],
        queryFn: () => fetchFacturacionList({ headers: getHeaders() }),
        enabled
    });
};
