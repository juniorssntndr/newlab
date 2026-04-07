import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    emitirComprobanteSunat,
    anularComprobante,
    emitirNotaCredito,
    consultarEstadoSunat,
} from '../services/apisperu.js';

const defaultFacturacionDeps = {
    emitirComprobanteSunat,
    anularComprobante,
    emitirNotaCredito,
    consultarEstadoSunat
};

let facturacionDeps = { ...defaultFacturacionDeps };

export const __setFacturacionDepsForTesting = (overrides = {}) => {
    facturacionDeps = {
        ...facturacionDeps,
        ...overrides
    };
};

export const __resetFacturacionDepsForTesting = () => {
    facturacionDeps = { ...defaultFacturacionDeps };
};

const router = Router();
router.use(authenticateToken);

const IGV_DEFAULT_RATE = 0.18;

const normalizeString = (value) => String(value ?? '').trim();
const normalizeDoc = (value) => normalizeString(value).replace(/\D/g, '');
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const inferTaxRate = (detail) => {
    const explicitRate = Number(detail?.taxRate);
    if (Number.isFinite(explicitRate) && explicitRate >= 0) {
        return explicitRate;
    }

    const percentage = Number(detail?.porcentajeIgv);
    if (Number.isFinite(percentage) && percentage >= 0) {
        return percentage > 1 ? percentage / 100 : percentage;
    }

    return IGV_DEFAULT_RATE;
};

const mapBillingDetailsToLines = (details = []) => details
    .map((detail, index) => {
        const qty = Number(detail?.qty ?? detail?.cantidad ?? 0);
        const unitPrice = Number(detail?.unitPrice?.amount ?? detail?.mtoValorUnitario ?? 0);

        return {
            sku: normalizeString(detail?.sku || detail?.codProducto || `ITEM-${index + 1}`),
            description: normalizeString(detail?.description || detail?.descripcion || 'Servicio dental'),
            qty,
            unitPrice: {
                amount: roundMoney(unitPrice),
                currency: normalizeString(detail?.unitPrice?.currency || 'PEN') || 'PEN'
            },
            taxRate: inferTaxRate(detail)
        };
    })
    .filter((line) => line.qty > 0 && line.unitPrice.amount >= 0 && line.description.length > 0);

const computeTotalFromLines = (lines = []) => roundMoney(lines.reduce((sum, line) => {
    const net = (Number(line.unitPrice?.amount) || 0) * (Number(line.qty) || 0);
    return sum + net + (net * (Number(line.taxRate) || 0));
}, 0));

const buildSnapshotOverride = ({ baseSnapshot, billingData, tipoComprobante }) => {
    if (!billingData) {
        return baseSnapshot;
    }

    const client = billingData?.client || {};
    const mappedLines = mapBillingDetailsToLines(billingData?.details || []);
    const lines = mappedLines.length > 0 ? mappedLines : baseSnapshot.lines;
    const fallbackTotal = computeTotalFromLines(lines);
    const requestedTotal = Number(billingData?.mtoImpVenta);
    const totalAmount = Number.isFinite(requestedTotal) && requestedTotal > 0
        ? roundMoney(requestedTotal)
        : fallbackTotal;

    const customerDocument = normalizeDoc(client?.numDoc) || baseSnapshot.customerDocument;
    if (tipoComprobante === '01' && customerDocument.length !== 11) {
        const error = new Error('Para emitir Factura, el receptor debe tener un RUC de 11 dígitos.');
        error.status = 400;
        throw error;
    }

    return {
        ...baseSnapshot,
        customerDocument,
        customerName: normalizeString(client?.rznSocial) || baseSnapshot.customerName,
        lines,
        total: {
            amount: totalAmount,
            currency: baseSnapshot?.total?.currency || 'PEN'
        }
    };
};

const getBillingModule = (req) => req.app.locals?.modules?.billing;
const isLegacyBillingMode = (req) => getBillingModule(req)?.billingAclMode !== 'new-acl';

// ─── Helper: Admin/Tecnico only ───────────────────────────────────────────────
function requireTecnico(req, res) {
    if (req.user.tipo !== 'admin' && req.user.tipo !== 'tecnico') {
        res.status(403).json({ error: 'No tienes permisos para esta operación de facturación.' });
        return false;
    }
    return true;
}

// ─── Guard: validate clinica access for clients ───────────────────────────────
async function guardClinicaAccess(pool, pedidoId, user, res) {
    if (user.tipo === 'cliente') {
        const { rows } = await pool.query('SELECT clinica_id FROM nl_pedidos WHERE id = $1', [pedidoId]);
        if (rows.length === 0 || Number(rows[0].clinica_id) !== Number(user.clinica_id)) {
            res.status(403).json({ error: 'Acceso denegado a este pedido.' });
            return false;
        }
    }
    return true;
}

// ─── POST /:pedidoId/emitir ───────────────────────────────────────────────────
router.post('/:pedidoId/emitir', async (req, res, next) => {
    try {
        if (!requireTecnico(req, res)) return;
        const { tipoComprobante, billingData } = req.body;
        if (!['01', '03'].includes(tipoComprobante)) {
            return res.status(400).json({ error: 'Tipo de comprobante inválido. Use 01 (Factura) o 03 (Boleta).' });
        }
        const pool = req.app.locals.pool;
        const existing = await pool.query(
            "SELECT id FROM nl_comprobantes WHERE pedido_id = $1 AND estado_sunat != 'anulado' LIMIT 1",
            [req.params.pedidoId]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'El pedido ya tiene un comprobante activo emitido.' });
        }

        let comprobante;
        if (isLegacyBillingMode(req)) {
            comprobante = await facturacionDeps.emitirComprobanteSunat(pool, req.params.pedidoId, tipoComprobante, billingData);
        } else {
            const billingModule = getBillingModule(req);
            if (!billingModule?.billingController || !billingModule?.billingRepository) {
                const error = new Error('Modulo de facturacion no disponible');
                error.status = 503;
                throw error;
            }

            const baseSnapshot = await billingModule.billingRepository.getOrderSnapshot(req.params.pedidoId);
            if (!baseSnapshot) {
                return res.status(404).json({ error: 'Pedido no encontrado.' });
            }

            const snapshot = buildSnapshotOverride({
                baseSnapshot,
                billingData,
                tipoComprobante
            });

            const result = await billingModule.billingController.createInvoice.execute(
                {
                    requestId: req.requestId,
                    actorId: String(req.user?.id || req.user?.email || 'unknown')
                },
                {
                    params: { pedidoId: req.params.pedidoId },
                    body: snapshot
                }
            );

            if (!result.ok) {
                return res.status(result.status).json({ error: result.errorMessage, code: result.errorCode });
            }

            const persisted = await pool.query('SELECT * FROM nl_comprobantes WHERE id = $1 LIMIT 1', [result.data.invoiceId]);
            comprobante = persisted.rows[0] || result.data;
        }

        res.json(comprobante);
    } catch (err) {
        console.error('[facturacion] emitir error:', err.message);
        next(err);
    }
});

// ─── POST /:comprobanteId/anular ──────────────────────────────────────────────
router.post('/:comprobanteId/anular', async (req, res, next) => {
    try {
        if (!requireTecnico(req, res)) return;
        const { motivo } = req.body;
        if (!motivo || motivo.trim().length < 5) {
            return res.status(400).json({ error: 'El motivo de anulación es obligatorio (mín. 5 caracteres).' });
        }
        const pool = req.app.locals.pool;
        const result = await facturacionDeps.anularComprobante(pool, req.params.comprobanteId, motivo.trim());
        res.json({ ok: true, comprobante: result });
    } catch (err) {
        console.error('[facturacion] anular error:', err.message);
        next(err);
    }
});

// ─── POST /:comprobanteId/nota-credito ────────────────────────────────────────
router.post('/:comprobanteId/nota-credito', async (req, res, next) => {
    try {
        if (!requireTecnico(req, res)) return;
        const { motivo, monto, detalles } = req.body;
        if (!motivo || motivo.trim().length < 5) {
            return res.status(400).json({ error: 'El motivo de la nota de crédito es obligatorio (mín. 5 caracteres).' });
        }
        if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
            return res.status(400).json({ error: 'El monto de la nota de crédito debe ser mayor a 0.' });
        }
        const pool = req.app.locals.pool;
        const result = await facturacionDeps.emitirNotaCredito(pool, req.params.comprobanteId, { motivo: motivo.trim(), monto, detalles });
        res.json({ ok: true, notaCredito: result });
    } catch (err) {
        console.error('[facturacion] nota-credito error:', err.message);
        next(err);
    }
});

// ─── GET /:comprobanteId/status ───────────────────────────────────────────────
router.get('/:comprobanteId/status', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        let result;

        if (isLegacyBillingMode(req)) {
            result = await facturacionDeps.consultarEstadoSunat(pool, req.params.comprobanteId);
        } else {
            const billingModule = getBillingModule(req);
            if (!billingModule?.billingController) {
                const error = new Error('Modulo de facturacion no disponible');
                error.status = 503;
                throw error;
            }

            const syncResult = await billingModule.billingController.syncInvoiceStatus.execute(
                {
                    requestId: req.requestId,
                    actorId: String(req.user?.id || req.user?.email || 'unknown')
                },
                {
                    params: { comprobanteId: req.params.comprobanteId }
                }
            );

            if (!syncResult.ok) {
                return res.status(syncResult.status).json({ error: syncResult.errorMessage, code: syncResult.errorCode });
            }

            result = {
                comprobanteId: req.params.comprobanteId,
                invoiceStatus: syncResult.data.invoiceStatus,
                sunatTicket: syncResult.data.sunatTicket,
                pdfUrl: syncResult.data.pdfUrl,
                xmlUrl: syncResult.data.xmlUrl
            };
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─── GET /:pedidoId — Comprobantes de un pedido ───────────────────────────────
router.get('/:pedidoId', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        if (!(await guardClinicaAccess(pool, req.params.pedidoId, req.user, res))) return;

        const { rows } = await pool.query(`
            SELECT c.*,
                   json_agg(nc.*) FILTER (WHERE nc.id IS NOT NULL) AS notas_credito
            FROM nl_comprobantes c
            LEFT JOIN nl_notas_credito nc ON nc.comprobante_id = c.id
            WHERE c.pedido_id = $1
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, [req.params.pedidoId]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// ─── GET / — Historial global paginado con filtros ────────────────────────────
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const {
            page = 1,
            limit = 20,
            tipo,
            estado,
            clinica_id,
            desde,
            hasta,
            q, // search by serie-correlativo or paciente
        } = req.query;

        const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
        const params = [];
        const conditions = [];

        if (req.user.tipo === 'cliente') {
            params.push(req.user.clinica_id);
            conditions.push(`p.clinica_id = $${params.length}`);
        } else if (clinica_id) {
            params.push(clinica_id);
            conditions.push(`p.clinica_id = $${params.length}`);
        }

        if (tipo) {
            params.push(tipo);
            conditions.push(`c.tipo_comprobante = $${params.length}`);
        }
        if (estado) {
            params.push(estado);
            conditions.push(`c.estado_sunat = $${params.length}`);
        }
        if (desde) {
            params.push(desde);
            conditions.push(`c.fecha_emision >= $${params.length}`);
        }
        if (hasta) {
            params.push(hasta);
            conditions.push(`c.fecha_emision <= $${params.length}`);
        }
        if (q) {
            params.push(`%${q}%`);
            conditions.push(`(p.paciente_nombre ILIKE $${params.length} OR CONCAT(c.serie,'-',c.correlativo) ILIKE $${params.length})`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countRes = await pool.query(`
            SELECT COUNT(*) FROM nl_comprobantes c
            JOIN nl_pedidos p ON c.pedido_id = p.id
            LEFT JOIN nl_clinicas cl ON p.clinica_id = cl.id
            ${where}
        `, params);

        params.push(Math.min(100, parseInt(limit)));
        params.push(offset);

        const { rows } = await pool.query(`
            SELECT c.*,
                   p.codigo AS pedido_codigo,
                   p.paciente_nombre,
                   cl.nombre AS clinica_nombre,
                   (SELECT COUNT(*) FROM nl_notas_credito WHERE comprobante_id = c.id) AS notas_credito_count
            FROM nl_comprobantes c
            JOIN nl_pedidos p ON c.pedido_id = p.id
            LEFT JOIN nl_clinicas cl ON p.clinica_id = cl.id
            ${where}
            ORDER BY c.fecha_emision DESC, c.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        res.json({
            data: rows,
            total: parseInt(countRes.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit)),
        });
    } catch (err) {
        next(err);
    }
});

export default router;
