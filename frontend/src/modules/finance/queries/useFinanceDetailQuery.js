import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchFinanceDetail } from '../api/financeApi.js';
import { financeKeys } from './financeKeys.js';

export const useFinanceDetailQuery = (orderId) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: financeKeys.detail(orderId),
        queryFn: () => fetchFinanceDetail({ orderId, headers: getHeaders() }),
        enabled: Boolean(orderId)
    });
};
