import { Router } from 'express';
import { authenticateToken, forbidRole } from '../../../../middleware/auth.js';

export const makeDashboardRoutes = ({ dashboardController }) => {
    const router = Router();

    router.use(authenticateToken);
    router.get('/stats', dashboardController.getStats);
    router.get('/finance', forbidRole('tecnico'), dashboardController.getFinance);

    return router;
};
