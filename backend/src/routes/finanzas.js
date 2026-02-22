import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const buildEstadoPagoCase = (alias = 'p', pagoAlias = 'pg') => {
    return `CASE
        WHEN COALESCE(${pagoAlias}.monto_pagado, 0) >= ${alias}.total THEN 'cancelado'
        WHEN COALESCE(${pagoAlias}.monto_pagado, 0) > 0 THEN 'pago_parcial'
        ELSE 'por_cancelar'
    END`;
};

const normalizePago = (pago) => ({
    ...pago,
    monto: parseFloat(pago.monto)
});

// GET /api/finanzas
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { estado_pago, clinica_id, search } = req.query;
        const params = [];
        let where = 'WHERE 1=1';

        if (req.user.tipo === 'cliente' && req.user.clinica_id) {
            params.push(req.user.clinica_id);
            where += ` AND p.clinica_id = $${params.length}`;
        }

        if (clinica_id) {
            params.push(clinica_id);
            where += ` AND p.clinica_id = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            where += ` AND (p.codigo ILIKE $${params.length} OR p.paciente_nombre ILIKE $${params.length})`;
        }

        const estadoCase = buildEstadoPagoCase('p', 'pg');
        if (estado_pago) {
            params.push(estado_pago);
            where += ` AND ${estadoCase} = $${params.length}`;
        }

        const query = `
            SELECT p.*, c.nombre as clinica_nombre,
                   COALESCE(pg.monto_pagado, 0) as monto_pagado,
                   (p.total - COALESCE(pg.monto_pagado, 0)) as saldo,
                   ${estadoCase} as estado_pago
            FROM nl_pedidos p
            LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
            LEFT JOIN (
                SELECT pedido_id, SUM(monto) as monto_pagado
                FROM nl_pagos
                GROUP BY pedido_id
            ) pg ON pg.pedido_id = p.id
            ${where}
            ORDER BY p.created_at DESC
        `;

        const result = await pool.query(query, params);
        const rows = result.rows.map((row) => ({
            ...row,
            monto_pagado: parseFloat(row.monto_pagado || 0),
            saldo: parseFloat(row.saldo || 0)
        }));
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/finanzas/:id
router.get('/:id', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const pedidoResult = await pool.query(
            `SELECT p.*, c.nombre as clinica_nombre, c.ruc as clinica_ruc, c.direccion as clinica_direccion
             FROM nl_pedidos p
             LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
             WHERE p.id = $1`,
            [req.params.id]
        );

        if (pedidoResult.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        const pedido = pedidoResult.rows[0];

        if (req.user.tipo === 'cliente' && req.user.clinica_id !== pedido.clinica_id) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const pagosResult = await pool.query(
            `SELECT pg.*, u.nombre as creado_por_nombre
             FROM nl_pagos pg
             LEFT JOIN nl_usuarios u ON pg.creado_por = u.id
             WHERE pg.pedido_id = $1
             ORDER BY pg.fecha_pago DESC, pg.created_at DESC`,
            [req.params.id]
        );

        const itemsResult = await pool.query(
            `SELECT pi.*, pr.nombre as producto_nombre
             FROM nl_pedido_items pi
             LEFT JOIN nl_productos pr ON pi.producto_id = pr.id
             WHERE pi.pedido_id = $1`,
            [req.params.id]
        );

        const pagos = pagosResult.rows.map(normalizePago);
        const montoPagado = pagos.reduce((sum, pago) => sum + (Number.isNaN(pago.monto) ? 0 : pago.monto), 0);
        const total = parseFloat(pedido.total || 0);
        const saldo = total - montoPagado;
        const estadoPago = montoPagado >= total ? 'cancelado' : montoPagado > 0 ? 'pago_parcial' : 'por_cancelar';

        res.json({
            ...pedido,
            items: itemsResult.rows,
            pagos,
            monto_pagado: montoPagado,
            saldo,
            estado_pago: estadoPago
        });
    } catch (err) { next(err); }
});

// POST /api/finanzas/:id/pagos
router.post('/:id/pagos', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        if (req.user.tipo === 'cliente') return res.status(403).json({ error: 'No autorizado' });

        const { monto, metodo, referencia, fecha_pago, notas } = req.body;
        const montoNumber = parseFloat(monto);
        if (!monto || Number.isNaN(montoNumber) || montoNumber <= 0) {
            return res.status(400).json({ error: 'Monto válido es requerido' });
        }

        const pedidoResult = await pool.query('SELECT id FROM nl_pedidos WHERE id = $1', [req.params.id]);
        if (pedidoResult.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });

        const result = await pool.query(
            `INSERT INTO nl_pagos (pedido_id, monto, metodo, referencia, fecha_pago, notas, creado_por)
             VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7)
             RETURNING *`,
            [req.params.id, montoNumber, metodo || 'transferencia', referencia || null, fecha_pago || null, notas || null, req.user.id]
        );

        res.status(201).json(normalizePago(result.rows[0]));
    } catch (err) { next(err); }
});

export default router;
