import { Router } from 'express';
import { authenticateToken } from '../../../../middleware/auth.js';
import { validateBody } from '../../../../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema } from '../../../../validation/schemas.js';

export const makeFinanceRoutes = ({ financeController }) => {
    const router = Router();

    router.use(authenticateToken);
    router.get('/', financeController.listFinanceOrders);
    router.get('/catalogos', financeController.getCatalogos);
    router.get('/movimientos', financeController.listMovimientos);
    router.post('/movimientos', validateBody(createMovimientoFinancieroSchema), financeController.createMovimiento);
    router.get('/:id', financeController.getOrderFinanceDetail);
    router.post('/:id/pagos', validateBody(createPagoSchema), financeController.registerPago);
    router.get('/estado-cuenta/:clinica_id', financeController.getEstadoCuentaByClinica);
    router.post('/pagos-masivos', financeController.registerPagosMasivos);
    router.patch('/pagos/:pagoId/conciliar', financeController.conciliarPago);

    return router;
};
