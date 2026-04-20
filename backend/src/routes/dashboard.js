import { Router } from 'express';
import { authenticateToken, forbidRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const getDashboardController = (req) => req.app?.locals?.modules?.dashboard?.dashboardController;

const delegateToDashboard = (controllerMethod) => async (req, res, next) => {
    const dashboardController = getDashboardController(req);
    if (!dashboardController?.[controllerMethod]) {
        return res.status(503).json({ error: 'Dashboard module not available' });
    }

    return dashboardController[controllerMethod](req, res, next);
};

router.get('/stats', delegateToDashboard('getStats'));
router.get('/finance', forbidRole('tecnico'), delegateToDashboard('getFinance'));

export default router;
