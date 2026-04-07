const normalizeRange = (range = {}) => ({
    from: range.from || null,
    to: range.to || null
});

export const dashboardKeys = {
    all: ['dashboard'],
    stats: () => [...dashboardKeys.all, 'stats'],
    finance: () => [...dashboardKeys.all, 'finance'],
    financeByRange: (range) => [...dashboardKeys.finance(), normalizeRange(range)]
};
