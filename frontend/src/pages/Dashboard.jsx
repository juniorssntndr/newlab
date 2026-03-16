import React, { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { API_URL } from '../config.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const statusLabels = {
    pendiente: 'Pendiente', en_diseno: 'En Diseño', esperando_aprobacion: 'Esperando Aprobación',
    en_produccion: 'En Producción', terminado: 'Terminado', enviado: 'Enviado'
};
const statusColors = ['#F59E0B', '#8B5CF6', '#3B82F6', '#0891B2', '#10B981', '#6B7280'];

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
    const { getHeaders } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [financeStats, setFinanceStats] = useState(null);
    const [clinicas, setClinicas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingFinance, setLoadingFinance] = useState(true);
    const [activeView, setActiveView] = useState('operativo');
    const [financeView, setFinanceView] = useState('resumen');
    const [strategicTopN, setStrategicTopN] = useState(5);
    const [strategicMetric, setStrategicMetric] = useState('monto');
    const [operativeView, setOperativeView] = useState('produccion');
    const [operativeRange, setOperativeRange] = useState('12m');
    const [filters, setFilters] = useState({
        from: daysAgoIso(90),
        to: todayIso(),
        clinica_id: ''
    });

    useEffect(() => {
        fetch(`${API_URL}/dashboard/stats`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setStats(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [getHeaders]);

    useEffect(() => {
        fetch(`${API_URL}/clinicas?estado=activo`, { headers: getHeaders() })
            .then((r) => r.json())
            .then((data) => setClinicas(Array.isArray(data) ? data : []))
            .catch(() => setClinicas([]));
    }, [getHeaders]);

    useEffect(() => {
        if (activeView !== 'financiero') return;
        const params = new URLSearchParams();
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.clinica_id) params.set('clinica_id', filters.clinica_id);

        setLoadingFinance(true);
        fetch(`${API_URL}/dashboard/finance?${params.toString()}`, { headers: getHeaders() })
            .then((r) => r.json())
            .then((data) => {
                setFinanceStats(data);
                setLoadingFinance(false);
            })
            .catch(() => setLoadingFinance(false));
    }, [filters, getHeaders, activeView]);

    if (loading) {
        return (
            <div>
                <div className="page-header"><div className="page-header-left"><h1>Dashboard</h1></div></div>
                <div className="grid grid-cols-5">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}
                </div>
            </div>
        );
    }

    const kpis = stats?.kpis || {};
    const topProductoMes = stats?.top_producto_mes || null;
    const topClinicaMes = stats?.top_clinica_mes || null;
    const historicoOperativo = stats?.historico_operativo_12m || [];
    const historicoTopProducto = stats?.historico_top_producto_12m || [];
    const historicoTopClinica = stats?.historico_top_clinica_12m || [];
    const finance = financeStats || {};
    const liquidez = finance?.liquidez || {};
    const ingresosFin = finance?.ingresos || {};
    const gastosFin = finance?.gastos || {};
    const estrategicos = finance?.estrategicos || {};
    const estrategicosKpis = estrategicos?.kpis || {};

    const kpiCardsMes = [
        { label: 'Pedidos del mes', value: kpis.pedidos_mes, icon: 'bi-calendar2-week', color: '#0891B2', bg: 'rgba(8,145,178,0.1)' },
        { label: 'Top producto (mes)', value: topProductoMes?.cantidad || 0, subvalue: topProductoMes?.producto || 'Sin pedidos', icon: 'bi-award', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
        { label: 'Top clínica (mes)', value: topClinicaMes?.pedidos || 0, subvalue: topClinicaMes?.clinica || 'Sin pedidos', icon: 'bi-building-check', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
        { label: 'Nuevos clientes con pedido', value: kpis.nuevos_clientes_mes, icon: 'bi-person-plus', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' }
    ];

    const kpiCardsOperacion = [
        { label: 'Pendientes', value: kpis.pendientes, icon: 'bi-hourglass-split', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
        { label: 'En Producción', value: kpis.en_produccion, icon: 'bi-gear', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
        { label: 'Clínicas Activas', value: kpis.clinicas_activas, icon: 'bi-building', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
        { label: 'Retrocesos (Mes)', value: kpis.retrocesos_mes, icon: 'bi-arrow-counterclockwise', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' }
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
                backgroundColor: 'rgba(8, 145, 178, 0.72)',
                borderRadius: 6,
                borderSkipped: false
            },
            {
                label: 'Nuevos clientes con pedido',
                data: historicoOperativoSlice.map((item) => toNumber(item.nuevos_clientes)),
                backgroundColor: 'rgba(99, 102, 241, 0.72)',
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
                backgroundColor: 'rgba(16, 185, 129, 0.72)',
                borderRadius: 6,
                borderSkipped: false
            },
            {
                label: 'Egresos',
                data: financeSeries.map((item) => toNumber(item?.egresos)),
                backgroundColor: 'rgba(239, 68, 68, 0.72)',
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
            backgroundColor: ['#EF4444', '#F97316', '#F59E0B', '#0EA5E9', '#6366F1', '#22C55E'],
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
                backgroundColor: 'rgba(14, 116, 144, 0.78)',
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
                backgroundColor: 'rgba(37, 99, 235, 0.78)',
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
                backgroundColor: 'rgba(14, 116, 144, 0.72)',
                borderRadius: 8,
                borderSkipped: false
            },
            {
                label: 'Top productos (suma mensual)',
                data: historyRows.map((row) => row.productos),
                backgroundColor: 'rgba(37, 99, 235, 0.72)',
                borderRadius: 8,
                borderSkipped: false
            }
        ]
    };

    const liquidityCards = [
        { label: 'Saldo en caja', value: formatCurrency(liquidez.saldo_caja), icon: 'bi-safe2', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
        { label: 'Saldo en bancos', value: formatCurrency(liquidez.saldo_bancos), icon: 'bi-bank', color: '#1D4ED8', bg: 'rgba(29,78,216,0.1)' },
        { label: 'Flujo del día', value: formatCurrency(liquidez.flujo_dia), icon: 'bi-lightning', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
        { label: 'Flujo del mes', value: formatCurrency(liquidez.flujo_mes), icon: 'bi-calendar-check', color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' }
    ];

    const businessCards = [
        { label: 'Ingresos del mes', value: formatCurrency(ingresosFin.mes), icon: 'bi-currency-dollar', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
        { label: 'Ingresos mes en caja', value: formatCurrency(ingresosFin.mes_caja), icon: 'bi-wallet', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)' },
        { label: 'Ingresos mes en bancos', value: formatCurrency(ingresosFin.mes_banco), icon: 'bi-credit-card', color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
        { label: 'Gastos totales del mes', value: formatCurrency(gastosFin.mes_total), icon: 'bi-receipt-cutoff', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' }
    ];

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Dashboard</h1>
                    <p>Liquidez, ingresos, gastos y operación del laboratorio</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border-color)' }}>
                <button
                    className={`btn ${activeView === 'operativo' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ borderRadius: '8px 8px 0 0', padding: '0.75rem 1.5rem' }}
                    onClick={() => setActiveView('operativo')}
                >
                    <i className="bi bi-clipboard-data"></i> Operativo
                </button>
                <button
                    className={`btn ${activeView === 'financiero' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ borderRadius: '8px 8px 0 0', padding: '0.75rem 1.5rem' }}
                    onClick={() => setActiveView('financiero')}
                >
                    <i className="bi bi-cash-coin"></i> Financiero BI
                </button>
            </div>

            {activeView === 'financiero' && (
                <>
            <div className="card dashboard-filters-card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="dashboard-filters-grid">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Desde</label>
                        <input
                            type="date"
                            className="form-input"
                            value={filters.from}
                            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Hasta</label>
                        <input
                            type="date"
                            className="form-input"
                            value={filters.to}
                            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Clínica</label>
                        <select
                            className="form-select"
                            value={filters.clinica_id}
                            onChange={(e) => setFilters((prev) => ({ ...prev, clinica_id: e.target.value }))}
                        >
                            <option value="">Todas las clínicas</option>
                            {clinicas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setFilters((prev) => ({ ...prev, from: daysAgoIso(30), to: todayIso() }))}>Últimos 30 días</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setFilters((prev) => ({ ...prev, from: daysAgoIso(60), to: todayIso() }))}>Últimos 60 días</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setFilters((prev) => ({ ...prev, from: daysAgoIso(90), to: todayIso() }))}>Últimos 90 días</button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className={`btn btn-sm ${financeView === 'resumen' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFinanceView('resumen')}>
                        <i className="bi bi-grid"></i> Resumen financiero
                    </button>
                    <button className={`btn btn-sm ${financeView === 'estrategicos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFinanceView('estrategicos')}>
                        <i className="bi bi-bar-chart-line"></i> Estratégicos
                    </button>
                </div>
            </div>

            {financeView === 'resumen' && (
                <>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header" style={{ marginBottom: 'var(--space-5)' }}>
                    <div>
                        <h3 className="card-title">Indicadores de liquidez</h3>
                        <p className="card-subtitle">Control de caja y flujo en tiempo real</p>
                    </div>
                </div>
                {loadingFinance ? (
                    <div className="grid dashboard-kpi-grid-liquid">
                        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}
                    </div>
                ) : (
                    <div className="grid dashboard-kpi-grid-liquid">
                        {liquidityCards.map((kpi, i) => (
                            <div key={i} className="card kpi-card dashboard-kpi-card animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                                <div className="kpi-icon" style={{ background: kpi.bg, color: kpi.color }}>
                                    <i className={`bi ${kpi.icon}`}></i>
                                </div>
                                <div className="kpi-value dashboard-kpi-currency">{kpi.value}</div>
                                <div className="kpi-label">{kpi.label}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header" style={{ marginBottom: 'var(--space-5)' }}>
                    <div>
                        <h3 className="card-title">Control de ingresos y gastos</h3>
                        <p className="card-subtitle">Indicadores clave mensuales para decisiones rápidas</p>
                    </div>
                </div>
                {loadingFinance ? (
                    <div className="grid dashboard-kpi-grid-liquid">
                        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}
                    </div>
                ) : (
                    <div className="grid dashboard-kpi-grid-liquid">
                        {businessCards.map((kpi, i) => (
                            <div key={i} className="card kpi-card dashboard-kpi-card animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                                <div className="kpi-icon" style={{ background: kpi.bg, color: kpi.color }}>
                                    <i className={`bi ${kpi.icon}`}></i>
                                </div>
                                <div className="kpi-value dashboard-kpi-currency">{kpi.value}</div>
                                <div className="kpi-label">{kpi.label}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-3" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card col-span-2">
                    <div className="card-header"><h3 className="card-title">BI mensual: ingresos vs egresos</h3></div>
                    {loadingFinance ? (
                        <div className="skeleton" style={{ height: 280, borderRadius: 12 }} />
                    ) : financeSeries.length > 0 ? (
                        <Bar
                            data={financeBarData}
                            options={{
                                responsive: true,
                                plugins: { legend: { display: true } },
                                scales: {
                                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                                    y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } }
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
                        <div className="skeleton" style={{ height: 280, borderRadius: 12 }} />
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
                    <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div>
                                <h3 className="card-title">Centro Estratégico</h3>
                                <p className="card-subtitle">Identifica rápidamente qué clínica y qué producto impulsan tus ingresos</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button className={`btn btn-sm ${strategicTopN === 5 ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setStrategicTopN(5)}>Top 5</button>
                                <button className={`btn btn-sm ${strategicTopN === 10 ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setStrategicTopN(10)}>Top 10</button>
                                <button className={`btn btn-sm ${strategicMetric === 'monto' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStrategicMetric('monto')}>S/.</button>
                                <button className={`btn btn-sm ${strategicMetric === 'pct' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStrategicMetric('pct')}>%</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid dashboard-kpi-grid-liquid" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card dashboard-kpi-card strategic-kpi-card">
                            <div className="kpi-label">Clínica líder del período</div>
                            <div className="kpi-value dashboard-kpi-currency">{topClinicaActual ? topClinicaActual.clinica : 'Sin datos'}</div>
                            <div className="kpi-label" style={{ marginTop: 'var(--space-2)' }}>{topClinicaActual ? formatCurrency(topClinicaActual.total) : 'S/. 0.00'}</div>
                        </div>
                        <div className="card dashboard-kpi-card strategic-kpi-card">
                            <div className="kpi-label">Producto líder del período</div>
                            <div className="kpi-value dashboard-kpi-currency">{topProductoActual ? topProductoActual.producto : 'Sin datos'}</div>
                            <div className="kpi-label" style={{ marginTop: 'var(--space-2)' }}>{topProductoActual ? formatCurrency(topProductoActual.total) : 'S/. 0.00'}</div>
                        </div>
                        <div className="card dashboard-kpi-card strategic-kpi-card">
                            <div className="kpi-label">Concentración top 3 clínicas</div>
                            <div className="kpi-value dashboard-kpi-currency">{formatPercent(estrategicosKpis.concentracion_top3_clinicas_pct)}</div>
                        </div>
                        <div className="card dashboard-kpi-card strategic-kpi-card">
                            <div className="kpi-label">Concentración top 3 productos</div>
                            <div className="kpi-value dashboard-kpi-currency">{formatPercent(estrategicosKpis.concentracion_top3_productos_pct)}</div>
                        </div>
                    </div>

                    <div className="grid strategic-bento-main" style={{ marginBottom: 'var(--space-6)' }}>
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
                                                x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
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
                                                x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
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

                    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
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
                                            y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } }
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
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className={`btn btn-sm ${operativeView === 'produccion' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOperativeView('produccion')}>Producción</button>
                        <button className={`btn btn-sm ${operativeView === 'resumen' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOperativeView('resumen')}>Resumen del mes</button>
                        <button className={`btn btn-sm ${operativeView === 'historico' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOperativeView('historico')}>Histórico</button>
                        <button className={`btn btn-sm ${operativeView === 'tops' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOperativeView('tops')}>Tops</button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className={`btn btn-sm ${operativeRange === '3m' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setOperativeRange('3m')}>3m</button>
                        <button className={`btn btn-sm ${operativeRange === '6m' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setOperativeRange('6m')}>6m</button>
                        <button className={`btn btn-sm ${operativeRange === '12m' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setOperativeRange('12m')}>12m</button>
                    </div>
                </div>
            </div>

            {operativeView === 'resumen' && (
                <>
                    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card-header" style={{ marginBottom: 'var(--space-5)' }}>
                            <div>
                                <h3 className="card-title">Indicadores comerciales del mes</h3>
                                <p className="card-subtitle">Rendimiento mensual de pedidos, clientes y demanda</p>
                            </div>
                        </div>
                        <div className="grid dashboard-kpi-grid-liquid">
                            {kpiCardsMes.map((kpi, i) => (
                                <div key={i} className="card kpi-card dashboard-kpi-card animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                                    <div className="kpi-icon" style={{ background: kpi.bg, color: kpi.color }}>
                                        <i className={`bi ${kpi.icon}`}></i>
                                    </div>
                                    <div className="kpi-value">{kpi.value ?? 0}</div>
                                    <div className="kpi-label">{kpi.label}</div>
                                    {kpi.subvalue && <div className="kpi-label" style={{ marginTop: 6, color: 'var(--color-text)' }}>{kpi.subvalue}</div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-3" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card">
                            <div className="card-header"><h3 className="card-title">Pedidos por Estado</h3></div>
                            <div style={{ maxWidth: 240, margin: '0 auto' }}>
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

                        <div className="card col-span-2">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Top del mes (tiempo real)</h3>
                                    <p className="card-subtitle">Se actualiza con los pedidos del mes actual</p>
                                </div>
                            </div>
                            <div className="dashboard-list compact">
                                <div className="dashboard-list-item"><span>Top producto del mes</span><strong>{topProductoMes ? `${topProductoMes.producto} (${topProductoMes.cantidad})` : 'Sin pedidos'}</strong></div>
                                <div className="dashboard-list-item"><span>Top clínica del mes</span><strong>{topClinicaMes ? `${topClinicaMes.clinica} (${topClinicaMes.pedidos})` : 'Sin pedidos'}</strong></div>
                                <div className="dashboard-list-item"><span>Pedidos del mes</span><strong>{kpis.pedidos_mes || 0}</strong></div>
                                <div className="dashboard-list-item"><span>Nuevos clientes con pedido</span><strong>{kpis.nuevos_clientes_mes || 0}</strong></div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {operativeView === 'historico' && (
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <div className="card-header"><h3 className="card-title">Histórico {selectedMonths} meses: pedidos y nuevos clientes</h3></div>
                    {historicoOperativoSlice.length > 0 ? (
                        <Bar data={operativoBarDataSlice} options={{
                            responsive: true,
                            plugins: { legend: { display: true } },
                            scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                                y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } }
                            }
                        }} />
                    ) : (
                        <div className="empty-state"><p className="empty-state-text">Sin histórico disponible</p></div>
                    )}
                </div>
            )}

            {operativeView === 'tops' && (
                <div className="grid grid-cols-3" style={{ marginBottom: 'var(--space-6)' }}>
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
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <div className="card-header"><h3 className="card-title">Operación del laboratorio</h3></div>
                    <div className="grid dashboard-kpi-grid-liquid">
                        {kpiCardsOperacion.map((kpi, i) => (
                            <div key={i} className="card kpi-card dashboard-kpi-card">
                                <div className="kpi-icon" style={{ background: kpi.bg, color: kpi.color }}>
                                    <i className={`bi ${kpi.icon}`}></i>
                                </div>
                                <div className="kpi-value">{kpi.value ?? 0}</div>
                                <div className="kpi-label">{kpi.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {operativeView === 'produccion' && (
                <div className="card" style={{ marginTop: 'var(--space-6)' }}>
                    <div className="card-header">
                        <h3 className="card-title">Pedidos Recientes</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pedidos')}>Ver todos →</button>
                    </div>
                    {(stats?.recientes || []).length > 0 ? (
                        <>
                            <div className="data-table-wrapper desktop-only" style={{ border: 'none' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Código</th><th>Paciente</th><th>Clínica</th><th>Estado</th><th>Entrega</th><th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recientes.map(p => (
                                        <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/pedidos/${p.id}`)}>
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
                                    <div key={p.id} className="mobile-card recent-order-card" onClick={() => navigate(`/pedidos/${p.id}`)} style={{ cursor: 'pointer' }}>
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
