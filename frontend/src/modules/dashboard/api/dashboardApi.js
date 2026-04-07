import { apiClient } from '../../../services/http/apiClient.js';

export const fetchDashboardStats = ({ headers }) => apiClient('/dashboard/stats', {
    headers
});

export const fetchDashboardFinance = ({ range, headers }) => apiClient('/dashboard/finance', {
    headers,
    query: {
        from: range?.from,
        to: range?.to
    }
});
