import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchDashboardFinance } from '../api/dashboardApi.js';
import { dashboardKeys } from './dashboardKeys.js';

const DASHBOARD_FINANCE_STALE_TIME = 15 * 60 * 1000;

export const useDashboardFinanceQuery = ({ range, enabled = true }) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: dashboardKeys.financeByRange(range),
        queryFn: () => fetchDashboardFinance({ range, headers: getHeaders() }),
        enabled,
        staleTime: DASHBOARD_FINANCE_STALE_TIME,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        placeholderData: (previousData) => previousData
    });
};
