import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';

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

router.get('/stats', requireRole('admin', 'tecnico', 'cliente'), delegateToDashboard('getStats'));
// KPIs financieros globales: solo admin/socios (antes forbidRole('tecnico') dejaba pasar a clientes).
router.get('/finance', requireRole('admin'), delegateToDashboard('getFinance'));

export default router;
