import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchOrderComprobantes } from '../api/financeApi.js';
import { financeKeys } from './financeKeys.js';

export const useOrderComprobantesQuery = (orderId) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: financeKeys.paymentList(orderId),
        queryFn: () => fetchOrderComprobantes({ orderId, headers: getHeaders() }),
        enabled: Boolean(orderId)
    });
};
