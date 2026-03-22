import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchOrderDetail } from '../api/ordersApi.js';
import { ordersKeys } from './orderKeys.js';

export const useOrderDetailQuery = (orderId) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: ordersKeys.detail(orderId),
        queryFn: () => fetchOrderDetail({ orderId, headers: getHeaders() }),
        enabled: Boolean(orderId)
    });
};
