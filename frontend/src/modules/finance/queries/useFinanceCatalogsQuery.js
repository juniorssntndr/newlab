import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchFinanceCatalogs } from '../api/financeApi.js';
import { financeKeys } from './financeKeys.js';

export const useFinanceCatalogsQuery = () => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: financeKeys.catalogs(),
        queryFn: () => fetchFinanceCatalogs({ headers: getHeaders() })
    });
};
