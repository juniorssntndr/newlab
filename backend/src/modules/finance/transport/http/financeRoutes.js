import { Router } from 'express';
import { authenticateToken, forbidRole } from '../../../../middleware/auth.js';
import { validateBody } from '../../../../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema, updateMovimientoFinancieroSchema } from '../../../../validation/schemas.js';

export const makeFinanceRoutes = ({ financeController }) => {
    const router = Router();

    router.use(authenticateToken);
    router.get('/', forbidRole('tecnico'), financeController.listFinanceOrders);
    router.get('/catalogos', forbidRole('tecnico'), financeController.getCatalogos);
    router.get('/movimientos', forbidRole('tecnico'), financeController.listMovimientos);
    router.post('/movimientos', forbidRole('tecnico'), validateBody(createMovimientoFinancieroSchema), financeController.createMovimiento);
    router.put('/movimientos/:movimientoId', forbidRole('tecnico'), validateBody(updateMovimientoFinancieroSchema), financeController.updateMovimiento);
    router.delete('/movimientos/:movimientoId', forbidRole('tecnico'), financeController.deleteMovimiento);
    router.get('/:id', forbidRole('tecnico'), financeController.getOrderFinanceDetail);
    router.post('/:id/pagos', forbidRole('tecnico'), validateBody(createPagoSchema), financeController.registerPago);
    router.get('/estado-cuenta/:clinica_id', financeController.getEstadoCuentaByClinica);
    router.post('/pagos-masivos', forbidRole('tecnico'), financeController.registerPagosMasivos);
    router.patch('/pagos/:pagoId/conciliar', forbidRole('tecnico'), financeController.conciliarPago);

    return router;
};
