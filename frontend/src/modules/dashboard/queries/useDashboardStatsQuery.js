import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchDashboardStats } from '../api/dashboardApi.js';
import { dashboardKeys } from './dashboardKeys.js';

const DASHBOARD_STATS_STALE_TIME = 5 * 60 * 1000;

export const useDashboardStatsQuery = () => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: dashboardKeys.stats(),
        queryFn: () => fetchDashboardStats({ headers: getHeaders() }),
        staleTime: DASHBOARD_STATS_STALE_TIME,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false
    });
};
