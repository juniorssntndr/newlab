import { Router } from 'express';
import { authenticateToken, requireRole } from '../../../../middleware/auth.js';
import { validateBody } from '../../../../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema, updateMovimientoFinancieroSchema } from '../../../../validation/schemas.js';

export const makeFinanceRoutes = ({ financeController }) => {
    const router = Router();
    const labCashier = requireRole('admin', 'operador');

    router.use(authenticateToken);
    router.get('/', labCashier, financeController.listFinanceOrders);
    router.get('/catalogos', labCashier, financeController.getCatalogos);
    router.get('/movimientos', labCashier, financeController.listMovimientos);
    router.post('/movimientos', labCashier, validateBody(createMovimientoFinancieroSchema), financeController.createMovimiento);
    router.put('/movimientos/:movimientoId', labCashier, validateBody(updateMovimientoFinancieroSchema), financeController.updateMovimiento);
    router.delete('/movimientos/:movimientoId', labCashier, financeController.deleteMovimiento);
    // Rutas estáticas antes de /:id para que Express no capture "estado-cuenta" o "saldos-favor" como id.
    router.get('/estado-cuenta/:clinica_id', labCashier, financeController.getEstadoCuentaByClinica);
    router.post('/pagos-masivos', labCashier, financeController.registerPagosMasivos);
    router.patch('/pagos/:pagoId/conciliar', labCashier, financeController.conciliarPago);
    router.post('/saldos-favor', labCashier, financeController.registerSaldoFavor);
    router.post('/saldos-favor/:clinicaId', labCashier, financeController.registerSaldoFavor);
    router.get('/saldos-favor/:clinicaId', labCashier, financeController.listSaldosFavorByClinica);
    router.get('/cobranzas/overview', labCashier, financeController.getCobranzasOverview);
    router.get('/cobranzas/clinica/:clinicaId', labCashier, financeController.getClinicDebtDetail);
    router.get('/sesiones-caja/actual', labCashier, financeController.getActiveCashSession);
    router.get('/sesiones-caja', labCashier, financeController.listCashSessions);
    router.post('/sesiones-caja/abrir', labCashier, financeController.openCashSession);
    router.post('/sesiones-caja/:sesionId/cerrar', labCashier, financeController.closeCashSession);
    router.post('/sesiones-caja/:sesionId/reabrir', requireRole('admin'), financeController.reopenCashSession);
    router.get('/:id', labCashier, financeController.getOrderFinanceDetail);
    router.post('/:id/pagos', labCashier, validateBody(createPagoSchema), financeController.registerPago);

    return router;
};
