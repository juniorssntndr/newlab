const buildEstadoPagoCase = (alias = 'p', pagoAlias = 'pg') => `CASE
        WHEN COALESCE(${pagoAlias}.monto_pagado, 0) >= ${alias}.total THEN 'cancelado'
        WHEN COALESCE(${pagoAlias}.monto_pagado, 0) > 0 THEN 'pago_parcial'
        ELSE 'por_cancelar'
    END`;

const resolveCuentaFinancieraWithDb = async (db, { cuentaId, tipoFondo }) => {
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

export const makeFinancePgRepository = ({ pool }) => ({
    listFinanceOrders: async ({ user, filters = {} }) => {
        const { estado_pago, clinica_id, search } = filters;
        const params = [];
        let where = 'WHERE 1=1';

        if (user?.tipo === 'cliente' && user?.clinica_id) {
            params.push(user.clinica_id);
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
        return result.rows;
    },
    listActiveAccounts: async () => {
        const result = await pool.query(
            'SELECT id, nombre, tipo_cuenta, moneda, saldo_inicial, activo FROM nl_fin_cuentas WHERE activo = TRUE ORDER BY tipo_cuenta ASC, nombre ASC'
        );

        return result.rows;
    },
    listMovements: async ({ user, filters = {} }) => {
        const { tipo, tipo_fondo, grupo_gasto, from, to, search, limit } = filters;
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

        if (user?.tipo === 'cliente' && user?.clinica_id) {
            params.push(user.clinica_id);
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

        return result.rows;
    },
    resolveCuentaFinanciera: async ({ cuentaId, tipoFondo }) => resolveCuentaFinancieraWithDb(pool, { cuentaId, tipoFondo }),
    createMovement: async ({ actorUserId, movementInput }) => {
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
        } = movementInput;

        const result = await pool.query(
            `INSERT INTO nl_fin_movimientos (
                tipo, tipo_fondo, cuenta_id, fecha_movimiento, monto, grupo_gasto, categoria_gasto,
                producto_id, clinica_id, descripcion, referencia, creado_por
            )
            VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                tipo,
                tipo_fondo,
                cuenta_id,
                fecha_movimiento || null,
                monto,
                grupo_gasto || null,
                categoria_gasto || null,
                producto_id || null,
                clinica_id || null,
                descripcion || null,
                referencia || null,
                actorUserId
            ]
        );

        return result.rows[0];
    },
    getOrderByIdWithClinic: async ({ orderId }) => {
        const result = await pool.query(
            `SELECT p.*, c.nombre as clinica_nombre, c.ruc as clinica_ruc, c.direccion as clinica_direccion
             FROM nl_pedidos p
             LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
             WHERE p.id = $1`,
            [orderId]
        );

        return result.rows[0] || null;
    },
    listPaymentsByOrderId: async ({ orderId }) => {
        const result = await pool.query(
            `SELECT pg.*, u.nombre as creado_por_nombre, c.nombre as cuenta_nombre
             FROM nl_pagos pg
             LEFT JOIN nl_usuarios u ON pg.creado_por = u.id
             LEFT JOIN nl_fin_cuentas c ON c.id = pg.cuenta_id
             WHERE pg.pedido_id = $1
             ORDER BY pg.fecha_pago DESC, pg.created_at DESC`,
            [orderId]
        );

        return result.rows;
    },
    listOrderItems: async ({ orderId }) => {
        const result = await pool.query(
            `SELECT pi.*, pr.nombre as producto_nombre
             FROM nl_pedido_items pi
             LEFT JOIN nl_productos pr ON pi.producto_id = pr.id
             WHERE pi.pedido_id = $1`,
            [orderId]
        );

        return result.rows;
    },
    registerPayment: async ({ orderId, actorUserId, paymentInput }) => {
        const { monto, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas } = paymentInput;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const pedidoResult = await client.query('SELECT id, codigo, total FROM nl_pedidos WHERE id = $1 FOR UPDATE', [orderId]);
            if (pedidoResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return { notFound: true };
            }

            const pedido = pedidoResult.rows[0];
            const totalPedido = parseFloat(pedido.total || 0);
            const pagosPreviosResult = await client.query(
                'SELECT COALESCE(SUM(monto), 0) as monto_pagado FROM nl_pagos WHERE pedido_id = $1',
                [orderId]
            );
            const montoPagadoActual = parseFloat(pagosPreviosResult.rows[0].monto_pagado || 0);
            const saldoActual = totalPedido - montoPagadoActual;

            if (monto > saldoActual + 0.01) {
                await client.query('ROLLBACK');
                return {
                    exceedsBalance: true,
                    details: {
                        total_pedido: totalPedido,
                        monto_pagado_actual: montoPagadoActual,
                        saldo_actual: Math.max(saldoActual, 0),
                        monto_intentado: monto
                    }
                };
            }

            const cuentaResolution = await resolveCuentaFinancieraWithDb(client, {
                cuentaId: cuenta_id || null,
                tipoFondo: tipo_fondo
            });
            if (cuentaResolution.error) {
                await client.query('ROLLBACK');
                return { accountError: cuentaResolution.error };
            }

            const result = await client.query(
                `INSERT INTO nl_pagos (pedido_id, monto, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas, creado_por)
                 VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8, $9)
                 RETURNING *`,
                [
                    orderId,
                    monto,
                    metodo,
                    tipo_fondo,
                    cuentaResolution.cuentaId,
                    referencia || null,
                    fecha_pago || null,
                    notas || null,
                    actorUserId
                ]
            );

            await client.query('COMMIT');

            return {
                notFound: false,
                pedido,
                cuentaId: cuentaResolution.cuentaId,
                payment: result.rows[0]
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    getClinicById: async ({ clinicaId }) => {
        const result = await pool.query('SELECT id, nombre, ruc FROM nl_clinicas WHERE id = $1', [clinicaId]);
        return result.rows[0] || null;
    },
    listPendingOrdersByClinic: async ({ clinicaId }) => {
        const result = await pool.query(
            `SELECT p.id, p.codigo, p.created_at, p.paciente_nombre, p.total,
                    COALESCE(pg.monto_pagado, 0) as monto_pagado,
                    (p.total - COALESCE(pg.monto_pagado, 0)) as saldo
             FROM nl_pedidos p
             LEFT JOIN (
                 SELECT pedido_id, SUM(monto) as monto_pagado
                 FROM nl_pagos
                 GROUP BY pedido_id
             ) pg ON pg.pedido_id = p.id
             WHERE p.clinica_id = $1 AND (p.total - COALESCE(pg.monto_pagado, 0)) > 0
             ORDER BY p.created_at ASC`,
            [clinicaId]
        );

        return result.rows;
    },
    registerBulkPayments: async ({ actorUserId, bulkInput }) => {
        const { clinica_id, monto_total, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas } = bulkInput;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const metodoPago = metodo || 'transferencia';
            const tipoFondo = tipo_fondo || (String(metodoPago).trim().toLowerCase() === 'efectivo' ? 'caja' : 'banco');
            const cuentaResolution = await resolveCuentaFinancieraWithDb(client, {
                cuentaId: cuenta_id || null,
                tipoFondo
            });

            if (cuentaResolution.error) {
                await client.query('ROLLBACK');
                return { accountError: cuentaResolution.error };
            }

            const ordersResult = await client.query(
                `SELECT p.id, p.codigo, p.total, COALESCE(pg.monto_pagado, 0) as monto_pagado,
                        (p.total - COALESCE(pg.monto_pagado, 0)) as saldo
                 FROM nl_pedidos p
                 LEFT JOIN (
                     SELECT pedido_id, SUM(monto) as monto_pagado
                     FROM nl_pagos
                     GROUP BY pedido_id
                 ) pg ON pg.pedido_id = p.id
                 WHERE p.clinica_id = $1 AND (p.total - COALESCE(pg.monto_pagado, 0)) > 0
                 ORDER BY p.created_at ASC
                 FOR UPDATE OF p`,
                [clinica_id]
            );

            const pendingOrders = ordersResult.rows.map((row) => ({
                ...row,
                total: parseFloat(row.total || 0),
                saldo: parseFloat(row.saldo || 0)
            }));

            let remainingMonto = monto_total;
            const pagosRegistrados = [];

            for (const order of pendingOrders) {
                if (remainingMonto <= 0) break;

                const montoAbonarOrder = Math.min(order.saldo, remainingMonto);
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
                        actorUserId
                    ]
                );

                pagosRegistrados.push({
                    pedido_codigo: order.codigo,
                    monto_abonado: montoAbonarOrder,
                    pago: pagoResult.rows[0]
                });

                remainingMonto -= montoAbonarOrder;
            }

            await client.query('COMMIT');

            return {
                accountError: null,
                cuentaId: cuentaResolution.cuentaId,
                tipoFondo,
                pagosRegistrados,
                remainingMonto
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    getPaymentWithOrderCodeById: async ({ pagoId }) => {
        const result = await pool.query(
            `SELECT pg.*, p.codigo as pedido_codigo
             FROM nl_pagos pg
             LEFT JOIN nl_pedidos p ON p.id = pg.pedido_id
             WHERE pg.id = $1`,
            [pagoId]
        );

        return result.rows[0] || null;
    },
    conciliatePayment: async ({ pagoId, actorUserId }) => {
        const result = await pool.query(
            `UPDATE nl_pagos
             SET conciliado = TRUE,
                 conciliado_at = NOW(),
                 conciliado_por = $1
             WHERE id = $2
             RETURNING *`,
            [actorUserId, pagoId]
        );

        return result.rows[0] || null;
    }
});
