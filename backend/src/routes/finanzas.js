import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema, updateMovimientoFinancieroSchema } from '../validation/schemas.js';

const router = Router();
router.use(authenticateToken);

const labCashier = requireRole('admin', 'tecnico');

const getFinanceController = (req) => req.app?.locals?.modules?.finance?.financeController;

const delegateToFinance = (controllerMethod) => async (req, res, next) => {
    const financeController = getFinanceController(req);
    if (!financeController?.[controllerMethod]) {
        return res.status(503).json({ error: 'Finance module not available' });
    }

    return financeController[controllerMethod](req, res, next);
};

router.get('/', labCashier, delegateToFinance('listFinanceOrders'));
router.get('/catalogos', labCashier, delegateToFinance('getCatalogos'));
router.get('/movimientos', labCashier, delegateToFinance('listMovimientos'));
router.post('/movimientos', labCashier, validateBody(createMovimientoFinancieroSchema), delegateToFinance('createMovimiento'));
router.put('/movimientos/:movimientoId', labCashier, validateBody(updateMovimientoFinancieroSchema), delegateToFinance('updateMovimiento'));
router.delete('/movimientos/:movimientoId', labCashier, delegateToFinance('deleteMovimiento'));
// Rutas estáticas antes de /:id para que Express no capture "estado-cuenta" como id.
router.get('/estado-cuenta/:clinica_id', labCashier, delegateToFinance('getEstadoCuentaByClinica'));
router.post('/pagos-masivos', labCashier, delegateToFinance('registerPagosMasivos'));
router.patch('/pagos/:pagoId/conciliar', labCashier, delegateToFinance('conciliarPago'));
router.get('/:id', labCashier, delegateToFinance('getOrderFinanceDetail'));
router.post('/:id/pagos', labCashier, validateBody(createPagoSchema), delegateToFinance('registerPago'));

export default router;
