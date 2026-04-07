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
        const [pedidosTotal, pedidosHoy, enProduccion, pendientes, enDiseno, esperandoAprobacion, retrasados, clinicasActivas, terminadosMes, timelineMes, pedidosMes, topProductoMes, topClinicaMes, topProductosMes, topClinicasMes, nuevosClientesMes, historicoOperativo, historicoTopProducto, historicoTopClinica] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM nl_pedidos'),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE fecha = CURRENT_DATE"),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE estado = 'en_produccion'"),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE estado = 'pendiente'"),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE estado = 'en_diseno'"),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE estado = 'esperando_aprobacion'"),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE fecha_entrega < CURRENT_DATE AND estado NOT IN ('terminado', 'enviado')"),
            pool.query("SELECT COUNT(*) FROM nl_clinicas WHERE estado = 'activo'"),
            pool.query("SELECT COUNT(*) FROM nl_pedidos WHERE estado IN ('terminado','enviado') AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)"),
            pool.query("SELECT estado_anterior, estado_nuevo FROM nl_pedido_timeline WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) AND estado_anterior IS NOT NULL AND estado_nuevo IS NOT NULL"),
            pool.query("SELECT COUNT(*) as count FROM nl_pedidos WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)"),
            pool.query(
                `SELECT pr.nombre as producto, SUM(COALESCE(pi.cantidad, 1)) as cantidad
                 FROM nl_pedido_items pi
                 INNER JOIN nl_pedidos p ON p.id = pi.pedido_id
                 LEFT JOIN nl_productos pr ON pr.id = pi.producto_id
                 WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', CURRENT_DATE)
                 GROUP BY pr.nombre
                 ORDER BY cantidad DESC, pr.nombre ASC
                 LIMIT 1`
            ),
            pool.query(
                `SELECT c.nombre as clinica, COUNT(*) as pedidos
                 FROM nl_pedidos p
                 LEFT JOIN nl_clinicas c ON c.id = p.clinica_id
                 WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', CURRENT_DATE)
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
                 WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', CURRENT_DATE)
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
                 WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', CURRENT_DATE)
                 GROUP BY COALESCE(c.nombre, 'Sin clinica')
                 ORDER BY pedidos DESC, COALESCE(c.nombre, 'Sin clinica') ASC
                 LIMIT 5`
            ),
            pool.query(
                `SELECT COUNT(*) as count
                 FROM nl_clinicas c
                 WHERE DATE_TRUNC('month', c.created_at) = DATE_TRUNC('month', CURRENT_DATE)
                   AND EXISTS (
                     SELECT 1 FROM nl_pedidos p
                     WHERE p.clinica_id = c.id
                       AND DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', c.created_at)
                   )`
            ),
            pool.query(
                `WITH meses AS (
                    SELECT DATE_TRUNC('month', (CURRENT_DATE - INTERVAL '11 months') + (gs.n * INTERVAL '1 month'))::date as periodo
                    FROM generate_series(0, 11) as gs(n)
                ),
                pedidos AS (
                    SELECT DATE_TRUNC('month', created_at)::date as periodo, COUNT(*) as pedidos
                    FROM nl_pedidos
                    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
                    GROUP BY 1
                ),
                nuevos_clientes AS (
                    SELECT DATE_TRUNC('month', c.created_at)::date as periodo, COUNT(*) as nuevos_clientes
                    FROM nl_clinicas c
                    WHERE c.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
                      AND EXISTS (
                        SELECT 1 FROM nl_pedidos p
                        WHERE p.clinica_id = c.id
                          AND DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', c.created_at)
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
                        DATE_TRUNC('month', p.created_at)::date as periodo,
                        COALESCE(pr.nombre, 'Servicio sin producto') as producto,
                        SUM(COALESCE(pi.cantidad, 1)) as cantidad,
                        ROW_NUMBER() OVER (
                            PARTITION BY DATE_TRUNC('month', p.created_at)::date
                            ORDER BY SUM(COALESCE(pi.cantidad, 1)) DESC, COALESCE(pr.nombre, 'Servicio sin producto') ASC
                        ) as rn
                    FROM nl_pedido_items pi
                    INNER JOIN nl_pedidos p ON p.id = pi.pedido_id
                    LEFT JOIN nl_productos pr ON pr.id = pi.producto_id
                    WHERE p.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
                    GROUP BY DATE_TRUNC('month', p.created_at)::date, COALESCE(pr.nombre, 'Servicio sin producto')
                )
                SELECT periodo, producto, cantidad
                FROM ranked
                WHERE rn = 1
                ORDER BY periodo ASC`
            ),
            pool.query(
                `WITH ranked AS (
                    SELECT
                        DATE_TRUNC('month', p.created_at)::date as periodo,
                        COALESCE(c.nombre, 'Sin clinica') as clinica,
                        COUNT(*) as pedidos,
                        ROW_NUMBER() OVER (
                            PARTITION BY DATE_TRUNC('month', p.created_at)::date
                            ORDER BY COUNT(*) DESC, COALESCE(c.nombre, 'Sin clinica') ASC
                        ) as rn
                    FROM nl_pedidos p
                    LEFT JOIN nl_clinicas c ON c.id = p.clinica_id
                    WHERE p.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
                    GROUP BY DATE_TRUNC('month', p.created_at)::date, COALESCE(c.nombre, 'Sin clinica')
                )
                SELECT periodo, clinica, pedidos
                FROM ranked
                WHERE rn = 1
                ORDER BY periodo ASC`
            )
        ]);

        return {
            pedidosTotal,
            pedidosHoy,
            enProduccion,
            pendientes,
            enDiseno,
            esperandoAprobacion,
            retrasados,
            clinicasActivas,
            terminadosMes,
            timelineMes,
            pedidosMes,
            topProductoMes,
            topClinicaMes,
            topProductosMes,
            topClinicasMes,
            nuevosClientesMes,
            historicoOperativo,
            historicoTopProducto,
            historicoTopClinica
        };
    },
    listOrdersByStatus: async () => {
        const result = await pool.query('SELECT estado, COUNT(*) as count FROM nl_pedidos GROUP BY estado');
        return result.rows;
    },
    listRecentOrders: async () => {
        const result = await pool.query(
            `SELECT p.id, p.codigo, p.estado, p.paciente_nombre, p.fecha_entrega, p.total, p.subtotal, c.nombre as clinica_nombre
             FROM nl_pedidos p LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
             ORDER BY p.created_at DESC LIMIT 5`
        );

        return result.rows;
    },
    getFinanceKpis: async ({ filters }) => {
        const ingresosFilter = buildIngresosFilters(filters);
        const result = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN pg.fecha_pago = CURRENT_DATE THEN pg.monto END), 0) as ingresos_dia,
                COALESCE(SUM(CASE WHEN pg.fecha_pago = CURRENT_DATE AND COALESCE(pg.tipo_fondo, CASE WHEN LOWER(COALESCE(pg.metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) = 'caja' THEN pg.monto END), 0) as ingresos_dia_caja,
                COALESCE(SUM(CASE WHEN pg.fecha_pago = CURRENT_DATE AND COALESCE(pg.tipo_fondo, CASE WHEN LOWER(COALESCE(pg.metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) = 'banco' THEN pg.monto END), 0) as ingresos_dia_banco,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', pg.fecha_pago) = DATE_TRUNC('month', CURRENT_DATE) THEN pg.monto END), 0) as ingresos_mes,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', pg.fecha_pago) = DATE_TRUNC('month', CURRENT_DATE) AND COALESCE(pg.tipo_fondo, CASE WHEN LOWER(COALESCE(pg.metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) = 'caja' THEN pg.monto END), 0) as ingresos_mes_caja,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', pg.fecha_pago) = DATE_TRUNC('month', CURRENT_DATE) AND COALESCE(pg.tipo_fondo, CASE WHEN LOWER(COALESCE(pg.metodo, '')) = 'efectivo' THEN 'caja' ELSE 'banco' END) = 'banco' THEN pg.monto END), 0) as ingresos_mes_banco,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('year', pg.fecha_pago) = DATE_TRUNC('year', CURRENT_DATE) THEN pg.monto END), 0) as ingresos_anio
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

        const [ingresosPeriodoResult, egresosPeriodoResult, gastosBreakdownResult] = await Promise.all([
            pool.query(
                `SELECT COALESCE(SUM(pg.monto), 0) as total
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
            )
        ]);

        return {
            ingresosPeriodo: ingresosPeriodoResult.rows[0] || {},
            egresosPeriodo: egresosPeriodoResult.rows[0] || {},
            gastosBreakdown: gastosBreakdownResult.rows
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
                 ${ingresosFilter.where} AND pg.fecha_pago = CURRENT_DATE`,
                ingresosFilter.params
            ),
            pool.query(
                `SELECT COALESCE(SUM(m.monto), 0) as total
                 FROM nl_fin_movimientos m
                 ${movFilter.where} AND m.tipo = 'egreso' AND m.fecha_movimiento = CURRENT_DATE`,
                movFilter.params
            ),
            pool.query(
                `SELECT COALESCE(SUM(pg.monto), 0) as total
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 ${ingresosFilter.where} AND DATE_TRUNC('month', pg.fecha_pago) = DATE_TRUNC('month', CURRENT_DATE)`,
                ingresosFilter.params
            ),
            pool.query(
                `SELECT COALESCE(SUM(m.monto), 0) as total
                 FROM nl_fin_movimientos m
                 ${movFilter.where} AND m.tipo = 'egreso' AND DATE_TRUNC('month', m.fecha_movimiento) = DATE_TRUNC('month', CURRENT_DATE)`,
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
                   AND pg.fecha_pago >= CURRENT_DATE - INTERVAL '119 days'
                 GROUP BY pg.fecha_pago
                 ORDER BY pg.fecha_pago ASC`,
                ingresosFilter.params
            ),
            pool.query(
                `SELECT m.fecha_movimiento as fecha, COALESCE(SUM(m.monto), 0) as total
                 FROM nl_fin_movimientos m
                 ${movFilter.where}
                   AND m.tipo = 'egreso'
                   AND m.fecha_movimiento >= CURRENT_DATE - INTERVAL '119 days'
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
                `SELECT COALESCE(pr.nombre, 'Servicio sin producto') as producto, SUM(pi.subtotal) as total
                 FROM nl_pedido_items pi
                 INNER JOIN nl_pedidos p ON p.id = pi.pedido_id
                 LEFT JOIN nl_productos pr ON pr.id = pi.producto_id
                 ${ingresosFilter.where}
                   AND p.fecha BETWEEN $${ingresosProductoParams.length - 1}::date AND $${ingresosProductoParams.length}::date
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
                        DATE_TRUNC('month', p.fecha)::date as periodo,
                        COALESCE(pr.nombre, 'Servicio sin producto') as producto,
                        SUM(pi.subtotal) as total,
                        ROW_NUMBER() OVER (
                            PARTITION BY DATE_TRUNC('month', p.fecha)::date
                            ORDER BY SUM(pi.subtotal) DESC, COALESCE(pr.nombre, 'Servicio sin producto') ASC
                        ) as rn
                    FROM nl_pedido_items pi
                    INNER JOIN nl_pedidos p ON p.id = pi.pedido_id
                    LEFT JOIN nl_productos pr ON pr.id = pi.producto_id
                    ${ingresosFilter.where}
                      AND p.fecha BETWEEN $${historicoProductosParams.length - 1}::date AND $${historicoProductosParams.length}::date
                    GROUP BY DATE_TRUNC('month', p.fecha)::date, COALESCE(pr.nombre, 'Servicio sin producto')
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
    listFinanceMonthlySeries: async ({ filters }) => {
        const ingresosFilter = buildIngresosFilters(filters);
        const movFilter = buildMovimientosFilters(filters);

        const [seriesIngresosResult, seriesEgresosResult] = await Promise.all([
            pool.query(
                `SELECT DATE_TRUNC('month', pg.fecha_pago)::date as periodo, SUM(pg.monto) as ingresos
                 FROM nl_pagos pg
                 INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
                 ${ingresosFilter.where}
                   AND pg.fecha_pago >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
                 GROUP BY DATE_TRUNC('month', pg.fecha_pago)::date
                 ORDER BY periodo ASC`,
                ingresosFilter.params
            ),
            pool.query(
                `SELECT DATE_TRUNC('month', m.fecha_movimiento)::date as periodo, SUM(m.monto) as egresos
                 FROM nl_fin_movimientos m
                 ${movFilter.where}
                   AND m.tipo = 'egreso'
                   AND m.fecha_movimiento >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
                 GROUP BY DATE_TRUNC('month', m.fecha_movimiento)::date
                 ORDER BY periodo ASC`,
                movFilter.params
            )
        ]);

        return {
            ingresosMensuales: seriesIngresosResult.rows,
            egresosMensuales: seriesEgresosResult.rows
        };
    }
});
