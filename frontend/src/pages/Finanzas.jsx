import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceAccountsQuery } from '../modules/finance/queries/useFinanceAccountsQuery.js';
import { useFacturacionListQuery } from '../modules/finance/queries/useFacturacionListQuery.js';

const statusLabels = {
    por_cancelar: 'Por cancelar',
    pago_parcial: 'Pago parcial',
    cancelado: 'Cancelado'
};

const Finanzas = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('finanzas');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [search, setSearch] = useState('');

    const filters = useMemo(() => ({
        estado_pago: filtroEstado,
        search
    }), [filtroEstado, search]);

    const financeAccountsQuery = useFinanceAccountsQuery({
        filters,
        enabled: activeTab === 'finanzas'
    });
    const facturacionQuery = useFacturacionListQuery(activeTab === 'comprobantes');

    const finanzas = financeAccountsQuery.data || [];
    const comprobantes = facturacionQuery.data || [];
    const loading = financeAccountsQuery.isLoading && finanzas.length === 0;
    const loadingComprobantes = facturacionQuery.isLoading && comprobantes.length === 0;

    const estados = ['', 'por_cancelar', 'pago_parcial', 'cancelado'];

    const formatDateShort = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    };

    const formatCurrency = (value) => {
        const number = parseFloat(value || 0);
        if (Number.isNaN(number)) return 'S/. 0.00';
        return `S/. ${number.toFixed(2)}`;
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Finanzas</h1>
                    <p>Seguimiento de estado de cuenta de clientes y facturación de pedidos</p>
                </div>
            </div>

            <div className="section-tabs dashboard-view-switcher" role="group" aria-label="Secciones de finanzas">
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'finanzas' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('finanzas')}
                    aria-pressed={activeTab === 'finanzas'}
                >
                    <i className="bi bi-wallet2" aria-hidden="true"></i> Estado de Cuentas
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'comprobantes' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('comprobantes')}
                    aria-pressed={activeTab === 'comprobantes'}
                >
                    <i className="bi bi-receipt" aria-hidden="true"></i> Historial de Facturación
                </button>
            </div>

            {activeTab === 'finanzas' && (
                <>
                    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
                                <i className="bi bi-search"></i>
                                <input
                                    className="form-input"
                                    placeholder="Buscar por código, paciente o clínica..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="pedidos-status-filters-scroller" style={{ minWidth: 0 }}>
                                <div className="pedidos-status-filters" role="group" aria-label="Filtrar por estado de pago">
                                    {estados.map((estado) => (
                                        <button
                                            key={estado || 'all'}
                                            type="button"
                                            className={`btn btn-sm pedidos-filter-chip${filtroEstado === estado ? ' is-active' : ''}`}
                                            onClick={() => setFiltroEstado(estado)}
                                        >
                                            {estado ? statusLabels[estado] : 'Todos'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="card">
                            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}
                        </div>
                    ) : finanzas.length === 0 ? (
                        <div className="card">
                            <div className="empty-state">
                                <i className="bi bi-cash-stack empty-state-icon"></i>
                                <h3 className="empty-state-title">Sin registros financieros</h3>
                                <p className="empty-state-text">Los pagos aparecerán aquí cuando se registren</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="card data-table-wrapper desktop-only" style={{ border: 'none' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Código</th>
                                            <th>Paciente</th>
                                            <th>Clínica</th>
                                            <th>Estado</th>
                                            <th>Fecha</th>
                                            <th>Total</th>
                                            <th>Pagado</th>
                                            <th>Saldo</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {finanzas.map((f) => (
                                            <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/finanzas/${f.id}`)}>
                                                <td><strong style={{ fontFamily: 'var(--font-mono)' }}>{f.codigo}</strong></td>
                                                <td>{f.paciente_nombre}</td>
                                                <td>{f.clinica_nombre}</td>
                                                <td><span className={`badge badge-dot badge-${f.estado_pago}`}>{statusLabels[f.estado_pago]}</span></td>
                                                <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDateShort(f.fecha || f.created_at)}</td>
                                                <td><strong>{formatCurrency(f.total)}</strong></td>
                                                <td>{formatCurrency(f.monto_pagado)}</td>
                                                <td>{formatCurrency(f.saldo)}</td>
                                                <td>
                                                    <button className="btn btn-ghost btn-sm btn-icon" title="Ver detalle">
                                                        <i className="bi bi-chevron-right"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mobile-cards mobile-only finanzas-mobile-cards">
                                {finanzas.map((f) => {
                                    const saldoNum = Number(f.saldo || 0);
                                    const pagadoNum = Number(f.monto_pagado || 0);
                                    const totalNum = Number(f.total || 0);
                                    const progressPct = totalNum > 0 ? Math.min(100, Math.round((pagadoNum / totalNum) * 100)) : 0;

                                    return (
                                        <div
                                            key={f.id}
                                            className="finanzas-card-bento"
                                            onClick={() => navigate(`/finanzas/${f.id}`)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/finanzas/${f.id}`); }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="finanzas-card-head">
                                                <div className="finanzas-card-main-info">
                                                    <strong className="finanzas-card-patient">{f.paciente_nombre || 'Sin paciente'}</strong>
                                                    <div className="finanzas-card-meta">
                                                        <span className="finanzas-card-code">{f.codigo}</span>
                                                        {f.clinica_nombre && <span className="finanzas-card-clinic">· {f.clinica_nombre}</span>}
                                                        <span className="finanzas-card-date">· {formatDateShort(f.fecha || f.created_at)}</span>
                                                    </div>
                                                </div>
                                                <span className={`badge badge-dot badge-${f.estado_pago}`}>
                                                    {statusLabels[f.estado_pago]}
                                                </span>
                                            </div>

                                            <div className="finanzas-card-foot">
                                                <div className="finanzas-card-breakdown">
                                                    <span className="finanzas-card-breakdown-item">
                                                        <em>Total:</em> {formatCurrency(f.total)}
                                                    </span>
                                                    <span className="finanzas-card-breakdown-item">
                                                        <em>Pagado:</em> {formatCurrency(f.monto_pagado)}
                                                    </span>
                                                </div>
                                                <div className="finanzas-card-saldo">
                                                    <span className="finanzas-card-saldo-label">Saldo</span>
                                                    <strong className={`finanzas-card-saldo-amount ${saldoNum > 0 ? 'is-pending' : 'is-paid'}`}>
                                                        {formatCurrency(f.saldo)}
                                                    </strong>
                                                </div>
                                            </div>

                                            {progressPct > 0 && progressPct < 100 && (
                                                <div className="finanzas-card-progress-bar" aria-hidden="true">
                                                    <div className="finanzas-card-progress-fill" style={{ width: `${progressPct}%` }} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </>
            )}

            {activeTab === 'comprobantes' && (
                <div className="card">
                    {loadingComprobantes ? (
                        <div>{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}</div>
                    ) : comprobantes.length === 0 ? (
                        <div className="empty-state">
                            <i className="bi bi-file-earmark-text empty-state-icon"></i>
                            <h3 className="empty-state-title">Sin comprobantes</h3>
                            <p className="empty-state-text">No hay comprobantes electrónicos emitidos aún.</p>
                        </div>
                    ) : (
                        <div className="data-table-wrapper" style={{ border: 'none' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Tipo / Serie</th>
                                        <th>Cliente / Paciente</th>
                                        <th>Total Venta</th>
                                        <th>Estado SUNAT</th>
                                        <th>Descargas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comprobantes.map((c) => (
                                        <tr key={c.id}>
                                            <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                                {formatDateShort(c.fecha_emision || c.created_at)}
                                            </td>
                                            <td>
                                                <span className={`badge badge-dot badge-${c.tipo_comprobante === '01' ? 'success' : 'primary'}`}>
                                                    {c.tipo_comprobante === '01' ? 'Factura' : 'Boleta'}
                                                </span>
                                                <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                                                    {c.serie}-{c.correlativo}
                                                </div>
                                            </td>
                                            <td>
                                                <strong>{c.clinica_nombre || 'Cliente'}</strong>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    {c.paciente_nombre ? `Pac: ${c.paciente_nombre}` : ''}
                                                    {c.pedido_codigo ? ` | Ped: ${c.pedido_codigo}` : ''}
                                                </div>
                                            </td>
                                            <td><strong>{formatCurrency(c.total_venta)}</strong></td>
                                            <td>
                                                {c.estado_sunat === 'aceptado' ? (
                                                    <span className="badge" style={{ background: '#e6f4ea', color: '#137333' }}>
                                                        <i className="bi bi-check-circle-fill" style={{ marginRight: 4 }}></i> Aceptado
                                                    </span>
                                                ) : c.estado_sunat === 'rechazado' ? (
                                                    <span className="badge" style={{ background: '#fce8e6', color: '#c5221f' }}>
                                                        <i className="bi bi-x-circle-fill" style={{ marginRight: 4 }}></i> Rechazado
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-dot badge-por_cancelar">Pendiente</span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {c.pdf_url && (
                                                        <a href={c.pdf_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" title="Descargar PDF">
                                                            <i className="bi bi-file-pdf" style={{ color: '#d32f2f' }}></i> PDF
                                                        </a>
                                                    )}
                                                    {c.xml_url && (
                                                        <a href={c.xml_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" title="Descargar XML">
                                                            <i className="bi bi-file-code" style={{ color: '#1976d2' }}></i> XML
                                                        </a>
                                                    )}
                                                    {c.cdr_url && (
                                                        <a href={c.cdr_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" title="Descargar CDR">
                                                            <i className="bi bi-file-check" style={{ color: '#388e3c' }}></i> CDR
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Finanzas;
