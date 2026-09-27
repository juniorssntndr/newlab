const buildIngresosFilters = ({ clinica_id, producto_id }) => {
    const params = [];
    let where = 'WHERE 1=1';

    if (clinica_id) {
        params.push(clinica_id);
        where += ` AND p.clinica_id = $${params.length}`;
    }

    if (producto_id) {
        params.push(producto_id);
        where += ` AND EXISTS (
            SELECT 1 FROM nl_pedido_items pi
            WHERE pi.pedido_id = p.id AND pi.producto_id = $${params.length}
        )`;
    }

    return { where, params };
};

const buildMovimientosFilters = ({ clinica_id, producto_id }, alias = 'm') => {
    const params = [];
    let where = 'WHERE 1=1';

    if (clinica_id) {
        params.push(clinica_id);
        where += ` AND ${alias}.clinica_id = $${params.length}`;
    }

    if (producto_id) {
        params.push(producto_id);
        where += ` AND ${alias}.producto_id = $${params.length}`;
    }

    return { where, params };
};

export const makeDashboardPgRepository = ({ pool }) => ({
    getStatsOverview: async () => {
        const [
            pedidosCountersResult,
            clinicasActivasResult,
            timelineMesResult,
            topProductoMesResult,
            topClinicaMesResult,
            topProductosMesResult,
            topClinicasMesResult,
            nuevosClientesMesResult,
            historicoOperativoResult,
            historicoTopProductoResult,
            historicoTopClinicaResult
        ] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*) as pedidos_total,
                    COUNT(*) FILTER (WHERE fecha = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date) as pedidos_hoy,
                    COUNT(*) FILTER (WHERE estado = 'en_produccion') as en_produccion,
                    COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
                    COUNT(*) FILTER (WHERE estado = 'en_diseno') as en_diseno,
                    COUNT(*) FILTER (WHERE estado = 'esperando_aprobacion') as esperando_aprobacion,
                    COUNT(*) FILTER (WHERE fecha_entrega < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date AND estado NOT IN ('terminado', 'enviado', 'anulado')) as retrasados,
                    COUNT(*) FILTER (WHERE estado IN ('terminado', 'enviado') AND DATE_TRUNC('month', created_at AT TIME ZONE 'America/Lima') = DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')) as terminados_mes,
                    COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at AT TIME ZONE 'America/Lima') = DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')) as pedidos_mes,
                    COUNT(*) FILTER (WHERE fecha_entrega = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date AND estado NOT IN ('terminado', 'enviado', 'anulado')) as entregas_hoy,
                    COUNT(*) FILTER (WHERE estado = 'terminado') as listos_despacho
                FROM nl_pedidos
            `),
            pool.query("SELECT COUNT(*) FROM nl_clinicas WHERE estado = 'activo'"),
            pool.query("SELECT estado_anterior, estado_nuevo FROM nl_pedido_timeline WHERE created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima') AND estado_anterior IS NOT NULL AND estado_nuevo IS NOT NULL"),
            pool.query(
                `SELECT pr.nombre as producto, SUM(COALESCE(pi.cantidad, 1)) as cantidad
                 FROM nl_pedido_items pi
                 INNER JOIN nl_pedidos p ON p.id = pi.pedido_id
                 LEFT JOIN nl_productos pr ON pr.id = pi.producto_id
                 WHERE DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima') = DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')
                 GROUP BY pr.nombre
                 ORDER BY cantidad DESC, pr.nombre ASC
                 LIMIT 1`
            ),
            pool.query(
                `SELECT c.nombre as clinica, COUNT(*) as pedidos
                 FROM nl_pedidos p
                 LEFT JOIN nl_clinicas c ON c.id = p.clinica_id
                 WHERE DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima') = DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')
                 GROUP BY c.nombre
                 ORDER BY pedidos DESC, c.nombre ASC
                 LIMIT 1`
            ),
            pool.query(
                `SELECT
                    COALESCE(pr.nombre, 'Servicio sin producto') as producto,
                    SUM(COALESCE(pi.cantidad, 1)) as cantidad
                 FROM nl_pedido_items pi
                 INNER JOIN nl_pedidos p ON p.id = pi.pedido_id
                 LEFT JOIN nl_productos pr ON pr.id = pi.producto_id
                 WHERE DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima') = DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')
                 GROUP BY COALESCE(pr.nombre, 'Servicio sin producto')
                 ORDER BY cantidad DESC, COALESCE(pr.nombre, 'Servicio sin producto') ASC
                 LIMIT 5`
            ),
            pool.query(
                `SELECT
                    COALESCE(c.nombre, 'Sin clinica') as clinica,
                    COUNT(*) as pedidos
                 FROM nl_pedidos p
                 LEFT JOIN nl_clinicas c ON c.id = p.clinica_id
                 WHERE DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima') = DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')
                 GROUP BY COALESCE(c.nombre, 'Sin clinica')
                 ORDER BY pedidos DESC, COALESCE(c.nombre, 'Sin clinica') ASC
                 LIMIT 5`
            ),
            pool.query(
                `SELECT COUNT(*) as count
                 FROM nl_clinicas c
                 WHERE DATE_TRUNC('month', c.created_at AT TIME ZONE 'America/Lima') = DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')
                   AND EXISTS (
                     SELECT 1 FROM nl_pedidos p
                     WHERE p.clinica_id = c.id
                       AND DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima') = DATE_TRUNC('month', c.created_at AT TIME ZONE 'America/Lima')
                   )`
            ),
            pool.query(
                `WITH meses AS (
                    SELECT DATE_TRUNC('month', ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima') - INTERVAL '11 months') + (gs.n * INTERVAL '1 month'))::date as periodo
                    FROM generate_series(0, 11) as gs(n)
                ),
                pedidos AS (
                    SELECT DATE_TRUNC('month', created_at AT TIME ZONE 'America/Lima')::date as periodo, COUNT(*) as pedidos
                    FROM nl_pedidos
                    WHERE created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima') - INTERVAL '11 months'
                    GROUP BY 1
                ),
                nuevos_clientes AS (
                    SELECT DATE_TRUNC('month', c.created_at AT TIME ZONE 'America/Lima')::date as periodo, COUNT(*) as nuevos_clientes
                    FROM nl_clinicas c
                    WHERE c.created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima') - INTERVAL '11 months'
                      AND EXISTS (
                        SELECT 1 FROM nl_pedidos p
                        WHERE p.clinica_id = c.id
                          AND DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima') = DATE_TRUNC('month', c.created_at AT TIME ZONE 'America/Lima')
                      )
                    GROUP BY 1
                )
                SELECT
                    m.periodo,
                    COALESCE(p.pedidos, 0) as pedidos,
                    COALESCE(nc.nuevos_clientes, 0) as nuevos_clientes
                FROM meses m
                LEFT JOIN pedidos p ON p.periodo = m.periodo
                LEFT JOIN nuevos_clientes nc ON nc.periodo = m.periodo
                ORDER BY m.periodo ASC`
            ),
            pool.query(
                `WITH ranked AS (
                    SELECT
                        DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima')::date as periodo,
                        COALESCE(pr.nombre, 'Servicio sin producto') as producto,
                        SUM(COALESCE(pi.cantidad, 1)) as cantidad,
                        ROW_NUMBER() OVER (
                            PARTITION BY DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima')::date
                            ORDER BY SUM(COALESCE(pi.cantidad, 1)) DESC, COALESCE(pr.nombre, 'Servicio sin producto') ASC
                        ) as rn
                    FROM nl_pedido_items pi
                    INNER JOIN nl_pedidos p ON p.id = pi.pedido_id
                    LEFT JOIN nl_productos pr ON pr.id = pi.producto_id
                    WHERE p.created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima') - INTERVAL '11 months'
                    GROUP BY DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima')::date, COALESCE(pr.nombre, 'Servicio sin producto')
                )
                SELECT periodo, producto, cantidad
                FROM ranked
                WHERE rn = 1
                ORDER BY periodo ASC`
            ),
            pool.query(
                `WITH ranked AS (
                    SELECT
                        DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima')::date as periodo,
                        COALESCE(c.nombre, 'Sin clinica') as clinica,
                        COUNT(*) as pedidos,
                        ROW_NUMBER() OVER (
                            PARTITION BY DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima')::date
                            ORDER BY COUNT(*) DESC, COALESCE(c.nombre, 'Sin clinica') ASC
                        ) as rn
                    FROM nl_pedidos p
                    LEFT JOIN nl_clinicas c ON c.id = p.clinica_id
                    WHERE p.created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima') - INTERVAL '11 months'
                    GROUP BY DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Lima')::date, COALESCE(c.nombre, 'Sin clinica')
                )
                SELECT periodo, clinica, pedidos
                FROM ranked
                WHERE rn = 1
                ORDER BY periodo ASC`
            )
        ]);

        const pc = pedidosCountersResult.rows[0] || {};

        return {
            pedidosTotal: { rows: [{ count: pc.pedidos_total || 0 }] },
            pedidosHoy: { rows: [{ count: pc.pedidos_hoy || 0 }] },
            enProduccion: { rows: [{ count: pc.en_produccion || 0 }] },
            pendientes: { rows: [{ count: pc.pendientes || 0 }] },
            enDiseno: { rows: [{ count: pc.en_diseno || 0 }] },
            esperandoAprobacion: { rows: [{ count: pc.esperando_aprobacion || 0 }] },
            retrasados: { rows: [{ count: pc.retrasados || 0 }] },
            clinicasActivas: clinicasActivasResult,
            terminadosMes: { rows: [{ count: pc.terminados_mes || 0 }] },
            timelineMes: timelineMesResult,
            pedidosMes: { rows: [{ count: pc.pedidos_mes || 0 }] },
            topProductoMes: topProductoMesResult,
            topClinicaMes: topClinicaMesResult,
            topProductosMes: topProductosMesResult,
            topClinicasMes: topClinicasMesResult,
            nuevosClientesMes: nuevosClientesMesResult,
            historicoOperativo: historicoOperativoResult,
            historicoTopProducto: historicoTopProductoResult,
            historicoTopClinica: historicoTopClinicaResult,
            entregasHoy: { rows: [{ count: pc.entregas_hoy || 0 }] },
            listosDespacho: { rows: [{ count: pc.listos_despacho || 0 }] }
        };
    },
    listOrdersByStatus: async () => {
        const result = await pool.query('SELECT estado, COUNT(*) as count FROM nl_pedidos GROUP BY estado');
        return result.rows;
    },
    listRecentOrders: async () => {
        const result = await pool.query(
            `SELECT p.id, p.codigo, p.estado, p.paciente_nombre, p.fecha_entrega, p.total, p.subtotal,
                    p.created_at, p.fecha,
                    c.nombre as clinica_nombre,
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
                      SELECT NULLIF(TRIM(pi.color_vita), '')
                      FROM nl_pedido_items pi
                      WHERE pi.pedido_id = p.id
                      ORDER BY pi.id ASC
                      LIMIT 1
                    ) as producto_color,
                    (
                      SELECT pi.piezas_dentales
                      FROM nl_pedido_items pi
                      WHERE pi.pedido_id = p.id
                      ORDER BY pi.id ASC
                      LIMIT 1
                    ) as producto_piezas,
                    (
                      SELECT COUNT(*)::int
                      FROM nl_pedido_items pi
                      WHERE pi.pedido_id = p.id
                    ) as items_count
             FROM nl_pedidos p
             LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
             ORDER BY p.created_at DESC
             LIMIT 5`
        );

        return result.rows;
    },
    getFinanceKpis: async ({ filters }) => {
        const ingresosFilter = buildIngresosFilters(filters);
        const result = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN pg.fecha_pago = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date THEN pg.monto END), 0) as ingresos_dia,
                COALESCE(SUM(CASE WHEN pg.fecha_pago = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date AND COALESCE(pg.tipo_fondo, CASE WHEN LOWER(COALESCE(pg.metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) = 'caja' THEN pg.monto END), 0) as ingresos_dia_caja,
                COALESCE(SUM(CASE WHEN pg.fecha_pago = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date AND COALESCE(pg.tipo_fondo, CASE WHEN LOWER(COALESCE(pg.metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) = 'banco' THEN pg.monto END), 0) as ingresos_dia_banco,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', pg.fecha_pago) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date) THEN pg.monto END), 0) as ingresos_mes,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', pg.fecha_pago) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date) AND COALESCE(pg.tipo_fondo, CASE WHEN LOWER(COALESCE(pg.metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) = 'caja' THEN pg.monto END), 0) as ingresos_mes_caja,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', pg.fecha_pago) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date) AND COALESCE(pg.tipo_fondo, CASE WHEN LOWER(COALESCE(pg.metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) = 'banco' THEN pg.monto END), 0) as ingresos_mes_banco,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('year', pg.fecha_pago) = DATE_TRUNC('year', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date) THEN pg.monto END), 0) as ingresos_anio
             FROM nl_pagos pg
             INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
             ${ingresosFilter.where}`,
            ingresosFilter.params
        );

        return result.rows[0] || {};
    },
    getFinancePeriodAggregates: async ({ filters, fromDate, toDate }) => {
        const ingresosFilter = buildIngresosFilters(filters);
        const movFilter = buildMovimientosFilters(filters);

        const ingresosPeriodoParams = [...ingresosFilter.params, fromDate, toDate];
        const egresosPeriodoParams = [...movFilter.params, fromDate, toDate];
        const gastosBreakdownParams = [...movFilter.params, fromDate, toDate];

        const [ingresosPeriodoResult, egresosPeriodoResult, gastosBreakdownResult, cuentasPorCobrarResult] = await Promise.all([
            pool.query(
                `SELECT
                    COALESCE(SUM(pg.monto), 0) as total,
                    COALESCE(SUM(CASE WHEN COALESCE(pg.tipo_fondo, CASE WHEN LOWER(COALESCE(pg.metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) = 'caja' THEN pg.monto END), 0) as total_caja,
                    COALESCE(SUM(CASE WHEN COALESCE(pg.tipo_fondo, CASE WHEN LOWER(COALESCE(pg.metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) = 'banco' THEN pg.monto END), 0) as total_banco
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 ${ingresosFilter.where} AND pg.fecha_pago BETWEEN $${ingresosPeriodoParams.length - 1}::date AND $${ingresosPeriodoParams.length}::date`,
                ingresosPeriodoParams
            ),
            pool.query(
                `SELECT COALESCE(SUM(m.monto), 0) as total
                 FROM nl_fin_movimientos m
                 ${movFilter.where} AND m.tipo = 'egreso' AND m.fecha_movimiento BETWEEN $${egresosPeriodoParams.length - 1}::date AND $${egresosPeriodoParams.length}::date`,
                egresosPeriodoParams
            ),
            pool.query(
                `SELECT
                    COALESCE(m.grupo_gasto, 'otro') as grupo_gasto,
                    COALESCE(m.categoria_gasto, 'sin_categoria') as categoria,
                    COALESCE(m.tipo_fondo, 'banco') as tipo_fondo,
                    SUM(m.monto) as total
                 FROM nl_fin_movimientos m
                 ${movFilter.where}
                   AND m.tipo = 'egreso'
                   AND m.fecha_movimiento BETWEEN $${gastosBreakdownParams.length - 1}::date AND $${gastosBreakdownParams.length}::date
                 GROUP BY COALESCE(m.grupo_gasto, 'otro'), COALESCE(m.categoria_gasto, 'sin_categoria'), COALESCE(m.tipo_fondo, 'banco')
                 ORDER BY total DESC`,
                gastosBreakdownParams
            ),
            pool.query(
                `WITH pedidos_saldos AS (
                    SELECT
                        p.id,
                        p.fecha,
                        p.total - COALESCE(SUM(pg.monto), 0) as saldo
                    FROM nl_pedidos p
                    LEFT JOIN nl_pagos pg ON pg.pedido_id = p.id
                    WHERE p.estado != 'anulado'
                    GROUP BY p.id, p.fecha, p.total
                    HAVING (p.total - COALESCE(SUM(pg.monto), 0)) > 0.01
                )
                SELECT
                    COALESCE(SUM(saldo), 0) as total_deuda_calle,
                    COALESCE(SUM(CASE WHEN fecha BETWEEN $1::date AND $2::date THEN saldo ELSE 0 END), 0) as deuda_periodo,
                    COUNT(*)::int as pedidos_pendientes_count
                FROM pedidos_saldos`,
                [fromDate, toDate]
            )
        ]);

        return {
            ingresosPeriodo: ingresosPeriodoResult.rows[0] || {},
            egresosPeriodo: egresosPeriodoResult.rows[0] || {},
            gastosBreakdown: gastosBreakdownResult.rows,
            cuentasPorCobrar: cuentasPorCobrarResult.rows[0] || {}
        };
    },
    getFinanceFlowTotals: async ({ filters }) => {
        const ingresosFilter = buildIngresosFilters(filters);
        const movFilter = buildMovimientosFilters(filters);

        const [flowDayIngresosResult, flowDayEgresosResult, flowMonthIngresosResult, flowMonthEgresosResult] = await Promise.all([
            pool.query(
                `SELECT COALESCE(SUM(pg.monto), 0) as total
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 ${ingresosFilter.where} AND pg.fecha_pago = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date`,
                ingresosFilter.params
            ),
            pool.query(
                `SELECT COALESCE(SUM(m.monto), 0) as total
                 FROM nl_fin_movimientos m
                 ${movFilter.where} AND m.tipo = 'egreso' AND m.fecha_movimiento = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date`,
                movFilter.params
            ),
            pool.query(
                `SELECT COALESCE(SUM(pg.monto), 0) as total
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 ${ingresosFilter.where} AND DATE_TRUNC('month', pg.fecha_pago) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date)`,
                ingresosFilter.params
            ),
            pool.query(
                `SELECT COALESCE(SUM(m.monto), 0) as total
                 FROM nl_fin_movimientos m
                 ${movFilter.where} AND m.tipo = 'egreso' AND DATE_TRUNC('month', m.fecha_movimiento) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date)`,
                movFilter.params
            )
        ]);

        return {
            flowDayIngresos: flowDayIngresosResult.rows[0] || {},
            flowDayEgresos: flowDayEgresosResult.rows[0] || {},
            flowMonthIngresos: flowMonthIngresosResult.rows[0] || {},
            flowMonthEgresos: flowMonthEgresosResult.rows[0] || {}
        };
    },
    getFinanceBalances: async () => {
        const result = await pool.query(
            `WITH base AS (
                SELECT tipo_cuenta as tipo_fondo, COALESCE(SUM(saldo_inicial), 0) as saldo_inicial
                FROM nl_fin_cuentas
                WHERE activo = TRUE
                GROUP BY tipo_cuenta
            ),
            pagos AS (
                SELECT
                    COALESCE(tipo_fondo, CASE WHEN LOWER(COALESCE(metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) as tipo_fondo,
                    COALESCE(SUM(monto), 0) as ingresos
                FROM nl_pagos
                WHERE movimiento_id IS NULL
                GROUP BY 1
            ),
            movimientos AS (
                SELECT
                    COALESCE(tipo_fondo, 'banco') as tipo_fondo,
                    COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) as ingresos,
                    COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) as egresos
                FROM nl_fin_movimientos
                GROUP BY 1
            )
            SELECT
                b.tipo_fondo as tipo_cuenta,
                b.saldo_inicial + COALESCE(p.ingresos, 0) + COALESCE(mv.ingresos, 0) - COALESCE(mv.egresos, 0) as saldo
            FROM base b
            LEFT JOIN pagos p ON p.tipo_fondo = b.tipo_fondo
            LEFT JOIN movimientos mv ON mv.tipo_fondo = b.tipo_fondo`
        );

        return result.rows;
    },
    listFinanceDailySeries: async ({ filters }) => {
        const ingresosFilter = buildIngresosFilters(filters);
        const movFilter = buildMovimientosFilters(filters);

        const [ingresosDiariosResult, egresosDiariosResult] = await Promise.all([
            pool.query(
                `SELECT pg.fecha_pago as fecha, COALESCE(SUM(pg.monto), 0) as total
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 ${ingresosFilter.where}
                   AND pg.fecha_pago >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - INTERVAL '119 days'
                 GROUP BY pg.fecha_pago
                 ORDER BY pg.fecha_pago ASC`,
                ingresosFilter.params
            ),
            pool.query(
                `SELECT m.fecha_movimiento as fecha, COALESCE(SUM(m.monto), 0) as total
                 FROM nl_fin_movimientos m
                 ${movFilter.where}
                   AND m.tipo = 'egreso'
                   AND m.fecha_movimiento >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - INTERVAL '119 days'
                 GROUP BY m.fecha_movimiento
                 ORDER BY m.fecha_movimiento ASC`,
                movFilter.params
            )
        ]);

        return {
            ingresosDiarios: ingresosDiariosResult.rows,
            egresosDiarios: egresosDiariosResult.rows
        };
    },
    listFinanceIncomeBreakdown: async ({ filters, fromDate, toDate }) => {
        const ingresosFilter = buildIngresosFilters(filters);
        const ingresosClinicaParams = [...ingresosFilter.params, fromDate, toDate];
        const ingresosProductoParams = [...ingresosFilter.params, fromDate, toDate];

        const [ingresosPorClinicaResult, ingresosPorProductoResult] = await Promise.all([
            pool.query(
                `SELECT COALESCE(c.nombre, 'Sin clinica') as clinica, SUM(pg.monto) as total
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 LEFT JOIN nl_clinicas c ON c.id = p.clinica_id
                 ${ingresosFilter.where}
                   AND pg.fecha_pago BETWEEN $${ingresosClinicaParams.length - 1}::date AND $${ingresosClinicaParams.length}::date
                 GROUP BY COALESCE(c.nombre, 'Sin clinica')
                 ORDER BY total DESC
                 LIMIT 8`,
                ingresosClinicaParams
            ),
            pool.query(
                `SELECT COALESCE(pr.nombre, 'Servicio sin producto') as producto, SUM(pg.monto) as total
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 LEFT JOIN LATERAL (
                     SELECT pi.producto_id
                     FROM nl_pedido_items pi
                     WHERE pi.pedido_id = p.id
                     ORDER BY pi.id ASC
                     LIMIT 1
                 ) item ON true
                 LEFT JOIN nl_productos pr ON pr.id = item.producto_id
                 ${ingresosFilter.where}
                   AND pg.fecha_pago BETWEEN $${ingresosProductoParams.length - 1}::date AND $${ingresosProductoParams.length}::date
                 GROUP BY COALESCE(pr.nombre, 'Servicio sin producto')
                 ORDER BY total DESC
                 LIMIT 8`,
                ingresosProductoParams
            )
        ]);

        return {
            ingresosPorClinica: ingresosPorClinicaResult.rows,
            ingresosPorProducto: ingresosPorProductoResult.rows
        };
    },
    getFinanceStrategicComparisons: async ({ filters, fromDate, toDate, prevFromDate, prevToDate }) => {
        const ingresosFilter = buildIngresosFilters(filters);
        const ingresosPrevPeriodoParams = [...ingresosFilter.params, prevFromDate, prevToDate];
        const pedidosCobradosPeriodoParams = [...ingresosFilter.params, fromDate, toDate];

        const [ingresosPrevPeriodoResult, pedidosCobradosPeriodoResult] = await Promise.all([
            pool.query(
                `SELECT COALESCE(SUM(pg.monto), 0) as total
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 ${ingresosFilter.where} AND pg.fecha_pago BETWEEN $${ingresosPrevPeriodoParams.length - 1}::date AND $${ingresosPrevPeriodoParams.length}::date`,
                ingresosPrevPeriodoParams
            ),
            pool.query(
                `SELECT COUNT(DISTINCT pg.pedido_id) as total
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 ${ingresosFilter.where} AND pg.fecha_pago BETWEEN $${pedidosCobradosPeriodoParams.length - 1}::date AND $${pedidosCobradosPeriodoParams.length}::date`,
                pedidosCobradosPeriodoParams
            )
        ]);

        return {
            ingresosPrevPeriodo: ingresosPrevPeriodoResult.rows[0] || {},
            pedidosCobradosPeriodo: pedidosCobradosPeriodoResult.rows[0] || {}
        };
    },
    listFinanceHistoricalTops: async ({ filters, fromDate, toDate }) => {
        const ingresosFilter = buildIngresosFilters(filters);
        const historicoClinicasParams = [...ingresosFilter.params, fromDate, toDate];
        const historicoProductosParams = [...ingresosFilter.params, fromDate, toDate];

        const [historicoTopClinicasResult, historicoTopProductosResult] = await Promise.all([
            pool.query(
                `WITH ranked AS (
                    SELECT
                        DATE_TRUNC('month', pg.fecha_pago)::date as periodo,
                        COALESCE(c.nombre, 'Sin clinica') as clinica,
                        SUM(pg.monto) as total,
                        ROW_NUMBER() OVER (
                            PARTITION BY DATE_TRUNC('month', pg.fecha_pago)::date
                            ORDER BY SUM(pg.monto) DESC, COALESCE(c.nombre, 'Sin clinica') ASC
                        ) as rn
                    FROM nl_pagos pg
                    INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                    LEFT JOIN nl_clinicas c ON c.id = p.clinica_id
                    ${ingresosFilter.where}
                      AND pg.fecha_pago BETWEEN $${historicoClinicasParams.length - 1}::date AND $${historicoClinicasParams.length}::date
                    GROUP BY DATE_TRUNC('month', pg.fecha_pago)::date, COALESCE(c.nombre, 'Sin clinica')
                )
                SELECT periodo, clinica, total
                FROM ranked
                WHERE rn <= 3
                ORDER BY periodo ASC, total DESC`,
                historicoClinicasParams
            ),
            pool.query(
                `WITH ranked AS (
                    SELECT
                        DATE_TRUNC('month', pg.fecha_pago)::date as periodo,
                        COALESCE(pr.nombre, 'Servicio sin producto') as producto,
                        SUM(pg.monto) as total,
                        ROW_NUMBER() OVER (
                            PARTITION BY DATE_TRUNC('month', pg.fecha_pago)::date
                            ORDER BY SUM(pg.monto) DESC, COALESCE(pr.nombre, 'Servicio sin producto') ASC
                        ) as rn
                    FROM nl_pagos pg
                    INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                    LEFT JOIN LATERAL (
                        SELECT pi.producto_id
                        FROM nl_pedido_items pi
                        WHERE pi.pedido_id = p.id
                        ORDER BY pi.id ASC
                        LIMIT 1
                    ) item ON true
                    LEFT JOIN nl_productos pr ON pr.id = item.producto_id
                    ${ingresosFilter.where}
                      AND pg.fecha_pago BETWEEN $${historicoProductosParams.length - 1}::date AND $${historicoProductosParams.length}::date
                    GROUP BY DATE_TRUNC('month', pg.fecha_pago)::date, COALESCE(pr.nombre, 'Servicio sin producto')
                )
                SELECT periodo, producto, total
                FROM ranked
                WHERE rn <= 3
                ORDER BY periodo ASC, total DESC`,
                historicoProductosParams
            )
        ]);

        return {
            historicoTopClinicas: historicoTopClinicasResult.rows,
            historicoTopProductos: historicoTopProductosResult.rows
        };
    },
    listFinanceMonthlySeries: async ({ filters, fromDate, toDate }) => {
        const ingresosFilter = buildIngresosFilters(filters);
        const movFilter = buildMovimientosFilters(filters);

        let ingresosWhere = ingresosFilter.where;
        let movWhere = movFilter.where;
        const ingresosParams = [...ingresosFilter.params];
        const movParams = [...movFilter.params];

        if (fromDate && toDate) {
            ingresosParams.push(fromDate, toDate);
            ingresosWhere += ` AND pg.fecha_pago BETWEEN $${ingresosParams.length - 1}::date AND $${ingresosParams.length}::date`;
            movParams.push(fromDate, toDate);
            movWhere += ` AND m.fecha_movimiento BETWEEN $${movParams.length - 1}::date AND $${movParams.length}::date`;
        } else {
            ingresosWhere += ` AND pg.fecha_pago >= DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date) - INTERVAL '5 months'`;
            movWhere += ` AND m.fecha_movimiento >= DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date) - INTERVAL '5 months'`;
        }

        const [seriesIngresosResult, seriesEgresosResult] = await Promise.all([
            pool.query(
                `SELECT TO_CHAR(DATE_TRUNC('month', pg.fecha_pago), 'YYYY-MM-01') as periodo, SUM(pg.monto) as ingresos
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 ${ingresosWhere}
                 GROUP BY DATE_TRUNC('month', pg.fecha_pago)
                 ORDER BY DATE_TRUNC('month', pg.fecha_pago) ASC`,
                ingresosParams
            ),
            pool.query(
                `SELECT TO_CHAR(DATE_TRUNC('month', m.fecha_movimiento), 'YYYY-MM-01') as periodo, SUM(m.monto) as egresos
                 FROM nl_fin_movimientos m
                 ${movWhere}
                   AND m.tipo = 'egreso'
                 GROUP BY DATE_TRUNC('month', m.fecha_movimiento)
                 ORDER BY DATE_TRUNC('month', m.fecha_movimiento) ASC`,
                movParams
            )
        ]);

        return {
            ingresosMensuales: seriesIngresosResult.rows,
            egresosMensuales: seriesEgresosResult.rows
        };
    }
});
