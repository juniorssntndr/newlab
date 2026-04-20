import { Router } from 'express';
import { authenticateToken, forbidRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema, updateMovimientoFinancieroSchema } from '../validation/schemas.js';

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

router.get('/', forbidRole('tecnico'), delegateToFinance('listFinanceOrders'));
router.get('/catalogos', forbidRole('tecnico'), delegateToFinance('getCatalogos'));
router.get('/movimientos', forbidRole('tecnico'), delegateToFinance('listMovimientos'));
router.post('/movimientos', forbidRole('tecnico'), validateBody(createMovimientoFinancieroSchema), delegateToFinance('createMovimiento'));
router.put('/movimientos/:movimientoId', forbidRole('tecnico'), validateBody(updateMovimientoFinancieroSchema), delegateToFinance('updateMovimiento'));
router.delete('/movimientos/:movimientoId', forbidRole('tecnico'), delegateToFinance('deleteMovimiento'));
router.get('/:id', forbidRole('tecnico'), delegateToFinance('getOrderFinanceDetail'));
router.post('/:id/pagos', forbidRole('tecnico'), validateBody(createPagoSchema), delegateToFinance('registerPago'));
router.get('/estado-cuenta/:clinica_id', delegateToFinance('getEstadoCuentaByClinica'));
router.post('/pagos-masivos', forbidRole('tecnico'), delegateToFinance('registerPagosMasivos'));
router.patch('/pagos/:pagoId/conciliar', forbidRole('tecnico'), delegateToFinance('conciliarPago'));

export default router;
