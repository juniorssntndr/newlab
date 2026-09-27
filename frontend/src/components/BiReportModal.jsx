import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import AfinixLogo from './AfinixLogo';
import { formatCategoriaGasto } from '../constants/financeCategories.js';
import '../styles/bi-report-modal.css';

const formatMoney = (val) => {
    const num = parseFloat(val || 0);
    if (Number.isNaN(num)) return 'S/. 0.00';
    return `S/. ${num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateLocal = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const [year, month, day] = String(dateStr).split('-');
        if (!year || !month || !day) return dateStr;
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
};

const BiReportModal = ({
    isOpen,
    onClose,
    filters = {},
    liquidez = {},
    ingresosFin = {},
    gastosFin = {},
    cuentasPorCobrar = {},
    gastoCategoriasTop = [],
    utilidadNeta = 0,
    margenNetoPct = 0,
    estrategicos = {},
    estrategicosKpis = {}
}) => {
    const reportRef = useRef(null);

    if (!isOpen) return null;

    const handlePrint = () => {
        window.print();
    };

    const todayDate = new Date();
    const formattedPrintDate = todayDate.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const formattedPrintTime = todayDate.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const totalCobrado = parseFloat(ingresosFin.periodo ?? ingresosFin.mes ?? 0);
    const totalGastos = parseFloat(gastosFin.periodo_total ?? gastosFin.mes_total ?? 0);
    const porCobrar = parseFloat(cuentasPorCobrar.total_calle ?? ingresosFin.por_cobrar_calle ?? 0);
    const pedidosPendientesCount = cuentasPorCobrar.pedidos_pendientes_count ?? ingresosFin.pedidos_pendientes_count ?? 0;

    const saldoCaja = parseFloat(liquidez.saldo_caja || 0);
    const saldoBancos = parseFloat(liquidez.saldo_bancos || 0);
    const flujoDia = parseFloat(liquidez.flujo_dia || 0);
    const totalDisponible = parseFloat(liquidez.saldoTotalHoy ?? (saldoCaja + saldoBancos));

    const topClinicas = Array.isArray(estrategicos.top_clinicas_periodo)
        ? estrategicos.top_clinicas_periodo.slice(0, 5)
        : [];
    const topProductos = Array.isArray(estrategicos.top_productos_periodo)
        ? estrategicos.top_productos_periodo.slice(0, 5)
        : [];

    const categoriesList = (gastoCategoriasTop || []).map((cat) => {
        const total = parseFloat(cat?.total || 0);
        const categoria = formatCategoriaGasto(cat?.categoria);
        const pct = totalGastos > 0 ? (total / totalGastos) * 100 : (cat.porcentaje || 0);
        return {
            categoria,
            total,
            porcentaje: pct
        };
    });

    const concTop3Clinicas = estrategicosKpis.concentracion_top3_clinicas_pct ?? 0;
    const concTop3Productos = estrategicosKpis.concentracion_top3_productos_pct ?? 0;

    const modalMarkup = (
        <div className="bi-report-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="bi-report-title">
            <div className="bi-report-modal" onClick={(e) => e.stopPropagation()} ref={reportRef}>
                {/* Header Acciones (no se imprime) */}
                <div className="bi-report-actions-bar no-print">
                    <div className="bi-report-actions-title">
                        <i className="bi bi-file-earmark-bar-graph-fill text-primary" aria-hidden="true"></i>
                        <span>Vista previa de Informe Financiero & BI</span>
                    </div>
                    <div className="bi-report-actions-btns">
                        <button
                            type="button"
                            className="btn btn-primary btn-sm bi-btn-print"
                            onClick={handlePrint}
                        >
                            <i className="bi bi-printer-fill" aria-hidden="true"></i>
                            <span>Imprimir / PDF</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={onClose}
                            aria-label="Cerrar informe"
                        >
                            <i className="bi bi-x-lg" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>

                {/* Hoja Ejecutiva de Reporte */}
                <div className="bi-report-sheet">
                    {/* Membrete Ejecutivo */}
                    <header className="bi-report-header">
                        <div className="bi-report-brand">
                            <AfinixLogo size={42} showText={true} />
                            <div className="bi-report-brand-sub">
                                <span className="bi-report-brand-tag">SISTEMA INTEGRAL DE GESTIÓN</span>
                            </div>
                        </div>

                        <div className="bi-report-title-block">
                            <h1 id="bi-report-title" className="bi-report-main-title">INFORME EJECUTIVO FINANCIERO & BI</h1>
                            <div className="bi-report-meta-grid">
                                <div className="bi-report-meta-item">
                                    <span className="bi-meta-label">PERÍODO:</span>
                                    <span className="bi-meta-val">{formatDateLocal(filters.from)} al {formatDateLocal(filters.to)}</span>
                                </div>
                                <div className="bi-report-meta-item">
                                    <span className="bi-meta-label">EMISIÓN:</span>
                                    <span className="bi-meta-val">{formattedPrintDate} - {formattedPrintTime}</span>
                                </div>
                                <div className="bi-report-meta-item">
                                    <span className="bi-meta-label">MONEDA:</span>
                                    <span className="bi-meta-val">Soles (PEN S/.)</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Ribbon Resumen Ejecutivo (4 KPIs Clave) */}
                    <section className="bi-report-kpi-ribbon">
                        <div className="bi-kpi-tile bi-kpi-income">
                            <span className="bi-kpi-tile-label">TOTAL COBRADO</span>
                            <span className="bi-kpi-tile-num">{formatMoney(totalCobrado)}</span>
                            <span className="bi-kpi-tile-sub">Ingresos del período</span>
                        </div>
                        <div className="bi-kpi-tile bi-kpi-expenses">
                            <span className="bi-kpi-tile-label">TOTAL GASTOS</span>
                            <span className="bi-kpi-tile-num">{formatMoney(totalGastos)}</span>
                            <span className="bi-kpi-tile-sub">Egresos operativos</span>
                        </div>
                        <div className={`bi-kpi-tile ${utilidadNeta >= 0 ? 'bi-kpi-profit' : 'bi-kpi-loss'}`}>
                            <span className="bi-kpi-tile-label">UTILIDAD OPERATIVA</span>
                            <span className="bi-kpi-tile-num">{formatMoney(utilidadNeta)}</span>
                            <span className="bi-kpi-tile-sub">Margen neto: {margenNetoPct.toFixed(1)}%</span>
                        </div>
                        <div className="bi-kpi-tile bi-kpi-receivable">
                            <span className="bi-kpi-tile-label">POR COBRAR (CALLE)</span>
                            <span className="bi-kpi-tile-num">{formatMoney(porCobrar)}</span>
                            <span className="bi-kpi-tile-sub">{pedidosPendientesCount} pedidos pendientes</span>
                        </div>
                    </section>

                    {/* SECCIÓN 1: Posición de Tesorería al Cierre */}
                    <section className="bi-report-section">
                        <div className="bi-section-header">
                            <i className="bi bi-wallet2" aria-hidden="true"></i>
                            <h2>1. Arqueo y Posición de Tesorería al Cierre</h2>
                        </div>
                        <div className="bi-treasury-grid">
                            <div className="bi-treasury-box">
                                <span className="bi-t-label">Flujo Neto de Hoy</span>
                                <span className={`bi-t-val ${flujoDia >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {formatMoney(flujoDia)}
                                </span>
                                <span className="bi-t-hint">Ingresos - Gastos del día</span>
                            </div>
                            <div className="bi-treasury-box">
                                <span className="bi-t-label">Efectivo en Caja</span>
                                <span className="bi-t-val text-success">{formatMoney(saldoCaja)}</span>
                                <span className="bi-t-hint">Saldo disponible en taller</span>
                            </div>
                            <div className="bi-treasury-box">
                                <span className="bi-t-label">Saldo en Bancos</span>
                                <span className="bi-t-val text-primary">{formatMoney(saldoBancos)}</span>
                                <span className="bi-t-hint">Cuentas corrientes / transferencias</span>
                            </div>
                            <div className="bi-treasury-box bi-treasury-total">
                                <span className="bi-t-label">Total Disponible Inmediato</span>
                                <span className="bi-t-val bi-t-highlight">{formatMoney(totalDisponible)}</span>
                                <span className="bi-t-hint">Caja + Bancos consolidados</span>
                            </div>
                        </div>
                    </section>

                    {/* SECCIÓN 2: Desglose Analítico de Gastos */}
                    <section className="bi-report-section">
                        <div className="bi-section-header">
                            <i className="bi bi-pie-chart" aria-hidden="true"></i>
                            <h2>2. Estructura Analítica de Gastos Operativos</h2>
                        </div>
                        {categoriesList && categoriesList.length > 0 ? (
                            <div className="bi-table-container">
                                <table className="bi-data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40%' }}>Categoría de Gasto</th>
                                            <th style={{ width: '25%', textAlign: 'right' }}>Monto (S/.)</th>
                                            <th style={{ width: '15%', textAlign: 'right' }}>% Total</th>
                                            <th style={{ width: '20%' }}>Distribución</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categoriesList.map((cat, idx) => (
                                            <tr key={idx}>
                                                <td className="font-semibold">{cat.categoria}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMoney(cat.total)}</td>
                                                <td style={{ textAlign: 'right' }}>{cat.porcentaje.toFixed(1)}%</td>
                                                <td>
                                                    <div className="bi-mini-bar-track">
                                                        <div
                                                            className="bi-mini-bar-fill"
                                                            style={{ width: `${Math.min(100, Math.max(3, cat.porcentaje))}%` }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <th>Total Consolidado</th>
                                            <th style={{ textAlign: 'right' }}>{formatMoney(totalGastos)}</th>
                                            <th style={{ textAlign: 'right' }}>100.0%</th>
                                            <th></th>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <p className="bi-empty-text">No se registraron gastos operativos en el período seleccionado.</p>
                        )}
                    </section>

                    {/* SECCIÓN 3: Análisis Estratégico y Concentración */}
                    <section className="bi-report-section">
                        <div className="bi-section-header">
                            <i className="bi bi-graph-up-arrow" aria-hidden="true"></i>
                            <h2>3. Análisis Estratégico de Concentración y Mercado</h2>
                        </div>

                        {/* Badges de Concentración */}
                        <div className="bi-concentration-badges">
                            <div className="bi-badge-box">
                                <span className="bi-badge-title">Concentración Top 3 Clínicas:</span>
                                <span className="bi-badge-value">{concTop3Clinicas.toFixed(1)}%</span>
                                <span className="bi-badge-desc">de las ventas totales</span>
                            </div>
                            <div className="bi-badge-box">
                                <span className="bi-badge-title">Concentración Top 3 Productos:</span>
                                <span className="bi-badge-value">{concTop3Productos.toFixed(1)}%</span>
                                <span className="bi-badge-desc">de los ingresos de catálogo</span>
                            </div>
                        </div>

                        <div className="bi-strategic-columns">
                            {/* Top Clínicas */}
                            <div className="bi-strategic-col">
                                <h3 className="bi-col-title">
                                    <i className="bi bi-building" aria-hidden="true"></i>
                                    Top 5 Clínicas / Clientes
                                </h3>
                                {topClinicas.length > 0 ? (
                                    <table className="bi-data-table bi-table-compact">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '10%' }}>#</th>
                                                <th style={{ width: '55%' }}>Clínica</th>
                                                <th style={{ width: '35%', textAlign: 'right' }}>Ventas (S/.)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topClinicas.map((c, i) => (
                                                <tr key={i}>
                                                    <td className="text-muted">{i + 1}</td>
                                                    <td className="font-semibold text-truncate" title={c.clinica}>{c.clinica}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatMoney(c.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="bi-empty-text">Sin datos de clínicas para este período.</p>
                                )}
                            </div>

                            {/* Top Productos */}
                            <div className="bi-strategic-col">
                                <h3 className="bi-col-title">
                                    <i className="bi bi-award" aria-hidden="true"></i>
                                    Top 5 Productos Demandados
                                </h3>
                                {topProductos.length > 0 ? (
                                    <table className="bi-data-table bi-table-compact">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '10%' }}>#</th>
                                                <th style={{ width: '55%' }}>Producto</th>
                                                <th style={{ width: '35%', textAlign: 'right' }}>Monto (S/.)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topProductos.map((p, i) => (
                                                <tr key={i}>
                                                    <td className="text-muted">{i + 1}</td>
                                                    <td className="font-semibold text-truncate" title={p.producto}>{p.producto}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatMoney(p.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="bi-empty-text">Sin datos de productos para este período.</p>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Footer de Auditoría */}
                    <footer className="bi-report-footer">
                        <p className="bi-footer-audit">
                            AFINIX DENTAL LAB • Informe Ejecutivo Automatizado • Generado para uso interno gerencial y toma de decisiones.
                        </p>
                    </footer>
                </div>
            </div>
        </div>
    );

    return createPortal(modalMarkup, document.body);
};

export default BiReportModal;
