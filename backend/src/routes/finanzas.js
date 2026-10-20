import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema, updateMovimientoFinancieroSchema } from '../validation/schemas.js';

const router = Router();
router.use(authenticateToken);

const labFinanceRole = requireRole('admin', 'operador', 'socio');
const labPartnerRole = requireRole('admin', 'socio');

const getFinanceController = (req) => req.app?.locals?.modules?.finance?.financeController;

const delegateToFinance = (controllerMethod) => async (req, res, next) => {
    const financeController = getFinanceController(req);
    if (!financeController?.[controllerMethod]) {
        return res.status(503).json({ error: 'Finance module not available' });
    }

    return financeController[controllerMethod](req, res, next);
};

router.get('/', labFinanceRole, delegateToFinance('listFinanceOrders'));
router.get('/catalogos', labFinanceRole, delegateToFinance('getCatalogos'));
router.get('/movimientos', labFinanceRole, delegateToFinance('listMovimientos'));
router.post('/movimientos', labFinanceRole, validateBody(createMovimientoFinancieroSchema), delegateToFinance('createMovimiento'));
router.put('/movimientos/:movimientoId', labFinanceRole, validateBody(updateMovimientoFinancieroSchema), delegateToFinance('updateMovimiento'));
router.delete('/movimientos/:movimientoId', labFinanceRole, delegateToFinance('deleteMovimiento'));
// Rutas estáticas antes de /:id para que Express no capture "estado-cuenta" o "saldos-favor" como id.
router.get('/estado-cuenta/:clinica_id', labFinanceRole, delegateToFinance('getEstadoCuentaByClinica'));
router.post('/pagos-masivos', labFinanceRole, delegateToFinance('registerPagosMasivos'));
router.post('/cobro-consolidado', labFinanceRole, delegateToFinance('registerConsolidatedPayment'));
router.patch('/pagos/:pagoId/conciliar', labFinanceRole, delegateToFinance('conciliarPago'));
router.post('/saldos-favor', labFinanceRole, delegateToFinance('registerSaldoFavor'));
router.post('/saldos-favor/:clinicaId', labFinanceRole, delegateToFinance('registerSaldoFavor'));
router.get('/saldos-favor/:clinicaId', labFinanceRole, delegateToFinance('listSaldosFavorByClinica'));
router.post('/saldos-favor/aplicar', labFinanceRole, delegateToFinance('aplicarSaldoFavor'));
router.get('/saldos-favor/aplicaciones/:clinicaId', labFinanceRole, delegateToFinance('listAplicacionesSaldoFavor'));
router.get('/cobranzas/overview', labFinanceRole, delegateToFinance('getCobranzasOverview'));
router.get('/cobranzas/clinica/:clinicaId', labFinanceRole, delegateToFinance('getClinicDebtDetail'));
router.get('/sesiones-caja/actual', labFinanceRole, delegateToFinance('getActiveCashSession'));
router.get('/sesiones-caja', labFinanceRole, delegateToFinance('listCashSessions'));
router.post('/sesiones-caja/abrir', labFinanceRole, delegateToFinance('openCashSession'));
router.post('/sesiones-caja/:sesionId/cerrar', labFinanceRole, delegateToFinance('closeCashSession'));
router.post('/sesiones-caja/:sesionId/reabrir', requireRole('admin'), delegateToFinance('reopenCashSession'));

// Rutas de Tesorería Multi-Banco, Transferencias y Socios
router.get('/cuentas', labPartnerRole, delegateToFinance('listAccountsWithBalance'));
router.post('/cuentas', requireRole('admin'), delegateToFinance('createAccount'));
router.put('/cuentas/:id', requireRole('admin'), delegateToFinance('updateAccount'));
router.get('/transferencias', labPartnerRole, delegateToFinance('listTransfers'));
router.post('/transferencias', labPartnerRole, delegateToFinance('registerTransfer'));
router.get('/socios', labPartnerRole, delegateToFinance('listSocios'));
router.post('/socios', requireRole('admin'), delegateToFinance('createSocio'));
router.put('/socios/:id', requireRole('admin'), delegateToFinance('updateSocio'));
router.delete('/socios/:id', requireRole('admin'), delegateToFinance('deleteSocio'));
router.get('/retiros-socios', labPartnerRole, delegateToFinance('listRetirosSocios'));
router.post('/retiros-socios', requireRole('admin'), delegateToFinance('registerRetiroSocio'));

router.get('/:id', labFinanceRole, delegateToFinance('getOrderFinanceDetail'));
router.post('/:id/pagos', labFinanceRole, validateBody(createPagoSchema), delegateToFinance('registerPago'));

export default router;
