import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchFinanceAccountState } from '../api/financeApi.js';
import { financeKeys } from './financeKeys.js';

export const useFinanceAccountStateQuery = (clinicId, options = {}) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: financeKeys.accountState(clinicId),
        queryFn: () => fetchFinanceAccountState({ clinicId, headers: getHeaders() }),
        enabled: Boolean(clinicId) && (options.enabled ?? true)
    });
};
