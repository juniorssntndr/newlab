import { Router } from 'express';
import { authenticateToken, requireRole } from '../../../../middleware/auth.js';
import { validateBody } from '../../../../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema, updateMovimientoFinancieroSchema } from '../../../../validation/schemas.js';

export const makeFinanceRoutes = ({ financeController }) => {
    const router = Router();
    const labCashier = requireRole('admin', 'tecnico');

    router.use(authenticateToken);
    router.get('/', labCashier, financeController.listFinanceOrders);
    router.get('/catalogos', labCashier, financeController.getCatalogos);
    router.get('/movimientos', labCashier, financeController.listMovimientos);
    router.post('/movimientos', labCashier, validateBody(createMovimientoFinancieroSchema), financeController.createMovimiento);
    router.put('/movimientos/:movimientoId', labCashier, validateBody(updateMovimientoFinancieroSchema), financeController.updateMovimiento);
    router.delete('/movimientos/:movimientoId', labCashier, financeController.deleteMovimiento);
    // Rutas estáticas antes de /:id para que Express no capture "estado-cuenta" como id.
    router.get('/estado-cuenta/:clinica_id', labCashier, financeController.getEstadoCuentaByClinica);
    router.post('/pagos-masivos', labCashier, financeController.registerPagosMasivos);
    router.patch('/pagos/:pagoId/conciliar', labCashier, financeController.conciliarPago);
    router.get('/:id', labCashier, financeController.getOrderFinanceDetail);
    router.post('/:id/pagos', labCashier, validateBody(createPagoSchema), financeController.registerPago);

    return router;
};
