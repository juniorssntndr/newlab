import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useAuth } from '../state/AuthContext.jsx';
import { useDashboardStatsQuery } from '../modules/dashboard/queries/useDashboardStatsQuery.js';
import { useDashboardFinanceQuery } from '../modules/dashboard/queries/useDashboardFinanceQuery.js';
import { canAccessFinanceDashboard } from '../utils/accessControl.js';
import { getOrderStatusLabel } from '../utils/orderStatusLabels.js';
import OrderProductThumb from '../components/orders/OrderProductThumb.jsx';
import FormDatePicker from '../components/FormDatePicker.jsx';
import { sortTeethByArchOrder } from '../utils/odontograma.js';
import '../styles/dashboard-ui-consistency.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const MAX_TEETH_PREVIEW = 4;

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

const getStrategicRankShellStyle = (count) => {
    const rows = Math.max(1, count);
    const height = Math.max(168, Math.min(460, rows * 42 + 52));
    return { height, minHeight: height };
};

const truncateChartLabel = (label, max = 22) => {
    const text = String(label || '');
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
};

const buildStrategicRankChartOptions = () => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    datasets: {
        bar: {
            categoryPercentage: 0.72,
            barPercentage: 0.82,
            borderRadius: 6,
            maxBarThickness: 28
        }
    },
    scales: {
        x: {
            grid: { color: dashboardGridColor },
            ticks: { font: { size: 10 }, maxTicksLimit: 5 }
        },
        y: {
            grid: { display: false },
            ticks: {
                font: { size: 10 },
                autoSkip: false,
                callback(value) {
                    return truncateChartLabel(this.getLabelForValue(value));
                }
            }
        }
    },
    layout: { padding: { top: 2, bottom: 2, right: 6 } }
});

const STRATEGIC_RANK_CHART_OPTIONS = buildStrategicRankChartOptions();

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
    const { user } = useAuth();
    const canAccessFinance = canAccessFinanceDashboard(user);
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
        enabled: canAccessFinance && activeView === 'financiero'
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
    const maxTopProductoCantidad = Math.max(
        ...topProductosMes.map((row) => Number(row.cantidad) || 0),
        1,
    );
    const maxTopClinicaPedidos = Math.max(
        ...topClinicasMes.map((row) => Number(row.pedidos) || 0),
        1,
    );
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
    const historicoTopProductoSlice = historicoTopProducto.slice(-12);
    const historicoTopClinicaSlice = historicoTopClinica.slice(-12);
    const maxHistoricoTopProducto = Math.max(
        ...historicoTopProductoSlice.map((item) => Number(item.cantidad) || 0),
        1,
    );
    const maxHistoricoTopClinica = Math.max(
        ...historicoTopClinicaSlice.map((item) => Number(item.pedidos) || 0),
        1,
    );

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
                        <div className="kpi-icon" aria-hidden="true">
                            <i className={`bi ${kpi.icon}`}></i>
                        </div>
                        <div className="dashboard-kpi-heading-group">
                            <div className="dashboard-kpi-heading">{kpi.label}</div>
                            <div className={valueClassName}>{kpi.value ?? 0}</div>
                            {kpi.detail && <div className={`dashboard-kpi-note ${options.noteClassName || ''}`.trim()}>{kpi.detail}</div>}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in dashboard-page">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard</h1>
                    <p>{canAccessFinance ? 'Liquidez, ingresos, gastos y operación del laboratorio' : 'Seguimiento operativo del laboratorio'}</p>
                </div>
            </div>

            <div className="section-tabs dashboard-view-switcher" role="group" aria-label="Vista principal del dashboard">
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeView === 'operativo' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveView('operativo')}
                    aria-pressed={activeView === 'operativo'}
                >
                    <i className="bi bi-clipboard-data" aria-hidden="true"></i> Operativo
                </button>
                {canAccessFinance ? (
                    <button
                        type="button"
                        className={`btn section-tab dashboard-view-tab ${activeView === 'financiero' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveView('financiero')}
                        aria-pressed={activeView === 'financiero'}
                    >
                        <i className="bi bi-cash-coin" aria-hidden="true"></i> Financiero BI
                    </button>
                ) : null}
            </div>

            {activeView === 'financiero' && (
                <>
            <div className="card dashboard-finance-controls">
                <div className="dashboard-finance-controls-row">
                    <div className="dashboard-finance-controls-dates">
                        <div className="dashboard-filters-grid">
                            <div className="form-group">
                                <label className="form-label" htmlFor="dashboard-finance-from">Desde</label>
                                <FormDatePicker
                                    id="dashboard-finance-from"
                                    value={filters.from}
                                    max={filters.to || undefined}
                                    onChange={(from) => setFilters((prev) => ({ ...prev, from }))}
                                    aria-label="Fecha desde"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="dashboard-finance-to">Hasta</label>
                                <FormDatePicker
                                    id="dashboard-finance-to"
                                    className="form-date-picker--end"
                                    value={filters.to}
                                    min={filters.from || undefined}
                                    onChange={(to) => setFilters((prev) => ({ ...prev, to }))}
                                    aria-label="Fecha hasta"
                                />
                            </div>
                        </div>
                        <div className="dashboard-filters-actions pedidos-status-filters" role="group" aria-label="Rangos rápidos del dashboard financiero">
                            {[30, 60, 90].map((days) => {
                                const active = filters.from === daysAgoIso(days) && filters.to === todayIso();
                                return (
                                    <button
                                        key={days}
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${active ? ' is-active' : ''}`}
                                        aria-pressed={active}
                                        onClick={() => setFilters((prev) => ({ ...prev, from: daysAgoIso(days), to: todayIso() }))}
                                    >
                                        Últimos {days} días
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="form-group dashboard-finance-view-group">
                        <span className="form-label" id="dashboard-finance-view-label">Vista</span>
                        <div
                            className="segmented-control dashboard-finance-view-switch"
                            role="group"
                            aria-labelledby="dashboard-finance-view-label"
                        >
                            <button
                                type="button"
                                aria-pressed={financeView === 'resumen'}
                                className={`segmented-control__btn${financeView === 'resumen' ? ' is-active' : ''}`}
                                onClick={() => setFinanceView('resumen')}
                            >
                                <i className="bi bi-grid" aria-hidden="true"></i>
                                Resumen
                            </button>
                            <button
                                type="button"
                                aria-pressed={financeView === 'estrategicos'}
                                className={`segmented-control__btn${financeView === 'estrategicos' ? ' is-active' : ''}`}
                                onClick={() => setFinanceView('estrategicos')}
                            >
                                <i className="bi bi-bar-chart-line" aria-hidden="true"></i>
                                Estratégicos
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {financeView === 'resumen' && (
                <>

            <div className="dashboard-ops-split is-equal dashboard-stack">
                <div className="card dashboard-ops-panel">
                    <div className="card-header dashboard-card-header">
                        <div>
                            <h3 className="card-title">Indicadores de liquidez</h3>
                            <p className="card-subtitle">Control de caja y flujo en tiempo real</p>
                        </div>
                    </div>
                    {loadingFinance ? (
                        <div className="grid dashboard-kpi-grid-ops-2x2 dashboard-staggered-grid">
                            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton dashboard-loading-card" />)}
                        </div>
                    ) : (
                        <div className="grid dashboard-kpi-grid-ops-2x2 dashboard-staggered-grid">
                            {liquidityCards.map((kpi, i) => (
                                renderDashboardMetricCard(kpi, i, {
                                    currency: true,
                                    className: 'animate-slide-up'
                                })
                            ))}
                        </div>
                    )}
                </div>

                <div className="card dashboard-ops-panel">
                    <div className="card-header dashboard-card-header">
                        <div>
                            <h3 className="card-title">Control de ingresos y gastos</h3>
                            <p className="card-subtitle">Indicadores clave mensuales para decisiones rápidas</p>
                        </div>
                    </div>
                    {loadingFinance ? (
                        <div className="grid dashboard-kpi-grid-ops-2x2 dashboard-staggered-grid">
                            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton dashboard-loading-card" />)}
                        </div>
                    ) : (
                        <div className="grid dashboard-kpi-grid-ops-2x2 dashboard-staggered-grid">
                            {businessCards.map((kpi, i) => (
                                renderDashboardMetricCard(kpi, i, {
                                    currency: true,
                                    className: 'animate-slide-up'
                                })
                            ))}
                        </div>
                    )}
                </div>
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
                                <button type="button" aria-pressed={strategicTopN === 5} className={`btn btn-sm pedidos-filter-chip${strategicTopN === 5 ? ' is-active' : ''}`} onClick={() => setStrategicTopN(5)}>Top 5</button>
                                <button type="button" aria-pressed={strategicTopN === 10} className={`btn btn-sm pedidos-filter-chip${strategicTopN === 10 ? ' is-active' : ''}`} onClick={() => setStrategicTopN(10)}>Top 10</button>
                                <button type="button" aria-pressed={strategicMetric === 'monto'} aria-label="Ver montos en soles" className={`btn btn-sm pedidos-filter-chip${strategicMetric === 'monto' ? ' is-active' : ''}`} onClick={() => setStrategicMetric('monto')}>S/.</button>
                                <button type="button" aria-pressed={strategicMetric === 'pct'} aria-label="Ver porcentajes" className={`btn btn-sm pedidos-filter-chip${strategicMetric === 'pct' ? ' is-active' : ''}`} onClick={() => setStrategicMetric('pct')}>%</button>
                            </div>
                        </div>
                    </div>

                    <div className="card dashboard-ops-panel dashboard-stack dashboard-strategic-summary">
                        <div className="grid dashboard-kpi-grid-ops-2x2 dashboard-strategic-kpis dashboard-staggered-grid">
                            {renderDashboardMetricCard({
                                label: 'Clínica líder del período',
                                value: topClinicaActual ? topClinicaActual.clinica : 'Sin datos',
                                detail: topClinicaActual ? formatCurrency(topClinicaActual.total) : 'S/. 0.00',
                                icon: 'bi-building-check'
                            }, 'strategic-clinic', {
                                className: 'animate-slide-up',
                                valueClassName: 'dashboard-kpi-main-value-featured',
                                noteClassName: 'dashboard-kpi-note-featured'
                            })}
                            {renderDashboardMetricCard({
                                label: 'Producto líder del período',
                                value: topProductoActual ? topProductoActual.producto : 'Sin datos',
                                detail: topProductoActual ? formatCurrency(topProductoActual.total) : 'S/. 0.00',
                                icon: 'bi-box-seam'
                            }, 'strategic-product', {
                                className: 'animate-slide-up',
                                valueClassName: 'dashboard-kpi-main-value-featured',
                                noteClassName: 'dashboard-kpi-note-featured'
                            })}
                            {renderDashboardMetricCard({
                                label: 'Concentración top 3 clínicas',
                                value: formatPercent(estrategicosKpis.concentracion_top3_clinicas_pct),
                                detail: 'Participación sobre ingresos',
                                icon: 'bi-pie-chart'
                            }, 'strategic-clinics-pct', { className: 'animate-slide-up' })}
                            {renderDashboardMetricCard({
                                label: 'Concentración top 3 productos',
                                value: formatPercent(estrategicosKpis.concentracion_top3_productos_pct),
                                detail: 'Participación sobre ingresos',
                                icon: 'bi-bar-chart'
                            }, 'strategic-products-pct', { className: 'animate-slide-up' })}
                        </div>
                    </div>

                    <div className="grid strategic-bento-main dashboard-stack">
                        <div className="card">
                            <div className="card-header"><h3 className="card-title">Ranking de clínicas</h3></div>
                            {topClinicasEstrategico.length > 0 ? (
                                <div
                                    className="strategic-chart-shell strategic-chart-shell--rank"
                                    style={getStrategicRankShellStyle(topClinicasEstrategico.length)}
                                >
                                    <Bar
                                        data={topClinicasChartData}
                                        options={STRATEGIC_RANK_CHART_OPTIONS}
                                    />
                                </div>
                            ) : (
                                <div className="empty-state"><p className="empty-state-text">Sin datos por clínica</p></div>
                            )}
                        </div>
                        <div className="card">
                            <div className="card-header"><h3 className="card-title">Ranking de productos</h3></div>
                            {topProductosEstrategico.length > 0 ? (
                                <div
                                    className="strategic-chart-shell strategic-chart-shell--rank"
                                    style={getStrategicRankShellStyle(topProductosEstrategico.length)}
                                >
                                    <Bar
                                        data={topProductosChartData}
                                        options={STRATEGIC_RANK_CHART_OPTIONS}
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
            <div className="card dashboard-stack dashboard-filter-bar">
                <div className="dashboard-toolbar-row">
                    <div className="pedidos-status-filters-scroller dashboard-filter-scroller">
                        <div className="dashboard-toolbar-group pedidos-status-filters" role="group" aria-label="Vista operativa">
                            <button type="button" aria-pressed={operativeView === 'produccion'} className={`btn btn-sm pedidos-filter-chip${operativeView === 'produccion' ? ' is-active' : ''}`} onClick={() => setOperativeView('produccion')}>Producción</button>
                            <button type="button" aria-pressed={operativeView === 'resumen'} className={`btn btn-sm pedidos-filter-chip${operativeView === 'resumen' ? ' is-active' : ''}`} onClick={() => setOperativeView('resumen')}>Resumen del mes</button>
                            <button type="button" aria-pressed={operativeView === 'historico'} className={`btn btn-sm pedidos-filter-chip${operativeView === 'historico' ? ' is-active' : ''}`} onClick={() => setOperativeView('historico')}>Histórico</button>
                            <button type="button" aria-pressed={operativeView === 'tops'} className={`btn btn-sm pedidos-filter-chip${operativeView === 'tops' ? ' is-active' : ''}`} onClick={() => setOperativeView('tops')}>Tops</button>
                        </div>
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
                        </div>
                    </div>

                    <div className="grid grid-cols-2 dashboard-stack">
                        <div className="card dashboard-top-featured">
                            <div className="card-header">
                                <div className="dashboard-top-featured-heading">
                                    <span className="dashboard-top-featured-icon" aria-hidden="true">
                                        <i className="bi bi-trophy-fill"></i>
                                    </span>
                                    <div>
                                        <h3 className="card-title">Top 5 productos del mes</h3>
                                        <p className="card-subtitle">Los productos con mayor volumen de pedidos</p>
                                    </div>
                                </div>
                            </div>
                            {topProductosMes.length > 0 ? (
                                <div className="dashboard-rank-list" role="list">
                                    {topProductosMes.map((row, index) => {
                                        const cantidad = Number(row.cantidad) || 0;
                                        const pct = Math.max(8, Math.round((cantidad / maxTopProductoCantidad) * 100));
                                        const rank = index + 1;
                                        return (
                                            <div
                                                key={`${row.producto}-${index}`}
                                                className={`dashboard-rank-item${rank === 1 ? ' is-leader' : ''}`}
                                                role="listitem"
                                            >
                                                <span className={`dashboard-rank-badge is-rank-${Math.min(rank, 4)}`} aria-hidden="true">
                                                    {rank === 1 ? <i className="bi bi-trophy-fill"></i> : rank}
                                                </span>
                                                <span className="dashboard-rank-icon" aria-hidden="true">
                                                    <i className="bi bi-box-seam"></i>
                                                </span>
                                                <div className="dashboard-rank-body">
                                                    <div className="dashboard-rank-row">
                                                        <span className="dashboard-rank-name">{row.producto}</span>
                                                        <strong className="dashboard-rank-value">{cantidad}</strong>
                                                    </div>
                                                    <div className="dashboard-rank-track" aria-hidden="true">
                                                        <span className="dashboard-rank-fill" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state"><p className="empty-state-text">Sin productos del mes</p></div>
                            )}
                        </div>

                        <div className="card dashboard-top-featured">
                            <div className="card-header">
                                <div className="dashboard-top-featured-heading">
                                    <span className="dashboard-top-featured-icon" aria-hidden="true">
                                        <i className="bi bi-building-fill"></i>
                                    </span>
                                    <div>
                                        <h3 className="card-title">Top 5 clínicas del mes</h3>
                                        <p className="card-subtitle">Las clínicas que más pedidos enviaron</p>
                                    </div>
                                </div>
                            </div>
                            {topClinicasMes.length > 0 ? (
                                <div className="dashboard-rank-list" role="list">
                                    {topClinicasMes.map((row, index) => {
                                        const pedidos = Number(row.pedidos) || 0;
                                        const pct = Math.max(8, Math.round((pedidos / maxTopClinicaPedidos) * 100));
                                        const rank = index + 1;
                                        return (
                                            <div
                                                key={`${row.clinica}-${index}`}
                                                className={`dashboard-rank-item${rank === 1 ? ' is-leader' : ''}`}
                                                role="listitem"
                                            >
                                                <span className={`dashboard-rank-badge is-rank-${Math.min(rank, 4)}`} aria-hidden="true">
                                                    {rank === 1 ? <i className="bi bi-trophy-fill"></i> : rank}
                                                </span>
                                                <span className="dashboard-rank-icon" aria-hidden="true">
                                                    <i className="bi bi-building"></i>
                                                </span>
                                                <div className="dashboard-rank-body">
                                                    <div className="dashboard-rank-row">
                                                        <span className="dashboard-rank-name">{row.clinica}</span>
                                                        <strong className="dashboard-rank-value">{pedidos}</strong>
                                                    </div>
                                                    <div className="dashboard-rank-track" aria-hidden="true">
                                                        <span className="dashboard-rank-fill" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state"><p className="empty-state-text">Sin clínicas del mes</p></div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {operativeView === 'historico' && (
                <div className="card dashboard-stack dashboard-historico-card">
                    <div className="card-header dashboard-card-header dashboard-card-header--split">
                        <div>
                            <h3 className="card-title">Histórico {selectedMonths} meses: pedidos y nuevos clientes</h3>
                            <p className="card-subtitle">El rango aplica solo al histórico operativo</p>
                        </div>
                        <div className="dashboard-toolbar-group dashboard-range-group" role="group" aria-label="Rango del histórico operativo">
                            <button type="button" aria-pressed={operativeRange === '3m'} aria-label="Últimos 3 meses" className={`btn btn-sm pedidos-filter-chip${operativeRange === '3m' ? ' is-active' : ''}`} onClick={() => setOperativeRange('3m')}>3m</button>
                            <button type="button" aria-pressed={operativeRange === '6m'} aria-label="Últimos 6 meses" className={`btn btn-sm pedidos-filter-chip${operativeRange === '6m' ? ' is-active' : ''}`} onClick={() => setOperativeRange('6m')}>6m</button>
                            <button type="button" aria-pressed={operativeRange === '12m'} aria-label="Últimos 12 meses" className={`btn btn-sm pedidos-filter-chip${operativeRange === '12m' ? ' is-active' : ''}`} onClick={() => setOperativeRange('12m')}>12m</button>
                        </div>
                    </div>
                    {historicoOperativoSlice.length > 0 ? (
                        <div className="dashboard-chart-shell dashboard-chart-shell--short">
                            <Bar data={operativoBarDataSlice} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: true } },
                                scales: {
                                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                                    y: { grid: { color: dashboardGridColor }, ticks: { font: { size: 11 } } }
                                }
                            }} />
                        </div>
                    ) : (
                        <div className="empty-state"><p className="empty-state-text">Sin histórico disponible</p></div>
                    )}
                </div>
            )}

            {operativeView === 'tops' && (
                <div className="dashboard-tops-stack dashboard-stack">
                    <div className="card dashboard-ops-panel dashboard-top-featured">
                        <div className="card-header dashboard-card-header">
                            <div className="dashboard-top-featured-heading">
                                <span className="dashboard-top-featured-icon" aria-hidden="true">
                                    <i className="bi bi-stars"></i>
                                </span>
                                <div>
                                    <h3 className="card-title">Top actual del mes</h3>
                                    <p className="card-subtitle">Producto y clínica con más pedidos este mes</p>
                                </div>
                            </div>
                        </div>
                        <div className="dashboard-tops-current-grid">
                            <article className="dashboard-tops-current-tile">
                                <span className="dashboard-tops-current-icon" aria-hidden="true">
                                    <i className="bi bi-box-seam"></i>
                                </span>
                                <div className="dashboard-tops-current-copy">
                                    <p className="dashboard-tops-current-label">Producto top del mes</p>
                                    <p className="dashboard-tops-current-value">
                                        {topProductoMes ? topProductoMes.producto : 'Sin pedidos'}
                                    </p>
                                    <span className="dashboard-tops-current-meta">
                                        {topProductoMes ? `${topProductoMes.cantidad} pedidos` : '0 pedidos'}
                                    </span>
                                </div>
                            </article>
                            <article className="dashboard-tops-current-tile">
                                <span className="dashboard-tops-current-icon" aria-hidden="true">
                                    <i className="bi bi-building"></i>
                                </span>
                                <div className="dashboard-tops-current-copy">
                                    <p className="dashboard-tops-current-label">Clínica top del mes</p>
                                    <p className="dashboard-tops-current-value">
                                        {topClinicaMes ? topClinicaMes.clinica : 'Sin pedidos'}
                                    </p>
                                    <span className="dashboard-tops-current-meta">
                                        {topClinicaMes ? `${topClinicaMes.pedidos} pedidos` : '0 pedidos'}
                                    </span>
                                </div>
                            </article>
                        </div>
                    </div>

                    <div className="dashboard-tops-history-grid">
                        <div className="card dashboard-ops-panel dashboard-top-featured">
                            <div className="card-header dashboard-card-header">
                                <div className="dashboard-top-featured-heading">
                                    <span className="dashboard-top-featured-icon" aria-hidden="true">
                                        <i className="bi bi-box-seam"></i>
                                    </span>
                                    <div>
                                        <h3 className="card-title">Top producto por mes</h3>
                                        <p className="card-subtitle">Lectura histórica de últimos 12 meses</p>
                                    </div>
                                </div>
                            </div>
                            {historicoTopProductoSlice.length > 0 ? (
                                <div className="dashboard-rank-list" role="list">
                                    {historicoTopProductoSlice.map((row, index) => {
                                        const cantidad = Number(row.cantidad) || 0;
                                        const pct = Math.max(8, Math.round((cantidad / maxHistoricoTopProducto) * 100));
                                        const rank = index + 1;
                                        return (
                                            <div
                                                key={`${row.periodo}-${row.producto}`}
                                                className={`dashboard-rank-item${rank === 1 ? ' is-leader' : ''}`}
                                                role="listitem"
                                            >
                                                <span className={`dashboard-rank-badge is-rank-${Math.min(rank, 4)}`} aria-hidden="true">
                                                    {rank === 1 ? <i className="bi bi-trophy-fill"></i> : rank}
                                                </span>
                                                <span className="dashboard-rank-icon" aria-hidden="true">
                                                    <i className="bi bi-box-seam"></i>
                                                </span>
                                                <div className="dashboard-rank-body">
                                                    <div className="dashboard-rank-row">
                                                        <span className="dashboard-rank-name">
                                                            <span className="dashboard-top-month">{toMonthLabel(row.periodo)}</span>
                                                            {row.producto}
                                                        </span>
                                                        <strong className="dashboard-rank-value">{cantidad}</strong>
                                                    </div>
                                                    <div className="dashboard-rank-track" aria-hidden="true">
                                                        <span className="dashboard-rank-fill" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state"><p className="empty-state-text">Sin datos de producto top</p></div>
                            )}
                        </div>
                        <div className="card dashboard-ops-panel dashboard-top-featured">
                            <div className="card-header dashboard-card-header">
                                <div className="dashboard-top-featured-heading">
                                    <span className="dashboard-top-featured-icon" aria-hidden="true">
                                        <i className="bi bi-building-fill"></i>
                                    </span>
                                    <div>
                                        <h3 className="card-title">Top clínica por mes</h3>
                                        <p className="card-subtitle">Lectura histórica de últimos 12 meses</p>
                                    </div>
                                </div>
                            </div>
                            {historicoTopClinicaSlice.length > 0 ? (
                                <div className="dashboard-rank-list" role="list">
                                    {historicoTopClinicaSlice.map((row, index) => {
                                        const pedidos = Number(row.pedidos) || 0;
                                        const pct = Math.max(8, Math.round((pedidos / maxHistoricoTopClinica) * 100));
                                        const rank = index + 1;
                                        return (
                                            <div
                                                key={`${row.periodo}-${row.clinica}`}
                                                className={`dashboard-rank-item${rank === 1 ? ' is-leader' : ''}`}
                                                role="listitem"
                                            >
                                                <span className={`dashboard-rank-badge is-rank-${Math.min(rank, 4)}`} aria-hidden="true">
                                                    {rank === 1 ? <i className="bi bi-trophy-fill"></i> : rank}
                                                </span>
                                                <span className="dashboard-rank-icon" aria-hidden="true">
                                                    <i className="bi bi-building"></i>
                                                </span>
                                                <div className="dashboard-rank-body">
                                                    <div className="dashboard-rank-row">
                                                        <span className="dashboard-rank-name">
                                                            <span className="dashboard-top-month">{toMonthLabel(row.periodo)}</span>
                                                            {row.clinica}
                                                        </span>
                                                        <strong className="dashboard-rank-value">{pedidos}</strong>
                                                    </div>
                                                    <div className="dashboard-rank-track" aria-hidden="true">
                                                        <span className="dashboard-rank-fill" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state"><p className="empty-state-text">Sin datos de clínica top</p></div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {operativeView === 'produccion' && (
                <div className="dashboard-ops-split dashboard-stack">
                    <div className="card dashboard-ops-panel">
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Operación del laboratorio</h3>
                                <p className="card-subtitle">Prioriza lo pendiente por cerrar, la carga real en producción y los pedidos atrasados</p>
                            </div>
                        </div>
                        <div className="grid dashboard-kpi-grid-ops-2x2">
                            {kpiCardsOperacion.map((kpi, i) => (
                                renderDashboardMetricCard(kpi, i)
                            ))}
                        </div>
                    </div>

                    <div className="card dashboard-ops-panel dashboard-ops-estado">
                        <div className="card-header">
                            <h3 className="card-title">Pedidos por Estado</h3>
                        </div>
                        <div className="dashboard-chart-donut-shell">
                            {(stats?.por_estado || []).length > 0 ? (
                                <Doughnut data={doughnutData} options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'bottom',
                                            labels: {
                                                padding: 10,
                                                boxWidth: 10,
                                                usePointStyle: true,
                                                pointStyle: 'circle',
                                                font: { size: 11 },
                                            },
                                        },
                                    },
                                    cutout: '65%',
                                }} />
                            ) : (
                                <div className="empty-state"><p className="empty-state-text">Sin datos</p></div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {operativeView === 'produccion' && (
                <div className="card dashboard-stack dashboard-recent-panel">
                    <div className="card-header">
                        <h3 className="card-title">Pedidos Recientes</h3>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/pedidos')}>Ver todos →</button>
                    </div>
                    {(stats?.recientes || []).length > 0 ? (
                        <ul className="pedidos-order-list dashboard-recent-orders">
                            {(stats.recientes || []).map((p) => {
                                const productName = p.producto_principal || '';
                                const itemsCount = Number(p.items_count) || 0;
                                const teethAll = sortTeethByArchOrder(p.producto_piezas || []);
                                const teeth = teethAll.slice(0, MAX_TEETH_PREVIEW);
                                const extraTeeth = Math.max(0, teethAll.length - MAX_TEETH_PREVIEW);
                                const tone = String(p.producto_color || '').trim();
                                const product = {
                                    id: p.id,
                                    nombre: productName,
                                    image_url: p.producto_image_url || '',
                                };
                                const hasClinicalLoad = teethAll.length > 0 || Boolean(tone) || itemsCount > 1;
                                return (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            className="pedidos-order-card"
                                            onClick={() => navigate(`/pedidos/${p.id}`)}
                                        >
                                            <span className="pedidos-order-thumb" aria-hidden="true">
                                                {productName ? (
                                                    <OrderProductThumb product={product} />
                                                ) : (
                                                    <i className="bi bi-clipboard2-pulse"></i>
                                                )}
                                            </span>
                                            <span className="pedidos-order-main">
                                                <span className="pedidos-order-top">
                                                    <strong className="pedidos-order-patient">
                                                        {p.paciente_nombre || 'Sin paciente'}
                                                    </strong>
                                                    <span className={`badge badge-dot badge-${p.estado}`}>
                                                        {getOrderStatusLabel(p.estado)}
                                                    </span>
                                                </span>
                                                <span className="pedidos-order-meta">
                                                    <span className="pedidos-order-code">{p.codigo}</span>
                                                    {p.clinica_nombre ? (
                                                        <span>· {p.clinica_nombre}</span>
                                                    ) : null}
                                                </span>
                                                {hasClinicalLoad ? (
                                                    <span className="pedidos-order-product" aria-label="Carga del pedido">
                                                        <span className="pedidos-order-product-tags">
                                                            {teeth.map((tooth) => (
                                                                <span key={`${p.id}-${tooth}`} className="pedidos-order-tooth">
                                                                    {tooth}
                                                                </span>
                                                            ))}
                                                            {extraTeeth > 0 ? (
                                                                <span className="pedidos-order-tooth is-more">+{extraTeeth}</span>
                                                            ) : null}
                                                            {tone ? (
                                                                <span className="pedidos-order-chip">Tono {tone}</span>
                                                            ) : null}
                                                            {itemsCount > 1 ? (
                                                                <span className="pedidos-order-chip">+{itemsCount - 1} ítems</span>
                                                            ) : null}
                                                        </span>
                                                    </span>
                                                ) : null}
                                                <span className="pedidos-order-dates">
                                                    <span>
                                                        <i className="bi bi-calendar3" aria-hidden="true"></i>
                                                        {formatDateShort(p.fecha || p.created_at)}
                                                    </span>
                                                    <span>
                                                        <i className="bi bi-truck" aria-hidden="true"></i>
                                                        Entrega {formatDateShort(p.fecha_entrega)}
                                                    </span>
                                                </span>
                                            </span>
                                            <span className="pedidos-order-aside">
                                                <strong className="pedidos-order-total">
                                                    S/. {parseFloat(p.total ?? 0).toFixed(2)}
                                                </strong>
                                                <span className="pedidos-order-cta">
                                                    Ver detalle
                                                    <i className="bi bi-chevron-right" aria-hidden="true"></i>
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
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
