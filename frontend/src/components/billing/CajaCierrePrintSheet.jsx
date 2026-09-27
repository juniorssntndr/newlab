import React from 'react';
import logoLight from '../../assets/branding/logo-light.png';

const fmt = (v) => {
    const n = parseFloat(v || 0);
    return isNaN(n) ? 'S/. 0.00' : 'S/. ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (v) => {
    if (!v) return '—';
    try {
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v);
        return new Intl.DateTimeFormat('es-PE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    } catch {
        return String(v);
    }
};

const fmtDateShort = (v) => {
    if (!v) return '—';
    try {
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v);
        return new Intl.DateTimeFormat('es-PE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(d);
    } catch {
        return String(v);
    }
};

const extractJobInfo = (m) => {
    let paciente = m.paciente_nombre;
    let pedido = m.pedido_codigo;
    let producto = m.producto_nombre;

    const desc = m.descripcion || '';
    if (!paciente && desc) {
        const pacMatch = desc.match(/Pac:\s*([^)]+)/i);
        if (pacMatch) paciente = pacMatch[1].trim();
    }
    if (!pedido && desc) {
        const pedMatch = desc.match(/SIM-[0-9A-Za-z_-]+/i) || desc.match(/NL-[0-9A-Za-z_-]+/i);
        if (pedMatch) pedido = pedMatch[0].trim();
    }
    if (!producto) {
        let clean = desc
            .replace(/Cobro (consolidado de \d+ pedidos:?|de pedido)?\s*(SIM|NL)-[0-9A-Za-z_,-]+/gi, '')
            .replace(/\(Pac:[^)]+\)/gi, '')
            .trim();
        producto = clean.length > 2 ? clean : 'Trabajo Dental';
    }
    return {
        paciente: paciente || '—',
        pedido: pedido || '—',
        producto: producto
    };
};

export const CajaCierrePrintSheet = ({ session, empresa, movimientos = [] }) => {
    if (!session) return null;

    const razonSocial = empresa?.razon_social || 'AFINIX DENTAL LAB S.A.C.';
    const ruc = empresa?.ruc || '20616033973';
    const direccion = empresa?.direccion || 'Calle Piura 316, Mariano Melgar, Arequipa.';
    const telefono = empresa?.telefono || '(01) 748-2910';
    const web = 'www.afinixlab.com';

    const fechaSesion = session.fecha ? fmtDateShort(session.fecha) : fmtDateShort(new Date());
    const turno = (session.turno || 'GENERAL').toUpperCase();
    const sessionId = session.id ? ('#' + session.id) : 'ACTUAL';
    const estado = (session.estado || 'CERRADA').toUpperCase();
    const isConsolidado = Boolean(session.isConsolidadoDia || session.turno === 'TODO EL DÍA' || session.turno === 'dia');

    // Movimientos desglosados
    const ingresos = movimientos.filter((m) => m.tipo === 'ingreso');
    const egresos = movimientos.filter((m) => m.tipo === 'egreso');

    // Cálculos reactivos desde los movimientos del reporte para evitar inconsistencias
    const movIngEfectivo = ingresos.filter((m) => m.tipo_fondo === 'caja').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
    const movEgEfectivo = egresos.filter((m) => m.tipo_fondo === 'caja').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
    const movIngBanco = ingresos.filter((m) => m.tipo_fondo === 'banco').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
    const movEgBanco = egresos.filter((m) => m.tipo_fondo === 'banco').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);

    const useCalculatedFromMovs = isConsolidado || (movimientos.length > 0 && parseFloat(session.total_ingresos_efectivo || 0) === 0 && (movIngEfectivo > 0 || movIngBanco > 0));

    const apertura = parseFloat(session.monto_apertura || 0);
    const ingEfectivo = useCalculatedFromMovs ? movIngEfectivo : parseFloat(session.total_ingresos_efectivo || 0);
    const egEfectivo = useCalculatedFromMovs ? movEgEfectivo : parseFloat(session.total_egresos_efectivo || 0);
    const esperado = parseFloat(session.monto_esperado_efectivo ?? (apertura + ingEfectivo - egEfectivo));
    const realContado = session.monto_real_efectivo !== null && session.monto_real_efectivo !== undefined
        ? parseFloat(session.monto_real_efectivo)
        : esperado;
    const dif = session.diferencia_efectivo !== null && session.diferencia_efectivo !== undefined && !isConsolidado
        ? parseFloat(session.diferencia_efectivo)
        : (realContado - esperado);

    const ingBanco = useCalculatedFromMovs ? movIngBanco : parseFloat(session.total_ingresos_banco || 0);
    const egBanco = useCalculatedFromMovs ? movEgBanco : parseFloat(session.total_egresos_banco || 0);
    const saldoBanco = ingBanco - egBanco;

    const totalIngresos = ingEfectivo + ingBanco;
    const totalEgresos = egEfectivo + egBanco;
    const flujoNeto = totalIngresos - totalEgresos;

    // Desglose tributario de comprobantes
    const boletas = ingresos.filter(m => m.sustento_comprobante_tipo === '03' || (m.sustento_numero && m.sustento_numero.startsWith('B')));
    const facturas = ingresos.filter(m => m.sustento_comprobante_tipo === '01' || (m.sustento_numero && m.sustento_numero.startsWith('F')));
    const notas = ingresos.filter(m => !boletas.includes(m) && !facturas.includes(m));

    const totalBoletas = boletas.reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
    const totalFacturas = facturas.reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
    const totalNotas = notas.reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);

    /* ==========================================================================
       MODO 1: REPORTE EJECUTIVO BI PARA SOCIOS / GERENCIA (isConsolidado === true)
       Limpio, sin membrete de factura, métricas directas y alta legibilidad.
       ========================================================================== */
    if (isConsolidado) {
        return (
            <div className="caja-cierre-sheet bi-executive-report" style={{
                width: '100%',
                maxWidth: '850px',
                margin: '0 auto',
                padding: '24px 28px',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '11.5px',
                lineHeight: '1.4'
            }}>
                {/* 1. Header Ejecutivo Limpio */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #0f172a',
                    paddingBottom: '12px',
                    marginBottom: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <img
                            src={logoLight}
                            alt={razonSocial}
                            style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                                {razonSocial}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>
                                RUC: {ruc} &bull; {direccion}
                            </div>
                            <div style={{ fontSize: '9.5px', color: '#0284c7', fontWeight: '600' }}>
                                Inteligencia Financiera &bull; Consolidado General de Operaciones
                            </div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <div style={{
                            display: 'inline-block',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            fontSize: '9.5px',
                            fontWeight: '700',
                            padding: '3px 10px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '4px',
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact'
                        }}>
                            Reporte Consolidado Diario
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                            {fechaSesion}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                            Jornada Completa &bull; {movimientos.length} transacciones liquidadas
                        </div>
                    </div>
                </div>

                {/* 2. Tarjetas Ejecutivas de Rendimiento Financiero (KPIs de Alto Impacto) */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px',
                    marginBottom: '16px'
                }}>
                    {/* KPI 1: Ingresos Totales */}
                    <div style={{
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                    }}>
                        <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Total Recaudado
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#15803d', margin: '3px 0 2px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                            +{fmt(totalIngresos)}
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#166534', fontWeight: '500' }}>
                            {ingresos.length} cobros ({fmt(ingEfectivo)} efec)
                        </div>
                    </div>

                    {/* KPI 2: Egresos Totales */}
                    <div style={{
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                    }}>
                        <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Total Egresos
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#b91c1c', margin: '3px 0 2px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                            -{fmt(totalEgresos)}
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#991b1b', fontWeight: '500' }}>
                            {egresos.length} gastos operativos
                        </div>
                    </div>

                    {/* KPI 3: Flujo Neto de Caja */}
                    <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                    }}>
                        <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Flujo Neto Diario
                        </div>
                        <div style={{
                            fontSize: '20px',
                            fontWeight: '900',
                            color: flujoNeto >= 0 ? '#0f172a' : '#dc2626',
                            margin: '3px 0 2px',
                            letterSpacing: '-0.02em',
                            fontVariantNumeric: 'tabular-nums'
                        }}>
                            {flujoNeto >= 0 ? '+' : ''}{fmt(flujoNeto)}
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '500' }}>
                            Margen neto de caja: {totalIngresos > 0 ? ((flujoNeto / totalIngresos) * 100).toFixed(0) + '%' : '0%'}
                        </div>
                    </div>

                    {/* KPI 4: Efectivo Disponible en Caja Física */}
                    <div style={{
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                    }}>
                        <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Efectivo en Caja
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#1d4ed8', margin: '3px 0 2px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(ingEfectivo - egEfectivo + apertura)}
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#1e40af', fontWeight: '500' }}>
                            Fondo apertura: {fmt(apertura)}
                        </div>
                    </div>
                </div>

                {/* 3. Barra de Síntesis Comercial y Tributaria (Insights de Negocio) */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    marginBottom: '16px',
                    fontSize: '10.5px'
                }}>
                    <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
                        <div>
                            <span style={{ color: '#64748b', fontWeight: '600' }}>Comprobantes SUNAT: </span>
                            <strong style={{ color: '#0f172a' }}>{boletas.length} Boletas</strong> ({fmt(totalBoletas)})
                            {facturas.length > 0 && <span> &bull; <strong style={{ color: '#0f172a' }}>{facturas.length} Facturas</strong> ({fmt(totalFacturas)})</span>}
                            {notas.length > 0 && <span> &bull; <strong style={{ color: '#64748b' }}>{notas.length} Notas</strong> ({fmt(totalNotas)})</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <div>
                            <span style={{ color: '#64748b', fontWeight: '600' }}>Canal de Recaudación: </span>
                            <strong style={{ color: '#059669' }}>100% Efectivo en Caja</strong>
                        </div>
                    </div>
                </div>

                {/* 4. Tabla de Transacciones - Cobros de Trabajos Dentales */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1.5px solid #0f172a',
                        paddingBottom: '5px',
                        marginBottom: '6px'
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Detalle de Cobranzas del Día ({ingresos.length})
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#15803d' }}>
                            Total Cobrado: +{fmt(totalIngresos)}
                        </div>
                    </div>

                    {ingresos.length === 0 ? (
                        <div style={{ padding: '12px 0', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                            No se registraron cobros en esta fecha.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', borderBottom: '1px solid #cbd5e1' }}>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '50px', fontWeight: '700' }}>Hora</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '180px', fontWeight: '700' }}>Cliente / Odontólogo</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '160px', fontWeight: '700' }}>Paciente &bull; Pedido</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '700' }}>Trabajo Dental</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'center', width: '90px', fontWeight: '700' }}>Comprobante</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'center', width: '65px', fontWeight: '700' }}>Canal</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', width: '80px', fontWeight: '700' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ingresos.map((m, idx) => {
                                    const timeStr = m.created_at
                                        ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : '—';
                                    const job = extractJobInfo(m);
                                    const compLabel = m.sustento_numero || (m.sustento_serie ? (m.sustento_serie + '-' + m.sustento_numero) : 'NV-000000');
                                    const isSunatCpe = compLabel.startsWith('B') || compLabel.startsWith('F');
                                    const canal = m.tipo_fondo === 'caja' ? 'Efectivo' : 'Banco';

                                    return (
                                        <tr key={m.id || idx} style={{
                                            borderBottom: '1px solid #f1f5f9',
                                            backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                                        }}>
                                            <td style={{ padding: '6px 8px', color: '#64748b', fontFamily: 'monospace' }}>
                                                {timeStr}
                                            </td>
                                            <td style={{ padding: '6px 8px', fontWeight: '700', color: '#0f172a' }}>
                                                {m.beneficiario || 'Cliente Mostrador'}
                                            </td>
                                            <td style={{ padding: '6px 8px' }}>
                                                <div style={{ fontWeight: '600', color: '#1e293b' }}>{job.paciente}</div>
                                                {job.pedido !== '—' && (
                                                    <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>
                                                        {job.pedido}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '6px 8px', color: '#334155' }}>
                                                {job.producto}
                                            </td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    backgroundColor: isSunatCpe ? '#eff6ff' : '#f1f5f9',
                                                    color: isSunatCpe ? '#1d4ed8' : '#475569',
                                                    fontWeight: '700',
                                                    fontSize: '9.5px',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {compLabel}
                                                </span>
                                            </td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center', color: '#475569' }}>
                                                {canal}
                                            </td>
                                            <td style={{
                                                padding: '6px 8px',
                                                textAlign: 'right',
                                                fontWeight: '800',
                                                color: '#15803d',
                                                fontFamily: 'monospace',
                                                fontSize: '11px'
                                            }}>
                                                +{fmt(m.monto)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1' }}>
                                    <td colSpan={6} style={{ padding: '7px 8px', fontWeight: '800', color: '#0f172a', textAlign: 'right' }}>
                                        TOTAL RECAUDADO ({ingresos.length} TRABAJOS):
                                    </td>
                                    <td style={{
                                        padding: '7px 8px',
                                        textAlign: 'right',
                                        fontWeight: '900',
                                        color: '#15803d',
                                        fontFamily: 'monospace',
                                        fontSize: '12px'
                                    }}>
                                        +{fmt(totalIngresos)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>

                {/* 5. Sección de Egresos (solo se muestra si existen) */}
                {egresos.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1.5px solid #b91c1c',
                            paddingBottom: '5px',
                            marginBottom: '6px'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                Detalle de Egresos y Gastos ({egresos.length})
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#b91c1c' }}>
                                Total Egresos: -{fmt(totalEgresos)}
                            </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '1px solid #fecaca' }}>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '50px' }}>Hora</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '180px' }}>Proveedor / Beneficiario</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', width: '140px' }}>Categoría</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Concepto</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'center', width: '80px' }}>Fondo</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', width: '80px' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {egresos.map((m, idx) => {
                                    const timeStr = m.created_at
                                        ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : '—';
                                    return (
                                        <tr key={m.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '6px 8px', color: '#64748b' }}>{timeStr}</td>
                                            <td style={{ padding: '6px 8px', fontWeight: '700', color: '#0f172a' }}>{m.beneficiario || '—'}</td>
                                            <td style={{ padding: '6px 8px', color: '#475569', textTransform: 'capitalize' }}>
                                                {(m.categoria_gasto || '').replace(/_/g, ' ')}
                                            </td>
                                            <td style={{ padding: '6px 8px', color: '#334155' }}>{m.descripcion || '—'}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center', color: '#475569' }}>
                                                {m.tipo_fondo === 'caja' ? 'Efectivo' : 'Banco'}
                                            </td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#b91c1c', fontFamily: 'monospace' }}>
                                                -{fmt(m.monto)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 6. Footer Ejecutivo de Auditoría */}
                <div style={{
                    marginTop: '24px',
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '9.5px',
                    color: '#94a3b8'
                }}>
                    <div>
                        <strong style={{ color: '#64748b' }}>AFINIX DENTAL LAB S.A.C.</strong> &bull; Sistema de Gestión Financiera
                    </div>
                    <div>
                        Reporte Oficial del Día &bull; {new Date().toLocaleString('es-PE')}
                    </div>
                </div>
            </div>
        );
    }

    /* ==========================================================================
       MODO 2: ARQUEO DE TURNO OPERATIVO (Cajero de Ventanilla)
       ========================================================================== */
    return (
        <div className="caja-cierre-sheet" style={{
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
            padding: '24px 28px',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            fontSize: '12px',
            lineHeight: '1.4'
        }}>
            {/* Header de Cierre de Turno */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid #0f172a',
                paddingBottom: '12px',
                marginBottom: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img
                        src={logoLight}
                        alt={razonSocial}
                        style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '-0.02em', color: '#0f172a' }}>
                            {razonSocial}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>
                            RUC: {ruc} &bull; {direccion}
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#0284c7', fontWeight: '600' }}>
                            Control Operativo de Turno &bull; Arqueo Físico y Auditoría de Caja
                        </div>
                    </div>
                </div>

                <div style={{
                    border: '1.5px solid #0f172a',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    textAlign: 'center',
                    backgroundColor: '#f8fafc',
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact'
                }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>
                        ARQUEO DE TURNO {turno}
                    </div>
                    <div style={{ fontSize: '10.5px', fontWeight: '600', color: '#2563eb' }}>
                        SESIÓN {sessionId} &bull; {fechaSesion}
                    </div>
                </div>
            </div>

            {/* Metadatos de la Sesión */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px',
                padding: '10px 14px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px',
                fontSize: '11.5px'
            }}>
                <div>
                    <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600' }}>Fecha del Turno</div>
                    <strong style={{ color: '#0f172a' }}>{fechaSesion}</strong>
                </div>
                <div>
                    <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600' }}>Apertura</div>
                    <div>{session.abierto_por_nombre || 'Administración'}</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px' }}>{session.abierto_en ? fmtDate(session.abierto_en) : '—'}</div>
                </div>
                <div>
                    <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600' }}>Cierre</div>
                    <div>{session.cerrado_por_nombre || (estado === 'CERRADA' ? 'Administración' : 'Pendiente')}</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px' }}>{session.cerrado_en ? fmtDate(session.cerrado_en) : 'En operación'}</div>
                </div>
                <div>
                    <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600' }}>Estado</div>
                    <strong style={{
                        color: estado === 'CERRADA' ? '#059669' : '#d97706',
                        display: 'inline-block',
                        padding: '1px 8px',
                        borderRadius: '999px',
                        backgroundColor: estado === 'CERRADA' ? '#dcfce7' : '#fef3c7',
                        fontSize: '10.5px'
                    }}>
                        {estado === 'CERRADA' ? 'Caja Cerrada' : 'Caja Abierta'}
                    </strong>
                </div>
            </div>

            {/* Bloques de Liquidación: Efectivo vs Digital */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>CUADRE DE CAJA FÍSICA (EFECTIVO)</span>
                        <span style={{ color: '#2563eb' }}>ARQUEO</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '3px 0', color: '#475569' }}>(+) Fondo Inicial / Apertura</td>
                                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: '600' }}>{fmt(apertura)}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '3px 0', color: '#059669' }}>(+) Cobros e Ingresos en Efectivo</td>
                                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: '600', color: '#059669' }}>+{fmt(ingEfectivo)}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '3px 0', color: '#dc2626' }}>(-) Egresos / Gastos en Efectivo</td>
                                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: '600', color: '#dc2626' }}>-{fmt(egEfectivo)}</td>
                            </tr>
                            <tr style={{ borderTop: '1px dashed #cbd5e1' }}>
                                <td style={{ padding: '6px 0 3px', fontWeight: '700', color: '#0f172a' }}>(=) Saldo Teórico Esperado</td>
                                <td style={{ padding: '6px 0 3px', textAlign: 'right', fontWeight: '800', fontSize: '12.5px', color: '#0f172a' }}>
                                    {fmt(esperado)}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '3px 0', fontWeight: '700', color: '#2563eb' }}>Efectivo Físico Contado (Real)</td>
                                <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: '800', fontSize: '12.5px', color: '#2563eb' }}>
                                    {fmt(realContado)}
                                </td>
                            </tr>
                            <tr style={{ borderTop: '1px solid #0f172a' }}>
                                <td style={{ padding: '6px 0 2px', fontWeight: '800' }}>Diferencia de Arqueo</td>
                                <td style={{
                                    padding: '6px 0 2px',
                                    textAlign: 'right',
                                    fontWeight: '800',
                                    fontSize: '12px',
                                    color: Math.abs(dif) < 0.01 ? '#059669' : dif < 0 ? '#dc2626' : '#2563eb'
                                }}>
                                    {Math.abs(dif) < 0.01 ? 'S/. 0.00 (CONFORME)' : dif < 0 ? (fmt(dif) + ' (FALTANTE)') : ('+' + fmt(dif) + ' (SOBRANTE)')}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 14px', flex: 1 }}>
                        <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px' }}>
                            BANCOS &amp; CANALES DIGITALES
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '3px 0', color: '#059669' }}>(+) Transferencias / Yape / Plin</td>
                                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: '600', color: '#059669' }}>+{fmt(ingBanco)}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '3px 0', color: '#dc2626' }}>(-) Pagos Digitales / Gastos</td>
                                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: '600', color: '#dc2626' }}>-{fmt(egBanco)}</td>
                                </tr>
                                <tr style={{ borderTop: '1px dashed #cbd5e1' }}>
                                    <td style={{ padding: '6px 0 2px', fontWeight: '700' }}>Neto Bancario del Turno</td>
                                    <td style={{ padding: '6px 0 2px', textAlign: 'right', fontWeight: '800', color: saldoBanco >= 0 ? '#2563eb' : '#dc2626' }}>
                                        {fmt(saldoBanco)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '8px', padding: '10px 14px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8' }}>Flujo Neto Total del Turno</div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#38bdf8', marginTop: '2px' }}>
                            {fmt(flujoNeto)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                            Ingresos: {fmt(totalIngresos)} &bull; Egresos: {fmt(totalEgresos)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Detalle de Ingresos */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#0f172a',
                    borderBottom: '1.5px solid #059669',
                    paddingBottom: '4px',
                    marginBottom: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>DETALLE DE INGRESOS ({ingresos.length})</span>
                    <span style={{ color: '#059669', fontSize: '10.5px', fontWeight: '700' }}>Total: +{fmt(totalIngresos)}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #bbf7d0', color: '#166534' }}>
                            <th style={{ padding: '4px 6px', textAlign: 'left', width: '50px' }}>Hora</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left', width: '160px' }}>Cliente / Clínica</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Detalle / Paciente</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left', width: '90px' }}>Comprobante</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left', width: '70px' }}>Medio</th>
                            <th style={{ padding: '4px 6px', textAlign: 'right', width: '70px' }}>Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ingresos.map((m, idx) => {
                            const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                            const job = extractJobInfo(m);
                            const compLabel = m.sustento_numero || 'NV';
                            const medioLabel = m.tipo_fondo === 'caja' ? 'Efectivo' : 'Banco';
                            return (
                                <tr key={m.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '4px 6px', color: '#64748b' }}>{timeStr}</td>
                                    <td style={{ padding: '4px 6px', fontWeight: '700', color: '#0f172a' }}>{m.beneficiario || 'Cliente Directo'}</td>
                                    <td style={{ padding: '4px 6px', color: '#334155' }}>
                                        {job.paciente !== '—' ? `${job.paciente} (${job.pedido})` : (job.producto || m.descripcion)}
                                    </td>
                                    <td style={{ padding: '4px 6px', color: '#2563eb', fontWeight: '600' }}>{compLabel}</td>
                                    <td style={{ padding: '4px 6px', color: '#475569' }}>{medioLabel}</td>
                                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>
                                        +{fmt(m.monto)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Detalle de Egresos Operativos (si existen) */}
            {egresos.length > 0 && (
                <div style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
                    <div style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#0f172a',
                        borderBottom: '1.5px solid #dc2626',
                        paddingBottom: '4px',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ color: '#991b1b' }}>DETALLE DE EGRESOS Y GASTOS OPERATIVOS ({egresos.length})</span>
                        <span style={{ color: '#dc2626', fontSize: '10.5px', fontWeight: '700' }}>Total Egresos: -{fmt(totalEgresos)}</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#991b1b', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                <th style={{ padding: '4px 6px', textAlign: 'left', width: '50px' }}>Hora</th>
                                <th style={{ padding: '4px 6px', textAlign: 'left', width: '160px' }}>Proveedor / Beneficiario</th>
                                <th style={{ padding: '4px 6px', textAlign: 'left', width: '130px' }}>Categoría</th>
                                <th style={{ padding: '4px 6px', textAlign: 'left' }}>Concepto / Descripción</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center', width: '80px' }}>Fondo</th>
                                <th style={{ padding: '4px 6px', textAlign: 'right', width: '75px' }}>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {egresos.map((m, idx) => {
                                const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                                const fondoLabel = m.tipo_fondo === 'caja' ? 'Efectivo' : 'Banco';
                                return (
                                    <tr key={m.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '4px 6px', color: '#64748b' }}>{timeStr}</td>
                                        <td style={{ padding: '4px 6px', fontWeight: '700', color: '#0f172a' }}>{m.beneficiario || '—'}</td>
                                        <td style={{ padding: '4px 6px', color: '#475569', textTransform: 'capitalize' }}>
                                            {(m.categoria_gasto || '').replace(/_/g, ' ')}
                                        </td>
                                        <td style={{ padding: '4px 6px', color: '#334155' }}>{m.descripcion || '—'}</td>
                                        <td style={{ padding: '4px 6px', textAlign: 'center', color: '#475569' }}>{fondoLabel}</td>
                                        <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '700', color: '#dc2626', fontFamily: 'monospace' }}>
                                            -{fmt(m.monto)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Firmas de Conformidad */}
            <div style={{
                marginTop: '36px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '40px',
                paddingTop: '8px',
                pageBreakInside: 'avoid'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #475569', width: '200px', margin: '0 auto', paddingTop: '6px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a' }}>
                            {session.cerrado_por_nombre || session.abierto_por_nombre || 'Cajero Responsable'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Cajero / Entregó Conforme</div>
                    </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #475569', width: '200px', margin: '0 auto', paddingTop: '6px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a' }}>
                            Administración y Finanzas
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Revisó y Recibió Conforme</div>
                    </div>
                </div>
            </div>

            {/* Pie de página auditoría */}
            <div style={{
                marginTop: '20px',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '9px',
                color: '#94a3b8'
            }}>
                <span><strong>AFINIX DENTAL LAB S.A.C.</strong> &bull; RUC: {ruc} &bull; Auditoría Oficial de Cierre</span>
                <span>{new Date().toLocaleString('es-PE')}</span>
            </div>
        </div>
    );
};

export default CajaCierrePrintSheet;
