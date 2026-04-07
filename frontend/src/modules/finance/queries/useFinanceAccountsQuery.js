import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchFinanceAccounts } from '../api/financeApi.js';
import { financeKeys } from './financeKeys.js';

export const useFinanceAccountsQuery = ({ filters, enabled = true }) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: financeKeys.list(filters),
        queryFn: () => fetchFinanceAccounts({ filters, headers: getHeaders() }),
        enabled,
        placeholderData: (previousData) => previousData
    });
};
