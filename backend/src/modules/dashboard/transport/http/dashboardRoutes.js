import { Router } from 'express';
import { authenticateToken, requireRole } from '../../../../middleware/auth.js';

export const makeDashboardRoutes = ({ dashboardController }) => {
    const router = Router();

    router.use(authenticateToken);
    router.get('/stats', dashboardController.getStats);
    router.get('/finance', requireRole('admin'), dashboardController.getFinance);

    return router;
};
