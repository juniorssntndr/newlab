import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const statusFlow = ['pendiente', 'en_diseno', 'esperando_aprobacion', 'en_produccion', 'terminado', 'enviado'];

const toNumber = (value) => {
    const n = parseFloat(value || 0);
    return Number.isNaN(n) ? 0 : n;
};

const toDateSql = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return value;
};

const toDateKey = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
    return date.toISOString().slice(0, 10);
};

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

const toDateFromRow = (value) => {
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const average = (values) => {
    if (!values.length) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
};

const calculateProjectedDailyFlow = (dailyNetFlows) => {
    if (!dailyNetFlows.length) return 0;
    const sorted = [...dailyNetFlows].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const netValues = sorted.map((item) => toNumber(item.neto));
    const alpha = 0.25;
    let ewma = netValues[0];
    for (let i = 1; i < netValues.length; i += 1) {
        ewma = (alpha * netValues[i]) + ((1 - alpha) * ewma);
    }

    const recentWindow = netValues.slice(-30);
    const previousWindow = netValues.slice(-60, -30);
    const trend = average(recentWindow) - average(previousWindow);

    return ewma + (trend * 0.35);
};

// GET /api/dashboard/stats
router.get('/stats', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;

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

        const statusIndex = new Map(statusFlow.map((s, i) => [s, i]));
        const retrocesosMes = timelineMes.rows.reduce((sum, row) => {
            const prev = statusIndex.get(row.estado_anterior);
            const next = statusIndex.get(row.estado_nuevo);
            if (prev === undefined || next === undefined) return sum;
            return next < prev ? sum + 1 : sum;
        }, 0);

        // Orders by status
        const porEstado = await pool.query(
            'SELECT estado, COUNT(*) as count FROM nl_pedidos GROUP BY estado'
        );

        // Recent orders
        const recientes = await pool.query(
            `SELECT p.id, p.codigo, p.estado, p.paciente_nombre, p.fecha_entrega, p.total, p.subtotal, c.nombre as clinica_nombre
       FROM nl_pedidos p LEFT JOIN nl_clinicas c ON p.clinica_id = c.id
       ORDER BY p.created_at DESC LIMIT 5`
        );

        // Monthly revenue (last 6 months)
        const ingresosMensuales = await pool.query(`
      SELECT DATE_TRUNC('month', created_at) as mes, SUM(total) as total
      FROM nl_pedidos WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY mes ORDER BY mes
    `);

        const pendientesCount = parseInt(pendientes.rows[0].count || 0, 10);
        const enDisenoCount = parseInt(enDiseno.rows[0].count || 0, 10);
        const esperandoAprobacionCount = parseInt(esperandoAprobacion.rows[0].count || 0, 10);
        const enProduccionCount = parseInt(enProduccion.rows[0].count || 0, 10);

        res.json({
            kpis: {
                total_pedidos: parseInt(pedidosTotal.rows[0].count),
                pedidos_hoy: parseInt(pedidosHoy.rows[0].count),
                en_produccion: enProduccionCount,
                pendientes: pendientesCount,
                en_diseno: enDisenoCount,
                esperando_aprobacion: esperandoAprobacionCount,
                trabajos_por_terminar: pendientesCount + enDisenoCount + esperandoAprobacionCount + enProduccionCount,
                retrasados: parseInt(retrasados.rows[0].count || 0, 10),
                clinicas_activas: parseInt(clinicasActivas.rows[0].count),
                terminados_mes: parseInt(terminadosMes.rows[0].count),
                retrocesos_mes: retrocesosMes,
                pedidos_mes: parseInt(pedidosMes.rows[0].count || 0),
                nuevos_clientes_mes: parseInt(nuevosClientesMes.rows[0].count || 0)
            },
            top_producto_mes: topProductoMes.rows[0]
                ? { producto: topProductoMes.rows[0].producto || '—', cantidad: parseInt(topProductoMes.rows[0].cantidad || 0, 10) }
                : null,
            top_clinica_mes: topClinicaMes.rows[0]
                ? { clinica: topClinicaMes.rows[0].clinica || '—', pedidos: parseInt(topClinicaMes.rows[0].pedidos || 0, 10) }
                : null,
            top_productos_mes: topProductosMes.rows.map((row) => ({
                producto: row.producto || '—',
                cantidad: parseInt(row.cantidad || 0, 10)
            })),
            top_clinicas_mes: topClinicasMes.rows.map((row) => ({
                clinica: row.clinica || '—',
                pedidos: parseInt(row.pedidos || 0, 10)
            })),
            historico_operativo_12m: historicoOperativo.rows.map((row) => ({
                periodo: row.periodo,
                pedidos: parseInt(row.pedidos || 0, 10),
                nuevos_clientes: parseInt(row.nuevos_clientes || 0, 10)
            })),
            historico_top_producto_12m: historicoTopProducto.rows.map((row) => ({
                periodo: row.periodo,
                producto: row.producto,
                cantidad: parseInt(row.cantidad || 0, 10)
            })),
            historico_top_clinica_12m: historicoTopClinica.rows.map((row) => ({
                periodo: row.periodo,
                clinica: row.clinica,
                pedidos: parseInt(row.pedidos || 0, 10)
            })),
            por_estado: porEstado.rows,
            recientes: recientes.rows
        });
    } catch (err) { next(err); }
});

// GET /api/dashboard/finance
router.get('/finance', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const from = toDateSql(req.query.from);
        const to = toDateSql(req.query.to);
        const fromDate = from || new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
        const toDate = to || new Date().toISOString().slice(0, 10);
        const filters = {
            clinica_id: req.query.clinica_id ? parseInt(req.query.clinica_id, 10) : null,
            producto_id: req.query.producto_id ? parseInt(req.query.producto_id, 10) : null
        };

        const ingresosFilter = buildIngresosFilters(filters);
        const movFilter = buildMovimientosFilters(filters);

        const ingresosKpiResult = await pool.query(
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

        const ingresosDia = toNumber(ingresosKpiResult.rows[0]?.ingresos_dia);
        const ingresosDiaCaja = toNumber(ingresosKpiResult.rows[0]?.ingresos_dia_caja);
        const ingresosDiaBanco = toNumber(ingresosKpiResult.rows[0]?.ingresos_dia_banco);
        const ingresosMes = toNumber(ingresosKpiResult.rows[0]?.ingresos_mes);
        const ingresosMesCaja = toNumber(ingresosKpiResult.rows[0]?.ingresos_mes_caja);
        const ingresosMesBanco = toNumber(ingresosKpiResult.rows[0]?.ingresos_mes_banco);
        const ingresosAnio = toNumber(ingresosKpiResult.rows[0]?.ingresos_anio);

        const ingresosPeriodoParams = [...ingresosFilter.params];
        ingresosPeriodoParams.push(fromDate, toDate);
        const ingresosPeriodoResult = await pool.query(
            `SELECT COALESCE(SUM(pg.monto), 0) as total
             FROM nl_pagos pg
             INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
             ${ingresosFilter.where} AND pg.fecha_pago BETWEEN $${ingresosPeriodoParams.length - 1}::date AND $${ingresosPeriodoParams.length}::date`,
            ingresosPeriodoParams
        );
        const ingresosPeriodo = toNumber(ingresosPeriodoResult.rows[0]?.total);

        const egresosPeriodoParams = [...movFilter.params];
        egresosPeriodoParams.push(fromDate, toDate);
        const egresosPeriodoResult = await pool.query(
            `SELECT COALESCE(SUM(m.monto), 0) as total
             FROM nl_fin_movimientos m
             ${movFilter.where} AND m.tipo = 'egreso' AND m.fecha_movimiento BETWEEN $${egresosPeriodoParams.length - 1}::date AND $${egresosPeriodoParams.length}::date`,
            egresosPeriodoParams
        );
        const egresosPeriodo = toNumber(egresosPeriodoResult.rows[0]?.total);

        const gastosBreakdownParams = [...movFilter.params, fromDate, toDate];
        const gastosBreakdownResult = await pool.query(
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
        );

        const gastosOperativos = gastosBreakdownResult.rows
            .filter((row) => row.grupo_gasto === 'operativo')
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const costosDirectos = gastosBreakdownResult.rows
            .filter((row) => row.grupo_gasto === 'costo_directo')
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const flowDayIngresosParams = [...ingresosFilter.params];
        const flowDayIngresosResult = await pool.query(
            `SELECT COALESCE(SUM(pg.monto), 0) as total
             FROM nl_pagos pg
             INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
             ${ingresosFilter.where} AND pg.fecha_pago = CURRENT_DATE`,
            flowDayIngresosParams
        );
        const flowDayIngresos = toNumber(flowDayIngresosResult.rows[0]?.total);

        const flowDayEgresosResult = await pool.query(
            `SELECT COALESCE(SUM(m.monto), 0) as total
             FROM nl_fin_movimientos m
             ${movFilter.where} AND m.tipo = 'egreso' AND m.fecha_movimiento = CURRENT_DATE`,
            movFilter.params
        );
        const flowDayEgresos = toNumber(flowDayEgresosResult.rows[0]?.total);

        const flowMonthIngresosResult = await pool.query(
            `SELECT COALESCE(SUM(pg.monto), 0) as total
             FROM nl_pagos pg
             INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
             ${ingresosFilter.where} AND DATE_TRUNC('month', pg.fecha_pago) = DATE_TRUNC('month', CURRENT_DATE)`,
            ingresosFilter.params
        );
        const flowMonthIngresos = toNumber(flowMonthIngresosResult.rows[0]?.total);

        const flowMonthEgresosResult = await pool.query(
            `SELECT COALESCE(SUM(m.monto), 0) as total
             FROM nl_fin_movimientos m
             ${movFilter.where} AND m.tipo = 'egreso' AND DATE_TRUNC('month', m.fecha_movimiento) = DATE_TRUNC('month', CURRENT_DATE)`,
            movFilter.params
        );
        const flowMonthEgresos = toNumber(flowMonthEgresosResult.rows[0]?.total);

        const saldoResult = await pool.query(
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

        const saldoCaja = saldoResult.rows
            .filter((row) => row.tipo_cuenta === 'caja')
            .reduce((sum, row) => sum + toNumber(row.saldo), 0);
        const saldoBancos = saldoResult.rows
            .filter((row) => row.tipo_cuenta === 'banco')
            .reduce((sum, row) => sum + toNumber(row.saldo), 0);

        const ingresosDiariosResult = await pool.query(
            `SELECT pg.fecha_pago as fecha, COALESCE(SUM(pg.monto), 0) as total
             FROM nl_pagos pg
             INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
             ${ingresosFilter.where}
               AND pg.fecha_pago >= CURRENT_DATE - INTERVAL '119 days'
             GROUP BY pg.fecha_pago
             ORDER BY pg.fecha_pago ASC`,
            ingresosFilter.params
        );

        const egresosDiariosResult = await pool.query(
            `SELECT m.fecha_movimiento as fecha, COALESCE(SUM(m.monto), 0) as total
             FROM nl_fin_movimientos m
             ${movFilter.where}
               AND m.tipo = 'egreso'
               AND m.fecha_movimiento >= CURRENT_DATE - INTERVAL '119 days'
             GROUP BY m.fecha_movimiento
             ORDER BY m.fecha_movimiento ASC`,
            movFilter.params
        );

        const ingresosMap = new Map(
            ingresosDiariosResult.rows.map((row) => {
                const date = toDateFromRow(row.fecha);
                const key = date ? toDateKey(date) : String(row.fecha);
                return [key, toNumber(row.total)];
            })
        );

        const egresosMap = new Map(
            egresosDiariosResult.rows.map((row) => {
                const date = toDateFromRow(row.fecha);
                const key = date ? toDateKey(date) : String(row.fecha);
                return [key, toNumber(row.total)];
            })
        );

        const flowKeys = Array.from(new Set([...ingresosMap.keys(), ...egresosMap.keys()])).sort();
        const dailyNetFlows = flowKeys.map((key) => ({
            fecha: key,
            neto: (ingresosMap.get(key) || 0) - (egresosMap.get(key) || 0)
        }));

        const flujoPromedioDiario = calculateProjectedDailyFlow(dailyNetFlows);
        const saldoTotal = saldoCaja + saldoBancos;

        const ingresosClinicaParams = [...ingresosFilter.params, fromDate, toDate];
        const ingresosPorClinicaResult = await pool.query(
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
        );

        const ingresosProductoParams = [...ingresosFilter.params, fromDate, toDate];
        const ingresosPorProductoResult = await pool.query(
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
        );

        const fromDateObj = new Date(`${fromDate}T00:00:00`);
        const toDateObj = new Date(`${toDate}T00:00:00`);
        const rangeDays = Math.max(1, Math.round((toDateObj.getTime() - fromDateObj.getTime()) / (24 * 60 * 60 * 1000)) + 1);
        const prevToObj = new Date(fromDateObj);
        prevToObj.setDate(prevToObj.getDate() - 1);
        const prevFromObj = new Date(prevToObj);
        prevFromObj.setDate(prevFromObj.getDate() - (rangeDays - 1));
        const prevFromDate = prevFromObj.toISOString().slice(0, 10);
        const prevToDate = prevToObj.toISOString().slice(0, 10);

        const ingresosPrevPeriodoParams = [...ingresosFilter.params, prevFromDate, prevToDate];
        const ingresosPrevPeriodoResult = await pool.query(
            `SELECT COALESCE(SUM(pg.monto), 0) as total
             FROM nl_pagos pg
             INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
             ${ingresosFilter.where} AND pg.fecha_pago BETWEEN $${ingresosPrevPeriodoParams.length - 1}::date AND $${ingresosPrevPeriodoParams.length}::date`,
            ingresosPrevPeriodoParams
        );
        const ingresosPrevPeriodo = toNumber(ingresosPrevPeriodoResult.rows[0]?.total);

        const pedidosCobradosPeriodoParams = [...ingresosFilter.params, fromDate, toDate];
        const pedidosCobradosPeriodoResult = await pool.query(
            `SELECT COUNT(DISTINCT pg.pedido_id) as total
             FROM nl_pagos pg
             INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
             ${ingresosFilter.where} AND pg.fecha_pago BETWEEN $${pedidosCobradosPeriodoParams.length - 1}::date AND $${pedidosCobradosPeriodoParams.length}::date`,
            pedidosCobradosPeriodoParams
        );
        const pedidosCobradosPeriodo = parseInt(pedidosCobradosPeriodoResult.rows[0]?.total || 0, 10);

        const historicoClinicasParams = [...ingresosFilter.params, fromDate, toDate];
        const historicoTopClinicasResult = await pool.query(
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
        );

        const historicoProductosParams = [...ingresosFilter.params, fromDate, toDate];
        const historicoTopProductosResult = await pool.query(
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
        );

        const seriesIngresosParams = [...ingresosFilter.params];
        const seriesIngresosResult = await pool.query(
            `SELECT DATE_TRUNC('month', pg.fecha_pago)::date as periodo, SUM(pg.monto) as ingresos
             FROM nl_pagos pg
             INNER JOIN nl_pedidos p ON p.id = pg.pedido_id
             ${ingresosFilter.where}
               AND pg.fecha_pago >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
             GROUP BY DATE_TRUNC('month', pg.fecha_pago)::date
             ORDER BY periodo ASC`,
            seriesIngresosParams
        );

        const seriesEgresosResult = await pool.query(
            `SELECT DATE_TRUNC('month', m.fecha_movimiento)::date as periodo, SUM(m.monto) as egresos
             FROM nl_fin_movimientos m
             ${movFilter.where}
               AND m.tipo = 'egreso'
               AND m.fecha_movimiento >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
             GROUP BY DATE_TRUNC('month', m.fecha_movimiento)::date
             ORDER BY periodo ASC`,
            movFilter.params
        );

        const ingresoSeriesMap = new Map(seriesIngresosResult.rows.map((row) => [toDateKey(row.periodo), toNumber(row.ingresos)]));
        const egresoSeriesMap = new Map(seriesEgresosResult.rows.map((row) => [toDateKey(row.periodo), toNumber(row.egresos)]));

        const monthlySeries = [];
        for (let i = 5; i >= 0; i -= 1) {
            const date = new Date();
            date.setDate(1);
            date.setMonth(date.getMonth() - i);
            const key = date.toISOString().slice(0, 10);
            monthlySeries.push({
                periodo: key,
                ingresos: ingresoSeriesMap.get(key) || 0,
                egresos: egresoSeriesMap.get(key) || 0,
                flujo_neto: (ingresoSeriesMap.get(key) || 0) - (egresoSeriesMap.get(key) || 0)
            });
        }

        const costosFijosMes = gastosBreakdownResult.rows
            .filter((row) => row.grupo_gasto === 'operativo')
            .reduce((sum, row) => sum + toNumber(row.total), 0);
        const costosVariablesMes = gastosBreakdownResult.rows
            .filter((row) => row.grupo_gasto === 'costo_directo')
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const egresosCaja = gastosBreakdownResult.rows
            .filter((row) => row.tipo_fondo === 'caja')
            .reduce((sum, row) => sum + toNumber(row.total), 0);
        const egresosBanco = gastosBreakdownResult.rows
            .filter((row) => row.tipo_fondo === 'banco')
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const top3ClinicasTotal = ingresosPorClinicaResult.rows
            .slice(0, 3)
            .reduce((sum, row) => sum + toNumber(row.total), 0);
        const top3ProductosTotal = ingresosPorProductoResult.rows
            .slice(0, 3)
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const margenContribucion = ingresosMes > 0 ? (ingresosMes - costosVariablesMes) / ingresosMes : 0;
        const puntoEquilibrio = margenContribucion > 0 ? costosFijosMes / margenContribucion : null;
        const margenOperativo = ingresosPeriodo > 0 ? ((ingresosPeriodo - egresosPeriodo) / ingresosPeriodo) * 100 : 0;

        res.json({
            filtros: {
                from: fromDate,
                to: toDate,
                clinica_id: filters.clinica_id,
                producto_id: filters.producto_id
            },
            liquidez: {
                saldo_caja: saldoCaja,
                saldo_bancos: saldoBancos,
                flujo_dia: flowDayIngresos - flowDayEgresos,
                flujo_mes: flowMonthIngresos - flowMonthEgresos,
                proyeccion_30: saldoTotal + (flujoPromedioDiario * 30),
                proyeccion_60: saldoTotal + (flujoPromedioDiario * 60)
            },
            ingresos: {
                dia: ingresosDia,
                dia_caja: ingresosDiaCaja,
                dia_banco: ingresosDiaBanco,
                mes: ingresosMes,
                mes_caja: ingresosMesCaja,
                mes_banco: ingresosMesBanco,
                anio: ingresosAnio,
                por_clinica: ingresosPorClinicaResult.rows.map((row) => ({
                    clinica: row.clinica,
                    total: toNumber(row.total)
                })),
                por_producto: ingresosPorProductoResult.rows.map((row) => ({
                    producto: row.producto,
                    total: toNumber(row.total)
                }))
            },
            gastos: {
                mes_total: flowMonthEgresos,
                total_operativos: gastosOperativos,
                total_costos_directos: costosDirectos,
                total_caja: egresosCaja,
                total_banco: egresosBanco,
                por_categoria: gastosBreakdownResult.rows.map((row) => ({
                    grupo_gasto: row.grupo_gasto,
                    categoria: row.categoria,
                    tipo_fondo: row.tipo_fondo,
                    total: toNumber(row.total)
                }))
            },
            metricas: {
                ingresos_periodo: ingresosPeriodo,
                egresos_periodo: egresosPeriodo,
                margen_operativo: margenOperativo,
                punto_equilibrio: puntoEquilibrio,
                flujo_proyectado_diario: flujoPromedioDiario
            },
            estrategicos: {
                kpis: {
                    crecimiento_ingresos_periodo_pct: ingresosPrevPeriodo > 0
                        ? ((ingresosPeriodo - ingresosPrevPeriodo) / ingresosPrevPeriodo) * 100
                        : null,
                    ticket_promedio_cobrado: pedidosCobradosPeriodo > 0
                        ? ingresosPeriodo / pedidosCobradosPeriodo
                        : 0,
                    concentracion_top3_clinicas_pct: ingresosPeriodo > 0
                        ? (top3ClinicasTotal / ingresosPeriodo) * 100
                        : 0,
                    concentracion_top3_productos_pct: ingresosPeriodo > 0
                        ? (top3ProductosTotal / ingresosPeriodo) * 100
                        : 0
                },
                top_clinicas_periodo: ingresosPorClinicaResult.rows.map((row) => ({
                    clinica: row.clinica,
                    total: toNumber(row.total),
                    participacion_pct: ingresosPeriodo > 0 ? (toNumber(row.total) / ingresosPeriodo) * 100 : 0
                })),
                top_productos_periodo: ingresosPorProductoResult.rows.map((row) => ({
                    producto: row.producto,
                    total: toNumber(row.total),
                    participacion_pct: ingresosPeriodo > 0 ? (toNumber(row.total) / ingresosPeriodo) * 100 : 0
                })),
                historico_top_clinicas: historicoTopClinicasResult.rows.map((row) => ({
                    periodo: row.periodo,
                    clinica: row.clinica,
                    total: toNumber(row.total)
                })),
                historico_top_productos: historicoTopProductosResult.rows.map((row) => ({
                    periodo: row.periodo,
                    producto: row.producto,
                    total: toNumber(row.total)
                }))
            },
            series: {
                mensual: monthlySeries
            }
        });
    } catch (err) { next(err); }
});

export default router;
