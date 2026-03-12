import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createPagoSchema } from '../validation/schemas.js';
import { writeAuditEvent } from '../services/audit.js';

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
    monto: parseFloat(pago.monto),
    conciliado: !!pago.conciliado
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
            where += ` AND (p.codigo ILIKE $${params.length} OR p.paciente_nombre ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`;

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
        const pagosPendientesConciliacion = pagos.filter((pago) => !pago.conciliado).length;

        res.json({
            ...pedido,
            items: itemsResult.rows,
            pagos,
            monto_pagado: montoPagado,
            saldo,
            estado_pago: estadoPago,
            pagos_pendientes_conciliacion: pagosPendientesConciliacion
        });
    } catch (err) { next(err); }
});

// POST /api/finanzas/:id/pagos
router.post('/:id/pagos', validateBody(createPagoSchema), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        if (req.user.tipo === 'cliente') return res.status(403).json({ error: 'No autorizado' });

        const { monto, metodo, referencia, fecha_pago, notas } = req.body;
        const montoNumber = parseFloat(monto);
        if (!monto || Number.isNaN(montoNumber) || montoNumber <= 0) {
            return res.status(400).json({ error: 'Monto válido es requerido' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pedidoResult = await client.query('SELECT id, codigo, total FROM nl_pedidos WHERE id = $1 FOR UPDATE', [req.params.id]);
            if (pedidoResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Pedido no encontrado' });
            }

            const pedido = pedidoResult.rows[0];
            const totalPedido = parseFloat(pedido.total || 0);
            const pagosPreviosResult = await client.query(
                'SELECT COALESCE(SUM(monto), 0) as monto_pagado FROM nl_pagos WHERE pedido_id = $1',
                [req.params.id]
            );
            const montoPagadoActual = parseFloat(pagosPreviosResult.rows[0].monto_pagado || 0);
            const saldoActual = totalPedido - montoPagadoActual;

            if (montoNumber > saldoActual + 0.01) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: 'El pago excede el saldo pendiente',
                    details: {
                        total_pedido: totalPedido,
                        monto_pagado_actual: montoPagadoActual,
                        saldo_actual: Math.max(saldoActual, 0),
                        monto_intentado: montoNumber
                    }
                });
            }

            const result = await client.query(
                `INSERT INTO nl_pagos (pedido_id, monto, metodo, referencia, fecha_pago, notas, creado_por)
                 VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7)
                 RETURNING *`,
                [req.params.id, montoNumber, metodo || 'transferencia', referencia || null, fecha_pago || null, notas || null, req.user.id]
            );

            await client.query('COMMIT');

            await writeAuditEvent(req, {
                entidad: 'pago',
                entidadId: result.rows[0].id,
                accion: 'pago_created',
                descripcion: `Pago registrado para pedido ${pedido.codigo}`,
                metadata: {
                    pedido_id: Number(req.params.id),
                    monto: montoNumber,
                    metodo: metodo || 'transferencia'
                }
            });

            res.status(201).json(normalizePago(result.rows[0]));
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (err) { next(err); }
});


// GET /api/finanzas/estado-cuenta/:clinica_id
router.get('/estado-cuenta/:clinica_id', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const clinicaId = req.params.clinica_id;

        // Security check for client role
        if (req.user.tipo === 'cliente' && req.user.clinica_id !== parseInt(clinicaId)) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Get clinica info
        const clinicaResult = await pool.query('SELECT id, nombre, ruc FROM nl_clinicas WHERE id = $1', [clinicaId]);
        if (clinicaResult.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });
        const clinica = clinicaResult.rows[0];

        // Get all pending orders for this clinica (where total > monto_pagado)
        const query = `
            SELECT p.id, p.codigo, p.created_at, p.paciente_nombre, p.total,
                   COALESCE(pg.monto_pagado, 0) as monto_pagado,
                   (p.total - COALESCE(pg.monto_pagado, 0)) as saldo
            FROM nl_pedidos p
            LEFT JOIN (
                SELECT pedido_id, SUM(monto) as monto_pagado
                FROM nl_pagos
                GROUP BY pedido_id
            ) pg ON pg.pedido_id = p.id
            WHERE p.clinica_id = $1 AND (p.total - COALESCE(pg.monto_pagado, 0)) > 0
            ORDER BY p.created_at ASC
        `;
        const result = await pool.query(query, [clinicaId]);
        
        const pedidosPendientes = result.rows.map(row => ({
            ...row,
            total: parseFloat(row.total || 0),
            monto_pagado: parseFloat(row.monto_pagado || 0),
            saldo: parseFloat(row.saldo || 0)
        }));

        const saldoTotalPendiente = pedidosPendientes.reduce((sum, p) => sum + p.saldo, 0);

        res.json({
            clinica_id: clinica.id,
            clinica_nombre: clinica.nombre,
            clinica_ruc: clinica.ruc,
            saldo_total_pendiente: saldoTotalPendiente,
            pedidos_pendientes: pedidosPendientes
        });
    } catch (err) { next(err); }
});

// POST /api/finanzas/pagos-masivos
router.post('/pagos-masivos', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        if (req.user.tipo === 'cliente') return res.status(403).json({ error: 'No autorizado' });

        const { clinica_id, monto_total, metodo, referencia, fecha_pago, notas } = req.body;
        const montoTotalNumber = parseFloat(monto_total);

        if (!clinica_id || isNaN(montoTotalNumber) || montoTotalNumber <= 0) {
            return res.status(400).json({ error: 'Datos inválidos. Se requiere clinica_id y un monto_total mayor a 0.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Find all pending orders for this clinica, FOR UPDATE to lock them during transaction
            const pendingOrdersQuery = `
                SELECT p.id, p.codigo, p.total, COALESCE(pg.monto_pagado, 0) as monto_pagado,
                       (p.total - COALESCE(pg.monto_pagado, 0)) as saldo
                FROM nl_pedidos p
                LEFT JOIN (
                    SELECT pedido_id, SUM(monto) as monto_pagado
                    FROM nl_pagos
                    GROUP BY pedido_id
                ) pg ON pg.pedido_id = p.id
                WHERE p.clinica_id = $1 AND (p.total - COALESCE(pg.monto_pagado, 0)) > 0
                ORDER BY p.created_at ASC
                FOR UPDATE OF p
            `;
            
            const ordersResult = await client.query(pendingOrdersQuery, [clinica_id]);
            const pendingOrders = ordersResult.rows.map(row => ({
                ...row,
                total: parseFloat(row.total || 0),
                saldo: parseFloat(row.saldo || 0)
            }));

            let remainingMonto = montoTotalNumber;
            const pagosRegistrados = [];

            for (const order of pendingOrders) {
                if (remainingMonto <= 0) break; // Finished distributing payment

                const montoAbonarOrder = Math.min(order.saldo, remainingMonto);
                
                // Insert individual payment record for this order
                const pagoResult = await client.query(
                    `INSERT INTO nl_pagos (pedido_id, monto, metodo, referencia, fecha_pago, notas, creado_por)
                     VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7)
                     RETURNING *`,
                    [
                        order.id, 
                        montoAbonarOrder, 
                        metodo || 'transferencia', 
                        referencia || 'Pago Masivo', 
                        fecha_pago || null, 
                        notas || 'Abono automático por pago masivo', 
                        req.user.id
                    ]
                );

                pagosRegistrados.push({
                    pedido_codigo: order.codigo,
                    monto_abonado: montoAbonarOrder,
                    pago: normalizePago(pagoResult.rows[0])
                });

                remainingMonto -= montoAbonarOrder;
            }

            await client.query('COMMIT');

            // Audit
            await writeAuditEvent(req, {
                entidad: 'clinica',
                entidadId: clinica_id,
                accion: 'pago_masivo_created',
                descripcion: `Pago masivo de S/. ${montoTotalNumber.toFixed(2)} distribuido en ${pagosRegistrados.length} pedidos.`,
                metadata: {
                    clinica_id,
                    monto_total: montoTotalNumber,
                    pedidos_afectados: pagosRegistrados.length
                }
            });

            res.status(201).json({
                message: 'Pago masivo procesado exitosamente',
                monto_total_ingresado: montoTotalNumber,
                monto_total_distribuido: montoTotalNumber - remainingMonto,
                monto_sobrante: remainingMonto, // Positive if they overpaid their entire debt
                pagos_registrados: pagosRegistrados
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (err) { next(err); }
});

// PATCH /api/finanzas/pagos/:pagoId/conciliar
router.patch('/pagos/:pagoId/conciliar', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        if (req.user.tipo === 'cliente') return res.status(403).json({ error: 'No autorizado' });

        const pagoResult = await pool.query(
            `SELECT pg.*, p.codigo as pedido_codigo
             FROM nl_pagos pg
             LEFT JOIN nl_pedidos p ON p.id = pg.pedido_id
             WHERE pg.id = $1`,
            [req.params.pagoId]
        );

        if (pagoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        if (pagoResult.rows[0].conciliado) {
            return res.json(normalizePago(pagoResult.rows[0]));
        }

        const result = await pool.query(
            `UPDATE nl_pagos
             SET conciliado = TRUE,
                 conciliado_at = NOW(),
                 conciliado_por = $1
             WHERE id = $2
             RETURNING *`,
            [req.user.id, req.params.pagoId]
        );

        await writeAuditEvent(req, {
            entidad: 'pago',
            entidadId: req.params.pagoId,
            accion: 'pago_conciliado',
            descripcion: `Pago conciliado para pedido ${pagoResult.rows[0].pedido_codigo || ''}`.trim(),
            metadata: {
                pedido_id: pagoResult.rows[0].pedido_id,
                monto: parseFloat(pagoResult.rows[0].monto || 0)
            }
        });

        res.json(normalizePago(result.rows[0]));
    } catch (err) { next(err); }
});

export default router;
