import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useDashboardStatsQuery } from '../modules/dashboard/queries/useDashboardStatsQuery.js';
import { useDashboardFinanceQuery } from '../modules/dashboard/queries/useDashboardFinanceQuery.js';
import '../styles/dashboard-ui-consistency.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const statusLabels = {
    pendiente: 'Pendiente', en_diseno: 'En Diseño', esperando_aprobacion: 'Esperando Aprobación',
    en_produccion: 'En Producción', terminado: 'Terminado', enviado: 'Enviado'
};
const dashboardPalette = {
    blue: 'rgba(37, 99, 235, 0.72)',
    sky: 'rgba(14, 165, 233, 0.72)',
    cyan: 'rgba(8, 145, 178, 0.72)',
    teal: 'rgba(20, 184, 166, 0.72)',
    emerald: 'rgba(16, 185, 129, 0.72)',
    amber: 'rgba(245, 158, 11, 0.72)',
    violet: 'rgba(139, 92, 246, 0.72)',
    red: 'rgba(239, 68, 68, 0.72)',
    orange: 'rgba(249, 115, 22, 0.72)',
    gray: 'rgba(107, 114, 128, 0.72)'
};
const dashboardGridColor = 'rgba(0,0,0,0.05)';
const statusColors = [dashboardPalette.amber, dashboardPalette.violet, dashboardPalette.blue, dashboardPalette.cyan, dashboardPalette.emerald, dashboardPalette.gray];

const formatCurrency = (value) => {
    const number = parseFloat(value || 0);
    if (Number.isNaN(number)) return 'S/. 0.00';
    return `S/. ${number.toFixed(2)}`;
};

const toNumber = (value) => {
    const number = parseFloat(value || 0);
    return Number.isNaN(number) ? 0 : number;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const daysAgoIso = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
};

const toMonthLabel = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-PE', { month: 'short' });
};

const formatDateShort = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const formatPercent = (value) => `${toNumber(value).toFixed(1)}%`;

const toMonthKey = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
};

const Dashboard = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('operativo');
    const [financeView, setFinanceView] = useState('resumen');
    const [strategicTopN, setStrategicTopN] = useState(5);
    const [strategicMetric, setStrategicMetric] = useState('monto');
    const [operativeView, setOperativeView] = useState('produccion');
    const [operativeRange, setOperativeRange] = useState('12m');
    const [filters, setFilters] = useState({
        from: daysAgoIso(90),
        to: todayIso()
    });

    const financeRange = useMemo(() => ({
        from: filters.from,
        to: filters.to
    }), [filters.from, filters.to]);
    const dashboardStatsQuery = useDashboardStatsQuery();
    const dashboardFinanceQuery = useDashboardFinanceQuery({
        range: financeRange,
        enabled: activeView === 'financiero'
    });
    const stats = dashboardStatsQuery.data || null;
    const financeStats = dashboardFinanceQuery.data || null;
    const loading = dashboardStatsQuery.isLoading;
    const loadingFinance = dashboardFinanceQuery.isLoading && !dashboardFinanceQuery.data;

    if (loading) {
        return (
            <div className="dashboard-page">
                <div className="page-header"><div className="page-header-left"><h1>Dashboard</h1></div></div>
                <div className="dashboard-loading-grid grid grid-cols-5">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton dashboard-loading-card" />)}
                </div>
            </div>
        );
    }

    const kpis = stats?.kpis || {};
    const topProductoMes = stats?.top_producto_mes || null;
    const topClinicaMes = stats?.top_clinica_mes || null;
    const topProductosMes = stats?.top_productos_mes || [];
    const topClinicasMes = stats?.top_clinicas_mes || [];
    const historicoOperativo = stats?.historico_operativo_12m || [];
    const historicoTopProducto = stats?.historico_top_producto_12m || [];
    const historicoTopClinica = stats?.historico_top_clinica_12m || [];
    const finance = financeStats || {};
    const liquidez = finance?.liquidez || {};
    const ingresosFin = finance?.ingresos || {};
    const gastosFin = finance?.gastos || {};
    const estrategicos = finance?.estrategicos || {};
    const estrategicosKpis = estrategicos?.kpis || {};

    const kpiCardsMesNumericos = [
        { label: 'Pedidos del mes', value: kpis.pedidos_mes, icon: 'bi-calendar2-week', detail: 'Registrados este mes' },
        { label: 'Nuevos clientes con pedido', value: kpis.nuevos_clientes_mes, icon: 'bi-person-plus', detail: 'Clínicas nuevas con actividad' },
        { label: 'Reprocesos en el mes', value: kpis.retrocesos_mes, icon: 'bi-arrow-counterclockwise', detail: 'Pedidos que volvieron de etapa' }
    ];

    const kpiCardsMesDatos = [
        { label: 'Producto top del mes', value: topProductoMes?.producto || 'Sin pedidos', detail: `${topProductoMes?.cantidad || 0} pedidos`, icon: 'bi-award' },
        { label: 'Clínica top del mes', value: topClinicaMes?.clinica || 'Sin pedidos', detail: `${topClinicaMes?.pedidos || 0} pedidos`, icon: 'bi-building-check' }
    ];

    const kpiCardsOperacion = [
        {
            label: 'Trabajos por terminar',
            value: kpis.trabajos_por_terminar,
            icon: 'bi-hourglass-split',
            detail: 'Pendientes de cerrar'
        },
        {
            label: 'Trabajos en producción',
            value: kpis.en_produccion,
            icon: 'bi-gear',
            detail: 'Pedidos fabricándose ahora'
        },
        {
            label: 'Pedidos retrasados',
            value: kpis.retrasados,
            icon: 'bi-alarm',
            detail: 'Con fecha de entrega vencida'
        },
        {
            label: 'Clínicas activas',
            value: kpis.clinicas_activas,
            icon: 'bi-building',
            detail: 'Con actividad vigente'
        }
    ];

    const doughnutData = {
        labels: (stats?.por_estado || []).map(e => statusLabels[e.estado] || e.estado),
        datasets: [{
            data: (stats?.por_estado || []).map(e => parseInt(e.count)),
            backgroundColor: statusColors.slice(0, (stats?.por_estado || []).length),
            borderWidth: 0, borderRadius: 4,
        }]
    };

    const monthsMap = { '3m': 3, '6m': 6, '12m': 12 };
    const selectedMonths = monthsMap[operativeRange] || 12;
    const historicoOperativoSlice = historicoOperativo.slice(-selectedMonths);
    const historicoTopProductoSlice = historicoTopProducto.slice(-selectedMonths);
    const historicoTopClinicaSlice = historicoTopClinica.slice(-selectedMonths);

    const operativoBarDataSlice = {
        labels: historicoOperativoSlice.map((item) => toMonthLabel(item.periodo)),
        datasets: [
            {
                label: 'Pedidos',
                data: historicoOperativoSlice.map((item) => toNumber(item.pedidos)),
                backgroundColor: dashboardPalette.cyan,
                borderRadius: 6,
                borderSkipped: false
            },
            {
                label: 'Nuevos clientes con pedido',
                data: historicoOperativoSlice.map((item) => toNumber(item.nuevos_clientes)),
                backgroundColor: dashboardPalette.violet,
                borderRadius: 6,
                borderSkipped: false
            }
        ]
    };

    const financeSeries = finance?.series?.mensual || [];
    const financeBarData = {
        labels: financeSeries.map((item) => toMonthLabel(item?.periodo)),
        datasets: [
            {
                label: 'Ingresos cobrados',
                data: financeSeries.map((item) => toNumber(item?.ingresos)),
                backgroundColor: dashboardPalette.emerald,
                borderRadius: 6,
                borderSkipped: false
            },
            {
                label: 'Egresos',
                data: financeSeries.map((item) => toNumber(item?.egresos)),
                backgroundColor: dashboardPalette.red,
                borderRadius: 6,
                borderSkipped: false
            }
        ]
    };

    const gastoCategoriasTop = (gastosFin?.por_categoria || []).slice(0, 6);
    const gastosDonutData = {
        labels: gastoCategoriasTop.map((row) => (row?.categoria || 'sin categoria').split('_').join(' ')),
        datasets: [{
            data: gastoCategoriasTop.map((row) => toNumber(row?.total)),
            backgroundColor: [
                dashboardPalette.red,
                dashboardPalette.orange,
                dashboardPalette.amber,
                dashboardPalette.sky,
                dashboardPalette.violet,
                dashboardPalette.emerald
            ],
            borderWidth: 0,
            borderRadius: 4
        }]
    };

    const topClinicasEstrategico = (estrategicos.top_clinicas_periodo || []).slice(0, strategicTopN);
    const topProductosEstrategico = (estrategicos.top_productos_periodo || []).slice(0, strategicTopN);
    const topClinicaActual = topClinicasEstrategico[0] || null;
    const topProductoActual = topProductosEstrategico[0] || null;

    const getStrategicValue = (row) => (strategicMetric === 'pct' ? toNumber(row.participacion_pct) : toNumber(row.total));

    const topClinicasChartData = {
        labels: topClinicasEstrategico.map((row) => row.clinica),
        datasets: [
            {
                label: 'Ingresos por clínica',
                data: topClinicasEstrategico.map((row) => getStrategicValue(row)),
                backgroundColor: dashboardPalette.cyan,
                borderRadius: 8,
                borderSkipped: false
            }
        ]
    };

    const topProductosChartData = {
        labels: topProductosEstrategico.map((row) => row.producto),
        datasets: [
            {
                label: 'Ingresos por producto/servicio',
                data: topProductosEstrategico.map((row) => getStrategicValue(row)),
                backgroundColor: dashboardPalette.blue,
                borderRadius: 8,
                borderSkipped: false
            }
        ]
    };

    const strategicHistoryClinicas = estrategicos.historico_top_clinicas || [];
    const strategicHistoryProductos = estrategicos.historico_top_productos || [];

    const historyMap = new Map();
    strategicHistoryClinicas.forEach((row) => {
        const key = toMonthKey(row.periodo);
        if (!key) return;
        const current = historyMap.get(key) || { clinicas: 0, productos: 0 };
        current.clinicas += toNumber(row.total);
        historyMap.set(key, current);
    });
    strategicHistoryProductos.forEach((row) => {
        const key = toMonthKey(row.periodo);
        if (!key) return;
        const current = historyMap.get(key) || { clinicas: 0, productos: 0 };
        current.productos += toNumber(row.total);
        historyMap.set(key, current);
    });

    const strategicYear = (() => {
        const date = new Date(filters.to || todayIso());
        return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
    })();

    const historyRows = Array.from({ length: 12 }, (_, monthIndex) => {
        const periodo = `${strategicYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const values = historyMap.get(periodo) || { clinicas: 0, productos: 0 };
        return { periodo, ...values };
    });

    const strategicHistoryData = {
        labels: historyRows.map((row) => toMonthLabel(row.periodo)),
        datasets: [
            {
                label: 'Top clínicas (suma mensual)',
                data: historyRows.map((row) => row.clinicas),
                backgroundColor: dashboardPalette.cyan,
                borderRadius: 8,
                borderSkipped: false
            },
            {
                label: 'Top productos (suma mensual)',
                data: historyRows.map((row) => row.productos),
                backgroundColor: dashboardPalette.blue,
                borderRadius: 8,
                borderSkipped: false
            }
        ]
    };

    const liquidityCards = [
        { label: 'Saldo en caja', value: formatCurrency(liquidez.saldo_caja), icon: 'bi-safe2', detail: 'Fondos disponibles en caja' },
        { label: 'Saldo en bancos', value: formatCurrency(liquidez.saldo_bancos), icon: 'bi-bank', detail: 'Fondos disponibles en bancos' },
        { label: 'Flujo del día', value: formatCurrency(liquidez.flujo_dia), icon: 'bi-lightning', detail: 'Ingreso neto de hoy' },
        { label: 'Flujo del mes', value: formatCurrency(liquidez.flujo_mes), icon: 'bi-calendar-check', detail: 'Ingreso neto del mes' }
    ];

    const businessCards = [
        { label: 'Ingresos del mes', value: formatCurrency(ingresosFin.mes), icon: 'bi-currency-dollar', detail: 'Cobrado en el período actual' },
        { label: 'Ingresos mes en caja', value: formatCurrency(ingresosFin.mes_caja), icon: 'bi-wallet', detail: 'Disponible en caja' },
        { label: 'Ingresos mes en bancos', value: formatCurrency(ingresosFin.mes_banco), icon: 'bi-credit-card', detail: 'Disponible en bancos' },
        { label: 'Gastos totales del mes', value: formatCurrency(gastosFin.mes_total), icon: 'bi-receipt-cutoff', detail: 'Egresos acumulados del mes' }
    ];

    const renderDashboardMetricCard = (kpi, i, options = {}) => {
        const valueClassName = [
            'dashboard-kpi-main-value',
            options.currency ? 'dashboard-kpi-currency' : '',
            options.valueClassName || ''
        ].filter(Boolean).join(' ');

        return (
            <div key={options.key || i} className={`card kpi-card dashboard-kpi-card ${options.className || ''}`.trim()}>
                <div className="dashboard-kpi-shell">
                    <div className="dashboard-kpi-row">
                        <div className="dashboard-kpi-heading-group">
                            <div className="dashboard-kpi-heading">{kpi.label}</div>
                        </div>
                        <div className="kpi-icon dashboard-kpi-icon-right">
                            <i className={`bi ${kpi.icon}`}></i>
                        </div>
                    </div>
                    <div className={valueClassName}>{kpi.value ?? 0}</div>
                    {kpi.detail && <div className={`dashboard-kpi-note ${options.noteClassName || ''}`.trim()}>{kpi.detail}</div>}
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in dashboard-page">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard</h1>
                    <p>Liquidez, ingresos, gastos y operación del laboratorio</p>
                </div>
            </div>

            <div className="dashboard-view-switcher" role="group" aria-label="Vista principal del dashboard">
                <button
                    type="button"
                    className={`btn dashboard-view-tab ${activeView === 'operativo' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveView('operativo')}
                    aria-pressed={activeView === 'operativo'}
                >
                    <i className="bi bi-clipboard-data" aria-hidden="true"></i> Operativo
                </button>
                <button
                    type="button"
                    className={`btn dashboard-view-tab ${activeView === 'financiero' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveView('financiero')}
                    aria-pressed={activeView === 'financiero'}
                >
                    <i className="bi bi-cash-coin" aria-hidden="true"></i> Financiero BI
                </button>
            </div>

            {activeView === 'financiero' && (
                <>
            <div className="card dashboard-filters-card">
                <div className="dashboard-filters-grid">
                    <div className="form-group">
                        <label className="form-label">Desde</label>
                        <input
                            type="date"
                            className="form-input"
                            value={filters.from}
                            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Hasta</label>
                        <input
                            type="date"
                            className="form-input"
                            value={filters.to}
                            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                        />
                    </div>
                </div>
                <div className="dashboard-filters-actions" role="group" aria-label="Rangos rapidos del dashboard financiero">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setFilters((prev) => ({ ...prev, from: daysAgoIso(30), to: todayIso() }))}>Últimos 30 días</button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setFilters((prev) => ({ ...prev, from: daysAgoIso(60), to: todayIso() }))}>Últimos 60 días</button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setFilters((prev) => ({ ...prev, from: daysAgoIso(90), to: todayIso() }))}>Últimos 90 días</button>
                </div>
            </div>

            <div className="card dashboard-toolbar-card dashboard-toolbar-card--padded">
                <div className="dashboard-toolbar-group" role="group" aria-label="Vista financiera">
                    <button type="button" aria-pressed={financeView === 'resumen'} className={`btn btn-sm ${financeView === 'resumen' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFinanceView('resumen')}>
                        <i className="bi bi-grid" aria-hidden="true"></i> Resumen financiero
                    </button>
                    <button type="button" aria-pressed={financeView === 'estrategicos'} className={`btn btn-sm ${financeView === 'estrategicos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFinanceView('estrategicos')}>
                        <i className="bi bi-bar-chart-line" aria-hidden="true"></i> Estratégicos
                    </button>
                </div>
            </div>

            {financeView === 'resumen' && (
                <>

            <div className="card dashboard-stack">
                <div className="card-header dashboard-card-header">
                    <div>
                        <h3 className="card-title">Indicadores de liquidez</h3>
                        <p className="card-subtitle">Control de caja y flujo en tiempo real</p>
                    </div>
                </div>
                {loadingFinance ? (
                    <div className="grid dashboard-kpi-grid-liquid dashboard-staggered-grid">
                        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton dashboard-loading-card" />)}
                    </div>
                ) : (
                    <div className="grid dashboard-kpi-grid-liquid dashboard-staggered-grid">
                        {liquidityCards.map((kpi, i) => (
                            renderDashboardMetricCard(kpi, i, {
                                currency: true,
                                className: 'animate-slide-up'
                            })
                        ))}
                    </div>
                )}
            </div>

            <div className="card dashboard-stack">
                <div className="card-header dashboard-card-header">
                    <div>
                        <h3 className="card-title">Control de ingresos y gastos</h3>
                        <p className="card-subtitle">Indicadores clave mensuales para decisiones rápidas</p>
                    </div>
                </div>
                {loadingFinance ? (
                    <div className="grid dashboard-kpi-grid-liquid dashboard-staggered-grid">
                        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton dashboard-loading-card" />)}
                    </div>
                ) : (
                    <div className="grid dashboard-kpi-grid-liquid dashboard-staggered-grid">
                        {businessCards.map((kpi, i) => (
                            renderDashboardMetricCard(kpi, i, {
                                currency: true,
                                className: 'animate-slide-up'
                            })
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-3 dashboard-stack">
                <div className="card col-span-2">
                    <div className="card-header"><h3 className="card-title">BI mensual: ingresos vs egresos</h3></div>
                    {loadingFinance ? (
                        <div className="skeleton dashboard-chart-shell dashboard-loading-chart-card" />
                    ) : financeSeries.length > 0 ? (
                        <Bar
                            data={financeBarData}
                            options={{
                                responsive: true,
                                plugins: { legend: { display: true } },
                                scales: {
                                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                                    y: { grid: { color: dashboardGridColor }, ticks: { font: { size: 11 } } }
                                }
                            }}
                        />
                    ) : (
                        <div className="empty-state"><p className="empty-state-text">Sin movimientos suficientes para BI mensual</p></div>
                    )}
                </div>
                <div className="card">
                    <div className="card-header"><h3 className="card-title">Gastos por categoría</h3></div>
                    {loadingFinance ? (
                        <div className="skeleton dashboard-chart-shell dashboard-loading-chart-card" />
                    ) : gastoCategoriasTop.length > 0 ? (
                        <Doughnut
                            data={gastosDonutData}
                            options={{
                                plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } } },
                                cutout: '58%'
                            }}
                        />
                    ) : (
                        <div className="empty-state"><p className="empty-state-text">No hay egresos registrados</p></div>
                    )}
                </div>
            </div>

                </>
            )}

            {financeView === 'estrategicos' && (
                <>
                    <div className="card dashboard-stack dashboard-toolbar-card--padded">
                        <div className="dashboard-toolbar-row">
                            <div>
                                <h3 className="card-title">Centro Estratégico</h3>
                                <p className="card-subtitle">Identifica rápidamente qué clínica y qué producto impulsan tus ingresos</p>
                            </div>
                            <div className="dashboard-toolbar-group" role="group" aria-label="Opciones del centro estrategico">
                                <button type="button" aria-pressed={strategicTopN === 5} className={`btn btn-sm ${strategicTopN === 5 ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setStrategicTopN(5)}>Top 5</button>
                                <button type="button" aria-pressed={strategicTopN === 10} className={`btn btn-sm ${strategicTopN === 10 ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setStrategicTopN(10)}>Top 10</button>
                                <button type="button" aria-pressed={strategicMetric === 'monto'} aria-label="Ver montos en soles" className={`btn btn-sm ${strategicMetric === 'monto' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStrategicMetric('monto')}>S/.</button>
                                <button type="button" aria-pressed={strategicMetric === 'pct'} aria-label="Ver porcentajes" className={`btn btn-sm ${strategicMetric === 'pct' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStrategicMetric('pct')}>%</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid dashboard-kpi-grid-liquid dashboard-staggered-grid dashboard-stack">
                        {renderDashboardMetricCard({
                            label: 'Clínica líder del período',
                            value: topClinicaActual ? topClinicaActual.clinica : 'Sin datos',
                            detail: topClinicaActual ? formatCurrency(topClinicaActual.total) : 'S/. 0.00',
                            icon: 'bi-building-check'
                        }, 'strategic-clinic', { className: 'strategic-kpi-card' })}
                        {renderDashboardMetricCard({
                            label: 'Producto líder del período',
                            value: topProductoActual ? topProductoActual.producto : 'Sin datos',
                            detail: topProductoActual ? formatCurrency(topProductoActual.total) : 'S/. 0.00',
                            icon: 'bi-box-seam'
                        }, 'strategic-product', { className: 'strategic-kpi-card' })}
                        {renderDashboardMetricCard({
                            label: 'Concentración top 3 clínicas',
                            value: formatPercent(estrategicosKpis.concentracion_top3_clinicas_pct),
                            detail: 'Participación sobre ingresos',
                            icon: 'bi-pie-chart'
                        }, 'strategic-clinics-pct', { className: 'strategic-kpi-card', currency: true })}
                        {renderDashboardMetricCard({
                            label: 'Concentración top 3 productos',
                            value: formatPercent(estrategicosKpis.concentracion_top3_productos_pct),
                            detail: 'Participación sobre ingresos',
                            icon: 'bi-bar-chart'
                        }, 'strategic-products-pct', { className: 'strategic-kpi-card', currency: true })}
                    </div>

                    <div className="grid strategic-bento-main dashboard-stack">
                        <div className="card">
                            <div className="card-header"><h3 className="card-title">Ranking de clínicas</h3></div>
                            {topClinicasEstrategico.length > 0 ? (
                                <div className="strategic-chart-shell">
                                    <Bar
                                        data={topClinicasChartData}
                                        options={{
                                            indexAxis: 'y',
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: {
                                                x: { grid: { color: dashboardGridColor }, ticks: { font: { size: 11 } } },
                                                y: { grid: { display: false }, ticks: { font: { size: 11 } } }
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="empty-state"><p className="empty-state-text">Sin datos por clínica</p></div>
                            )}
                        </div>
                        <div className="card">
                            <div className="card-header"><h3 className="card-title">Ranking de productos</h3></div>
                            {topProductosEstrategico.length > 0 ? (
                                <div className="strategic-chart-shell">
                                    <Bar
                                        data={topProductosChartData}
                                        options={{
                                            indexAxis: 'y',
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: {
                                                x: { grid: { color: dashboardGridColor }, ticks: { font: { size: 11 } } },
                                                y: { grid: { display: false }, ticks: { font: { size: 11 } } }
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="empty-state"><p className="empty-state-text">Sin datos por producto</p></div>
                            )}
                        </div>
                    </div>

                    <div className="card dashboard-stack">
                        <div className="card-header"><h3 className="card-title">Histórico estratégico mensual</h3></div>
                        {historyRows.length > 0 ? (
                            <div className="strategic-chart-shell strategic-chart-shell--short">
                                <Bar
                                    data={strategicHistoryData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: true } },
                                        scales: {
                                            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                                            y: { grid: { color: dashboardGridColor }, ticks: { font: { size: 11 } } }
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="empty-state"><p className="empty-state-text">Sin histórico estratégico disponible</p></div>
                        )}
                    </div>
                </>
            )}

                </>
            )}

            {/* KPIs */}
            {activeView === 'operativo' && (
                <>
            <div className="card dashboard-stack">
                <div className="dashboard-toolbar-row">
                    <div className="dashboard-toolbar-group" role="group" aria-label="Vista operativa">
                        <button type="button" aria-pressed={operativeView === 'produccion'} className={`btn btn-sm ${operativeView === 'produccion' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOperativeView('produccion')}>Producción</button>
                        <button type="button" aria-pressed={operativeView === 'resumen'} className={`btn btn-sm ${operativeView === 'resumen' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOperativeView('resumen')}>Resumen del mes</button>
                        <button type="button" aria-pressed={operativeView === 'historico'} className={`btn btn-sm ${operativeView === 'historico' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOperativeView('historico')}>Histórico</button>
                        <button type="button" aria-pressed={operativeView === 'tops'} className={`btn btn-sm ${operativeView === 'tops' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOperativeView('tops')}>Tops</button>
                    </div>
                    <div className="dashboard-toolbar-group" role="group" aria-label="Rango operativo">
                        <button type="button" aria-pressed={operativeRange === '3m'} aria-label="Ultimos 3 meses" className={`btn btn-sm ${operativeRange === '3m' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setOperativeRange('3m')}>3m</button>
                        <button type="button" aria-pressed={operativeRange === '6m'} aria-label="Ultimos 6 meses" className={`btn btn-sm ${operativeRange === '6m' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setOperativeRange('6m')}>6m</button>
                        <button type="button" aria-pressed={operativeRange === '12m'} aria-label="Ultimos 12 meses" className={`btn btn-sm ${operativeRange === '12m' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setOperativeRange('12m')}>12m</button>
                    </div>
                </div>
            </div>

            {operativeView === 'resumen' && (
                <>
                    <div className="card dashboard-stack">
                        <div className="card-header dashboard-card-header">
                            <div>
                                <h3 className="card-title">Indicadores comerciales del mes</h3>
                                <p className="card-subtitle">Separa métricas numéricas de los datos destacados del mes</p>
                            </div>
                        </div>
                        <div className="dashboard-summary-groups">
                            <div>
                                <div className="dashboard-summary-group-title">Métricas numéricas</div>
                                <div className="grid dashboard-kpi-grid-liquid dashboard-kpi-grid-numeric dashboard-staggered-grid">
                                    {kpiCardsMesNumericos.map((kpi, i) => (
                                        renderDashboardMetricCard(kpi, i, {
                                            className: 'animate-slide-up dashboard-kpi-card-numeric'
                                        })
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="dashboard-summary-group-title">Datos destacados</div>
                                <div className="grid dashboard-kpi-grid-liquid dashboard-kpi-grid-featured dashboard-staggered-grid">
                                    {kpiCardsMesDatos.map((kpi, i) => (
                                        renderDashboardMetricCard(kpi, i, {
                                            key: `featured-${i}`,
                                            className: 'animate-slide-up dashboard-kpi-card-featured',
                                            valueClassName: 'dashboard-kpi-main-value-featured',
                                            noteClassName: 'dashboard-kpi-note-featured'
                                        })
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 dashboard-stack">
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Top 5 productos del mes</h3>
                                    <p className="card-subtitle">Los productos con mayor volumen de pedidos</p>
                                </div>
                            </div>
                            {topProductosMes.length > 0 ? (
                                <div className="dashboard-list compact">
                                    {topProductosMes.map((row, index) => (
                                        <div key={`${row.producto}-${index}`} className="dashboard-list-item">
                                            <span>{index + 1}. {row.producto}</span>
                                            <strong>{row.cantidad}</strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state"><p className="empty-state-text">Sin productos del mes</p></div>
                            )}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Top 5 clínicas del mes</h3>
                                    <p className="card-subtitle">Las clínicas que más pedidos enviaron</p>
                                </div>
                            </div>
                            {topClinicasMes.length > 0 ? (
                                <div className="dashboard-list compact">
                                    {topClinicasMes.map((row, index) => (
                                        <div key={`${row.clinica}-${index}`} className="dashboard-list-item">
                                            <span>{index + 1}. {row.clinica}</span>
                                            <strong>{row.pedidos}</strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state"><p className="empty-state-text">Sin clínicas del mes</p></div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {operativeView === 'historico' && (
                <div className="card dashboard-stack">
                    <div className="card-header"><h3 className="card-title">Histórico {selectedMonths} meses: pedidos y nuevos clientes</h3></div>
                    {historicoOperativoSlice.length > 0 ? (
                        <Bar data={operativoBarDataSlice} options={{
                            responsive: true,
                            plugins: { legend: { display: true } },
                            scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                                y: { grid: { color: dashboardGridColor }, ticks: { font: { size: 11 } } }
                            }
                        }} />
                    ) : (
                        <div className="empty-state"><p className="empty-state-text">Sin histórico disponible</p></div>
                    )}
                </div>
            )}

            {operativeView === 'tops' && (
                <div className="grid grid-cols-3 dashboard-stack">
                    <div className="card col-span-1">
                        <div className="card-header"><h3 className="card-title">Top producto por mes</h3></div>
                        {historicoTopProductoSlice.length > 0 ? (
                            <div className="dashboard-list compact">
                                {historicoTopProductoSlice.map((row) => (
                                    <div key={`${row.periodo}-${row.producto}`} className="dashboard-list-item"><span>{toMonthLabel(row.periodo)} · {row.producto}</span><strong>{row.cantidad}</strong></div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state"><p className="empty-state-text">Sin datos de producto top</p></div>
                        )}
                    </div>
                    <div className="card col-span-1">
                        <div className="card-header"><h3 className="card-title">Top clínica por mes</h3></div>
                        {historicoTopClinicaSlice.length > 0 ? (
                            <div className="dashboard-list compact">
                                {historicoTopClinicaSlice.map((row) => (
                                    <div key={`${row.periodo}-${row.clinica}`} className="dashboard-list-item"><span>{toMonthLabel(row.periodo)} · {row.clinica}</span><strong>{row.pedidos}</strong></div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state"><p className="empty-state-text">Sin datos de clínica top</p></div>
                        )}
                    </div>
                    <div className="card col-span-1">
                        <div className="card-header"><h3 className="card-title">Top actual del mes</h3></div>
                        <div className="dashboard-list compact">
                            <div className="dashboard-list-item"><span>Producto líder</span><strong>{topProductoMes ? `${topProductoMes.producto} (${topProductoMes.cantidad})` : 'Sin pedidos'}</strong></div>
                            <div className="dashboard-list-item"><span>Clínica líder</span><strong>{topClinicaMes ? `${topClinicaMes.clinica} (${topClinicaMes.pedidos})` : 'Sin pedidos'}</strong></div>
                        </div>
                    </div>
                </div>
            )}

            {operativeView === 'produccion' && (
                <div className="card dashboard-stack">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Operación del laboratorio</h3>
                            <p className="card-subtitle">Prioriza lo pendiente por cerrar, la carga real en producción y los pedidos atrasados</p>
                        </div>
                    </div>
                    <div className="grid dashboard-kpi-grid-liquid">
                        {kpiCardsOperacion.map((kpi, i) => (
                            renderDashboardMetricCard(kpi, i)
                        ))}
                    </div>
                </div>
            )}

            {operativeView === 'produccion' && (
                <div className="card dashboard-stack">
                    <div className="card-header"><h3 className="card-title">Pedidos por Estado</h3></div>
                    <div className="dashboard-chart-donut-shell">
                        {(stats?.por_estado || []).length > 0 ? (
                            <Doughnut data={doughnutData} options={{
                                plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } } },
                                cutout: '65%'
                            }} />
                        ) : (
                            <div className="empty-state"><p className="empty-state-text">Sin datos</p></div>
                        )}
                    </div>
                </div>
            )}

            {operativeView === 'produccion' && (
                <div className="card dashboard-stack">
                    <div className="card-header">
                        <h3 className="card-title">Pedidos Recientes</h3>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/pedidos')}>Ver todos →</button>
                    </div>
                    {(stats?.recientes || []).length > 0 ? (
                        <>
                            <div className="data-table-wrapper desktop-only dashboard-data-table-shell">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Código</th><th>Paciente</th><th>Clínica</th><th>Estado</th><th>Entrega</th><th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recientes.map(p => (
                                        <tr key={p.id} className="dashboard-clickable-row" onClick={() => navigate(`/pedidos/${p.id}`)}>
                                            <td><strong>{p.codigo}</strong></td>
                                            <td>{p.paciente_nombre}</td>
                                            <td>{p.clinica_nombre}</td>
                                            <td><span className={`badge badge-dot badge-${p.estado}`}>{statusLabels[p.estado]}</span></td>
                                            <td>{formatDateShort(p.fecha_entrega)}</td>
                                            <td><strong>S/. {parseFloat(p.total ?? 0).toFixed(2)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                            <div className="mobile-cards mobile-only recent-orders-mobile">
                                {stats.recientes.map(p => (
                                    <div key={p.id} className="mobile-card recent-order-card dashboard-mobile-card" onClick={() => navigate(`/pedidos/${p.id}`)}>
                                        <div className="mobile-card-head">
                                            <div className="mobile-card-title">{p.codigo}</div>
                                            <span className={`badge badge-dot badge-${p.estado}`}>{statusLabels[p.estado]}</span>
                                        </div>
                                        <div className="mobile-card-grid">
                                            <div className="mobile-field"><span className="mobile-field-label">Paciente</span><span className="mobile-field-value">{p.paciente_nombre}</span></div>
                                            <div className="mobile-field"><span className="mobile-field-label">Clinica</span><span className="mobile-field-value">{p.clinica_nombre}</span></div>
                                            <div className="mobile-field"><span className="mobile-field-label">Entrega</span><span className="mobile-field-value">{formatDateShort(p.fecha_entrega)}</span></div>
                                            <div className="mobile-field"><span className="mobile-field-label">Total</span><span className="mobile-field-value"><strong>S/. {parseFloat(p.total ?? 0).toFixed(2)}</strong></span></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <i className="bi bi-clipboard2 empty-state-icon"></i>
                            <p className="empty-state-text">No hay pedidos recientes</p>
                        </div>
                    )}
                </div>
            )}
                </>
            )}
        </div>
    );
};

export default Dashboard;
