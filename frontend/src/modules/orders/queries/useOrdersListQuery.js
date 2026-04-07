import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchOrdersList } from '../api/ordersApi.js';
import { ordersKeys } from './orderKeys.js';

export const useOrdersListQuery = ({ filters }) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: ordersKeys.list(filters),
        queryFn: () => fetchOrdersList({ filters, headers: getHeaders() }),
        placeholderData: (previousData) => previousData
    });
};
