import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchBillingPreview } from '../api/billingApi.js';
import { billingKeys } from './billingKeys.js';

export const useBillingPreviewQuery = (orderId, enabled = true) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: billingKeys.preview(orderId),
        queryFn: () => fetchBillingPreview({ orderId, headers: getHeaders() }),
        enabled: enabled && Boolean(orderId)
    });
};
