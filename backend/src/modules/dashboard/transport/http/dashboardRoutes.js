import { Router } from 'express';
import { authenticateToken } from '../../../../middleware/auth.js';

export const makeDashboardRoutes = ({ dashboardController }) => {
    const router = Router();

    router.use(authenticateToken);
    router.get('/stats', dashboardController.getStats);
    router.get('/finance', dashboardController.getFinance);

    return router;
};
