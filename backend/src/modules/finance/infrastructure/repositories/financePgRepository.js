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
            beneficiario,
            producto_id,
            clinica_id,
            descripcion,
            referencia,
            sustento_tipo = 'ninguno',
            sustento_comprobante_tipo,
            sustento_emisor_doc,
            sustento_emisor_razon_social,
            sustento_serie,
            sustento_numero,
            sustento_fecha_emision,
            sustento_archivo_url,
            sustento_nota,
            sustento_observacion
        } = movementInput;

        const result = await pool.query(
            `INSERT INTO nl_fin_movimientos (
                tipo, tipo_fondo, cuenta_id, fecha_movimiento, monto, grupo_gasto, categoria_gasto,
                beneficiario, producto_id, clinica_id, descripcion, referencia,
                sustento_tipo, sustento_comprobante_tipo, sustento_emisor_doc, sustento_emisor_razon_social,
                sustento_serie, sustento_numero, sustento_fecha_emision, sustento_archivo_url,
                sustento_nota, sustento_observacion, creado_por
            )
            VALUES (
                $1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7,
                $8, $9, $10, $11, $12,
                $13, $14, $15, $16,
                $17, $18, $19::date, $20,
                $21, $22, $23
            )
            RETURNING *`,
            [
                tipo,
                tipo_fondo,
                cuenta_id,
                fecha_movimiento || null,
                monto,
                grupo_gasto || null,
                categoria_gasto || null,
                beneficiario || null,
                producto_id || null,
                clinica_id || null,
                descripcion || null,
                referencia || null,
                sustento_tipo || 'ninguno',
                sustento_comprobante_tipo || null,
                sustento_emisor_doc || null,
                sustento_emisor_razon_social || null,
                sustento_serie || null,
                sustento_numero || null,
                sustento_fecha_emision || null,
                sustento_archivo_url || null,
                sustento_nota || null,
                sustento_observacion || null,
                actorUserId
            ]
        );

        return result.rows[0];
    },
    updateMovement: async ({ movementId, movementInput }) => {
        const {
            tipo,
            tipo_fondo,
            cuenta_id,
            fecha_movimiento,
            monto,
            grupo_gasto,
            categoria_gasto,
            beneficiario,
            producto_id,
            clinica_id,
            descripcion,
            referencia,
            sustento_tipo = 'ninguno',
            sustento_comprobante_tipo,
            sustento_emisor_doc,
            sustento_emisor_razon_social,
            sustento_serie,
            sustento_numero,
            sustento_fecha_emision,
            sustento_archivo_url,
            sustento_nota,
            sustento_observacion
        } = movementInput;

        const result = await pool.query(
            `UPDATE nl_fin_movimientos
             SET tipo = $2,
                 tipo_fondo = $3,
                 cuenta_id = $4,
                 fecha_movimiento = COALESCE($5::date, CURRENT_DATE),
                 monto = $6,
                 grupo_gasto = $7,
                 categoria_gasto = $8,
                 beneficiario = $9,
                 producto_id = $10,
                 clinica_id = $11,
                 descripcion = $12,
                 referencia = $13,
                 sustento_tipo = $14,
                 sustento_comprobante_tipo = $15,
                 sustento_emisor_doc = $16,
                 sustento_emisor_razon_social = $17,
                 sustento_serie = $18,
                 sustento_numero = $19,
                 sustento_fecha_emision = $20::date,
                 sustento_archivo_url = $21,
                 sustento_nota = $22,
                 sustento_observacion = $23
             WHERE id = $1
             RETURNING *`,
            [
                movementId,
                tipo,
                tipo_fondo,
                cuenta_id,
                fecha_movimiento || null,
                monto,
                grupo_gasto || null,
                categoria_gasto || null,
                beneficiario || null,
                producto_id || null,
                clinica_id || null,
                descripcion || null,
                referencia || null,
                sustento_tipo || 'ninguno',
                sustento_comprobante_tipo || null,
                sustento_emisor_doc || null,
                sustento_emisor_razon_social || null,
                sustento_serie || null,
                sustento_numero || null,
                sustento_fecha_emision || null,
                sustento_archivo_url || null,
                sustento_nota || null,
                sustento_observacion || null
            ]
        );

        return result.rows[0] || null;
    },
    deleteMovement: async ({ movementId }) => {
        const result = await pool.query(
            'DELETE FROM nl_fin_movimientos WHERE id = $1 RETURNING *',
            [movementId]
        );

        return result.rows[0] || null;
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
            `SELECT pi.*, pr.nombre as producto_nombre, pr.image_url as producto_image_url
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
    },
    registerSaldoFavor: async ({ clinicaId, actorUserId, paymentInput }) => {
        const { monto, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas } = paymentInput;
        const tipoFondo = tipo_fondo || (String(metodo || '').toLowerCase() === 'efectivo' ? 'caja' : 'banco');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const cuentaResolution = await resolveCuentaFinancieraWithDb(client, {
                cuentaId: cuenta_id || null,
                tipoFondo
            });
            if (cuentaResolution.error) {
                await client.query('ROLLBACK');
                return { accountError: cuentaResolution.error };
            }

            const result = await client.query(
                `INSERT INTO nl_pagos (
                    pedido_id, clinica_id, monto, metodo, tipo_fondo, cuenta_id,
                    referencia, fecha_pago, notas, creado_por, es_saldo_favor, saldo_disponible
                )
                VALUES (
                    NULL, $1, $2, $3, $4, $5,
                    $6, COALESCE($7::date, CURRENT_DATE), $8, $9, TRUE, $2
                )
                RETURNING *`,
                [
                    clinicaId,
                    monto,
                    metodo || (tipoFondo === 'caja' ? 'efectivo' : 'transferencia'),
                    tipoFondo,
                    cuentaResolution.cuentaId,
                    referencia || null,
                    fecha_pago || null,
                    notas || 'Cobro a cuenta de clínica (Saldo a Favor)',
                    actorUserId
                ]
            );

            await client.query('COMMIT');
            return { ok: true, data: result.rows[0] };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    listSaldosFavorByClinica: async ({ clinicaId }) => {
        const result = await pool.query(
            `SELECT p.*, c.nombre as clinica_nombre, u.nombre as creado_por_nombre, cu.nombre as cuenta_nombre
             FROM nl_pagos p
             LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
             LEFT JOIN nl_usuarios u ON p.creado_por = u.id
             LEFT JOIN nl_fin_cuentas cu ON p.cuenta_id = cu.id
             WHERE p.clinica_id = $1 AND p.es_saldo_favor = TRUE AND p.saldo_disponible > 0
             ORDER BY p.fecha_pago DESC, p.id DESC`,
            [clinicaId]
        );
        return result.rows;
    },
    aplicarSaldoFavor: async ({ pagoOrigenId, pedidoDestinoId, montoAplicado, notas, actorUserId }) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Lock and verify origin payment
            const pagoOrigenRes = await client.query(
                `SELECT * FROM nl_pagos WHERE id = $1 AND es_saldo_favor = TRUE FOR UPDATE`,
                [pagoOrigenId]
            );
            if (pagoOrigenRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return { ok: false, status: 404, error: 'El saldo a favor de origen no existe.' };
            }

            const pagoOrigen = pagoOrigenRes.rows[0];
            const saldoDisponible = parseFloat(pagoOrigen.saldo_disponible || 0);
            if (montoAplicado > saldoDisponible + 0.001) {
                await client.query('ROLLBACK');
                return {
                    ok: false,
                    status: 400,
                    error: `El monto a aplicar (S/. ${montoAplicado.toFixed(2)}) supera el saldo disponible (S/. ${saldoDisponible.toFixed(2)}).`
                };
            }

            // 2. Lock and verify destination order
            const pedidoRes = await client.query(
                `SELECT id, codigo, clinica_id, total FROM nl_pedidos WHERE id = $1 FOR UPDATE`,
                [pedidoDestinoId]
            );
            if (pedidoRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return { ok: false, status: 404, error: 'El pedido de destino no existe.' };
            }

            const pedido = pedidoRes.rows[0];
            if (pedido.clinica_id !== pagoOrigen.clinica_id) {
                await client.query('ROLLBACK');
                return { ok: false, status: 400, error: 'El saldo a favor y el pedido deben pertenecer a la misma clínica.' };
            }

            // 3. Check order outstanding balance
            const pagosPrevios = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as pagado FROM nl_pagos WHERE pedido_id = $1`,
                [pedidoDestinoId]
            );
            const totalPedido = parseFloat(pedido.total || 0);
            const montoPagado = parseFloat(pagosPrevios.rows[0].pagado || 0);
            const saldoPedido = Math.max(0, totalPedido - montoPagado);

            if (montoAplicado > saldoPedido + 0.01) {
                await client.query('ROLLBACK');
                return {
                    ok: false,
                    status: 400,
                    error: `El monto a aplicar (S/. ${montoAplicado.toFixed(2)}) supera el saldo pendiente del pedido #${pedido.codigo} (S/. ${saldoPedido.toFixed(2)}).`
                };
            }

            // 4. Update origin payment balance
            await client.query(
                `UPDATE nl_pagos
                 SET saldo_disponible = saldo_disponible - $1
                 WHERE id = $2`,
                [montoAplicado, pagoOrigenId]
            );

            // 5. Record application log
            const aplicacionRes = await client.query(
                `INSERT INTO nl_saldo_favor_aplicaciones (
                    pago_origen_id, pedido_destino_id, clinica_id, monto_aplicado, fecha_aplicacion, notas, creado_por
                )
                VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6)
                RETURNING *`,
                [
                    pagoOrigenId,
                    pedidoDestinoId,
                    pedido.clinica_id,
                    montoAplicado,
                    notas || `Aplicación de saldo a favor #${pagoOrigenId}`,
                    actorUserId
                ]
            );

            // 6. Insert order payment record referencing the saldo
            const pagoPedidoRes = await client.query(
                `INSERT INTO nl_pagos (
                    pedido_id, clinica_id, monto, metodo, tipo_fondo, cuenta_id,
                    referencia, fecha_pago, notas, creado_por, es_saldo_favor, saldo_disponible
                )
                VALUES (
                    $1, $2, $3, 'saldo_favor', $4, $5,
                    $6, CURRENT_DATE, $7, $8, FALSE, 0
                )
                RETURNING *`,
                [
                    pedidoDestinoId,
                    pedido.clinica_id,
                    montoAplicado,
                    pagoOrigen.tipo_fondo,
                    pagoOrigen.cuenta_id,
                    `Saldo a favor #${pagoOrigenId}`,
                    notas || `Abono por aplicación de saldo a favor #${pagoOrigenId}`,
                    actorUserId
                ]
            );

            await client.query('COMMIT');
            return {
                ok: true,
                status: 201,
                data: {
                    aplicacion: aplicacionRes.rows[0],
                    pago_pedido: pagoPedidoRes.rows[0],
                    saldo_restante_origen: saldoDisponible - montoAplicado,
                    saldo_restante_pedido: Math.max(0, saldoPedido - montoAplicado)
                }
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    listAplicacionesSaldoFavor: async ({ clinicaId }) => {
        const result = await pool.query(
            `SELECT a.*, p.codigo as pedido_codigo, u.nombre as creado_por_nombre
             FROM nl_saldo_favor_aplicaciones a
             LEFT JOIN nl_pedidos p ON a.pedido_destino_id = p.id
             LEFT JOIN nl_usuarios u ON a.creado_por = u.id
             WHERE a.clinica_id = $1
             ORDER BY a.fecha_aplicacion DESC, a.id DESC`,
            [clinicaId]
        );
        return result.rows;
    },
    getActiveCashSession: async () => {
        // Look for open session
        const sessionRes = await pool.query(
            `SELECT s.*, u.nombre as abierto_por_nombre
             FROM nl_fin_sesiones_caja s
             LEFT JOIN nl_usuarios u ON s.abierto_por = u.id
             WHERE s.estado = 'abierta'
             ORDER BY s.fecha DESC, s.id DESC
             LIMIT 1`
        );

        let session = sessionRes.rows[0] || null;
        const targetDate = session ? session.fecha : new Date().toISOString().split('T')[0];

        // Compute live metrics for the target date
        // 1. Ingresos en efectivo (Pagos de pedidos y anticipos que no sean método saldo_favor interno)
        const ingresosEfectivoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_pagos
             WHERE tipo_fondo = 'caja'
               AND (metodo IS NULL OR metodo != 'saldo_favor')
               AND fecha_pago = $1::date`,
            [targetDate]
        );

        // 2. Movimientos extra de ingreso en efectivo
        const movIngresosEfectivoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_fin_movimientos
             WHERE tipo = 'ingreso' AND tipo_fondo = 'caja' AND fecha_movimiento = $1::date`,
            [targetDate]
        );

        // 3. Egresos en efectivo
        const egresosEfectivoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_fin_movimientos
             WHERE tipo = 'egreso' AND tipo_fondo = 'caja' AND fecha_movimiento = $1::date`,
            [targetDate]
        );

        // 4. Ingresos en banco
        const ingresosBancoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_pagos
             WHERE tipo_fondo = 'banco'
               AND (metodo IS NULL OR metodo != 'saldo_favor')
               AND fecha_pago = $1::date`,
            [targetDate]
        );

        const movIngresosBancoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_fin_movimientos
             WHERE tipo = 'ingreso' AND tipo_fondo = 'banco' AND fecha_movimiento = $1::date`,
            [targetDate]
        );

        // 5. Egresos en banco
        const egresosBancoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_fin_movimientos
             WHERE tipo = 'egreso' AND tipo_fondo = 'banco' AND fecha_movimiento = $1::date`,
            [targetDate]
        );

        const totalIngresosEfectivo = parseFloat(ingresosEfectivoRes.rows[0].total || 0) + parseFloat(movIngresosEfectivoRes.rows[0].total || 0);
        const totalEgresosEfectivo = parseFloat(egresosEfectivoRes.rows[0].total || 0);
        const totalIngresosBanco = parseFloat(ingresosBancoRes.rows[0].total || 0) + parseFloat(movIngresosBancoRes.rows[0].total || 0);
        const totalEgresosBanco = parseFloat(egresosBancoRes.rows[0].total || 0);

        const montoApertura = session ? parseFloat(session.monto_apertura || 0) : 0;
        const montoEsperadoEfectivo = montoApertura + totalIngresosEfectivo - totalEgresosEfectivo;

        return {
            hasActiveSession: Boolean(session),
            session,
            targetDate,
            resumenEnVivo: {
                monto_apertura: montoApertura,
                total_ingresos_efectivo: totalIngresosEfectivo,
                total_egresos_efectivo: totalEgresosEfectivo,
                saldo_teorico_efectivo: montoEsperadoEfectivo,
                total_ingresos_banco: totalIngresosBanco,
                total_egresos_banco: totalEgresosBanco,
                balance_neto_banco: totalIngresosBanco - totalEgresosBanco,
                balance_neto_dia: (totalIngresosEfectivo - totalEgresosEfectivo) + (totalIngresosBanco - totalEgresosBanco)
            }
        };
    },
    openCashSession: async ({ montoApertura = 0, turno = 'general', fecha, actorUserId }) => {
        const targetFecha = fecha || new Date().toISOString().split('T')[0];

        // Check if there is already an open session for the date/shift
        const existingRes = await pool.query(
            `SELECT id FROM nl_fin_sesiones_caja WHERE estado = 'abierta' LIMIT 1`
        );
        if (existingRes.rows.length > 0) {
            return { ok: false, status: 400, error: 'Ya existe una sesión de caja abierta actualmente. Ciérrala antes de abrir una nueva.' };
        }

        const result = await pool.query(
            `INSERT INTO nl_fin_sesiones_caja (
                fecha, turno, monto_apertura, estado, abierto_por, abierto_at
            )
            VALUES (
                $1::date, $2, $3, 'abierta', $4, NOW()
            )
            RETURNING *`,
            [targetFecha, turno, montoApertura, actorUserId]
        );

        return { ok: true, status: 201, data: result.rows[0] };
    },
    closeCashSession: async ({ sesionId, montoRealEfectivo, observacionesCierre, actorUserId }) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const sessionRes = await client.query(
                `SELECT * FROM nl_fin_sesiones_caja WHERE id = $1 FOR UPDATE`,
                [sesionId]
            );
            if (sessionRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return { ok: false, status: 404, error: 'Sesión de caja no encontrada' };
            }

            const session = sessionRes.rows[0];
            if (session.estado === 'cerrada') {
                await client.query('ROLLBACK');
                return { ok: false, status: 400, error: 'La sesión de caja ya se encuentra cerrada' };
            }

            // Calculate exact figures for that session date
            const ingresosEfRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_pagos WHERE tipo_fondo = 'caja' AND (metodo IS NULL OR metodo != 'saldo_favor') AND fecha_pago = $1::date`,
                [session.fecha]
            );
            const movIngresosEfRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_fin_movimientos WHERE tipo = 'ingreso' AND tipo_fondo = 'caja' AND fecha_movimiento = $1::date`,
                [session.fecha]
            );
            const egresosEfRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_fin_movimientos WHERE tipo = 'egreso' AND tipo_fondo = 'caja' AND fecha_movimiento = $1::date`,
                [session.fecha]
            );

            const ingresosBcoRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_pagos WHERE tipo_fondo = 'banco' AND (metodo IS NULL OR metodo != 'saldo_favor') AND fecha_pago = $1::date`,
                [session.fecha]
            );
            const movIngresosBcoRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_fin_movimientos WHERE tipo = 'ingreso' AND tipo_fondo = 'banco' AND fecha_movimiento = $1::date`,
                [session.fecha]
            );
            const egresosBcoRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_fin_movimientos WHERE tipo = 'egreso' AND tipo_fondo = 'banco' AND fecha_movimiento = $1::date`,
                [session.fecha]
            );

            const totalIngresosEf = parseFloat(ingresosEfRes.rows[0].total || 0) + parseFloat(movIngresosEfRes.rows[0].total || 0);
            const totalEgresosEf = parseFloat(egresosEfRes.rows[0].total || 0);
            const totalIngresosBco = parseFloat(ingresosBcoRes.rows[0].total || 0) + parseFloat(movIngresosBcoRes.rows[0].total || 0);
            const totalEgresosBco = parseFloat(egresosBcoRes.rows[0].total || 0);

            const montoApertura = parseFloat(session.monto_apertura || 0);
            const montoEsperadoEf = montoApertura + totalIngresosEf - totalEgresosEf;
            const montoRealEfNumber = parseFloat(montoRealEfectivo || 0);
            const diferencia = montoRealEfNumber - montoEsperadoEf;

            const updateRes = await client.query(
                `UPDATE nl_fin_sesiones_caja
                 SET estado = 'cerrada',
                     monto_esperado_efectivo = $1,
                     monto_real_efectivo = $2,
                     diferencia_efectivo = $3,
                     total_ingresos_efectivo = $4,
                     total_egresos_efectivo = $5,
                     total_ingresos_banco = $6,
                     total_egresos_banco = $7,
                     observaciones_cierre = $8,
                     cerrado_por = $9,
                     cerrado_at = NOW()
                 WHERE id = $10
                 RETURNING *`,
                [
                    montoEsperadoEf,
                    montoRealEfNumber,
                    diferencia,
                    totalIngresosEf,
                    totalEgresosEf,
                    totalIngresosBco,
                    totalEgresosBco,
                    observacionesCierre || null,
                    actorUserId,
                    sesionId
                ]
            );

            await client.query('COMMIT');
            return { ok: true, status: 200, data: updateRes.rows[0] };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    reopenCashSession: async ({ sesionId, motivo, actorUserId }) => {
        const result = await pool.query(
            `UPDATE nl_fin_sesiones_caja
             SET estado = 'abierta',
                 reabierto_por = $1,
                 reabierto_at = NOW(),
                 reabierto_motivo = $2
             WHERE id = $3
             RETURNING *`,
            [actorUserId, motivo || 'Reapertura autorizada por administración', sesionId]
        );

        if (result.rows.length === 0) {
            return { ok: false, status: 404, error: 'Sesión no encontrada' };
        }

        return { ok: true, status: 200, data: result.rows[0] };
    },
    listCashSessions: async ({ limit = 30, offset = 0 } = {}) => {
        const result = await pool.query(
            `SELECT s.*,
                    u1.nombre as abierto_por_nombre,
                    u2.nombre as cerrado_por_nombre,
                    u3.nombre as reabierto_por_nombre
             FROM nl_fin_sesiones_caja s
             LEFT JOIN nl_usuarios u1 ON s.abierto_por = u1.id
             LEFT JOIN nl_usuarios u2 ON s.cerrado_por = u2.id
             LEFT JOIN nl_usuarios u3 ON s.reabierto_por = u3.id
             ORDER BY s.fecha DESC, s.id DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows;
    },
    getCobranzasOverview: async () => {
        const result = await pool.query(
            `WITH pedidos_saldos AS (
                SELECT
                    p.id,
                    p.codigo,
                    p.clinica_id,
                    p.total,
                    COALESCE(SUM(pg.monto), 0) as pagado,
                    p.total - COALESCE(SUM(pg.monto), 0) as saldo,
                    p.fecha_entrega,
                    p.created_at,
                    CURRENT_DATE - COALESCE(p.fecha_entrega, p.created_at::date) as dias_antiguedad
                FROM nl_pedidos p
                LEFT JOIN nl_pagos pg ON pg.pedido_id = p.id
                WHERE p.estado != 'anulado'
                GROUP BY p.id, p.codigo, p.clinica_id, p.total, p.fecha_entrega, p.created_at
                HAVING (p.total - COALESCE(SUM(pg.monto), 0)) > 0.01
            ),
            saldos_favor AS (
                SELECT
                    clinica_id,
                    COALESCE(SUM(saldo_disponible), 0) as total_saldo_favor
                FROM nl_pagos
                WHERE es_saldo_favor = TRUE AND saldo_disponible > 0
                GROUP BY clinica_id
            ),
            ultimos_pagos AS (
                SELECT
                    clinica_id,
                    MAX(fecha_pago) as ultima_fecha_pago
                FROM nl_pagos
                WHERE clinica_id IS NOT NULL
                GROUP BY clinica_id
            )
            SELECT
                c.id as clinica_id,
                c.nombre as clinica_nombre,
                c.ruc as clinica_ruc,
                c.telefono as clinica_telefono,
                c.email as clinica_email,
                c.contacto_nombre as clinica_contacto,
                COALESCE(COUNT(ps.id), 0) as pedidos_pendientes_count,
                COALESCE(SUM(ps.saldo), 0) as total_deuda,
                COALESCE(SUM(CASE WHEN ps.dias_antiguedad <= 15 THEN ps.saldo ELSE 0 END), 0) as deuda_0_15,
                COALESCE(SUM(CASE WHEN ps.dias_antiguedad > 15 AND ps.dias_antiguedad <= 30 THEN ps.saldo ELSE 0 END), 0) as deuda_15_30,
                COALESCE(SUM(CASE WHEN ps.dias_antiguedad > 30 THEN ps.saldo ELSE 0 END), 0) as deuda_30_mas,
                COALESCE(sf.total_saldo_favor, 0) as saldo_favor_disponible,
                GREATEST(0, COALESCE(SUM(ps.saldo), 0) - COALESCE(sf.total_saldo_favor, 0)) as deuda_neta,
                up.ultima_fecha_pago
            FROM nl_clinicas c
            LEFT JOIN pedidos_saldos ps ON ps.clinica_id = c.id
            LEFT JOIN saldos_favor sf ON sf.clinica_id = c.id
            LEFT JOIN ultimos_pagos up ON up.clinica_id = c.id
            WHERE ps.id IS NOT NULL OR sf.total_saldo_favor > 0
            GROUP BY c.id, c.nombre, c.ruc, c.telefono, c.email, c.contacto_nombre, sf.total_saldo_favor, up.ultima_fecha_pago
            ORDER BY deuda_neta DESC, total_deuda DESC`
        );
        return result.rows;
    },
    getClinicDebtDetail: async ({ clinicaId }) => {
        const [ordersRes, saldosFavorRes] = await Promise.all([
            pool.query(
                `SELECT
                    p.id,
                    p.codigo,
                    p.paciente_nombre,
                    p.doctor_nombre,
                    p.fecha_entrega,
                    p.created_at,
                    p.total,
                    COALESCE(SUM(pg.monto), 0) as pagado,
                    p.total - COALESCE(SUM(pg.monto), 0) as saldo,
                    CURRENT_DATE - COALESCE(p.fecha_entrega, p.created_at::date) as dias_antiguedad
                FROM nl_pedidos p
                LEFT JOIN nl_pagos pg ON pg.pedido_id = p.id
                WHERE p.clinica_id = $1 AND p.estado != 'anulado'
                GROUP BY p.id, p.codigo, p.paciente_nombre, p.doctor_nombre, p.fecha_entrega, p.created_at, p.total
                HAVING (p.total - COALESCE(SUM(pg.monto), 0)) > 0.01
                ORDER BY p.fecha_entrega ASC, p.created_at ASC`,
                [clinicaId]
            ),
            pool.query(
                `SELECT p.*, cu.nombre as cuenta_nombre
                 FROM nl_pagos p
                 LEFT JOIN nl_fin_cuentas cu ON p.cuenta_id = cu.id
                 WHERE p.clinica_id = $1 AND p.es_saldo_favor = TRUE AND p.saldo_disponible > 0
                 ORDER BY p.fecha_pago DESC`,
                [clinicaId]
            )
        ]);

        return {
            pedidos_pendientes: ordersRes.rows,
            saldos_favor: saldosFavorRes.rows
        };
    }
});
