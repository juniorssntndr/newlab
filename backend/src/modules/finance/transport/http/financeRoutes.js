import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../../../../middleware/auth.js';
import { validateBody } from '../../../../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema, updateMovimientoFinancieroSchema } from '../../../../validation/schemas.js';

const receiptUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        if (!mime.startsWith('image/') && mime !== 'application/pdf') {
            return cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP) o documentos PDF'));
        }
        cb(null, true);
    }
});

export const makeFinanceRoutes = ({ financeController }) => {
    const router = Router();
    const labCashier = requireRole('admin', 'operador', 'socio');
    const labPartnerRole = requireRole('admin', 'socio');

    router.use(authenticateToken);
    router.get('/', labCashier, financeController.listFinanceOrders);
    router.get('/catalogos', labCashier, financeController.getCatalogos);
    router.get('/movimientos', labCashier, financeController.listMovimientos);
    router.post('/upload-sustento', labCashier, receiptUpload.single('archivo'), financeController.uploadSustento);
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
    // Rutas de Tesorería Multi-Banco, Transferencias y Socios
    router.get('/cuentas', labPartnerRole, financeController.listAccountsWithBalance);
    router.post('/cuentas', labPartnerRole, financeController.createAccount);
    router.put('/cuentas/:id', labPartnerRole, financeController.updateAccount);
    router.get('/transferencias', labPartnerRole, financeController.listTransfers);
    router.post('/transferencias', labPartnerRole, financeController.registerTransfer);
    router.get('/socios', labPartnerRole, financeController.listSocios);
    router.post('/socios', requireRole('admin'), financeController.createSocio);
    router.put('/socios/:id', requireRole('admin'), financeController.updateSocio);
    router.delete('/socios/:id', requireRole('admin'), financeController.deleteSocio);
    router.get('/retiros-socios', labPartnerRole, financeController.listRetirosSocios);
    router.post('/retiros-socios', requireRole('admin'), financeController.registerRetiroSocio);

    router.get('/:id', labCashier, financeController.getOrderFinanceDetail);
    router.post('/:id/pagos', labCashier, validateBody(createPagoSchema), financeController.registerPago);

    return router;
};
