export const makeDashboardController = ({ dashboardService }) => ({
    getStats: async (req, res, next) => {
        try {
            const data = await dashboardService.getStats();
            return res.json(data);
        } catch (error) {
            next(error);
        }
    },
    getFinance: async (req, res, next) => {
        try {
            const data = await dashboardService.getFinance({ query: req.query });
            return res.json(data);
        } catch (error) {
            next(error);
        }
    }
});
