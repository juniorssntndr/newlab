import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema } from '../validation/schemas.js';

const router = Router();
router.use(authenticateToken);

const getFinanceController = (req) => req.app?.locals?.modules?.finance?.financeController;

const delegateToFinance = (controllerMethod) => async (req, res, next) => {
    const financeController = getFinanceController(req);
    if (!financeController?.[controllerMethod]) {
        return res.status(503).json({ error: 'Finance module not available' });
    }

    return financeController[controllerMethod](req, res, next);
};

router.get('/', delegateToFinance('listFinanceOrders'));
router.get('/catalogos', delegateToFinance('getCatalogos'));
router.get('/movimientos', delegateToFinance('listMovimientos'));
router.post('/movimientos', validateBody(createMovimientoFinancieroSchema), delegateToFinance('createMovimiento'));
router.get('/:id', delegateToFinance('getOrderFinanceDetail'));
router.post('/:id/pagos', validateBody(createPagoSchema), delegateToFinance('registerPago'));
router.get('/estado-cuenta/:clinica_id', delegateToFinance('getEstadoCuentaByClinica'));
router.post('/pagos-masivos', delegateToFinance('registerPagosMasivos'));
router.patch('/pagos/:pagoId/conciliar', delegateToFinance('conciliarPago'));

export default router;
