import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createMovimientoFinancieroSchema, createPagoSchema } from '../validation/schemas.js';
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
    monto: parseFloat(pago.monto || 0),
    conciliado: !!pago.conciliado
});

const GASTOS_OPERATIVOS = ['alquiler', 'servicios', 'sueldos', 'marketing', 'mantenimiento'];
const COSTOS_DIRECTOS = ['insumos', 'materiales', 'laboratorio', 'logistica'];

const normalizeMovimiento = (movimiento) => ({
    ...movimiento,
    monto: parseFloat(movimiento.monto || 0)
});

const metodoToTipoFondo = (metodo = '') => {
    const normalized = String(metodo || '').trim().toLowerCase();
    if (normalized === 'efectivo') return 'caja';
    return 'banco';
};

const resolveCuentaFinanciera = async (db, { cuentaId, tipoFondo }) => {
    if (cuentaId) {
        const cuenta = await db.query('SELECT id, tipo_cuenta, activo FROM nl_fin_cuentas WHERE id = $1 LIMIT 1', [cuentaId]);
        if (cuenta.rows.length === 0 || !cuenta.rows[0].activo) {
            return { error: 'La cuenta financiera seleccionada no existe o está inactiva.' };
        }
        if (cuenta.rows[0].tipo_cuenta !== tipoFondo) {
            return { error: `La cuenta seleccionada no corresponde a ${tipoFondo === 'caja' ? 'caja' : 'banco'}.` };
        }
        return { cuentaId: cuenta.rows[0].id };
    }

    const cuentaDefault = await db.query(
        'SELECT id FROM nl_fin_cuentas WHERE activo = TRUE AND tipo_cuenta = $1 ORDER BY id ASC LIMIT 1',
        [tipoFondo]
    );

    if (cuentaDefault.rows.length === 0) {
        return { error: `No existe una cuenta activa de tipo ${tipoFondo}.` };
    }

    return { cuentaId: cuentaDefault.rows[0].id };
};

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
                   COALESCE(pg.monto_pagado_caja, 0) as monto_pagado_caja,
                   COALESCE(pg.monto_pagado_banco, 0) as monto_pagado_banco,
                   (p.total - COALESCE(pg.monto_pagado, 0)) as saldo,
                   ${estadoCase} as estado_pago
            FROM nl_pedidos p
            LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
            LEFT JOIN (
                SELECT
                    pedido_id,
                    SUM(monto) as monto_pagado,
                    SUM(CASE WHEN tipo_fondo = 'caja' THEN monto ELSE 0 END) as monto_pagado_caja,
                    SUM(CASE WHEN tipo_fondo = 'banco' THEN monto ELSE 0 END) as monto_pagado_banco
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
            monto_pagado_caja: parseFloat(row.monto_pagado_caja || 0),
            monto_pagado_banco: parseFloat(row.monto_pagado_banco || 0),
            saldo: parseFloat(row.saldo || 0)
        }));
        res.json(rows);
    } catch (err) { next(err); }
});

// GET /api/finanzas/catalogos
router.get('/catalogos', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const cuentasResult = await pool.query(
            'SELECT id, nombre, tipo_cuenta, moneda, saldo_inicial, activo FROM nl_fin_cuentas WHERE activo = TRUE ORDER BY tipo_cuenta ASC, nombre ASC'
        );

        res.json({
            cuentas: cuentasResult.rows.map((row) => ({
                ...row,
                saldo_inicial: parseFloat(row.saldo_inicial || 0)
            })),
            categorias_gasto: {
                operativo: GASTOS_OPERATIVOS,
                costo_directo: COSTOS_DIRECTOS,
                otro: []
            }
        });
    } catch (err) { next(err); }
});

// GET /api/finanzas/movimientos
router.get('/movimientos', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { tipo, tipo_fondo, grupo_gasto, from, to, search, limit } = req.query;
        const params = [];
        let where = 'WHERE 1=1';

        if (tipo) {
            params.push(tipo);
            where += ` AND m.tipo = $${params.length}`;
        }
        if (grupo_gasto) {
            params.push(grupo_gasto);
            where += ` AND m.grupo_gasto = $${params.length}`;
        }
        if (tipo_fondo) {
            params.push(tipo_fondo);
            where += ` AND m.tipo_fondo = $${params.length}`;
        }
        if (from) {
            params.push(from);
            where += ` AND m.fecha_movimiento >= $${params.length}::date`;
        }
        if (to) {
            params.push(to);
            where += ` AND m.fecha_movimiento <= $${params.length}::date`;
        }
        if (search) {
            params.push(`%${search}%`);
            where += ` AND (m.categoria_gasto ILIKE $${params.length} OR m.descripcion ILIKE $${params.length} OR m.referencia ILIKE $${params.length})`;
        }

        if (req.user.tipo === 'cliente' && req.user.clinica_id) {
            params.push(req.user.clinica_id);
            where += ` AND m.clinica_id = $${params.length}`;
        }

        const queryLimit = Math.min(Math.max(parseInt(limit || 80, 10), 1), 300);
        params.push(queryLimit);

        const result = await pool.query(
            `SELECT m.*, c.nombre as cuenta_nombre, c.tipo_cuenta, u.nombre as creado_por_nombre, pr.nombre as producto_nombre
             FROM nl_fin_movimientos m
             LEFT JOIN nl_fin_cuentas c ON c.id = m.cuenta_id
             LEFT JOIN nl_usuarios u ON u.id = m.creado_por
             LEFT JOIN nl_productos pr ON pr.id = m.producto_id
             ${where}
             ORDER BY m.fecha_movimiento DESC, m.created_at DESC
             LIMIT $${params.length}`,
            params
        );

        res.json(result.rows.map(normalizeMovimiento));
    } catch (err) { next(err); }
});

// POST /api/finanzas/movimientos
router.post('/movimientos', validateBody(createMovimientoFinancieroSchema), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        if (req.user.tipo === 'cliente') return res.status(403).json({ error: 'No autorizado' });

        const {
            tipo,
            tipo_fondo,
            cuenta_id,
            fecha_movimiento,
            monto,
            grupo_gasto,
            categoria_gasto,
            producto_id,
            clinica_id,
            descripcion,
            referencia
        } = req.body;

        const montoNumber = parseFloat(monto);
        if (Number.isNaN(montoNumber) || montoNumber <= 0) {
            return res.status(400).json({ error: 'Monto invalido' });
        }

        const tipoFondo = tipo_fondo || 'banco';
        const cuentaResolution = await resolveCuentaFinanciera(pool, {
            cuentaId: cuenta_id || null,
            tipoFondo
        });
        if (cuentaResolution.error) {
            return res.status(400).json({ error: cuentaResolution.error });
        }
        const cuentaId = cuentaResolution.cuentaId;

        const result = await pool.query(
            `INSERT INTO nl_fin_movimientos (
                tipo, tipo_fondo, cuenta_id, fecha_movimiento, monto, grupo_gasto, categoria_gasto,
                producto_id, clinica_id, descripcion, referencia, creado_por
            )
            VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                tipo,
                tipoFondo,
                cuentaId,
                fecha_movimiento || null,
                montoNumber,
                grupo_gasto || null,
                categoria_gasto || null,
                producto_id || null,
                clinica_id || null,
                descripcion || null,
                referencia || null,
                req.user.id
            ]
        );

        await writeAuditEvent(req, {
            entidad: 'movimiento_financiero',
            entidadId: result.rows[0].id,
            accion: 'movimiento_financiero_created',
            descripcion: `${tipo === 'egreso' ? 'Egreso' : 'Ingreso'} registrado`,
            metadata: {
                tipo,
                monto: montoNumber,
                categoria_gasto: categoria_gasto || null,
                grupo_gasto: grupo_gasto || null,
                cuenta_id: cuentaId,
                tipo_fondo: tipoFondo
            }
        });

        res.status(201).json(normalizeMovimiento(result.rows[0]));
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
            `SELECT pg.*, u.nombre as creado_por_nombre, c.nombre as cuenta_nombre
             FROM nl_pagos pg
             LEFT JOIN nl_usuarios u ON pg.creado_por = u.id
             LEFT JOIN nl_fin_cuentas c ON c.id = pg.cuenta_id
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
        const montoPagadoCaja = pagos
            .filter((pago) => pago.tipo_fondo === 'caja')
            .reduce((sum, pago) => sum + (Number.isNaN(pago.monto) ? 0 : pago.monto), 0);
        const montoPagadoBancos = pagos
            .filter((pago) => pago.tipo_fondo === 'banco')
            .reduce((sum, pago) => sum + (Number.isNaN(pago.monto) ? 0 : pago.monto), 0);
        const total = parseFloat(pedido.total || 0);
        const saldo = total - montoPagado;
        const estadoPago = montoPagado >= total ? 'cancelado' : montoPagado > 0 ? 'pago_parcial' : 'por_cancelar';
        const pagosPendientesConciliacion = pagos.filter((pago) => !pago.conciliado).length;

        res.json({
            ...pedido,
            items: itemsResult.rows,
            pagos,
            monto_pagado: montoPagado,
            monto_pagado_caja: montoPagadoCaja,
            monto_pagado_bancos: montoPagadoBancos,
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

        const { monto, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas } = req.body;
        const montoNumber = parseFloat(monto);
        if (!monto || Number.isNaN(montoNumber) || montoNumber <= 0) {
            return res.status(400).json({ error: 'Monto válido es requerido' });
        }

        const metodoPago = metodo || 'transferencia';
        const tipoFondo = tipo_fondo || metodoToTipoFondo(metodoPago);

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

            const cuentaResolution = await resolveCuentaFinanciera(client, {
                cuentaId: cuenta_id || null,
                tipoFondo
            });
            if (cuentaResolution.error) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: cuentaResolution.error });
            }

            const result = await client.query(
                `INSERT INTO nl_pagos (pedido_id, monto, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas, creado_por)
                 VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8, $9)
                 RETURNING *`,
                [
                    req.params.id,
                    montoNumber,
                    metodoPago,
                    tipoFondo,
                    cuentaResolution.cuentaId,
                    referencia || null,
                    fecha_pago || null,
                    notas || null,
                    req.user.id
                ]
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
                    metodo: metodoPago,
                    tipo_fondo: tipoFondo,
                    cuenta_id: cuentaResolution.cuentaId
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

        const { clinica_id, monto_total, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas } = req.body;
        const montoTotalNumber = parseFloat(monto_total);

        if (!clinica_id || isNaN(montoTotalNumber) || montoTotalNumber <= 0) {
            return res.status(400).json({ error: 'Datos inválidos. Se requiere clinica_id y un monto_total mayor a 0.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const metodoPago = metodo || 'transferencia';
            const tipoFondo = tipo_fondo || metodoToTipoFondo(metodoPago);
            const cuentaResolution = await resolveCuentaFinanciera(client, {
                cuentaId: cuenta_id || null,
                tipoFondo
            });
            if (cuentaResolution.error) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: cuentaResolution.error });
            }

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
                    `INSERT INTO nl_pagos (pedido_id, monto, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas, creado_por)
                     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8, $9)
                     RETURNING *`,
                    [
                        order.id, 
                        montoAbonarOrder, 
                        metodoPago,
                        tipoFondo,
                        cuentaResolution.cuentaId,
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
