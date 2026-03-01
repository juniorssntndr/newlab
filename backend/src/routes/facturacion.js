import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    emitirComprobanteSunat,
    anularComprobante,
    emitirNotaCredito,
    consultarEstadoSunat,
} from '../services/apisperu.js';

const router = Router();
router.use(authenticateToken);

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
        const comprobante = await emitirComprobanteSunat(pool, req.params.pedidoId, tipoComprobante, billingData);
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
        const result = await anularComprobante(pool, req.params.comprobanteId, motivo.trim());
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
        const result = await emitirNotaCredito(pool, req.params.comprobanteId, { motivo: motivo.trim(), monto, detalles });
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
        const result = await consultarEstadoSunat(pool, req.params.comprobanteId);
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
