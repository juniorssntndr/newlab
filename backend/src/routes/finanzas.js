import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema, updateMovimientoFinancieroSchema } from '../validation/schemas.js';

const router = Router();
router.use(authenticateToken);

const labCashier = requireRole('admin', 'operador');

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
// Rutas estáticas antes de /:id para que Express no capture "estado-cuenta" o "saldos-favor" como id.
router.get('/estado-cuenta/:clinica_id', labCashier, delegateToFinance('getEstadoCuentaByClinica'));
router.post('/pagos-masivos', labCashier, delegateToFinance('registerPagosMasivos'));
router.patch('/pagos/:pagoId/conciliar', labCashier, delegateToFinance('conciliarPago'));
router.post('/saldos-favor', labCashier, delegateToFinance('registerSaldoFavor'));
router.post('/saldos-favor/:clinicaId', labCashier, delegateToFinance('registerSaldoFavor'));
router.get('/saldos-favor/:clinicaId', labCashier, delegateToFinance('listSaldosFavorByClinica'));
router.post('/saldos-favor/aplicar', labCashier, delegateToFinance('aplicarSaldoFavor'));
router.get('/saldos-favor/aplicaciones/:clinicaId', labCashier, delegateToFinance('listAplicacionesSaldoFavor'));
router.get('/cobranzas/overview', labCashier, delegateToFinance('getCobranzasOverview'));
router.get('/cobranzas/clinica/:clinicaId', labCashier, delegateToFinance('getClinicDebtDetail'));
router.get('/sesiones-caja/actual', labCashier, delegateToFinance('getActiveCashSession'));
router.get('/sesiones-caja', labCashier, delegateToFinance('listCashSessions'));
router.post('/sesiones-caja/abrir', labCashier, delegateToFinance('openCashSession'));
router.post('/sesiones-caja/:sesionId/cerrar', labCashier, delegateToFinance('closeCashSession'));
router.post('/sesiones-caja/:sesionId/reabrir', requireRole('admin'), delegateToFinance('reopenCashSession'));
router.get('/:id', labCashier, delegateToFinance('getOrderFinanceDetail'));
router.post('/:id/pagos', labCashier, validateBody(createPagoSchema), delegateToFinance('registerPago'));

export default router;
