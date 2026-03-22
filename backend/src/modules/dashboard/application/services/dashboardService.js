const statusFlow = ['pendiente', 'en_diseno', 'esperando_aprobacion', 'en_produccion', 'terminado', 'enviado'];

const toNumber = (value) => {
    const n = Number.parseFloat(value || 0);
    return Number.isNaN(n) ? 0 : n;
};

const toDateSql = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return value;
};

const toDateFromRow = (value) => {
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateKey = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
    return date.toISOString().slice(0, 10);
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

export const makeDashboardService = ({ dashboardRepository }) => ({
    getStats: async () => {
        const [stats, porEstado, recientes] = await Promise.all([
            dashboardRepository.getStatsOverview(),
            dashboardRepository.listOrdersByStatus(),
            dashboardRepository.listRecentOrders()
        ]);

        const statusIndex = new Map(statusFlow.map((status, index) => [status, index]));
        const retrocesosMes = stats.timelineMes.rows.reduce((sum, row) => {
            const prev = statusIndex.get(row.estado_anterior);
            const next = statusIndex.get(row.estado_nuevo);
            if (prev === undefined || next === undefined) return sum;
            return next < prev ? sum + 1 : sum;
        }, 0);

        const pendientesCount = Number.parseInt(stats.pendientes.rows[0].count || 0, 10);
        const enDisenoCount = Number.parseInt(stats.enDiseno.rows[0].count || 0, 10);
        const esperandoAprobacionCount = Number.parseInt(stats.esperandoAprobacion.rows[0].count || 0, 10);
        const enProduccionCount = Number.parseInt(stats.enProduccion.rows[0].count || 0, 10);

        return {
            kpis: {
                total_pedidos: Number.parseInt(stats.pedidosTotal.rows[0].count, 10),
                pedidos_hoy: Number.parseInt(stats.pedidosHoy.rows[0].count, 10),
                en_produccion: enProduccionCount,
                pendientes: pendientesCount,
                en_diseno: enDisenoCount,
                esperando_aprobacion: esperandoAprobacionCount,
                trabajos_por_terminar: pendientesCount + enDisenoCount + esperandoAprobacionCount + enProduccionCount,
                retrasados: Number.parseInt(stats.retrasados.rows[0].count || 0, 10),
                clinicas_activas: Number.parseInt(stats.clinicasActivas.rows[0].count, 10),
                terminados_mes: Number.parseInt(stats.terminadosMes.rows[0].count, 10),
                retrocesos_mes: retrocesosMes,
                pedidos_mes: Number.parseInt(stats.pedidosMes.rows[0].count || 0, 10),
                nuevos_clientes_mes: Number.parseInt(stats.nuevosClientesMes.rows[0].count || 0, 10)
            },
            top_producto_mes: stats.topProductoMes.rows[0]
                ? { producto: stats.topProductoMes.rows[0].producto || '—', cantidad: Number.parseInt(stats.topProductoMes.rows[0].cantidad || 0, 10) }
                : null,
            top_clinica_mes: stats.topClinicaMes.rows[0]
                ? { clinica: stats.topClinicaMes.rows[0].clinica || '—', pedidos: Number.parseInt(stats.topClinicaMes.rows[0].pedidos || 0, 10) }
                : null,
            top_productos_mes: stats.topProductosMes.rows.map((row) => ({
                producto: row.producto || '—',
                cantidad: Number.parseInt(row.cantidad || 0, 10)
            })),
            top_clinicas_mes: stats.topClinicasMes.rows.map((row) => ({
                clinica: row.clinica || '—',
                pedidos: Number.parseInt(row.pedidos || 0, 10)
            })),
            historico_operativo_12m: stats.historicoOperativo.rows.map((row) => ({
                periodo: row.periodo,
                pedidos: Number.parseInt(row.pedidos || 0, 10),
                nuevos_clientes: Number.parseInt(row.nuevos_clientes || 0, 10)
            })),
            historico_top_producto_12m: stats.historicoTopProducto.rows.map((row) => ({
                periodo: row.periodo,
                producto: row.producto,
                cantidad: Number.parseInt(row.cantidad || 0, 10)
            })),
            historico_top_clinica_12m: stats.historicoTopClinica.rows.map((row) => ({
                periodo: row.periodo,
                clinica: row.clinica,
                pedidos: Number.parseInt(row.pedidos || 0, 10)
            })),
            por_estado: porEstado,
            recientes
        };
    },
    getFinance: async ({ query }) => {
        const from = toDateSql(query.from);
        const to = toDateSql(query.to);
        const fromDate = from || new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
        const toDate = to || new Date().toISOString().slice(0, 10);
        const filters = {
            clinica_id: query.clinica_id ? Number.parseInt(query.clinica_id, 10) : null,
            producto_id: query.producto_id ? Number.parseInt(query.producto_id, 10) : null
        };

        const fromDateObj = new Date(`${fromDate}T00:00:00`);
        const toDateObj = new Date(`${toDate}T00:00:00`);
        const rangeDays = Math.max(1, Math.round((toDateObj.getTime() - fromDateObj.getTime()) / (24 * 60 * 60 * 1000)) + 1);
        const prevToObj = new Date(fromDateObj);
        prevToObj.setDate(prevToObj.getDate() - 1);
        const prevFromObj = new Date(prevToObj);
        prevFromObj.setDate(prevFromObj.getDate() - (rangeDays - 1));
        const prevFromDate = prevFromObj.toISOString().slice(0, 10);
        const prevToDate = prevToObj.toISOString().slice(0, 10);

        const [ingresosKpis, periodAggregates, flowTotals, saldos, dailySeries, incomeBreakdown, strategicComparison, historicalTops, monthlySeries] = await Promise.all([
            dashboardRepository.getFinanceKpis({ filters }),
            dashboardRepository.getFinancePeriodAggregates({ filters, fromDate, toDate }),
            dashboardRepository.getFinanceFlowTotals({ filters }),
            dashboardRepository.getFinanceBalances(),
            dashboardRepository.listFinanceDailySeries({ filters }),
            dashboardRepository.listFinanceIncomeBreakdown({ filters, fromDate, toDate }),
            dashboardRepository.getFinanceStrategicComparisons({ filters, fromDate, toDate, prevFromDate, prevToDate }),
            dashboardRepository.listFinanceHistoricalTops({ filters, fromDate, toDate }),
            dashboardRepository.listFinanceMonthlySeries({ filters })
        ]);

        const ingresosDia = toNumber(ingresosKpis.ingresos_dia);
        const ingresosDiaCaja = toNumber(ingresosKpis.ingresos_dia_caja);
        const ingresosDiaBanco = toNumber(ingresosKpis.ingresos_dia_banco);
        const ingresosMes = toNumber(ingresosKpis.ingresos_mes);
        const ingresosMesCaja = toNumber(ingresosKpis.ingresos_mes_caja);
        const ingresosMesBanco = toNumber(ingresosKpis.ingresos_mes_banco);
        const ingresosAnio = toNumber(ingresosKpis.ingresos_anio);

        const ingresosPeriodo = toNumber(periodAggregates.ingresosPeriodo.total);
        const egresosPeriodo = toNumber(periodAggregates.egresosPeriodo.total);

        const gastosOperativos = periodAggregates.gastosBreakdown
            .filter((row) => row.grupo_gasto === 'operativo')
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const costosDirectos = periodAggregates.gastosBreakdown
            .filter((row) => row.grupo_gasto === 'costo_directo')
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const flowDayIngresos = toNumber(flowTotals.flowDayIngresos.total);
        const flowDayEgresos = toNumber(flowTotals.flowDayEgresos.total);
        const flowMonthIngresos = toNumber(flowTotals.flowMonthIngresos.total);
        const flowMonthEgresos = toNumber(flowTotals.flowMonthEgresos.total);

        const saldoCaja = saldos
            .filter((row) => row.tipo_cuenta === 'caja')
            .reduce((sum, row) => sum + toNumber(row.saldo), 0);

        const saldoBancos = saldos
            .filter((row) => row.tipo_cuenta === 'banco')
            .reduce((sum, row) => sum + toNumber(row.saldo), 0);

        const ingresosMap = new Map(
            dailySeries.ingresosDiarios.map((row) => {
                const date = toDateFromRow(row.fecha);
                const key = date ? toDateKey(date) : String(row.fecha);
                return [key, toNumber(row.total)];
            })
        );

        const egresosMap = new Map(
            dailySeries.egresosDiarios.map((row) => {
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

        const costosFijosMes = periodAggregates.gastosBreakdown
            .filter((row) => row.grupo_gasto === 'operativo')
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const costosVariablesMes = periodAggregates.gastosBreakdown
            .filter((row) => row.grupo_gasto === 'costo_directo')
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const egresosCaja = periodAggregates.gastosBreakdown
            .filter((row) => row.tipo_fondo === 'caja')
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const egresosBanco = periodAggregates.gastosBreakdown
            .filter((row) => row.tipo_fondo === 'banco')
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const top3ClinicasTotal = incomeBreakdown.ingresosPorClinica
            .slice(0, 3)
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const top3ProductosTotal = incomeBreakdown.ingresosPorProducto
            .slice(0, 3)
            .reduce((sum, row) => sum + toNumber(row.total), 0);

        const margenContribucion = ingresosMes > 0 ? (ingresosMes - costosVariablesMes) / ingresosMes : 0;
        const puntoEquilibrio = margenContribucion > 0 ? costosFijosMes / margenContribucion : null;
        const margenOperativo = ingresosPeriodo > 0 ? ((ingresosPeriodo - egresosPeriodo) / ingresosPeriodo) * 100 : 0;

        const ingresosPrevPeriodo = toNumber(strategicComparison.ingresosPrevPeriodo.total);
        const pedidosCobradosPeriodo = Number.parseInt(strategicComparison.pedidosCobradosPeriodo.total || 0, 10);

        const ingresoSeriesMap = new Map(monthlySeries.ingresosMensuales.map((row) => [toDateKey(row.periodo), toNumber(row.ingresos)]));
        const egresoSeriesMap = new Map(monthlySeries.egresosMensuales.map((row) => [toDateKey(row.periodo), toNumber(row.egresos)]));

        const monthlySeriesMerged = [];
        for (let i = 5; i >= 0; i -= 1) {
            const date = new Date();
            date.setDate(1);
            date.setMonth(date.getMonth() - i);
            const key = date.toISOString().slice(0, 10);
            monthlySeriesMerged.push({
                periodo: key,
                ingresos: ingresoSeriesMap.get(key) || 0,
                egresos: egresoSeriesMap.get(key) || 0,
                flujo_neto: (ingresoSeriesMap.get(key) || 0) - (egresoSeriesMap.get(key) || 0)
            });
        }

        return {
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
                por_clinica: incomeBreakdown.ingresosPorClinica.map((row) => ({
                    clinica: row.clinica,
                    total: toNumber(row.total)
                })),
                por_producto: incomeBreakdown.ingresosPorProducto.map((row) => ({
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
                por_categoria: periodAggregates.gastosBreakdown.map((row) => ({
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
                top_clinicas_periodo: incomeBreakdown.ingresosPorClinica.map((row) => ({
                    clinica: row.clinica,
                    total: toNumber(row.total),
                    participacion_pct: ingresosPeriodo > 0 ? (toNumber(row.total) / ingresosPeriodo) * 100 : 0
                })),
                top_productos_periodo: incomeBreakdown.ingresosPorProducto.map((row) => ({
                    producto: row.producto,
                    total: toNumber(row.total),
                    participacion_pct: ingresosPeriodo > 0 ? (toNumber(row.total) / ingresosPeriodo) * 100 : 0
                })),
                historico_top_clinicas: historicalTops.historicoTopClinicas.map((row) => ({
                    periodo: row.periodo,
                    clinica: row.clinica,
                    total: toNumber(row.total)
                })),
                historico_top_productos: historicalTops.historicoTopProductos.map((row) => ({
                    periodo: row.periodo,
                    producto: row.producto,
                    total: toNumber(row.total)
                }))
            },
            series: {
                mensual: monthlySeriesMerged
            }
        };
    }
});
