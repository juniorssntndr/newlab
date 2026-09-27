const buildEstadoPagoCase = (alias = 'p', pagoAlias = 'pg') => `CASE
        WHEN COALESCE(${pagoAlias}.monto_pagado, 0) >= ${alias}.total THEN 'cancelado'
        WHEN COALESCE(${pagoAlias}.monto_pagado, 0) > 0 THEN 'pago_parcial'
        ELSE 'por_cancelar'
    END`;

const getLimaDateString = (d = new Date()) => {
    try {
        return new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'America/Lima', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(d);
    } catch {
        const limaDate = new Date(d.getTime() - 5 * 60 * 60 * 1000);
        return limaDate.toISOString().split('T')[0];
    }
};

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
            SELECT p.*, c.nombre as clinica_nombre, c.ruc as clinica_ruc, c.razon_social as clinica_razon_social, c.dni as clinica_dni,
                   (
                     SELECT pr.nombre
                     FROM nl_pedido_items pi
                     JOIN nl_productos pr ON pi.producto_id = pr.id
                     WHERE pi.pedido_id = p.id
                     ORDER BY pi.id ASC
                     LIMIT 1
                   ) as producto_principal,
                   (
                     SELECT pr.image_url
                     FROM nl_pedido_items pi
                     JOIN nl_productos pr ON pi.producto_id = pr.id
                     WHERE pi.pedido_id = p.id
                     ORDER BY pi.id ASC
                     LIMIT 1
                   ) as producto_image_url,
                   (
                     SELECT pi.piezas_dentales
                     FROM nl_pedido_items pi
                     WHERE pi.pedido_id = p.id
                     ORDER BY pi.id ASC
                     LIMIT 1
                   ) as producto_piezas,
                   (
                     SELECT COALESCE(pi.cantidad, cardinality(pi.piezas_dentales), 1)
                     FROM nl_pedido_items pi
                     WHERE pi.pedido_id = p.id
                     ORDER BY pi.id ASC
                     LIMIT 1
                   ) as producto_cantidad,
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
        let where = "WHERE 1=1 AND m.tipo IN ('ingreso', 'egreso') AND COALESCE(m.grupo_gasto, '') != 'patrimonio_socio'";

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
            where += ` AND (m.categoria_gasto ILIKE $${params.length} OR m.descripcion ILIKE $${params.length} OR m.referencia ILIKE $${params.length} OR m.beneficiario ILIKE $${params.length} OR COALESCE(m.pedido_codigo, '') ILIKE $${params.length} OR COALESCE(m.sustento_numero, '') ILIKE $${params.length})`;
        }

        if (user?.tipo === 'cliente' && user?.clinica_id) {
            params.push(user.clinica_id);
            where += ` AND m.clinica_id = $${params.length}`;
        }

        const queryLimit = Math.min(Math.max(parseInt(limit || 80, 10), 1), 300);
        params.push(queryLimit);

        const result = await pool.query(
            `SELECT m.*
             FROM (
                 SELECT 
                     m.id,
                     'movimiento'::text as origen,
                     m.tipo,
                     m.tipo_fondo,
                     m.cuenta_id,
                     m.fecha_movimiento,
                     m.monto,
                     m.grupo_gasto,
                     m.categoria_gasto,
                     m.beneficiario,
                     m.descripcion,
                     m.referencia,
                     m.sustento_tipo,
                     m.sustento_comprobante_tipo,
                     m.sustento_serie,
                     m.sustento_numero,
                     m.sustento_emisor_doc,
                     m.sustento_emisor_razon_social,
                     m.sustento_archivo_url,
                     m.sustento_observacion,
                     m.clinica_id,
                     m.creado_por,
                     m.created_at,
                     c.nombre as cuenta_nombre,
                     c.tipo_cuenta,
                     u.nombre as creado_por_nombre,
                     COALESCE(pr.nombre, ped_info.producto_nombre) as producto_nombre,
                     ped_info.pedido_codigo as pedido_codigo,
                     ped_info.paciente_nombre as paciente_nombre,
                     COALESCE(ped_info.metodo_pago, NULL::text) as metodo_pago,
                     ped_info.pedido_id as pedido_id,
                     m.sesion_caja_id,
                     ped_info.estado_sunat as estado_sunat,
                     COALESCE(ped_info.producto_cantidad, 1) as producto_cantidad
                 FROM nl_fin_movimientos m
                 LEFT JOIN nl_fin_cuentas c ON c.id = m.cuenta_id
                 LEFT JOIN nl_usuarios u ON u.id = m.creado_por
                 LEFT JOIN nl_productos pr ON pr.id = m.producto_id
                 LEFT JOIN LATERAL (
                     SELECT 
                         p.pedido_id,
                         ped.codigo as pedido_codigo,
                         ped.paciente_nombre,
                         p.metodo as metodo_pago,
                         (
                             SELECT pr_sub.nombre
                             FROM nl_pedido_items pi_sub
                             JOIN nl_productos pr_sub ON pi_sub.producto_id = pr_sub.id
                             WHERE pi_sub.pedido_id = ped.id
                             ORDER BY pi_sub.id ASC LIMIT 1
                         ) as producto_nombre,
                         (
                             SELECT COALESCE(pi_sub.cantidad, cardinality(pi_sub.piezas_dentales), 1)
                             FROM nl_pedido_items pi_sub
                             WHERE pi_sub.pedido_id = ped.id
                             ORDER BY pi_sub.id ASC LIMIT 1
                         ) as producto_cantidad,
                         comp.estado_sunat
                     FROM nl_pagos p
                     JOIN nl_pedidos ped ON ped.id = p.pedido_id
                     LEFT JOIN LATERAL (
                         SELECT estado_sunat
                         FROM nl_comprobantes
                         WHERE pedido_id = ped.id AND estado_sunat != 'anulado'
                         ORDER BY id DESC LIMIT 1
                     ) comp ON true
                     WHERE p.movimiento_id = m.id
                     ORDER BY p.id ASC LIMIT 1
                 ) ped_info ON true

                 UNION ALL

                 SELECT
                     p.id,
                     'pago_pedido'::text as origen,
                     'ingreso'::text as tipo,
                     COALESCE(p.tipo_fondo, CASE WHEN LOWER(p.metodo) = 'efectivo' THEN 'caja' ELSE 'banco' END) as tipo_fondo,
                     p.cuenta_id,
                     p.fecha_pago as fecha_movimiento,
                     p.monto,
                     'ingreso_operativo'::text as grupo_gasto,
                     'cobro_pedido'::text as categoria_gasto,
                     COALESCE(cl.nombre, 'Cliente') as beneficiario,
                     CASE 
                         WHEN ped.codigo IS NOT NULL THEN COALESCE(CONCAT('Paciente: ', ped.paciente_nombre), 'Trabajo de laboratorio')
                         ELSE COALESCE(p.notas, 'Cobro a cuenta de cliente')
                     END as descripcion,
                     p.referencia,
                     CASE WHEN comp.tipo_comprobante IS NOT NULL OR p.notas ILIKE '%[Factura%' OR p.notas ILIKE '%[Boleta%' THEN 'fiscal'::text ELSE 'simple'::text END as sustento_tipo,
                     COALESCE(
                         comp.tipo_comprobante,
                         CASE 
                             WHEN p.notas ILIKE '%[Factura%' THEN '01'
                             WHEN p.notas ILIKE '%[Boleta%' THEN '03'
                             ELSE '00'
                         END
                     ) as sustento_comprobante_tipo,
                     COALESCE(
                         comp.serie,
                         CASE 
                             WHEN p.notas ILIKE '%[Factura%' THEN 'F001'
                             WHEN p.notas ILIKE '%[Boleta%' THEN 'B001'
                             ELSE 'NV'
                         END
                     ) as sustento_serie,
                     COALESCE(
                         CASE 
                             WHEN comp.serie IS NOT NULL AND comp.correlativo IS NOT NULL 
                             THEN CONCAT(comp.serie, '-', LPAD(comp.correlativo::text, 8, '0'))
                             ELSE NULL
                         END,
                         CASE 
                             WHEN p.notas ILIKE '%[Factura%' THEN CONCAT('F001-', LPAD(p.id::text, 6, '0'))
                             WHEN p.notas ILIKE '%[Boleta%' THEN CONCAT('B001-', LPAD(p.id::text, 6, '0'))
                             ELSE CONCAT('NV-', LPAD(p.id::text, 6, '0'))
                         END
                     ) as sustento_numero,
                     COALESCE(comp.receptor_documento, NULL::text) as sustento_emisor_doc,
                     COALESCE(comp.receptor_razon_social, NULL::text) as sustento_emisor_razon_social,
                     COALESCE(comp.pdf_url, NULL::text) as sustento_archivo_url,
                     p.notas as sustento_observacion,
                     p.clinica_id,
                     p.creado_por,
                     p.created_at,
                     c.nombre as cuenta_nombre,
                     c.tipo_cuenta,
                     u.nombre as creado_por_nombre,
                     (
                         SELECT pr_sub.nombre
                         FROM nl_pedido_items pi_sub
                         JOIN nl_productos pr_sub ON pi_sub.producto_id = pr_sub.id
                         WHERE pi_sub.pedido_id = ped.id
                         ORDER BY pi_sub.id ASC LIMIT 1
                     ) as producto_nombre,
                     ped.codigo as pedido_codigo,
                     ped.paciente_nombre as paciente_nombre,
                     p.metodo as metodo_pago,
                     p.pedido_id,
                     p.sesion_caja_id,
                     comp.estado_sunat,
                     (
                         SELECT COALESCE(pi_sub.cantidad, cardinality(pi_sub.piezas_dentales), 1)
                         FROM nl_pedido_items pi_sub
                         WHERE pi_sub.pedido_id = ped.id
                         ORDER BY pi_sub.id ASC LIMIT 1
                     ) as producto_cantidad
                 FROM nl_pagos p
                 LEFT JOIN nl_pedidos ped ON ped.id = p.pedido_id
                 LEFT JOIN LATERAL (
                     SELECT tipo_comprobante, serie, correlativo, estado_sunat, receptor_documento, receptor_razon_social, pdf_url
                     FROM nl_comprobantes
                     WHERE pedido_id = ped.id AND estado_sunat != 'anulado'
                     ORDER BY id DESC LIMIT 1
                 ) comp ON true
                 LEFT JOIN nl_clinicas cl ON cl.id = p.clinica_id
                 LEFT JOIN nl_fin_cuentas c ON c.id = p.cuenta_id
                 LEFT JOIN nl_usuarios u ON u.id = p.creado_por
                 WHERE (p.metodo IS NULL OR p.metodo != 'saldo_favor') AND p.movimiento_id IS NULL
             ) m
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

        let sesionCajaId = null;
        try {
            const sesionRes = await pool.query(`SELECT id FROM nl_fin_sesiones_caja WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1`);
            sesionCajaId = sesionRes.rows[0]?.id || null;
        } catch {
            // non-blocking
        }

        const result = await pool.query(
            `INSERT INTO nl_fin_movimientos (
                tipo, tipo_fondo, cuenta_id, fecha_movimiento, monto, grupo_gasto, categoria_gasto,
                beneficiario, producto_id, clinica_id, descripcion, referencia,
                sustento_tipo, sustento_comprobante_tipo, sustento_emisor_doc, sustento_emisor_razon_social,
                sustento_serie, sustento_numero, sustento_fecha_emision, sustento_archivo_url,
                sustento_nota, sustento_observacion, creado_por, sesion_caja_id
            )
            VALUES (
                $1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7,
                $8, $9, $10, $11, $12,
                $13, $14, $15, $16,
                $17, $18, $19::date, $20,
                $21, $22, $23, $24
            )
            RETURNING *`,
            [
                tipo,
                tipo_fondo,
                cuenta_id,
                fecha_movimiento || getLimaDateString(new Date()),
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
                actorUserId,
                sesionCajaId
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
        const { monto, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas, descuento, motivo_descuento } = paymentInput;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const pedidoResult = await client.query('SELECT id, codigo, total, subtotal, igv, observaciones FROM nl_pedidos WHERE id = $1 FOR UPDATE', [orderId]);
            if (pedidoResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return { notFound: true };
            }

            const pedido = pedidoResult.rows[0];
            let totalPedido = parseFloat(pedido.total || 0);
            const pagosPreviosResult = await client.query(
                'SELECT COALESCE(SUM(monto), 0) as monto_pagado FROM nl_pagos WHERE pedido_id = $1',
                [orderId]
            );
            const montoPagadoActual = parseFloat(pagosPreviosResult.rows[0].monto_pagado || 0);
            let saldoActual = totalPedido - montoPagadoActual;

            // Manejo de Descuento Comercial si fue provisto
            const descuentoNum = parseFloat(descuento || 0);
            if (descuentoNum > 0) {
                if (descuentoNum > saldoActual + 0.01) {
                    await client.query('ROLLBACK');
                    return {
                        accountError: `El descuento (S/. ${descuentoNum.toFixed(2)}) no puede exceder el saldo actual del pedido (S/. ${saldoActual.toFixed(2)})`
                    };
                }

                const nuevoTotal = Math.max(0, Math.round((totalPedido - descuentoNum) * 100) / 100);
                const nuevoSubtotal = Math.round((nuevoTotal / 1.18) * 100) / 100;
                const nuevoIgv = Math.round((nuevoTotal - nuevoSubtotal) * 100) / 100;
                const obsNota = `\n[Descuento comercial: S/. ${descuentoNum.toFixed(2)} (${motivo_descuento || 'Ajuste en mostrador'}). Total ajustado de S/. ${totalPedido.toFixed(2)} a S/. ${nuevoTotal.toFixed(2)}]`;
                const nuevasObs = ((pedido.observaciones || '') + obsNota).trim();

                await client.query(
                    'UPDATE nl_pedidos SET total = $1, subtotal = $2, igv = $3, observaciones = $4, updated_at = NOW() WHERE id = $5',
                    [nuevoTotal, nuevoSubtotal, nuevoIgv, nuevasObs, orderId]
                );

                totalPedido = nuevoTotal;
                saldoActual = totalPedido - montoPagadoActual;
                pedido.total = nuevoTotal;
            }

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

            const notaFinal = descuentoNum > 0
                ? ((notas || '') + ` (Descuento comercial: S/. ${descuentoNum.toFixed(2)} - ${motivo_descuento || 'Ajuste en mostrador'})`).trim()
                : (notas || null);

            let sesionCajaId = null;
            try {
                const sesionRes = await client.query(`SELECT id FROM nl_fin_sesiones_caja WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1`);
                sesionCajaId = sesionRes.rows[0]?.id || null;
            } catch {
                // non-blocking
            }

            const result = await client.query(
                `INSERT INTO nl_pagos (pedido_id, monto, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas, creado_por, sesion_caja_id)
                 VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8, $9, $10)
                 RETURNING *`,
                [
                    orderId,
                    monto,
                    metodo,
                    tipo_fondo,
                    cuentaResolution.cuentaId,
                    referencia || null,
                    fecha_pago || null,
                    notaFinal,
                    actorUserId,
                    sesionCajaId
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

            let sesionCajaId = null;
            try {
                const sesionRes = await client.query(`SELECT id FROM nl_fin_sesiones_caja WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1`);
                sesionCajaId = sesionRes.rows[0]?.id || null;
            } catch {
                // non-blocking
            }

            for (const order of pendingOrders) {
                if (remainingMonto <= 0) break;

                const montoAbonarOrder = Math.min(order.saldo, remainingMonto);
                const pagoResult = await client.query(
                    `INSERT INTO nl_pagos (pedido_id, monto, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas, creado_por, sesion_caja_id)
                     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8, $9, $10)
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
                        actorUserId,
                        sesionCajaId
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

            let sesionCajaId = null;
            try {
                const sesionRes = await client.query(`SELECT id FROM nl_fin_sesiones_caja WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1`);
                sesionCajaId = sesionRes.rows[0]?.id || null;
            } catch {
                // non-blocking
            }

            const result = await client.query(
                `INSERT INTO nl_pagos (
                    pedido_id, clinica_id, monto, metodo, tipo_fondo, cuenta_id,
                    referencia, fecha_pago, notas, creado_por, es_saldo_favor, saldo_disponible, sesion_caja_id
                )
                VALUES (
                    NULL, $1, $2, $3, $4, $5,
                    $6, COALESCE($7::date, CURRENT_DATE), $8, $9, TRUE, $2, $10
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
                    actorUserId,
                    sesionCajaId
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
        const todayStr = getLimaDateString(new Date());
        let sessionDateStr = todayStr;
        if (session) {
            if (session.abierto_at) {
                sessionDateStr = getLimaDateString(new Date(session.abierto_at));
            } else if (session.fecha) {
                sessionDateStr = session.fecha instanceof Date ? getLimaDateString(session.fecha) : String(session.fecha).slice(0, 10);
            }
        }
        const sessionFechaCol = session && session.fecha 
            ? (session.fecha instanceof Date ? getLimaDateString(session.fecha) : String(session.fecha).slice(0, 10))
            : todayStr;
        const isCajaTrasnochada = Boolean(session && (sessionDateStr < todayStr || sessionFechaCol < todayStr));
        const targetDate = sessionDateStr;
        const sessionId = session ? session.id : null;

        // Compute live metrics for the target date or session
        // 1. Ingresos en efectivo (Pagos de pedidos y anticipos que no sean método saldo_favor interno y que no tengan movimiento generado)
        const ingresosEfectivoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_pagos
             WHERE tipo_fondo = 'caja'
               AND (metodo IS NULL OR metodo != 'saldo_favor')
               AND movimiento_id IS NULL
               AND (($1::integer IS NOT NULL AND sesion_caja_id = $1) OR ($1::integer IS NULL AND fecha_pago = $2::date))`,
            [sessionId, targetDate]
        );

        // 2. Movimientos extra de ingreso en efectivo (incluye cobros en mostrador registrados en nl_fin_movimientos)
        const movIngresosEfectivoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_fin_movimientos
             WHERE tipo = 'ingreso' AND tipo_fondo = 'caja'
               AND (($1::integer IS NOT NULL AND sesion_caja_id = $1) OR ($1::integer IS NULL AND fecha_movimiento = $2::date))`,
            [sessionId, targetDate]
        );

        // 3. Egresos en efectivo
        const egresosEfectivoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_fin_movimientos
             WHERE tipo = 'egreso' AND tipo_fondo = 'caja'
               AND (($1::integer IS NOT NULL AND sesion_caja_id = $1) OR ($1::integer IS NULL AND fecha_movimiento = $2::date))`,
            [sessionId, targetDate]
        );

        // 4. Ingresos en banco
        const ingresosBancoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_pagos
             WHERE tipo_fondo = 'banco'
               AND (metodo IS NULL OR metodo != 'saldo_favor')
               AND movimiento_id IS NULL
               AND (($1::integer IS NOT NULL AND sesion_caja_id = $1) OR ($1::integer IS NULL AND fecha_pago = $2::date))`,
            [sessionId, targetDate]
        );

        const movIngresosBancoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_fin_movimientos
             WHERE tipo = 'ingreso' AND tipo_fondo = 'banco'
               AND (($1::integer IS NOT NULL AND sesion_caja_id = $1) OR ($1::integer IS NULL AND fecha_movimiento = $2::date))`,
            [sessionId, targetDate]
        );

        // 5. Egresos en banco
        const egresosBancoRes = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total
             FROM nl_fin_movimientos
             WHERE tipo = 'egreso' AND tipo_fondo = 'banco'
               AND (($1::integer IS NOT NULL AND sesion_caja_id = $1) OR ($1::integer IS NULL AND fecha_movimiento = $2::date))`,
            [sessionId, targetDate]
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
            isCajaTrasnochada,
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
        const targetFecha = fecha || getLimaDateString(new Date());

        // Check if there is already an open session for the date/shift
        const existingRes = await pool.query(
            `SELECT id FROM nl_fin_sesiones_caja WHERE estado = 'abierta' LIMIT 1`
        );
        if (existingRes.rows.length > 0) {
            return { ok: false, status: 400, error: 'Ya existe una sesión de caja abierta actualmente. Debes cerrarla antes de abrir una nueva.' };
        }

        const result = await pool.query(
            `INSERT INTO nl_fin_sesiones_caja (
                fecha, turno, monto_apertura, estado, abierto_por, abierto_at
            )
            VALUES (
                $1::date, $2, $3, 'abierta', $4, NOW()
            )
            RETURNING *`,
            [targetFecha, turno || 'general', montoApertura, actorUserId]
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

            // Calculate exact figures for that session (excluding payments that already generated a movement)
            const ingresosEfRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_pagos WHERE tipo_fondo = 'caja' AND (metodo IS NULL OR metodo != 'saldo_favor') AND movimiento_id IS NULL AND (sesion_caja_id = $1 OR (sesion_caja_id IS NULL AND fecha_pago = $2::date))`,
                [session.id, session.fecha]
            );
            const movIngresosEfRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_fin_movimientos WHERE tipo = 'ingreso' AND tipo_fondo = 'caja' AND (sesion_caja_id = $1 OR (sesion_caja_id IS NULL AND fecha_movimiento = $2::date))`,
                [session.id, session.fecha]
            );
            const egresosEfRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_fin_movimientos WHERE tipo = 'egreso' AND tipo_fondo = 'caja' AND (sesion_caja_id = $1 OR (sesion_caja_id IS NULL AND fecha_movimiento = $2::date))`,
                [session.id, session.fecha]
            );

            const ingresosBcoRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_pagos WHERE tipo_fondo = 'banco' AND (metodo IS NULL OR metodo != 'saldo_favor') AND movimiento_id IS NULL AND (sesion_caja_id = $1 OR (sesion_caja_id IS NULL AND fecha_pago = $2::date))`,
                [session.id, session.fecha]
            );
            const movIngresosBcoRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_fin_movimientos WHERE tipo = 'ingreso' AND tipo_fondo = 'banco' AND (sesion_caja_id = $1 OR (sesion_caja_id IS NULL AND fecha_movimiento = $2::date))`,
                [session.id, session.fecha]
            );
            const egresosBcoRes = await client.query(
                `SELECT COALESCE(SUM(monto), 0) as total FROM nl_fin_movimientos WHERE tipo = 'egreso' AND tipo_fondo = 'banco' AND (sesion_caja_id = $1 OR (sesion_caja_id IS NULL AND fecha_movimiento = $2::date))`,
                [session.id, session.fecha]
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
                    p.fecha_entrega,
                    p.created_at,
                    p.total,
                    COALESCE(SUM(pg.monto), 0) as pagado,
                    p.total - COALESCE(SUM(pg.monto), 0) as saldo,
                    CURRENT_DATE - COALESCE(p.fecha_entrega, p.created_at::date) as dias_antiguedad
                FROM nl_pedidos p
                LEFT JOIN nl_pagos pg ON pg.pedido_id = p.id
                WHERE p.clinica_id = $1 AND p.estado != 'anulado'
                GROUP BY p.id, p.codigo, p.paciente_nombre, p.fecha_entrega, p.created_at, p.total
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
    },
    registerConsolidatedPayment: async ({ actorUserId, consolidatedInput }) => {
        const {
            orderPayments = [],
            totalCobrado,
            tipo_fondo = 'caja',
            metodo = 'efectivo',
            cuenta_id,
            fecha_pago,
            referencia,
            comprobante = {},
            beneficiario,
            descripcion
        } = consolidatedInput;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const cuentaResolution = await resolveCuentaFinancieraWithDb(client, {
                cuentaId: cuenta_id || null,
                tipoFondo: tipo_fondo
            });
            if (cuentaResolution.error) {
                await client.query('ROLLBACK');
                return { accountError: cuentaResolution.error };
            }

            let sesionCajaId = null;
            try {
                const sesionRes = await client.query(`SELECT id FROM nl_fin_sesiones_caja WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1`);
                sesionCajaId = sesionRes.rows[0]?.id || null;
            } catch {
                // non-blocking
            }

            const fechaMov = fecha_pago || getLimaDateString(new Date());
            const totalNum = parseFloat(totalCobrado || 0);

            const compObj = comprobante || {};
            const compTipo = compObj.tipo_comprobante || (compObj.tipo === 'factura' ? '01' : (compObj.tipo === 'boleta' ? '03' : consolidatedInput.sustento_comprobante_tipo || '00'));
            const sustentoTipo = (compObj.tipo === 'factura' || compObj.tipo === 'boleta' || ['01', '03'].includes(compTipo) || consolidatedInput.sustento_tipo === 'fiscal') ? 'fiscal' : 'simple';
            const sustentoCompTipo = compTipo;
            const sustentoSerie = compObj.serie || consolidatedInput.sustento_serie || (sustentoCompTipo === '01' ? 'F001' : (sustentoCompTipo === '03' ? 'B001' : 'NV'));
            const sustentoNumero = compObj.numero || consolidatedInput.sustento_numero || `${sustentoSerie}-000000`;
            const emisorDoc = compObj.docIdentidad || consolidatedInput.sustento_emisor_doc || null;
            const emisorRazon = compObj.razonSocial || consolidatedInput.sustento_emisor_razon_social || null;
            const archivoUrl = compObj.pdfUrl || consolidatedInput.sustento_archivo_url || null;

            const movResult = await client.query(
                `INSERT INTO nl_fin_movimientos (
                    tipo, tipo_fondo, cuenta_id, fecha_movimiento, monto,
                    grupo_gasto, categoria_gasto, beneficiario, descripcion,
                    referencia, sustento_tipo, sustento_comprobante_tipo,
                    sustento_serie, sustento_numero, sustento_emisor_doc,
                    sustento_emisor_razon_social, sustento_archivo_url,
                    sesion_caja_id, creado_por
                ) VALUES (
                    'ingreso', $1, $2, COALESCE($3::date, CURRENT_DATE), $4,
                    NULL, 'cobro_pedido', $5, $6,
                    $7, $8, $9,
                    $10, $11, $12,
                    $13, $14,
                    $15, $16
                ) RETURNING *`,
                [
                    tipo_fondo,
                    cuentaResolution.cuentaId,
                    fechaMov,
                    totalNum,
                    beneficiario || 'Cliente Directo',
                    descripcion || 'Cobro consolidado en mostrador',
                    referencia || null,
                    sustentoTipo,
                    sustentoCompTipo,
                    sustentoSerie,
                    sustentoNumero,
                    emisorDoc,
                    emisorRazon,
                    archivoUrl,
                    sesionCajaId,
                    actorUserId
                ]
            );

            const movimiento = movResult.rows[0];

            if (sustentoCompTipo === '00' && (!sustentoNumero || sustentoNumero.includes('000000'))) {
                const nvNumero = `NV-${String(movimiento.id).padStart(6, '0')}`;
                await client.query(
                    `UPDATE nl_fin_movimientos SET sustento_numero = $1 WHERE id = $2`,
                    [nvNumero, movimiento.id]
                );
                movimiento.sustento_numero = nvNumero;
            }

            const pagosRegistrados = [];
            for (const item of orderPayments) {
                const orderId = item.orderId || item.pedido_id;
                const montoNum = parseFloat(item.monto || item.monto_abonado || 0);
                const descuentoNum = parseFloat(item.descuento || item.descuento_aplicado || 0);
                const motivoDescuento = item.motivo_descuento || item.descuento_motivo || null;

                if (montoNum <= 0 && descuentoNum <= 0) continue;

                const pedidoResult = await client.query('SELECT id, codigo, total, subtotal, igv, observaciones FROM nl_pedidos WHERE id = $1 FOR UPDATE', [orderId]);
                if (pedidoResult.rows.length === 0) continue;

                const pedido = pedidoResult.rows[0];
                let totalPedido = parseFloat(pedido.total || 0);

                if (descuentoNum > 0) {
                    const nuevoTotal = Math.max(0, Math.round((totalPedido - descuentoNum) * 100) / 100);
                    const nuevoSubtotal = Math.round((nuevoTotal / 1.18) * 100) / 100;
                    const nuevoIgv = Math.round((nuevoTotal - nuevoSubtotal) * 100) / 100;
                    const obsNota = `\n[Descuento comercial: S/. ${descuentoNum.toFixed(2)} (${motivoDescuento || 'Ajuste en mostrador'}). Total ajustado de S/. ${totalPedido.toFixed(2)} a S/. ${nuevoTotal.toFixed(2)}]`;
                    const nuevasObs = ((pedido.observaciones || '') + obsNota).trim();

                    await client.query(
                        'UPDATE nl_pedidos SET total = $1, subtotal = $2, igv = $3, observaciones = $4, updated_at = NOW() WHERE id = $5',
                        [nuevoTotal, nuevoSubtotal, nuevoIgv, nuevasObs, orderId]
                    );
                }

                let compTag = `[${sustentoCompTipo === '01' ? 'Factura' : sustentoCompTipo === '03' ? 'Boleta' : 'Nota'} ${movimiento.sustento_numero}]`;
                let notaFinal = `Cobro en mostrador - Pedido ${pedido.codigo} ${compTag}`;
                if (descuentoNum > 0) {
                    notaFinal += ` (Descuento comercial: S/. ${descuentoNum.toFixed(2)} - ${motivoDescuento || 'Ajuste en mostrador'})`;
                }

                const pagoResult = await client.query(
                    `INSERT INTO nl_pagos (pedido_id, monto, metodo, tipo_fondo, cuenta_id, referencia, fecha_pago, notas, creado_por, sesion_caja_id, movimiento_id)
                     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8, $9, $10, $11)
                     RETURNING *`,
                    [
                        orderId,
                        montoNum,
                        metodo,
                        tipo_fondo,
                        cuentaResolution.cuentaId,
                        referencia || null,
                        fechaMov,
                        notaFinal,
                        actorUserId,
                        sesionCajaId,
                        movimiento.id
                    ]
                );

                pagosRegistrados.push(pagoResult.rows[0]);
            }

            if (comprobante.comprobanteId && pagosRegistrados.length > 0) {
                await client.query(
                    `UPDATE nl_comprobantes SET pago_id = $1 WHERE id = $2`,
                    [pagosRegistrados[0].id, comprobante.comprobanteId]
                );
            }

            await client.query('COMMIT');

            return {
                ok: true,
                movimiento,
                pagos: pagosRegistrados
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    listAccountsWithBalance: async () => {
        const result = await pool.query(`
            SELECT 
                c.id, 
                c.nombre, 
                c.tipo_cuenta, 
                c.banco, 
                c.numero_cuenta, 
                c.cci, 
                c.moneda, 
                c.saldo_inicial, 
                c.color, 
                c.descripcion, 
                c.activo,
                c.created_at,
                (
                    c.saldo_inicial
                    + COALESCE(p.total_pagos, 0)
                    + COALESCE(mi.total_ingresos, 0)
                    + COALESCE(tr_in.total_transferencias_in, 0)
                    - COALESCE(me.total_egresos, 0)
                    - COALESCE(tr_out.total_transferencias_out, 0)
                ) as saldo_actual
            FROM nl_fin_cuentas c
            LEFT JOIN (
                SELECT cuenta_id, SUM(monto) as total_pagos 
                FROM nl_pagos 
                GROUP BY cuenta_id
            ) p ON p.cuenta_id = c.id
            LEFT JOIN (
                SELECT cuenta_id, SUM(monto) as total_ingresos 
                FROM nl_fin_movimientos 
                WHERE tipo = 'ingreso' 
                GROUP BY cuenta_id
            ) mi ON mi.cuenta_id = c.id
            LEFT JOIN (
                SELECT cuenta_id, SUM(monto) as total_egresos 
                FROM nl_fin_movimientos 
                WHERE tipo IN ('egreso', 'retiro_socio') 
                GROUP BY cuenta_id
            ) me ON me.cuenta_id = c.id
            LEFT JOIN (
                SELECT cuenta_destino_id, SUM(monto) as total_transferencias_in 
                FROM nl_fin_transferencias 
                GROUP BY cuenta_destino_id
            ) tr_in ON tr_in.cuenta_destino_id = c.id
            LEFT JOIN (
                SELECT cuenta_origen_id, SUM(monto) as total_transferencias_out 
                FROM nl_fin_transferencias 
                GROUP BY cuenta_origen_id
            ) tr_out ON tr_out.cuenta_origen_id = c.id
            WHERE c.activo = TRUE
            ORDER BY c.tipo_cuenta ASC, c.nombre ASC
        `);
        return result.rows.map((r) => ({
            ...r,
            saldo_inicial: parseFloat(r.saldo_inicial || 0),
            saldo_actual: parseFloat(r.saldo_actual || 0)
        }));
    },
    createAccount: async ({ nombre, tipo_cuenta, banco, numero_cuenta, cci, moneda, saldo_inicial, color, descripcion }) => {
        const result = await pool.query(
            `INSERT INTO nl_fin_cuentas (nombre, tipo_cuenta, banco, numero_cuenta, cci, moneda, saldo_inicial, color, descripcion, activo)
             VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'PEN'), COALESCE($7, 0.00), COALESCE($8, '#0284c7'), $9, TRUE)
             RETURNING *`,
            [nombre, tipo_cuenta || 'banco', banco || null, numero_cuenta || null, cci || null, moneda, saldo_inicial, color, descripcion || null]
        );
        return result.rows[0];
    },
    updateAccount: async ({ id, nombre, tipo_cuenta, banco, numero_cuenta, cci, moneda, color, descripcion, activo }) => {
        const result = await pool.query(
            `UPDATE nl_fin_cuentas
             SET nombre = COALESCE($2, nombre),
                 tipo_cuenta = COALESCE($3, tipo_cuenta),
                 banco = COALESCE($4, banco),
                 numero_cuenta = COALESCE($5, numero_cuenta),
                 cci = COALESCE($6, cci),
                 moneda = COALESCE($7, moneda),
                 color = COALESCE($8, color),
                 descripcion = COALESCE($9, descripcion),
                 activo = COALESCE($10, activo)
             WHERE id = $1
             RETURNING *`,
            [id, nombre, tipo_cuenta, banco, numero_cuenta, cci, moneda, color, descripcion, activo]
        );
        return result.rows[0] || null;
    },
    registerTransfer: async ({ actorUserId, cuenta_origen_id, cuenta_destino_id, monto, fecha, referencia, motivo }) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const insertResult = await client.query(
                `INSERT INTO nl_fin_transferencias (cuenta_origen_id, cuenta_destino_id, monto, fecha, referencia, motivo, creado_por)
                 VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6, $7)
                 RETURNING *`,
                [cuenta_origen_id, cuenta_destino_id, monto, fecha || null, referencia || null, motivo || null, actorUserId]
            );
            await client.query('COMMIT');
            return insertResult.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    listTransfers: async ({ limit = 50 } = {}) => {
        const result = await pool.query(`
            SELECT 
                t.*,
                co.nombre as cuenta_origen_nombre,
                co.banco as cuenta_origen_banco,
                co.color as cuenta_origen_color,
                cd.nombre as cuenta_destino_nombre,
                cd.banco as cuenta_destino_banco,
                cd.color as cuenta_destino_color,
                u.nombre as creado_por_nombre
            FROM nl_fin_transferencias t
            LEFT JOIN nl_fin_cuentas co ON co.id = t.cuenta_origen_id
            LEFT JOIN nl_fin_cuentas cd ON cd.id = t.cuenta_destino_id
            LEFT JOIN nl_usuarios u ON u.id = t.creado_por
            ORDER BY t.fecha DESC, t.id DESC
            LIMIT $1
        `, [limit]);
        return result.rows.map((r) => ({
            ...r,
            monto: parseFloat(r.monto || 0)
        }));
    },
    listSocios: async () => {
        const result = await pool.query(`
            SELECT 
                s.*,
                COALESCE(r.total_retirado, 0) as total_retirado
            FROM nl_fin_socios s
            LEFT JOIN (
                SELECT socio_id, SUM(monto) as total_retirado
                FROM nl_fin_movimientos
                WHERE tipo = 'retiro_socio'
                GROUP BY socio_id
            ) r ON r.socio_id = s.id
            ORDER BY s.id ASC
        `);
        return result.rows.map((r) => ({
            ...r,
            porcentaje_participacion: parseFloat(r.porcentaje_participacion || 0),
            total_retirado: parseFloat(r.total_retirado || 0)
        }));
    },
    createSocio: async ({ nombre, documento_tipo, documento_numero, porcentaje_participacion, telefono, email }) => {
        const result = await pool.query(
            `INSERT INTO nl_fin_socios (nombre, documento_tipo, documento_numero, porcentaje_participacion, telefono, email, activo)
             VALUES ($1, COALESCE($2, 'DNI'), $3, COALESCE($4, 0.00), $5, $6, TRUE)
             RETURNING *`,
            [nombre, documento_tipo, documento_numero || null, porcentaje_participacion, telefono || null, email || null]
        );
        return result.rows[0];
    },
    updateSocio: async ({ id, nombre, documento_tipo, documento_numero, porcentaje_participacion, telefono, email, activo }) => {
        const result = await pool.query(
            `UPDATE nl_fin_socios
             SET nombre = COALESCE($2, nombre),
                 documento_tipo = COALESCE($3, documento_tipo),
                 documento_numero = COALESCE($4, documento_numero),
                 porcentaje_participacion = COALESCE($5, porcentaje_participacion),
                 telefono = COALESCE($6, telefono),
                 email = COALESCE($7, email),
                 activo = COALESCE($8, activo)
             WHERE id = $1
             RETURNING *`,
            [
                id,
                nombre ?? null,
                documento_tipo ?? null,
                documento_numero ?? null,
                porcentaje_participacion ?? null,
                telefono ?? null,
                email ?? null,
                activo ?? null
            ]
        );
        return result.rows[0] || null;
    },
    deleteSocio: async ({ id }) => {
        const countRes = await pool.query('SELECT COUNT(*)::int as count FROM nl_fin_movimientos WHERE socio_id = $1', [id]);
        const count = countRes.rows[0]?.count || 0;
        if (count > 0) {
            const updateRes = await pool.query('UPDATE nl_fin_socios SET activo = false, porcentaje_participacion = 0.00 WHERE id = $1 RETURNING *', [id]);
            return { deleted: false, inactivated: true, socio: updateRes.rows[0] };
        }
        const deleteRes = await pool.query('DELETE FROM nl_fin_socios WHERE id = $1 RETURNING *', [id]);
        return { deleted: true, inactivated: false, socio: deleteRes.rows[0] };
    },
    registerRetiroSocio: async ({ actorUserId, socio_id, cuenta_id, monto, fecha_movimiento, referencia, descripcion, tipo_fondo }) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const insertResult = await client.query(
                `INSERT INTO nl_fin_movimientos (
                    tipo, tipo_fondo, cuenta_id, fecha_movimiento, monto, 
                    grupo_gasto, categoria_gasto, socio_id, descripcion, referencia, creado_por
                ) VALUES (
                    'retiro_socio', $1, $2, COALESCE($3, CURRENT_DATE), $4, 
                    'patrimonio_socio', 'retiro_utilidad', $5, $6, $7, $8
                ) RETURNING *`,
                [
                    tipo_fondo || 'banco',
                    cuenta_id,
                    fecha_movimiento || null,
                    monto,
                    socio_id,
                    descripcion || 'Retiro de utilidades / dividendos',
                    referencia || null,
                    actorUserId
                ]
            );
            await client.query('COMMIT');
            return insertResult.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    listRetirosSocios: async ({ limit = 50 } = {}) => {
        const result = await pool.query(`
            SELECT 
                m.*,
                s.nombre as socio_nombre,
                s.documento_numero as socio_documento,
                c.nombre as cuenta_nombre,
                c.banco as cuenta_banco,
                c.color as cuenta_color,
                u.nombre as creado_por_nombre
            FROM nl_fin_movimientos m
            LEFT JOIN nl_fin_socios s ON s.id = m.socio_id
            LEFT JOIN nl_fin_cuentas c ON c.id = m.cuenta_id
            LEFT JOIN nl_usuarios u ON u.id = m.creado_por
            WHERE m.tipo = 'retiro_socio'
            ORDER BY m.fecha_movimiento DESC, m.id DESC
            LIMIT $1
        `, [limit]);
        return result.rows.map((r) => ({
            ...r,
            monto: parseFloat(r.monto || 0)
        }));
    }
});
