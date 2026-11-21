/**
 * financialHtmlReportGenerator.js
 * Generador de Reporte Financiero Interactivo en HTML Autocontenido
 * Marca Oficial: AFINIX Dental Lab (AFINIX DENTAL LAB S.A.C.)
 */
import { resolveImageUrl } from './resolveImageUrl';

const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return `S/. ${num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateReadable = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const cleanStr = String(dateStr).includes('T') ? String(dateStr).split('T')[0] : String(dateStr);
        const parts = cleanStr.split('-');
        if (parts.length === 3) {
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            return d.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
        return cleanStr;
    } catch {
        return dateStr;
    }
};

const escapeHtml = (unsafe) => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export const buildFinancialHtmlReport = ({
    movimientos = [],
    startDate = '',
    endDate = '',
    empresaFiscal = null,
    generatedBy = 'Administración'
}) => {
    const ruc = empresaFiscal?.ruc || '20616033973';
    const razonSocial = empresaFiscal?.razon_social || 'AFINIX DENTAL LAB S.A.C.';
    const direccion = empresaFiscal?.direccion || 'Calle Piura 316, Mariano Melgar, Arequipa.';
    const fechaEmision = new Date().toLocaleString('es-PE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // 1. Métricas Consolidadas Globales
    let totalIngresos = 0;
    let totalIngresosCaja = 0;
    let totalIngresosBanco = 0;
    let totalEgresos = 0;
    let totalEgresosCaja = 0;
    let totalEgresosBanco = 0;
    let countConSustento = 0;
    let countSinSustento = 0;

    const categoriaEgresosMap = {};
    const diasMap = {};

    movimientos.forEach((m) => {
        const monto = parseFloat(m.monto || 0);
        const isIngreso = m.tipo === 'ingreso';
        const isCash = m.tipo_fondo === 'caja';
        const hasVoucher = Boolean(m.sustento_archivo_url);

        if (isIngreso) {
            totalIngresos += monto;
            if (isCash) totalIngresosCaja += monto;
            else totalIngresosBanco += monto;
        } else {
            totalEgresos += monto;
            if (isCash) totalEgresosCaja += monto;
            else totalEgresosBanco += monto;

            if (hasVoucher) countConSustento++;
            else countSinSustento++;

            const cat = m.categoria_gasto || 'otros';
            categoriaEgresosMap[cat] = (categoriaEgresosMap[cat] || 0) + monto;
        }

        // Agrupación día por día
        const rawDate = m.fecha_movimiento || (m.created_at ? String(m.created_at).split('T')[0] : 'Sin fecha');
        const dateKey = String(rawDate).includes('T') ? String(rawDate).split('T')[0] : String(rawDate);

        if (!diasMap[dateKey]) {
            diasMap[dateKey] = {
                fecha: dateKey,
                ingresos: 0,
                egresos: 0,
                movimientos: []
            };
        }

        if (isIngreso) {
            diasMap[dateKey].ingresos += monto;
        } else {
            diasMap[dateKey].egresos += monto;
        }
        diasMap[dateKey].movimientos.push(m);
    });

    const balanceNeto = totalIngresos - totalEgresos;
    const totalEgresosCount = countConSustento + countSinSustento;
    const porcentajeSustentado = totalEgresosCount > 0 ? Math.round((countConSustento / totalEgresosCount) * 100) : 100;

    // Ordenar días descendente (más recientes primero)
    const sortedDays = Object.values(diasMap).sort((a, b) => (b.fecha > a.fecha ? 1 : -1));

    // Desglose de categorías ordenadas por monto mayor
    const sortedCategorias = Object.entries(categoriaEgresosMap)
        .map(([cat, total]) => ({
            categoria: cat.replace(/_/g, ' ').toUpperCase(),
            total,
            porcentaje: totalEgresos > 0 ? ((total / totalEgresos) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.total - a.total);

    // Preparar JSON para el motor interactivo en el cliente
    const clientDataJson = JSON.stringify({
        movimientos: movimientos.map((m) => ({
            id: m.id,
            tipo: m.tipo,
            tipo_fondo: m.tipo_fondo,
            monto: parseFloat(m.monto || 0),
            fecha: m.fecha_movimiento ? (String(m.fecha_movimiento).includes('T') ? String(m.fecha_movimiento).split('T')[0] : String(m.fecha_movimiento)) : '',
            hora: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            beneficiario: m.beneficiario || (m.origen === 'pago_pedido' ? 'Cliente Directo' : '—'),
            descripcion: m.descripcion || m.producto_nombre || '—',
            categoria: (m.categoria_gasto || '').replace(/_/g, ' '),
            comprobante: m.sustento_numero || (m.origen === 'pago_pedido' ? `NV-${String(m.id).padStart(6, '0')}` : 'Sin comprobante'),
            comprobante_tipo: m.sustento_comprobante_tipo,
            archivo_url: m.sustento_archivo_url ? resolveImageUrl(m.sustento_archivo_url) : null
        }))
    });

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte Financiero · ${escapeHtml(razonSocial)}</title>
    <style>
        :root {
            --primary: #0284c7;
            --primary-dark: #0369a1;
            --primary-light: #e0f2fe;
            --success: #10b981;
            --success-light: #d1fae5;
            --danger: #ef4444;
            --danger-light: #fee2e2;
            --slate-50: #f8fafc;
            --slate-100: #f1f5f9;
            --slate-200: #e2e8f0;
            --slate-300: #cbd5e1;
            --slate-600: #475569;
            --slate-800: #1e293b;
            --slate-900: #0f172a;
            --radius-md: 10px;
            --radius-lg: 14px;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
            --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
            --shadow-lg: 0 10px 25px rgba(0,0,0,0.12);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        body {
            background-color: var(--slate-50);
            color: var(--slate-900);
            line-height: 1.5;
            padding: 24px 16px;
        }

        .container {
            max-width: 1140px;
            margin: 0 auto;
        }

        /* HEADER */
        .report-header {
            background: #ffffff;
            border: 1px solid var(--slate-200);
            border-radius: var(--radius-lg);
            padding: 24px;
            box-shadow: var(--shadow-sm);
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
        }

        .brand-title {
            font-size: 1.45rem;
            font-weight: 800;
            color: var(--slate-900);
            letter-spacing: -0.02em;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .brand-title span.badge-primary {
            background: var(--primary-light);
            color: var(--primary);
            font-size: 0.72rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            text-transform: uppercase;
        }

        .company-meta {
            font-size: 0.82rem;
            color: var(--slate-600);
            margin-top: 4px;
        }

        .period-card {
            background: var(--slate-100);
            border: 1px solid var(--slate-200);
            border-radius: var(--radius-md);
            padding: 12px 16px;
            text-align: right;
        }

        .period-label {
            font-size: 0.75rem;
            color: var(--slate-600);
            text-transform: uppercase;
            font-weight: 700;
        }

        .period-dates {
            font-size: 1rem;
            font-weight: 800;
            color: var(--primary);
        }

        .period-sub {
            font-size: 0.75rem;
            color: var(--slate-600);
        }

        /* KPIS GRID */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .kpi-card {
            background: #ffffff;
            border: 1px solid var(--slate-200);
            border-radius: var(--radius-lg);
            padding: 20px;
            box-shadow: var(--shadow-sm);
            position: relative;
            overflow: hidden;
        }

        .kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
        }

        .kpi-card.income::before { background: var(--success); }
        .kpi-card.expense::before { background: var(--danger); }
        .kpi-card.balance::before { background: var(--primary); }
        .kpi-card.audit::before { background: #8b5cf6; }

        .kpi-label {
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            color: var(--slate-600);
            margin-bottom: 6px;
        }

        .kpi-value {
            font-size: 1.7rem;
            font-weight: 800;
            color: var(--slate-900);
            font-variant-numeric: tabular-nums;
        }

        .kpi-value.income { color: var(--success); }
        .kpi-value.expense { color: var(--danger); }
        .kpi-value.balance-pos { color: var(--primary); }
        .kpi-value.balance-neg { color: var(--danger); }

        .kpi-details {
            margin-top: 10px;
            font-size: 0.78rem;
            color: var(--slate-600);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px dashed var(--slate-200);
            padding-top: 8px;
        }

        /* SECTION CARDS */
        .card {
            background: #ffffff;
            border: 1px solid var(--slate-200);
            border-radius: var(--radius-lg);
            padding: 24px;
            box-shadow: var(--shadow-sm);
            margin-bottom: 24px;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 12px;
        }

        .card-title {
            font-size: 1.1rem;
            font-weight: 800;
            color: var(--slate-900);
        }

        /* CATEGORIAS HORIZONTAL BARS */
        .cat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 14px;
        }

        .cat-item {
            background: var(--slate-50);
            border: 1px solid var(--slate-200);
            border-radius: var(--radius-md);
            padding: 12px 14px;
        }

        .cat-header {
            display: flex;
            justify-content: space-between;
            font-size: 0.82rem;
            font-weight: 700;
            margin-bottom: 6px;
        }

        .progress-bar-bg {
            height: 6px;
            background: var(--slate-200);
            border-radius: 3px;
            overflow: hidden;
        }

        .progress-bar-fill {
            height: 100%;
            background: var(--danger);
            border-radius: 3px;
        }

        /* CONTROLS TOOLBAR */
        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 18px;
            background: #ffffff;
            padding: 14px 18px;
            border-radius: var(--radius-lg);
            border: 1px solid var(--slate-200);
        }

        .filter-group {
            display: inline-flex;
            background: var(--slate-100);
            border-radius: 8px;
            padding: 3px;
            gap: 4px;
        }

        .filter-btn {
            background: transparent;
            border: none;
            padding: 6px 14px;
            font-size: 0.8125rem;
            font-weight: 600;
            border-radius: 6px;
            color: var(--slate-600);
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .filter-btn.active {
            background: #ffffff;
            color: var(--primary);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .search-input {
            border: 1px solid var(--slate-300);
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 0.85rem;
            min-width: 240px;
            outline: none;
        }

        .search-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
        }

        /* ACCORDION DIA POR DIA */
        .day-accordion {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .day-card {
            background: #ffffff;
            border: 1px solid var(--slate-200);
            border-radius: var(--radius-lg);
            overflow: hidden;
            box-shadow: var(--shadow-sm);
            transition: border-color 0.15s ease;
        }

        .day-header {
            padding: 16px 20px;
            background: #ffffff;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            gap: 12px;
            flex-wrap: wrap;
            border-bottom: 1px solid transparent;
        }

        .day-card.open .day-header {
            background: var(--slate-50);
            border-bottom-color: var(--slate-200);
        }

        .day-title {
            font-size: 1rem;
            font-weight: 800;
            color: var(--slate-900);
            display: flex;
            align-items: center;
            gap: 8px;
            text-transform: capitalize;
        }

        .day-pills {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .badge {
            font-size: 0.75rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-variant-numeric: tabular-nums;
        }

        .badge-income { background: var(--success-light); color: var(--success); }
        .badge-expense { background: var(--danger-light); color: var(--danger); }
        .badge-balance { background: var(--primary-light); color: var(--primary); }
        .badge-cash { background: #fef3c7; color: #b45309; }
        .badge-bank { background: #e0e7ff; color: #4338ca; }

        .chevron {
            display: inline-block;
            transition: transform 0.2s ease;
            font-size: 0.8rem;
            color: var(--slate-600);
        }

        .day-card.open .chevron {
            transform: rotate(180deg);
        }

        .day-content {
            display: none;
            padding: 0;
        }

        .day-card.open .day-content {
            display: block;
        }

        /* TABLES */
        .table-responsive {
            width: 100%;
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.83rem;
            text-align: left;
        }

        th {
            background: var(--slate-50);
            color: var(--slate-600);
            font-weight: 700;
            padding: 10px 14px;
            border-bottom: 1px solid var(--slate-200);
            text-transform: uppercase;
            font-size: 0.72rem;
            letter-spacing: 0.03em;
        }

        td {
            padding: 12px 14px;
            border-bottom: 1px solid var(--slate-200);
            color: var(--slate-800);
            vertical-align: middle;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr:hover td {
            background: #fafbfd;
        }

        .amount-cell {
            font-weight: 800;
            font-variant-numeric: tabular-nums;
            text-align: right;
            font-size: 0.9rem;
        }

        .amount-cell.income { color: var(--success); }
        .amount-cell.expense { color: var(--danger); }

        .btn-voucher {
            background: var(--primary-light);
            color: var(--primary);
            border: 1px solid rgba(2, 132, 199, 0.3);
            border-radius: 6px;
            padding: 3px 8px;
            font-size: 0.75rem;
            font-weight: 700;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .btn-voucher:hover {
            background: var(--primary);
            color: #ffffff;
        }

        /* LIGHTBOX MODAL */
        .lightbox-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(4px);
            z-index: 9999;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .lightbox-content {
            background: #ffffff;
            border-radius: var(--radius-lg);
            max-width: 900px;
            width: 100%;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow-lg);
        }

        .lightbox-header {
            padding: 14px 20px;
            border-bottom: 1px solid var(--slate-200);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .lightbox-body {
            padding: 20px;
            overflow-y: auto;
            text-align: center;
            background: #0f172a;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 350px;
        }

        .lightbox-body img {
            max-width: 100%;
            max-height: 70vh;
            border-radius: 6px;
            object-fit: contain;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }

        .lightbox-footer {
            padding: 12px 20px;
            border-top: 1px solid var(--slate-200);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            background: var(--slate-50);
        }

        .btn {
            padding: 8px 16px;
            font-size: 0.82rem;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            border: 1px solid transparent;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .btn-primary { background: var(--primary); color: #ffffff; }
        .btn-primary:hover { background: var(--primary-dark); }
        .btn-secondary { background: #ffffff; border-color: var(--slate-300); color: var(--slate-800); }
        .btn-secondary:hover { background: var(--slate-100); }

        /* FOOTER */
        .report-footer {
            text-align: center;
            font-size: 0.78rem;
            color: var(--slate-600);
            margin-top: 36px;
            padding-top: 20px;
            border-top: 1px solid var(--slate-200);
        }

        @media (max-width: 768px) {
            .report-header { flex-direction: column; align-items: flex-start; }
            .period-card { text-align: left; width: 100%; }
            .toolbar { flex-direction: column; align-items: stretch; }
            .search-input { min-width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- HEADER -->
        <header class="report-header">
            <div>
                <div class="brand-title">
                    ${escapeHtml(razonSocial)}
                    <span class="badge-primary">Reporte Oficial</span>
                </div>
                <div class="company-meta">
                    <strong>RUC:</strong> ${escapeHtml(ruc)} &bull; ${escapeHtml(direccion)}
                </div>
                <div class="company-meta" style="margin-top: 2px;">
                    <strong>Emisión:</strong> ${escapeHtml(fechaEmision)} &bull; <strong>Responsable:</strong> ${escapeHtml(generatedBy)}
                </div>
            </div>

            <div class="period-card">
                <div class="period-label">Período Seleccionado</div>
                <div class="period-dates">
                    ${startDate ? escapeHtml(startDate) : 'Inicio'} &rarr; ${endDate ? escapeHtml(endDate) : 'Hoy'}
                </div>
                <div class="period-sub">Consolidado y Detalle Día a Día</div>
            </div>
        </header>

        <!-- KPIS CONSOLIDADOS -->
        <section class="kpi-grid">
            <div class="kpi-card income">
                <div class="kpi-label">Total Ingresos</div>
                <div class="kpi-value income">+${formatCurrency(totalIngresos)}</div>
                <div class="kpi-details">
                    <span>Efectivo: <strong>${formatCurrency(totalIngresosCaja)}</strong></span>
                    <span>Bancos: <strong>${formatCurrency(totalIngresosBanco)}</strong></span>
                </div>
            </div>

            <div class="kpi-card expense">
                <div class="kpi-label">Total Egresos / Gastos</div>
                <div class="kpi-value expense">-${formatCurrency(totalEgresos)}</div>
                <div class="kpi-details">
                    <span>Efectivo: <strong>${formatCurrency(totalEgresosCaja)}</strong></span>
                    <span>Bancos: <strong>${formatCurrency(totalEgresosBanco)}</strong></span>
                </div>
            </div>

            <div class="kpi-card balance">
                <div class="kpi-label">Balance Neto del Período</div>
                <div class="kpi-value ${balanceNeto >= 0 ? 'balance-pos' : 'balance-neg'}">
                    ${balanceNeto >= 0 ? '+' : ''}${formatCurrency(balanceNeto)}
                </div>
                <div class="kpi-details">
                    <span>Margen Operativo</span>
                    <span class="badge ${balanceNeto >= 0 ? 'badge-income' : 'badge-expense'}">
                        ${balanceNeto >= 0 ? 'Superávit' : 'Déficit'}
                    </span>
                </div>
            </div>

            <div class="kpi-card audit">
                <div class="kpi-label">Auditoría de Sustentos</div>
                <div class="kpi-value" style="color: #8b5cf6;">${porcentajeSustentado}%</div>
                <div class="kpi-details">
                    <span>Con Foto/Comprobante: <strong>${countConSustento}</strong></span>
                    <span>Pendientes: <strong>${countSinSustento}</strong></span>
                </div>
            </div>
        </section>

        <!-- DISTRIBUCIÓN POR CATEGORÍA -->
        ${sortedCategorias.length > 0 ? `
        <section class="card">
            <div class="card-header">
                <h2 class="card-title">Distribución de Gastos por Categoría</h2>
                <span class="badge badge-expense">Total: -${formatCurrency(totalEgresos)}</span>
            </div>
            <div class="cat-grid">
                ${sortedCategorias.map((c) => `
                    <div class="cat-item">
                        <div class="cat-header">
                            <span>${escapeHtml(c.categoria)}</span>
                            <span>${formatCurrency(c.total)} (${c.porcentaje}%)</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${c.porcentaje}%;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
        ` : ''}

        <!-- CONTROLS & TOOLBAR -->
        <div class="toolbar">
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <div class="filter-group">
                    <button type="button" class="filter-btn active" onclick="setFilterType('all')">Todos</button>
                    <button type="button" class="filter-btn" onclick="setFilterType('ingreso')">Solo Ingresos</button>
                    <button type="button" class="filter-btn" onclick="setFilterType('egreso')">Solo Egresos</button>
                </div>
                <button type="button" class="btn btn-secondary" onclick="toggleAllDays()" id="btn-toggle-days" style="padding: 6px 12px; font-size: 0.78rem;">
                    Colapsar Todos
                </button>
            </div>

            <div>
                <input 
                    type="text" 
                    id="search-input" 
                    class="search-input" 
                    placeholder="Buscar cliente, beneficiario, concepto..." 
                    oninput="handleSearch(this.value)"
                />
            </div>
        </div>

        <!-- LISTA DIA POR DIA INTERACTIVA -->
        <main class="day-accordion" id="days-container">
            ${sortedDays.map((dia, index) => {
                const balanceDia = dia.ingresos - dia.egresos;
                const diaNombre = formatDateReadable(dia.fecha);

                return `
                <article class="day-card open" data-date="${dia.fecha}">
                    <div class="day-header" onclick="toggleDay('${dia.fecha}')">
                        <div class="day-title">
                            <span class="chevron">&#9660;</span>
                            <span>${escapeHtml(diaNombre)}</span>
                            <span style="font-size: 0.75rem; color: var(--slate-600); font-weight: 600;">(${dia.movimientos.length} movs)</span>
                        </div>
                        <div class="day-pills">
                            <span class="badge badge-income">+${formatCurrency(dia.ingresos)}</span>
                            <span class="badge badge-expense">-${formatCurrency(dia.egresos)}</span>
                            <span class="badge badge-balance">Neto: ${balanceDia >= 0 ? '+' : ''}${formatCurrency(balanceDia)}</span>
                        </div>
                    </div>

                    <div class="day-content">
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 70px;">Hora</th>
                                        <th style="width: 100px;">Flujo</th>
                                        <th style="width: 130px;">Fondo</th>
                                        <th>Beneficiario / Cliente</th>
                                        <th>Detalle / Concepto</th>
                                        <th>Comprobante</th>
                                        <th style="text-align: right; width: 110px;">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${dia.movimientos.map((m) => {
                                        const isIng = m.tipo === 'ingreso';
                                        const isCash = m.tipo_fondo === 'caja';
                                        const montoNum = parseFloat(m.monto || 0);
                                        const horaStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                                        const compLabel = m.sustento_numero || (m.origen === 'pago_pedido' ? `NV-${String(m.id).padStart(6, '0')}` : 'Sin sustento');
                                        const voucherUrl = m.sustento_archivo_url ? resolveImageUrl(m.sustento_archivo_url) : null;
                                        const searchContent = `${m.beneficiario || ''} ${m.descripcion || ''} ${m.categoria_gasto || ''} ${compLabel}`.toLowerCase();

                                        return `
                                        <tr class="mov-row" data-type="${m.tipo}" data-search="${escapeHtml(searchContent)}">
                                            <td style="color: var(--slate-600); font-variant-numeric: tabular-nums;">${horaStr}</td>
                                            <td>
                                                <span class="badge ${isIng ? 'badge-income' : 'badge-expense'}">
                                                    ${isIng ? 'Ingreso' : 'Egreso'}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="badge ${isCash ? 'badge-cash' : 'badge-bank'}">
                                                    ${isCash ? 'Efectivo en Caja' : 'Banco / Transf.'}
                                                </span>
                                            </td>
                                            <td>
                                                <strong>${escapeHtml(m.beneficiario || (m.origen === 'pago_pedido' ? 'Cliente Directo' : 'Sin beneficiario'))}</strong>
                                                ${m.pedido_codigo ? `<span class="badge badge-balance" style="margin-left: 4px;">${escapeHtml(m.pedido_codigo)}</span>` : ''}
                                            </td>
                                            <td>
                                                <div>${escapeHtml(m.descripcion || m.producto_nombre || 'Sin descripción')}</div>
                                                ${m.categoria_gasto ? `<div style="font-size: 0.72rem; color: var(--slate-600);">${escapeHtml(m.categoria_gasto.replace(/_/g, ' '))}</div>` : ''}
                                            </td>
                                            <td>
                                                ${voucherUrl ? `
                                                    <button type="button" class="btn-voucher" onclick="openLightbox('${escapeHtml(voucherUrl)}', '${escapeHtml(compLabel)}', '${escapeHtml(m.beneficiario || '')}', '${isIng ? '+' : '-'}${formatCurrency(montoNum)}')">
                                                        📷 ${escapeHtml(compLabel)}
                                                    </button>
                                                ` : `
                                                    <span style="font-size: 0.75rem; color: var(--slate-600);">${escapeHtml(compLabel)}</span>
                                                `}
                                            </td>
                                            <td class="amount-cell ${isIng ? 'income' : 'expense'}">
                                                ${isIng ? `+${formatCurrency(montoNum)}` : `-${formatCurrency(montoNum)}`}
                                            </td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </article>
                `;
            }).join('')}
        </main>

        <!-- FOOTER -->
        <footer class="report-footer">
            <p><strong>${escapeHtml(razonSocial)}</strong> &bull; RUC ${escapeHtml(ruc)}</p>
            <p style="margin-top: 4px;">Este archivo es un reporte interactivo generado automáticamente. No requiere conexión a internet para consultar sus registros.</p>
        </footer>
    </div>

    <!-- LIGHTBOX MODAL PARA VOUCHERS -->
    <div class="lightbox-overlay" id="lightbox" onclick="closeLightbox(event)">
        <div class="lightbox-content" onclick="event.stopPropagation()">
            <div class="lightbox-header">
                <div>
                    <h3 id="lightbox-title" style="font-size: 0.95rem; font-weight: 800; color: var(--slate-900);">Comprobante</h3>
                    <p id="lightbox-subtitle" style="font-size: 0.75rem; color: var(--slate-600);"></p>
                </div>
                <button type="button" class="btn btn-secondary" onclick="closeLightbox()" style="padding: 4px 10px;">&times; Cerrar</button>
            </div>
            <div class="lightbox-body">
                <img id="lightbox-img" src="" alt="Comprobante digital" />
            </div>
            <div class="lightbox-footer">
                <a id="lightbox-link" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                    Abrir archivo original &rarr;
                </a>
            </div>
        </div>
    </div>

    <!-- JAVASCRIPT INTERACTIVO CLIENT-SIDE -->
    <script>
        let currentFilter = 'all';
        let currentSearch = '';
        let allExpanded = true;

        function toggleDay(dateKey) {
            const card = document.querySelector('.day-card[data-date="' + dateKey + '"]');
            if (card) {
                card.classList.toggle('open');
            }
        }

        function toggleAllDays() {
            const cards = document.querySelectorAll('.day-card');
            const btn = document.getElementById('btn-toggle-days');
            allExpanded = !allExpanded;

            cards.forEach(card => {
                if (allExpanded) {
                    card.classList.add('open');
                } else {
                    card.classList.remove('open');
                }
            });

            btn.textContent = allExpanded ? 'Colapsar Todos' : 'Expandir Todos';
        }

        function setFilterType(type) {
            currentFilter = type;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            applyFilters();
        }

        function handleSearch(val) {
            currentSearch = (val || '').toLowerCase().trim();
            applyFilters();
        }

        function applyFilters() {
            const rows = document.querySelectorAll('.mov-row');
            const dayCards = document.querySelectorAll('.day-card');

            rows.forEach(row => {
                const rowType = row.getAttribute('data-type');
                const rowSearch = row.getAttribute('data-search') || '';

                const matchesType = currentFilter === 'all' || rowType === currentFilter;
                const matchesSearch = !currentSearch || rowSearch.includes(currentSearch);

                if (matchesType && matchesSearch) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });

            // Ocultar días que se quedaron sin filas visibles
            dayCards.forEach(card => {
                const visibleRows = card.querySelectorAll('.mov-row:not([style*="display: none"])');
                if (visibleRows.length === 0) {
                    card.style.display = 'none';
                } else {
                    card.style.display = '';
                }
            });
        }

        function openLightbox(url, title, subtitle, monto) {
            const lb = document.getElementById('lightbox');
            const img = document.getElementById('lightbox-img');
            const t = document.getElementById('lightbox-title');
            const s = document.getElementById('lightbox-subtitle');
            const link = document.getElementById('lightbox-link');

            img.src = url;
            t.textContent = title + ' · ' + monto;
            s.textContent = subtitle;
            link.href = url;

            lb.style.display = 'flex';
        }

        function closeLightbox(e) {
            document.getElementById('lightbox').style.display = 'none';
            document.getElementById('lightbox-img').src = '';
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeLightbox();
        });
    </script>
</body>
</html>`;
};

/**
 * Dispara la descarga del archivo HTML interactivo en el navegador
 */
export const downloadFinancialHtmlReport = (options) => {
    const htmlContent = buildFinancialHtmlReport(options);
    const startStr = options.startDate || 'inicio';
    const endStr = options.endDate || 'hoy';
    const fileName = `Reporte_Financiero_AFINIX_${startStr}_a_${endStr}.html`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
