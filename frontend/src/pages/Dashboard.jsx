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
import BiReportModal from '../components/BiReportModal.jsx';
import { sortTeethByArchOrder } from '../utils/odontograma.js';
import { formatCategoriaGasto } from '../constants/financeCategories.js';
import TreasurySection from '../components/finance/TreasurySection.jsx';
import '../styles/dashboard-ui-consistency.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const MAX_TEETH_PREVIEW = 4;

const statusLabels = {
    pendiente: 'Pendiente', en_diseno: 'En Diseño', esperando_aprobacion: 'Esperando Aprobación',
    en_produccion: 'En Producción', terminado: 'Terminado', enviado: 'Enviado'
};
const orderStatusColorMap = {
    pendiente: '#f59e0b',
    en_diseno: '#8b5cf6',
    esperando_aprobacion: '#0ea5e9',
    en_produccion: '#2563eb',
    terminado: '#10b981',
    enviado: '#64748b'
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
const statusColors = [orderStatusColorMap.pendiente, orderStatusColorMap.en_diseno, orderStatusColorMap.esperando_aprobacion, orderStatusColorMap.en_produccion, orderStatusColorMap.terminado, orderStatusColorMap.enviado];

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

const toIsoDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const todayIso = () => toIsoDate(new Date());

const startOfMonthIso = () => {
    const now = new Date();
    return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
};

const startOfPreviousMonthIso = () => {
    const now = new Date();
    return toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
};

const endOfPreviousMonthIso = () => {
    const now = new Date();
    return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 0));
};

const startOfLast3MonthsIso = () => {
    const now = new Date();
    return toIsoDate(new Date(now.getFullYear(), now.getMonth() - 2, 1));
};

const startOfYearIso = () => {
    const now = new Date();
    return toIsoDate(new Date(now.getFullYear(), 0, 1));
};

const daysAgoIso = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return toIsoDate(date);
};

const toMonthLabel = (value) => {
    if (!value) return '—';
    if (typeof value === 'string' && /^\d{4}-\d{2}/.test(value)) {
        const [year, month] = value.slice(0, 7).split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('es-PE', { month: 'short' });
    }
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
    const [showBiReport, setShowBiReport] = useState(false);
    const [filters, setFilters] = useState({
        from: startOfMonthIso(),
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
        { label: 'Pedidos del mes', value: kpis.pedidos_mes, icon: 'bi-box-seam-fill', detail: 'Registrados este mes', colorScheme: 'primary' },
        { label: 'Nuevos clientes con pedido', value: kpis.nuevos_clientes_mes, icon: 'bi-person-check-fill', detail: 'Clínicas nuevas con actividad', colorScheme: 'success' },
        { label: 'Reprocesos en el mes', value: kpis.retrocesos_mes, icon: 'bi-arrow-repeat', detail: 'Pedidos que volvieron de etapa', colorScheme: kpis.retrocesos_mes > 0 ? 'warning' : 'primary' }
    ];

    const kpiCardsMesDatos = [
        { label: 'Producto top del mes', value: topProductoMes?.producto || 'Sin pedidos', detail: `${topProductoMes?.cantidad || 0} pedidos`, icon: 'bi-trophy-fill', colorScheme: 'gold' },
        { label: 'Clínica top del mes', value: topClinicaMes?.clinica || 'Sin pedidos', detail: `${topClinicaMes?.pedidos || 0} pedidos`, icon: 'bi-award-fill', colorScheme: 'gold' }
    ];

    const kpiCardsOperacion = [
        {
            label: 'Pedidos retrasados',
            value: kpis.retrasados,
            icon: 'bi-exclamation-octagon-fill',
            detail: 'Requieren acción inmediata',
            colorScheme: 'danger',
            onClick: () => navigate('/pedidos?filtro=retrasados')
        },
        {
            label: 'Entregas para hoy',
            value: kpis.entregas_hoy ?? 0,
            icon: 'bi-calendar-check-fill',
            detail: 'Comprometidos para hoy',
            colorScheme: 'warning',
            onClick: () => navigate('/pedidos?filtro=entregas_hoy')
        },
        {
            label: 'En taller / Fabricación',
            value: kpis.en_taller ?? kpis.trabajos_por_terminar,
            icon: 'bi-gear-wide-connected',
            detail: kpis.en_produccion > 0 ? `${kpis.en_produccion} en máquinas · ${kpis.en_diseno || 0} en diseño` : 'Diseño, fresado e impresión',
            colorScheme: 'primary',
            onClick: () => navigate('/pedidos?estado=en_produccion')
        },
        {
            label: 'Listos para despacho',
            value: kpis.listos_despacho ?? 0,
            icon: 'bi-box-seam-fill',
            detail: 'Terminados por entregar',
            colorScheme: 'success',
            onClick: () => navigate('/pedidos?estado=terminado')
        }
    ];

    const rawPorEstado = stats?.por_estado || [];
    const totalPedidosEstado = rawPorEstado.reduce((sum, item) => sum + parseInt(item.count || 0, 10), 0);

    const estadosBreakdown = rawPorEstado.map((e) => {
        const count = parseInt(e.count || 0, 10);
        const pct = totalPedidosEstado > 0 ? Math.round((count / totalPedidosEstado) * 100) : 0;
        return {
            estado: e.estado,
            label: statusLabels[e.estado] || e.estado,
            count,
            pct,
            color: orderStatusColorMap[e.estado] || '#64748b'
        };
    }).filter((e) => e.count > 0);

    const doughnutData = {
        labels: estadosBreakdown.map((e) => e.label),
        datasets: [{
            data: estadosBreakdown.map((e) => e.count),
            backgroundColor: estadosBreakdown.map((e) => e.color),
            borderWidth: 0,
            borderRadius: 4
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
                borderSkipped: false,
                maxBarThickness: 36,
                categoryPercentage: 0.5,
                barPercentage: 0.7
            },
            {
                label: 'Egresos',
                data: financeSeries.map((item) => toNumber(item?.egresos)),
                backgroundColor: dashboardPalette.red,
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 36,
                categoryPercentage: 0.5,
                barPercentage: 0.7
            }
        ]
    };

    const categoryTotalsMap = new Map();
    (gastosFin?.por_categoria || []).forEach((row) => {
        const rawCat = row?.categoria || 'sin_categoria';
        const current = categoryTotalsMap.get(rawCat) || { categoria: rawCat, total: 0 };
        current.total += toNumber(row?.total);
        categoryTotalsMap.set(rawCat, current);
    });
    const gastoCategoriasTop = Array.from(categoryTotalsMap.values())
        .filter((item) => item.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);
    const gastosDonutData = {
        labels: gastoCategoriasTop.map((row) => formatCategoriaGasto(row?.categoria)),
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

    const isCurrentMonth = filters.from === startOfMonthIso() && filters.to === todayIso();
    const periodLabel = isCurrentMonth ? 'del mes' : 'del período';
    const metricas = finance?.metricas || {};
    const cuentasPorCobrar = finance?.cuentas_por_cobrar || {};
    const saldoTotalHoy = toNumber(liquidez.saldo_caja) + toNumber(liquidez.saldo_bancos);
    const margenNeto = toNumber(metricas.margen_neto_pct ?? (toNumber(ingresosFin.periodo ?? ingresosFin.mes) > 0 ? (((toNumber(ingresosFin.periodo ?? ingresosFin.mes) - toNumber(gastosFin.periodo_total ?? gastosFin.mes_total)) / toNumber(ingresosFin.periodo ?? ingresosFin.mes)) * 100) : 0));

    const operationalResultsCards = [
        {
            label: 'Total cobrado',
            value: formatCurrency(ingresosFin.periodo ?? ingresosFin.mes),
            icon: 'bi-cash-coin',
            detail: 'Caja física y bancos',
            colorScheme: 'success'
        },
        {
            label: 'Gastos totales',
            value: formatCurrency(gastosFin.periodo_total ?? gastosFin.mes_total),
            icon: 'bi-receipt',
            detail: 'Materiales y fijos',
            colorScheme: 'danger'
        },
        {
            label: 'Utilidad neta',
            value: formatCurrency(metricas.utilidad_neta ?? (toNumber(ingresosFin.periodo ?? ingresosFin.mes) - toNumber(gastosFin.periodo_total ?? gastosFin.mes_total))),
            icon: 'bi-graph-up-arrow',
            detail: `Margen: ${margenNeto.toFixed(1)}%`,
            colorScheme: margenNeto >= 0 ? 'success' : 'danger'
        },
        {
            label: 'Por cobrar (calle)',
            value: formatCurrency(cuentasPorCobrar.total_calle ?? 0),
            icon: 'bi-clock-history',
            detail: `${cuentasPorCobrar.pedidos_pendientes_count || 0} pedidos pendientes`,
            colorScheme: toNumber(cuentasPorCobrar.total_calle) > 0 ? 'warning' : 'primary',
            onClick: () => navigate('/finanzas')
        }
    ];

    const liquidityCards = [
        { label: 'Flujo de hoy', value: formatCurrency(liquidez.flujo_dia), icon: 'bi-lightning-charge-fill', detail: 'Ingreso neto del día', colorScheme: toNumber(liquidez.flujo_dia) >= 0 ? 'warning' : 'danger' },
        { label: 'Efectivo en caja', value: formatCurrency(liquidez.saldo_caja), icon: 'bi-cash-stack', detail: 'Disponible en taller', colorScheme: 'success' },
        { label: 'Saldo en bancos', value: formatCurrency(liquidez.saldo_bancos), icon: 'bi-bank2', detail: 'Cuentas bancarias', colorScheme: 'primary' },
        { label: 'Total disponible', value: formatCurrency(saldoTotalHoy), icon: 'bi-wallet2', detail: 'Caja + Bancos hoy', colorScheme: 'primary' }
    ];

    // Intelligent polar balancing for callout donut charts:
    // When one quadrant has >= 2 slices and the opposite quadrant across the pole is empty,
    // or when a hemisphere is overcrowded, routes slices near 12 o'clock or 6 o'clock across
    // to prevent collision while strictly preserving the mathematical 45° diagonal angle.
    const balancePolarSlices = (rawSlices) => {
        if (rawSlices.length <= 1) return;

        let leftCount = rawSlices.filter(s => !s.isRight).length;
        let rightCount = rawSlices.filter(s => s.isRight).length;

        const topLeftCount = () => rawSlices.filter(s => !s.isRight && Math.sin(s.midAngle) < 0).length;
        const topRightCount = () => rawSlices.filter(s => s.isRight && Math.sin(s.midAngle) < 0).length;
        const bottomLeftCount = () => rawSlices.filter(s => !s.isRight && Math.sin(s.midAngle) >= 0).length;
        const bottomRightCount = () => rawSlices.filter(s => s.isRight && Math.sin(s.midAngle) >= 0).length;

        // Top Pole Balance (12 o'clock)
        if (topLeftCount() >= 2 && topRightCount() === 0) {
            const candidates = rawSlices.filter(
                s => !s.isRight && Math.sin(s.midAngle) < -0.35 && Math.abs(Math.cos(s.midAngle)) < 0.75
            );
            if (candidates.length > 0) {
                candidates.sort((a, b) => Math.cos(b.midAngle) - Math.cos(a.midAngle));
                candidates[0].isRight = true;
                leftCount--;
                rightCount++;
            }
        } else if (topRightCount() >= 2 && topLeftCount() === 0) {
            const candidates = rawSlices.filter(
                s => s.isRight && Math.sin(s.midAngle) < -0.35 && Math.abs(Math.cos(s.midAngle)) < 0.75
            );
            if (candidates.length > 0) {
                candidates.sort((a, b) => Math.cos(a.midAngle) - Math.cos(b.midAngle));
                candidates[0].isRight = false;
                rightCount--;
                leftCount++;
            }
        }

        // Bottom Pole Balance (6 o'clock)
        if (bottomLeftCount() >= 2 && bottomRightCount() === 0) {
            const candidates = rawSlices.filter(
                s => !s.isRight && Math.sin(s.midAngle) > 0.35 && Math.abs(Math.cos(s.midAngle)) < 0.75
            );
            if (candidates.length > 0) {
                candidates.sort((a, b) => Math.cos(b.midAngle) - Math.cos(a.midAngle));
                candidates[0].isRight = true;
                leftCount--;
                rightCount++;
            }
        } else if (bottomRightCount() >= 2 && bottomLeftCount() === 0) {
            const candidates = rawSlices.filter(
                s => s.isRight && Math.sin(s.midAngle) > 0.35 && Math.abs(Math.cos(s.midAngle)) < 0.75
            );
            if (candidates.length > 0) {
                candidates.sort((a, b) => Math.cos(a.midAngle) - Math.cos(b.midAngle));
                candidates[0].isRight = false;
                rightCount--;
                leftCount++;
            }
        }

        // General Hemisphere Overcrowding fallback (>3 and diff > 1)
        if (leftCount > 3 && leftCount > rightCount + 1) {
            const candidates = rawSlices.filter(
                s => !s.isRight && Math.abs(Math.cos(s.midAngle)) < 0.5
            );
            if (candidates.length > 0) {
                candidates.sort((a, b) => Math.cos(b.midAngle) - Math.cos(a.midAngle));
                candidates[0].isRight = true;
            }
        } else if (rightCount > 3 && rightCount > leftCount + 1) {
            const candidates = rawSlices.filter(
                s => s.isRight && Math.abs(Math.cos(s.midAngle)) < 0.5
            );
            if (candidates.length > 0) {
                candidates.sort((a, b) => Math.cos(a.midAngle) - Math.cos(b.midAngle));
                candidates[0].isRight = false;
            }
        }
    };

    const renderCalloutDonutChart = () => {
        if (!estadosBreakdown.length || totalPedidosEstado === 0) {
            return (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                    <p className="empty-state-text">Sin pedidos activos</p>
                </div>
            );
        }

        const viewBoxWidth = 520;
        const viewBoxHeight = 280;
        const cx = 260;
        const cy = 140;
        const outerRadius = 86;
        const innerRadius = 60;

        let currentAngle = -Math.PI / 2;

        const rawSlices = estadosBreakdown.map((item) => {
            const sliceAngle = (item.count / totalPedidosEstado) * 2 * Math.PI;
            const startAngle = currentAngle;
            const endAngle = currentAngle + sliceAngle;
            const midAngle = startAngle + sliceAngle / 2;
            currentAngle = endAngle;

            const isFull = sliceAngle >= 2 * Math.PI - 0.001;
            const effEnd = isFull ? startAngle + 2 * Math.PI - 0.001 : endAngle;
            const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

            const x1 = cx + outerRadius * Math.cos(startAngle);
            const y1 = cy + outerRadius * Math.sin(startAngle);
            const x2 = cx + outerRadius * Math.cos(effEnd);
            const y2 = cy + outerRadius * Math.sin(effEnd);
            const x3 = cx + innerRadius * Math.cos(effEnd);
            const y3 = cy + innerRadius * Math.sin(effEnd);
            const x4 = cx + innerRadius * Math.cos(startAngle);
            const y4 = cy + innerRadius * Math.sin(startAngle);

            const pathData = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;

            const p1x = cx + (outerRadius + 3) * Math.cos(midAngle);
            const p1y = cy + (outerRadius + 3) * Math.sin(midAngle);

            return {
                ...item,
                pathData,
                midAngle,
                p1x,
                p1y
            };
        });

        // 1. Initial side assignment based on midAngle cosine
        rawSlices.forEach((slice) => {
            slice.isRight = Math.cos(slice.midAngle) >= 0;
        });

        // 2. Intelligent polar balancing preserving 45° angle
        balancePolarSlices(rawSlices);

        // 3. Initial leader vertical target (p2y)
        rawSlices.forEach((slice) => {
            const dyMag = 28;
            const dy = Math.sin(slice.midAngle) >= 0 ? dyMag : -dyMag;
            slice.p2y = Math.max(24, Math.min(viewBoxHeight - 26, slice.p1y + dy));
        });

        // 4. Anti-collision spacing preserving topological planarity + STRICT 45° DIAGONAL
        const adjustSpacing = (items, isRightSide) => {
            if (items.length > 1) {
                // CRITICAL: Sort by anchor Y (p1y) ascending so vertical order matches perimeter topology
                items.sort((a, b) => a.p1y - b.p1y);

                const minGap = 42;
                for (let i = 1; i < items.length; i++) {
                    if (items[i].p2y - items[i - 1].p2y < minGap) {
                        items[i].p2y = items[i - 1].p2y + minGap;
                    }
                }

                const maxAllowedY = viewBoxHeight - 28;
                const overflow = items[items.length - 1].p2y - maxAllowedY;
                if (overflow > 0) {
                    for (let i = items.length - 1; i >= 0; i--) {
                        items[i].p2y -= overflow;
                    }
                    for (let i = 0; i < items.length; i++) {
                        items[i].p2y = Math.max(28 + i * minGap, items[i].p2y);
                    }
                }
            }

            items.forEach((slice) => {
                // Guard: Enforce minimum vertical travel so diagonal is never flat
                const minDy = 22;
                if (Math.abs(slice.p2y - slice.p1y) < minDy) {
                    slice.p2y = slice.p1y + (slice.p2y >= slice.p1y ? minDy : -minDy);
                }

                // Mathematical 45° lock: |dx| === |dy|
                const travel = Math.abs(slice.p2y - slice.p1y);
                slice.p2x = isRightSide ? slice.p1x + travel : slice.p1x - travel;

                slice.p3y = slice.p2y;
                const hLen = 95;
                slice.p3x = isRightSide
                    ? Math.min(viewBoxWidth - 12, slice.p2x + hLen)
                    : Math.max(12, slice.p2x - hLen);
            });
        };

        const rightItems = rawSlices.filter(s => s.isRight);
        const leftItems = rawSlices.filter(s => !s.isRight);
        adjustSpacing(rightItems, true);
        adjustSpacing(leftItems, false);

        const mobileCx = 100;
        const mobileCy = 100;
        const mobileOuterR = 80;
        const mobileInnerR = 56;
        let mobileAngle = -Math.PI / 2;
        const mobileSlices = estadosBreakdown.map((item) => {
            const sliceAngle = (item.count / totalPedidosEstado) * 2 * Math.PI;
            const startA = mobileAngle;
            const endA = mobileAngle + sliceAngle;
            mobileAngle = endA;

            const isFull = sliceAngle >= 2 * Math.PI - 0.001;
            const effEnd = isFull ? startA + 2 * Math.PI - 0.001 : endA;
            const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

            const x1 = mobileCx + mobileOuterR * Math.cos(startA);
            const y1 = mobileCy + mobileOuterR * Math.sin(startA);
            const x2 = mobileCx + mobileOuterR * Math.cos(effEnd);
            const y2 = mobileCy + mobileOuterR * Math.sin(effEnd);
            const x3 = mobileCx + mobileInnerR * Math.cos(effEnd);
            const y3 = mobileCy + mobileInnerR * Math.sin(effEnd);
            const x4 = mobileCx + mobileInnerR * Math.cos(startA);
            const y4 = mobileCy + mobileInnerR * Math.sin(startA);

            const pathData = `M ${x1} ${y1} A ${mobileOuterR} ${mobileOuterR} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${mobileInnerR} ${mobileInnerR} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;

            return { ...item, pathData };
        });

        return (
            <div className="dashboard-callout-donut-wrapper">
                <svg
                    viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                    className="dashboard-callout-donut-svg dashboard-callout-donut-desktop"
                    style={{ width: '100%', height: 'auto', maxHeight: '275px', overflow: 'visible' }}
                >
                    {/* Outer subtle tech guide ring */}
                    <circle
                        cx={cx}
                        cy={cy}
                        r={outerRadius + 8}
                        fill="none"
                        stroke="var(--color-border, rgba(0, 0, 0, 0.06))"
                        strokeWidth="1"
                        strokeDasharray="3 4"
                        pointerEvents="none"
                    />

                    {/* Donut Slices */}
                    {rawSlices.map((slice) => (
                        <path
                            key={slice.estado}
                            d={slice.pathData}
                            fill={slice.color}
                            className="dashboard-callout-slice"
                            onClick={() => navigate(`/pedidos?estado=${slice.estado}`)}
                            style={{ cursor: 'pointer', transition: 'filter 0.2s, transform 0.2s' }}
                        >
                            <title>{`${slice.label}: ${slice.count} pedidos (${slice.pct}%)`}</title>
                        </path>
                    ))}

                    {/* Tech Geometric Callout Leaders & Labels */}
                    {rawSlices.map((slice) => {
                        const linePath = `M ${slice.p1x} ${slice.p1y} L ${slice.p2x} ${slice.p2y} L ${slice.p3x} ${slice.p3y}`;
                        const textAnchor = slice.isRight ? 'start' : 'end';
                        const textX = slice.isRight ? slice.p2x + 4 : slice.p2x - 4;
                        const textY = slice.p3y - 8;

                        return (
                            <g
                                key={`callout-${slice.estado}`}
                                className="dashboard-callout-group"
                                onClick={() => navigate(`/pedidos?estado=${slice.estado}`)}
                                style={{ cursor: 'pointer' }}
                            >
                                <title>{`Ver pedidos en ${slice.label}`}</title>
                                {/* Geometric Tech Leader Line */}
                                <path
                                    d={linePath}
                                    fill="none"
                                    stroke={slice.color}
                                    strokeWidth="1.75"
                                    strokeLinecap="square"
                                    strokeLinejoin="miter"
                                    opacity="0.9"
                                />

                                {/* Tech Ring / Reticle Anchor on Arc */}
                                <circle cx={slice.p1x} cy={slice.p1y} r="3" fill="#ffffff" stroke={slice.color} strokeWidth="2" />

                                {/* Terminal Tech Tick / Notch */}
                                <line
                                    x1={slice.p3x}
                                    y1={slice.p3y - 4}
                                    x2={slice.p3x}
                                    y2={slice.p3y + 4}
                                    stroke={slice.color}
                                    strokeWidth="2"
                                />

                                {/* Label & Value sitting right above the ruler line */}
                                <text
                                    x={textX}
                                    y={textY}
                                    textAnchor={textAnchor}
                                    style={{ fontFamily: 'inherit' }}
                                >
                                    <tspan fill="var(--color-text-secondary, #64748b)" fontSize="11.5px" fontWeight="700" letterSpacing="0.04em" textTransform="uppercase">
                                        {slice.label}
                                    </tspan>
                                    <tspan fill="var(--color-text-primary, #0A1B33)" fontSize="16px" fontWeight="900" dx="6">
                                        {slice.count}
                                    </tspan>
                                    <tspan fill={slice.color} fontSize="12px" fontWeight="800" dx="4">
                                        ({slice.pct}%)
                                    </tspan>
                                </text>
                            </g>
                        );
                    })}

                    {/* Center Total Counter (Enhanced Scale) */}
                    <g pointerEvents="none">
                        <text
                            x={cx}
                            y={cy - 4}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="var(--color-text-primary, #0A1B33)"
                            style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-0.04em' }}
                        >
                            {totalPedidosEstado}
                        </text>
                        <text
                            x={cx}
                            y={cy + 20}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="var(--color-text-secondary, #64748b)"
                            style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                        >
                            TOTAL
                        </text>
                    </g>
                </svg>

                {/* Mobile Responsive Layout: Generous Donut + Organized Breakdown Grid */}
                <div className="dashboard-donut-mobile-view">
                    <div className="dashboard-donut-mobile-chart-wrap">
                        <svg viewBox="0 0 200 200" className="dashboard-donut-mobile-svg">
                            <circle
                                cx={mobileCx}
                                cy={mobileCy}
                                r={mobileOuterR + 6}
                                fill="none"
                                stroke="var(--color-border, rgba(0, 0, 0, 0.06))"
                                strokeWidth="1"
                                strokeDasharray="3 4"
                                pointerEvents="none"
                            />
                            {mobileSlices.map((slice) => (
                                <path
                                    key={`mob-${slice.estado}`}
                                    d={slice.pathData}
                                    fill={slice.color}
                                    className="dashboard-callout-slice"
                                    onClick={() => navigate(`/pedidos?estado=${slice.estado}`)}
                                >
                                    <title>{`${slice.label}: ${slice.count} pedidos (${slice.pct}%)`}</title>
                                </path>
                            ))}
                            <g pointerEvents="none">
                                <text
                                    x={mobileCx}
                                    y={mobileCy - 3}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="var(--color-text-primary, #0A1B33)"
                                    style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.04em' }}
                                >
                                    {totalPedidosEstado}
                                </text>
                                <text
                                    x={mobileCx}
                                    y={mobileCy + 19}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="var(--color-text-secondary, #64748b)"
                                    style={{ fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                                >
                                    TOTAL
                                </text>
                            </g>
                        </svg>
                    </div>
                    <div className="dashboard-donut-mobile-legend">
                        {estadosBreakdown.map((slice) => (
                            <button
                                key={`mob-legend-${slice.estado}`}
                                type="button"
                                className="dashboard-donut-mobile-pill"
                                onClick={() => navigate(`/pedidos?estado=${slice.estado}`)}
                            >
                                <div className="dashboard-donut-mobile-pill-main">
                                    <span className="dashboard-donut-mobile-dot" style={{ backgroundColor: slice.color }} />
                                    <span className="dashboard-donut-mobile-label">{slice.label}</span>
                                </div>
                                <span className="dashboard-donut-mobile-val">
                                    <strong>{slice.count}</strong>
                                    <small>({slice.pct}%)</small>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderGastosCalloutDonutChart = () => {
        const totalGastos = gastoCategoriasTop.reduce((sum, item) => sum + toNumber(item?.total), 0);
        if (!gastoCategoriasTop.length || totalGastos <= 0) {
            return (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                    <p className="empty-state-text">No hay egresos registrados</p>
                </div>
            );
        }

        const categoryColors = [
            dashboardPalette.red,
            dashboardPalette.orange,
            dashboardPalette.amber,
            dashboardPalette.sky,
            dashboardPalette.violet,
            dashboardPalette.emerald
        ];

        const formattedCategories = gastoCategoriasTop.map((item, idx) => {
            const label = formatCategoriaGasto(item?.categoria);
            const total = toNumber(item?.total);
            const pct = totalGastos > 0 ? Math.round((total / totalGastos) * 100) : 0;
            return {
                categoria: item?.categoria,
                label,
                total,
                pct,
                color: categoryColors[idx % categoryColors.length]
            };
        }).filter(item => item.total > 0);

        const viewBoxWidth = 540;
        const viewBoxHeight = 280;
        const cx = 270;
        const cy = 140;
        const outerRadius = 88;
        const innerRadius = 64;

        let currentAngle = -Math.PI / 2;

        const rawSlices = formattedCategories.map((item) => {
            const sliceAngle = (item.total / totalGastos) * 2 * Math.PI;
            const startAngle = currentAngle;
            const endAngle = currentAngle + sliceAngle;
            const midAngle = startAngle + sliceAngle / 2;
            currentAngle = endAngle;

            const isFull = sliceAngle >= 2 * Math.PI - 0.001;
            const effEnd = isFull ? startAngle + 2 * Math.PI - 0.001 : endAngle;
            const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

            const x1 = cx + outerRadius * Math.cos(startAngle);
            const y1 = cy + outerRadius * Math.sin(startAngle);
            const x2 = cx + outerRadius * Math.cos(effEnd);
            const y2 = cy + outerRadius * Math.sin(effEnd);
            const x3 = cx + innerRadius * Math.cos(effEnd);
            const y3 = cy + innerRadius * Math.sin(effEnd);
            const x4 = cx + innerRadius * Math.cos(startAngle);
            const y4 = cy + innerRadius * Math.sin(startAngle);

            const pathData = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;

            const p1x = cx + (outerRadius + 3) * Math.cos(midAngle);
            const p1y = cy + (outerRadius + 3) * Math.sin(midAngle);

            return {
                ...item,
                pathData,
                midAngle,
                p1x,
                p1y
            };
        });

        // 1. Initial side assignment based on midAngle cosine
        rawSlices.forEach((slice) => {
            slice.isRight = Math.cos(slice.midAngle) >= 0;
        });

        // 2. Intelligent polar balancing preserving 45° angle
        balancePolarSlices(rawSlices);

        // 3. Initial leader vertical target (p2y)
        rawSlices.forEach((slice) => {
            const dyMag = 28;
            const dy = Math.sin(slice.midAngle) >= 0 ? dyMag : -dyMag;
            slice.p2y = Math.max(20, Math.min(viewBoxHeight - 24, slice.p1y + dy));
        });

        // 4. Anti-collision spacing preserving topological planarity + STRICT 45° DIAGONAL
        const adjustSpacing = (items, isRightSide) => {
            if (items.length > 1) {
                // CRITICAL: Sort by anchor Y (p1y) ascending so vertical order matches perimeter topology
                items.sort((a, b) => a.p1y - b.p1y);

                const minGap = 40;
                for (let i = 1; i < items.length; i++) {
                    if (items[i].p2y - items[i - 1].p2y < minGap) {
                        items[i].p2y = items[i - 1].p2y + minGap;
                    }
                }

                const maxAllowedY = viewBoxHeight - 24;
                const overflow = items[items.length - 1].p2y - maxAllowedY;
                if (overflow > 0) {
                    for (let i = items.length - 1; i >= 0; i--) {
                        items[i].p2y -= overflow;
                    }
                    for (let i = 0; i < items.length; i++) {
                        items[i].p2y = Math.max(20 + i * minGap, items[i].p2y);
                    }
                }
            }

            items.forEach((slice) => {
                // Guard: Enforce minimum vertical travel so diagonal is never flat
                const minDy = 22;
                if (Math.abs(slice.p2y - slice.p1y) < minDy) {
                    slice.p2y = slice.p1y + (slice.p2y >= slice.p1y ? minDy : -minDy);
                }

                // Mathematical 45° lock: |dx| === |dy|
                const travel = Math.abs(slice.p2y - slice.p1y);
                slice.p2x = isRightSide ? slice.p1x + travel : slice.p1x - travel;

                slice.p3y = slice.p2y;
                const hLen = 95;
                slice.p3x = isRightSide
                    ? Math.min(viewBoxWidth - 12, slice.p2x + hLen)
                    : Math.max(12, slice.p2x - hLen);
            });
        };

        const rightItems = rawSlices.filter(s => s.isRight);
        const leftItems = rawSlices.filter(s => !s.isRight);
        adjustSpacing(rightItems, true);
        adjustSpacing(leftItems, false);

        const mobileCx = 100;
        const mobileCy = 100;
        const mobileOuterR = 80;
        const mobileInnerR = 56;
        let mobileAngle = -Math.PI / 2;
        const mobileGastosSlices = rawSlices.map((item) => {
            const sliceAngle = (item.total / totalGastos) * 2 * Math.PI;
            const startA = mobileAngle;
            const endA = mobileAngle + sliceAngle;
            mobileAngle = endA;

            const isFull = sliceAngle >= 2 * Math.PI - 0.001;
            const effEnd = isFull ? startA + 2 * Math.PI - 0.001 : endA;
            const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

            const x1 = mobileCx + mobileOuterR * Math.cos(startA);
            const y1 = mobileCy + mobileOuterR * Math.sin(startA);
            const x2 = mobileCx + mobileOuterR * Math.cos(effEnd);
            const y2 = mobileCy + mobileOuterR * Math.sin(effEnd);
            const x3 = mobileCx + mobileInnerR * Math.cos(effEnd);
            const y3 = mobileCy + mobileInnerR * Math.sin(effEnd);
            const x4 = mobileCx + mobileInnerR * Math.cos(startA);
            const y4 = mobileCy + mobileInnerR * Math.sin(startA);

            const pathData = `M ${x1} ${y1} A ${mobileOuterR} ${mobileOuterR} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${mobileInnerR} ${mobileInnerR} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;

            return { ...item, pathData };
        });

        return (
            <div className="dashboard-callout-donut-wrapper" style={{ padding: '0' }}>
                <svg
                    viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                    className="dashboard-callout-donut-svg dashboard-callout-donut-desktop"
                    style={{ width: '100%', height: 'auto', maxHeight: '280px', overflow: 'visible' }}
                >
                    {/* Outer subtle tech guide ring */}
                    <circle
                        cx={cx}
                        cy={cy}
                        r={outerRadius + 8}
                        fill="none"
                        stroke="var(--color-border, rgba(0, 0, 0, 0.06))"
                        strokeWidth="1"
                        strokeDasharray="3 4"
                        pointerEvents="none"
                    />

                    {/* Donut Slices */}
                    {rawSlices.map((slice) => (
                        <path
                            key={slice.categoria}
                            d={slice.pathData}
                            fill={slice.color}
                            className="dashboard-callout-slice"
                            onClick={() => navigate('/caja-gastos')}
                            style={{ cursor: 'pointer', transition: 'filter 0.2s, transform 0.2s' }}
                        >
                            <title>{`${slice.label}: S/. ${slice.total.toFixed(2)} (${slice.pct}%)`}</title>
                        </path>
                    ))}

                    {/* Tech Geometric Callout Leaders & Labels */}
                    {rawSlices.map((slice) => {
                        const linePath = `M ${slice.p1x} ${slice.p1y} L ${slice.p2x} ${slice.p2y} L ${slice.p3x} ${slice.p3y}`;
                        const textAnchor = slice.isRight ? 'start' : 'end';
                        const textX = slice.isRight ? slice.p2x + 4 : slice.p2x - 4;
                        const textY = slice.p3y - 8;

                        return (
                            <g
                                key={`callout-${slice.categoria}`}
                                className="dashboard-callout-group"
                                onClick={() => navigate('/caja-gastos')}
                                style={{ cursor: 'pointer' }}
                            >
                                <title>{`Ver egresos de ${slice.label}`}</title>
                                {/* Geometric Tech Leader Line */}
                                <path
                                    d={linePath}
                                    fill="none"
                                    stroke={slice.color}
                                    strokeWidth="1.75"
                                    strokeLinecap="square"
                                    strokeLinejoin="miter"
                                    opacity="0.9"
                                />

                                {/* Tech Ring / Reticle Anchor on Arc */}
                                <circle cx={slice.p1x} cy={slice.p1y} r="3" fill="#ffffff" stroke={slice.color} strokeWidth="2" />

                                {/* Terminal Tech Tick / Notch */}
                                <line
                                    x1={slice.p3x}
                                    y1={slice.p3y - 4}
                                    x2={slice.p3x}
                                    y2={slice.p3y + 4}
                                    stroke={slice.color}
                                    strokeWidth="2"
                                />

                                {/* Label & Value sitting right above the ruler line */}
                                <text
                                    x={textX}
                                    y={textY}
                                    textAnchor={textAnchor}
                                    style={{ fontFamily: 'inherit' }}
                                >
                                    <tspan fill="var(--color-text-secondary, #64748b)" fontSize="11px" fontWeight="700" letterSpacing="0.03em" textTransform="uppercase">
                                        {slice.label}
                                    </tspan>
                                    <tspan fill="var(--color-text-primary, #0A1B33)" fontSize="14px" fontWeight="900" dx="5">
                                        S/. {slice.total.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </tspan>
                                    <tspan fill={slice.color} fontSize="11px" fontWeight="800" dx="4">
                                        ({slice.pct}%)
                                    </tspan>
                                </text>
                            </g>
                        );
                    })}

                    {/* Center Total Counter (Optimized Scale & Airy Spacing) */}
                    <g pointerEvents="none">
                        <text
                            x={cx}
                            y={cy - 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="var(--color-text-primary, #0A1B33)"
                            style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.02em' }}
                        >
                            S/. {totalGastos.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </text>
                        <text
                            x={cx}
                            y={cy + 18}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="var(--color-text-secondary, #64748b)"
                            style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}
                        >
                            GASTOS TOTALES
                        </text>
                    </g>
                </svg>

                {/* Mobile Responsive Layout: Generous Donut + Organized Breakdown Grid */}
                <div className="dashboard-donut-mobile-view">
                    <div className="dashboard-donut-mobile-chart-wrap">
                        <svg viewBox="0 0 200 200" className="dashboard-donut-mobile-svg">
                            <circle
                                cx={mobileCx}
                                cy={mobileCy}
                                r={mobileOuterR + 6}
                                fill="none"
                                stroke="var(--color-border, rgba(0, 0, 0, 0.06))"
                                strokeWidth="1"
                                strokeDasharray="3 4"
                                pointerEvents="none"
                            />
                            {mobileGastosSlices.map((slice) => (
                                <path
                                    key={`mob-gasto-${slice.categoria}`}
                                    d={slice.pathData}
                                    fill={slice.color}
                                    className="dashboard-callout-slice"
                                    onClick={() => navigate('/caja-gastos')}
                                >
                                    <title>{`${slice.label}: S/. ${slice.total.toFixed(2)} (${slice.pct}%)`}</title>
                                </path>
                            ))}
                            <g pointerEvents="none">
                                <text
                                    x={mobileCx}
                                    y={mobileCy - 3}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="var(--color-text-primary, #0A1B33)"
                                    style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}
                                >
                                    S/. {totalGastos.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </text>
                                <text
                                    x={mobileCx}
                                    y={mobileCy + 18}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="var(--color-text-secondary, #64748b)"
                                    style={{ fontSize: '8.5px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                                >
                                    GASTOS TOTALES
                                </text>
                            </g>
                        </svg>
                    </div>
                    <div className="dashboard-donut-mobile-legend">
                        {rawSlices.map((slice) => (
                            <button
                                key={`mob-legend-gasto-${slice.categoria}`}
                                type="button"
                                className="dashboard-donut-mobile-pill"
                                onClick={() => navigate('/caja-gastos')}
                            >
                                <div className="dashboard-donut-mobile-pill-main">
                                    <span className="dashboard-donut-mobile-dot" style={{ backgroundColor: slice.color }} />
                                    <span className="dashboard-donut-mobile-label">{slice.label}</span>
                                </div>
                                <span className="dashboard-donut-mobile-val">
                                    <strong>S/. {slice.total.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
                                    <small>({slice.pct}%)</small>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderDashboardMetricCard = (kpi, i, options = {}) => {
        const valueClassName = [
            'dashboard-kpi-main-value',
            options.currency ? 'dashboard-kpi-currency' : '',
            options.valueClassName || ''
        ].filter(Boolean).join(' ');

        const cardClasses = [
            'card kpi-card dashboard-kpi-card',
            kpi.colorScheme ? `dashboard-kpi-card--${kpi.colorScheme}` : '',
            kpi.onClick ? 'is-clickable' : '',
            options.className || ''
        ].filter(Boolean).join(' ');

        return (
            <div
                key={options.key || i}
                className={cardClasses}
                onClick={kpi.onClick}
            >
                {kpi.onClick && (
                    <span className="dashboard-kpi-card-arrow" aria-hidden="true">
                        <i className="bi bi-chevron-right"></i>
                    </span>
                )}
                <div className="dashboard-kpi-shell">
                    <div className="dashboard-kpi-row">
                        <div className="kpi-icon" aria-hidden="true">
                            <i className={`bi ${kpi.icon}`}></i>
                        </div>
                        <div className="dashboard-kpi-heading-group">
                            <div className="dashboard-kpi-heading">{kpi.label}</div>
                            <div className={valueClassName}>
                                {kpi.value ?? 0}
                            </div>
                            {kpi.detail && <div className={`dashboard-kpi-note ${options.noteClassName || ''}`.trim()}>{kpi.detail}</div>}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in dashboard-page page-container">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>
                        <i className="bi bi-grid-1x2 text-primary" aria-hidden="true"></i> Dashboard
                    </h1>
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
                {canAccessFinance ? (
                    <button
                        type="button"
                        className={`btn section-tab dashboard-view-tab ${activeView === 'tesoreria' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveView('tesoreria')}
                        aria-pressed={activeView === 'tesoreria'}
                    >
                        <i className="bi bi-bank" aria-hidden="true"></i> Tesorería, Bancos y Socios
                    </button>
                ) : null}
            </div>

            {activeView === 'financiero' && (
                <>
            <div className="card dashboard-ops-panel dashboard-stack">
                <div className="card-header dashboard-card-header" style={{ marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontSize: '1rem', flexShrink: 0 }}>
                            <i className="bi bi-wallet2" aria-hidden="true"></i>
                        </span>
                        <div>
                            <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Disponibilidad en cuentas y caja (Hoy)</h3>
                            <p className="card-subtitle" style={{ margin: 0, fontSize: '0.78rem' }}>Fondos líquidos consolidados disponibles en el taller y bancos sin filtro de fechas</p>
                        </div>
                    </div>
                </div>
                {loadingFinance ? (
                    <div className="grid dashboard-kpi-grid-4 dashboard-staggered-grid">
                        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton dashboard-loading-card" />)}
                    </div>
                ) : (
                    <div className="grid dashboard-kpi-grid-4 dashboard-staggered-grid">
                        {liquidityCards.map((kpi, i) => (
                            renderDashboardMetricCard(kpi, i, {
                                currency: true,
                                className: 'animate-slide-up'
                            })
                        ))}
                    </div>
                )}
            </div>

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
                            {(() => {
                                const isMonthActive = filters.from === startOfMonthIso() && filters.to === todayIso();
                                return (
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${isMonthActive ? ' is-active' : ''}`}
                                        aria-pressed={isMonthActive}
                                        onClick={() => setFilters((prev) => ({ ...prev, from: startOfMonthIso(), to: todayIso() }))}
                                    >
                                        Este mes
                                    </button>
                                );
                            })()}
                            {(() => {
                                const isPrevMonthActive = filters.from === startOfPreviousMonthIso() && filters.to === endOfPreviousMonthIso();
                                return (
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${isPrevMonthActive ? ' is-active' : ''}`}
                                        aria-pressed={isPrevMonthActive}
                                        onClick={() => setFilters((prev) => ({ ...prev, from: startOfPreviousMonthIso(), to: endOfPreviousMonthIso() }))}
                                    >
                                        Mes anterior
                                    </button>
                                );
                            })()}
                            {(() => {
                                const isLast3MonthsActive = filters.from === startOfLast3MonthsIso() && filters.to === todayIso();
                                return (
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${isLast3MonthsActive ? ' is-active' : ''}`}
                                        aria-pressed={isLast3MonthsActive}
                                        onClick={() => setFilters((prev) => ({ ...prev, from: startOfLast3MonthsIso(), to: todayIso() }))}
                                    >
                                        Últimos 3 meses
                                    </button>
                                );
                            })()}
                            {(() => {
                                const isYearActive = filters.from === startOfYearIso() && filters.to === todayIso();
                                return (
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${isYearActive ? ' is-active' : ''}`}
                                        aria-pressed={isYearActive}
                                        onClick={() => setFilters((prev) => ({ ...prev, from: startOfYearIso(), to: todayIso() }))}
                                    >
                                        Año actual
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                    <div className="dashboard-finance-right-actions" style={{ display: 'flex', alignItems: 'flex-end', gap: '0.65rem', flexWrap: 'wrap' }}>
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
                        <button
                            type="button"
                            className="btn btn-outline-primary btn-sm dashboard-bi-report-trigger-btn desktop-only"
                            onClick={() => setShowBiReport(true)}
                            title="Generar y visualizar Informe Ejecutivo BI"
                            style={{
                                height: '36px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                padding: '0 0.85rem',
                                borderRadius: '6px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <i className="bi bi-file-earmark-bar-graph-fill" aria-hidden="true"></i>
                            <span>Informe BI</span>
                        </button>
                    </div>
                </div>
            </div>

            {financeView === 'resumen' && (
                <>

            <div className="card dashboard-ops-panel dashboard-stack">
                <div className="card-header dashboard-card-header" style={{ marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(var(--color-primary-rgb), 0.1)', color: 'var(--color-primary)', fontSize: '0.95rem', flexShrink: 0 }}>
                            <i className="bi bi-funnel-fill" aria-hidden="true"></i>
                        </span>
                        <div>
                            <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Resultados de la operación</h3>
                            <p className="card-subtitle" style={{ margin: 0, fontSize: '0.78rem' }}>{isCurrentMonth ? 'Rendimiento financiero y cobranzas del mes actual' : 'Rendimiento financiero y cobranzas del período seleccionado'}</p>
                        </div>
                    </div>
                </div>
                {loadingFinance ? (
                    <div className="grid dashboard-kpi-grid-4 dashboard-staggered-grid">
                        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton dashboard-loading-card" />)}
                    </div>
                ) : (
                    <div className="grid dashboard-kpi-grid-4 dashboard-staggered-grid">
                        {operationalResultsCards.map((kpi, i) => (
                            renderDashboardMetricCard(kpi, i, {
                                currency: true,
                                className: 'animate-slide-up'
                            })
                        ))}
                    </div>
                )}
            </div>

            <div className="dashboard-finance-charts dashboard-stack">
                <div className="card dashboard-finance-chart-card">
                    <div className="card-header"><h3 className="card-title">BI mensual: ingresos vs egresos</h3></div>
                    <div className="dashboard-finance-chart-body">
                        {loadingFinance ? (
                            <div className="skeleton dashboard-finance-chart-loading" />
                        ) : financeSeries.length > 0 ? (
                            <Bar
                                data={financeBarData}
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
                        ) : (
                            <div className="empty-state"><p className="empty-state-text">Sin movimientos suficientes para BI mensual</p></div>
                        )}
                    </div>
                </div>
                <div className="card dashboard-finance-chart-card">
                    <div className="card-header"><h3 className="card-title">Gastos por categoría</h3></div>
                    <div className="dashboard-finance-chart-body">
                        {loadingFinance ? (
                            <div className="skeleton dashboard-finance-chart-loading" />
                        ) : (
                            renderGastosCalloutDonutChart()
                        )}
                    </div>
                </div>
            </div>

                </>
            )}


            {financeView === 'estrategicos' && (
                <>
                    <div className="card dashboard-stack dashboard-toolbar-card--padded dashboard-strategic-toolbar-card">
                        <div className="dashboard-strategic-toolbar-row">
                            <div className="dashboard-strategic-header">
                                <span className="dashboard-strategic-icon">
                                    <i className="bi bi-bullseye" aria-hidden="true"></i>
                                </span>
                                <div>
                                    <h3 className="card-title dashboard-strategic-title">Centro Estratégico</h3>
                                    <p className="card-subtitle dashboard-strategic-subtitle desktop-only">Identifica rápidamente qué clínica y qué producto impulsan tus ingresos</p>
                                </div>
                            </div>
                            <div className="dashboard-strategic-filters">
                                <div className="dashboard-strategic-filter-group">
                                    <span className="dashboard-strategic-filter-label">Ranking:</span>
                                    <div className="segmented-control dashboard-strategic-segmented" role="group" aria-label="Cantidad de elementos en ranking">
                                        <button
                                            type="button"
                                            className={`segmented-control__btn${strategicTopN === 5 ? ' is-active' : ''}`}
                                            onClick={() => setStrategicTopN(5)}
                                        >
                                            Top 5
                                        </button>
                                        <button
                                            type="button"
                                            className={`segmented-control__btn${strategicTopN === 10 ? ' is-active' : ''}`}
                                            onClick={() => setStrategicTopN(10)}
                                        >
                                            Top 10
                                        </button>
                                    </div>
                                </div>

                                <div className="dashboard-strategic-filter-group dashboard-strategic-filter-group--metric">
                                    <span className="dashboard-strategic-filter-label">Métrica:</span>
                                    <div className="segmented-control dashboard-strategic-segmented" role="group" aria-label="Unidad de medida">
                                        <button
                                            type="button"
                                            className={`segmented-control__btn${strategicMetric === 'monto' ? ' is-active' : ''}`}
                                            onClick={() => setStrategicMetric('monto')}
                                            title="Ver montos facturados en Soles"
                                        >
                                            <i className="bi bi-cash-stack" aria-hidden="true"></i>
                                            <span>Soles<span className="desktop-only"> (S/.)</span></span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`segmented-control__btn${strategicMetric === 'pct' ? ' is-active' : ''}`}
                                            onClick={() => setStrategicMetric('pct')}
                                            title="Ver porcentaje de participación"
                                        >
                                            <i className="bi bi-percent" aria-hidden="true"></i>
                                            <span>Participación<span className="desktop-only"> (%)</span></span>
                                        </button>
                                    </div>
                                </div>
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

            {/* VISTA TESORERÍA, BANCOS Y SOCIOS */}
            {activeView === 'tesoreria' && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                    <TreasurySection />
                </div>
            )}

            {/* KPIs */}
            {activeView === 'operativo' && (
                <>
            <div className="card dashboard-stack dashboard-filter-bar">
                <div className="dashboard-toolbar-row">
                    <div className="pedidos-status-filters-scroller dashboard-filter-scroller">
                        <div className="dashboard-toolbar-group pedidos-status-filters" role="group" aria-label="Vista operativa">
                            <button type="button" aria-pressed={operativeView === 'produccion'} className={`btn btn-sm pedidos-filter-chip${operativeView === 'produccion' ? ' is-active' : ''}`} onClick={() => setOperativeView('produccion')}>
                                <i className="bi bi-gear-wide-connected" aria-hidden="true" style={{ marginRight: '0.35rem' }}></i>
                                Producción
                            </button>
                            <button type="button" aria-pressed={operativeView === 'resumen'} className={`btn btn-sm pedidos-filter-chip${operativeView === 'resumen' ? ' is-active' : ''}`} onClick={() => setOperativeView('resumen')}>
                                <i className="bi bi-calendar-check" aria-hidden="true" style={{ marginRight: '0.35rem' }}></i>
                                Resumen del mes
                            </button>
                            <button type="button" aria-pressed={operativeView === 'tops'} className={`btn btn-sm pedidos-filter-chip${operativeView === 'tops' ? ' is-active' : ''}`} onClick={() => setOperativeView('tops')}>
                                <i className="bi bi-trophy" aria-hidden="true" style={{ marginRight: '0.35rem' }}></i>
                                Tops
                            </button>
                            <button type="button" aria-pressed={operativeView === 'historico'} className={`btn btn-sm pedidos-filter-chip${operativeView === 'historico' ? ' is-active' : ''}`} onClick={() => setOperativeView('historico')}>
                                <i className="bi bi-clock-history" aria-hidden="true" style={{ marginRight: '0.35rem' }}></i>
                                Histórico
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {operativeView === 'resumen' && (
                <>
                    <div className="card dashboard-stack">
                        <div className="card-header dashboard-card-header" style={{ marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(var(--color-primary-rgb), 0.1)', color: 'var(--color-primary)', fontSize: '1rem', flexShrink: 0 }}>
                                    <i className="bi bi-graph-up-arrow" aria-hidden="true"></i>
                                </span>
                                <div>
                                    <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Indicadores comerciales del mes</h3>
                                    <p className="card-subtitle" style={{ margin: 0, fontSize: '0.78rem' }}>Separa métricas numéricas de los datos destacados del mes</p>
                                </div>
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
                                                    <i className="bi bi-box-seam-fill"></i>
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
                                                    <i className="bi bi-building-fill"></i>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', fontSize: '1rem', flexShrink: 0 }}>
                                <i className="bi bi-clock-history" aria-hidden="true"></i>
                            </span>
                            <div>
                                <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Histórico {selectedMonths} meses: pedidos y nuevos clientes</h3>
                                <p className="card-subtitle" style={{ margin: 0, fontSize: '0.78rem' }}>El rango aplica solo al histórico operativo</p>
                            </div>
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
                    <div className="card dashboard-ops-panel dashboard-top-featured dashboard-top-featured--gold">
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
                        <div className="grid dashboard-kpi-grid-liquid dashboard-kpi-grid-featured dashboard-staggered-grid">
                            {kpiCardsMesDatos.map((kpi, i) => (
                                renderDashboardMetricCard(kpi, i, {
                                    key: `tops-featured-${i}`,
                                    className: 'animate-slide-up dashboard-kpi-card-featured',
                                    valueClassName: 'dashboard-kpi-main-value-featured',
                                    noteClassName: 'dashboard-kpi-note-featured'
                                })
                            ))}
                        </div>
                    </div>

                    <div className="dashboard-tops-history-grid">
                        <div className="card dashboard-ops-panel dashboard-top-featured">
                            <div className="card-header dashboard-card-header">
                                <div className="dashboard-top-featured-heading">
                                    <span className="dashboard-top-featured-icon" aria-hidden="true">
                                        <i className="bi bi-trophy-fill"></i>
                                    </span>
                                    <div>
                                        <h3 className="card-title">Top producto por mes</h3>
                                        <p className="card-subtitle">Lectura histórica de últimos 12 meses</p>
                                    </div>
                                </div>
                            </div>
                            {historicoTopProductoSlice.length > 0 ? (
                                <div className="dashboard-rank-list" role="list">
                                    {historicoTopProductoSlice.map((row) => {
                                        const cantidad = Number(row.cantidad) || 0;
                                        const pct = Math.max(8, Math.round((cantidad / maxHistoricoTopProducto) * 100));
                                        const isLeader = cantidad === maxHistoricoTopProducto && cantidad > 0;
                                        return (
                                            <div
                                                key={`${row.periodo}-${row.producto}`}
                                                className={`dashboard-rank-item${isLeader ? ' is-leader' : ''}`}
                                                role="listitem"
                                            >
                                                <span className={`dashboard-rank-badge ${isLeader ? 'is-rank-1' : 'is-rank-neutral'}`} aria-hidden="true">
                                                    {isLeader ? <i className="bi bi-trophy-fill" title="Récord del año"></i> : <i className="bi bi-calendar3"></i>}
                                                </span>
                                                <span className="dashboard-rank-icon" aria-hidden="true">
                                                    <i className="bi bi-box-seam-fill"></i>
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
                                    {historicoTopClinicaSlice.map((row) => {
                                        const pedidos = Number(row.pedidos) || 0;
                                        const pct = Math.max(8, Math.round((pedidos / maxHistoricoTopClinica) * 100));
                                        const isLeader = pedidos === maxHistoricoTopClinica && pedidos > 0;
                                        return (
                                            <div
                                                key={`${row.periodo}-${row.clinica}`}
                                                className={`dashboard-rank-item${isLeader ? ' is-leader' : ''}`}
                                                role="listitem"
                                            >
                                                <span className={`dashboard-rank-badge ${isLeader ? 'is-rank-1' : 'is-rank-neutral'}`} aria-hidden="true">
                                                    {isLeader ? <i className="bi bi-trophy-fill" title="Récord del año"></i> : <i className="bi bi-calendar3"></i>}
                                                </span>
                                                <span className="dashboard-rank-icon" aria-hidden="true">
                                                    <i className="bi bi-building-fill"></i>
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
                        <div className="card-header" style={{ marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(var(--color-primary-rgb), 0.1)', color: 'var(--color-primary)', fontSize: '1rem', flexShrink: 0 }}>
                                    <i className="bi bi-gear-wide-connected" aria-hidden="true"></i>
                                </span>
                                <div>
                                    <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Operación del laboratorio</h3>
                                    <p className="card-subtitle" style={{ margin: 0, fontSize: '0.78rem' }}>Prioridad diaria: pedidos retrasados, entregas de hoy y carga viva de fabricación</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid dashboard-kpi-grid-ops-2x2">
                            {kpiCardsOperacion.map((kpi, i) => (
                                renderDashboardMetricCard(kpi, i)
                            ))}
                        </div>
                    </div>

                    <div className="card dashboard-ops-panel dashboard-ops-estado">
                        <div className="card-header" style={{ marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontSize: '1rem', flexShrink: 0 }}>
                                    <i className="bi bi-pie-chart-fill" aria-hidden="true"></i>
                                </span>
                                <div>
                                    <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Pedidos por Estado</h3>
                                    <p className="card-subtitle" style={{ margin: 0, fontSize: '0.78rem' }}>Distribución viva del taller</p>
                                </div>
                            </div>
                        </div>
                        {renderCalloutDonutChart()}
                    </div>
                </div>
            )}

            {operativeView === 'produccion' && (
                <div className="card dashboard-stack dashboard-recent-panel">
                    <div className="card-header dashboard-recent-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(var(--color-primary-rgb), 0.1)', color: 'var(--color-primary)', fontSize: '1rem', flexShrink: 0 }}>
                                <i className="bi bi-clock" aria-hidden="true"></i>
                            </span>
                            <h3 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Pedidos Recientes</h3>
                        </div>
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

            <BiReportModal
                isOpen={showBiReport}
                onClose={() => setShowBiReport(false)}
                filters={filters}
                liquidez={{ ...liquidez, saldoTotalHoy }}
                ingresosFin={ingresosFin}
                gastosFin={gastosFin}
                cuentasPorCobrar={cuentasPorCobrar}
                gastoCategoriasTop={gastoCategoriasTop}
                utilidadNeta={metricas.utilidad_neta ?? (toNumber(ingresosFin.periodo ?? ingresosFin.mes) - toNumber(gastosFin.periodo_total ?? gastosFin.mes_total))}
                margenNetoPct={margenNeto}
                estrategicos={estrategicos}
                estrategicosKpis={estrategicosKpis}
            />
        </div>
    );
};

export default Dashboard;
