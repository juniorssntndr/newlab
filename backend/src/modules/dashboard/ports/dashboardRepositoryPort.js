const notImplemented = (methodName) => {
    throw new Error(`dashboardRepository.${methodName} must be implemented`);
};

export const dashboardRepositoryPort = {
    getStatsOverview: () => notImplemented('getStatsOverview'),
    listOrdersByStatus: () => notImplemented('listOrdersByStatus'),
    listRecentOrders: () => notImplemented('listRecentOrders'),
    getFinanceKpis: () => notImplemented('getFinanceKpis'),
    getFinancePeriodAggregates: () => notImplemented('getFinancePeriodAggregates'),
    getFinanceFlowTotals: () => notImplemented('getFinanceFlowTotals'),
    getFinanceBalances: () => notImplemented('getFinanceBalances'),
    listFinanceDailySeries: () => notImplemented('listFinanceDailySeries'),
    listFinanceIncomeBreakdown: () => notImplemented('listFinanceIncomeBreakdown'),
    getFinanceStrategicComparisons: () => notImplemented('getFinanceStrategicComparisons'),
    listFinanceHistoricalTops: () => notImplemented('listFinanceHistoricalTops'),
    listFinanceMonthlySeries: () => notImplemented('listFinanceMonthlySeries')
};
