import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';
import { useFinanceAccountsQuery } from '../modules/finance/queries/useFinanceAccountsQuery.js';
import { useFinanceCatalogsQuery } from '../modules/finance/queries/useFinanceCatalogsQuery.js';
import { useFacturacionListQuery } from '../modules/finance/queries/useFacturacionListQuery.js';
import { useCobranzasOverviewQuery } from '../modules/finance/queries/useCobranzasOverviewQuery.js';
import { useClinicDebtDetailQuery } from '../modules/finance/queries/useClinicDebtDetailQuery.js';
import { useRegisterSaldoFavorMutation } from '../modules/finance/mutations/useRegisterSaldoFavorMutation.js';

const statusLabels = {
    por_cancelar: 'Por cancelar',
    pago_parcial: 'Pago parcial',
    cancelado: 'Cancelado'
};

const Finanzas = () => {
    const navigate = useNavigate();
    const { getHeaders } = useAuth();
    const [activeTab, setActiveTab] = useState('finanzas'); // 'finanzas' | 'cobranzas' | 'comprobantes'
    const [filtroEstado, setFiltroEstado] = useState('');
    const [search, setSearch] = useState('');
    const [cobranzasSearch, setCobranzasSearch] = useState('');

    // Modal Saldo a Favor
    const [saldoModalOpen, setSaldoModalOpen] = useState(false);
    const [clinicasList, setClinicasList] = useState([]);
    const [saldoForm, setSaldoForm] = useState({
        clinica_id: '',
        monto: '',
        tipo_fondo: 'banco',
        metodo: 'transferencia',
        cuenta_id: '',
        referencia: '',
        fecha_pago: new Date().toISOString().split('T')[0],
        notas: ''
    });

    // Modal Detalle Deuda Clínica
    const [selectedClinicForDebt, setSelectedClinicForDebt] = useState(null);

    const filters = useMemo(() => ({
        estado_pago: filtroEstado,
        search
    }), [filtroEstado, search]);

    const financeAccountsQuery = useFinanceAccountsQuery({
        filters,
        enabled: activeTab === 'finanzas'
    });
    const cobranzasOverviewQuery = useCobranzasOverviewQuery(activeTab === 'cobranzas');
    const facturacionQuery = useFacturacionListQuery(activeTab === 'comprobantes');
    const financeCatalogsQuery = useFinanceCatalogsQuery();
    const registerSaldoFavorMutation = useRegisterSaldoFavorMutation();

    const clinicDebtDetailQuery = useClinicDebtDetailQuery(
        selectedClinicForDebt?.clinica_id,
        Boolean(selectedClinicForDebt)
    );

    const finanzas = financeAccountsQuery.data || [];
    const comprobantes = facturacionQuery.data || [];
    const cobranzasData = cobranzasOverviewQuery.data?.data || { kpis: {}, clinicas: [] };
    const catalogos = {
        cuentas: Array.isArray(financeCatalogsQuery.data?.cuentas) ? financeCatalogsQuery.data.cuentas : []
    };
    const loading = financeAccountsQuery.isLoading && finanzas.length === 0;
    const loadingComprobantes = facturacionQuery.isLoading && comprobantes.length === 0;
    const loadingCobranzas = cobranzasOverviewQuery.isLoading && !cobranzasData.clinicas.length;

    const estados = ['', 'por_cancelar', 'pago_parcial', 'cancelado'];

    useEffect(() => {
        const fetchClinicas = async () => {
            try {
                const res = await fetch(`${API_URL}/clinicas`, { headers: getHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    setClinicasList(data);
                    if (data.length > 0 && !saldoForm.clinica_id) {
                        setSaldoForm((p) => ({ ...p, clinica_id: String(data[0].id) }));
                    }
                }
            } catch {
                // ignore
            }
        };
        fetchClinicas();
    }, []);

    const cuentasFiltradas = useMemo(() => {
        const target = saldoForm.tipo_fondo === 'caja' ? 'caja' : 'banco';
        return (catalogos.cuentas || []).filter((c) => c.tipo_cuenta === target);
    }, [catalogos.cuentas, saldoForm.tipo_fondo]);

    useEffect(() => {
        if (cuentasFiltradas.length > 0 && !cuentasFiltradas.some((c) => String(c.id) === String(saldoForm.cuenta_id))) {
            setSaldoForm((p) => ({ ...p, cuenta_id: String(cuentasFiltradas[0].id) }));
        }
    }, [cuentasFiltradas, saldoForm.cuenta_id]);

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

    const handleCreateSaldoFavor = async (e) => {
        e.preventDefault();
        if (!saldoForm.clinica_id) {
            toast.error('Selecciona una clínica');
            return;
        }
        const montoNum = parseFloat(saldoForm.monto);
        if (Number.isNaN(montoNum) || montoNum <= 0) {
            toast.error('Ingresa un monto válido mayor a 0');
            return;
        }

        try {
            await registerSaldoFavorMutation.mutateAsync({
                clinicaId: saldoForm.clinica_id,
                payload: {
                    monto: montoNum,
                    tipo_fondo: saldoForm.tipo_fondo,
                    metodo: saldoForm.metodo,
                    cuenta_id: saldoForm.cuenta_id ? parseInt(saldoForm.cuenta_id, 10) : null,
                    referencia: saldoForm.referencia?.trim() || null,
                    fecha_pago: saldoForm.fecha_pago || null,
                    notas: saldoForm.notas?.trim() || 'Anticipo / Saldo a favor registrado en caja'
                }
            });

            toast.success('Saldo a favor registrado exitosamente.');
            setSaldoModalOpen(false);
            setSaldoForm((p) => ({
                ...p,
                monto: '',
                referencia: '',
                notas: ''
            }));
        } catch (err) {
            toast.error(err.message || 'Error al registrar saldo a favor');
        }
    };

    const filteredCobranzasClinicas = useMemo(() => {
        const query = cobranzasSearch.trim().toLowerCase();
        if (!query) return cobranzasData.clinicas;
        return cobranzasData.clinicas.filter((c) => {
            const nom = (c.clinica_nombre || '').toLowerCase();
            const con = (c.clinica_contacto || '').toLowerCase();
            const ruc = (c.clinica_ruc || '').toLowerCase();
            return nom.includes(query) || con.includes(query) || ruc.includes(query);
        });
    }, [cobranzasData.clinicas, cobranzasSearch]);

    const buildWhatsAppLink = (clinica) => {
        const phone = (clinica.clinica_telefono || '').replace(/\D/g, '');
        if (!phone) return null;

        const formattedPhone = phone.startsWith('51') ? phone : `51${phone}`;
        const message = `Estimado(a) ${clinica.clinica_contacto || clinica.clinica_nombre},\nLe saludamos de AFINIX Dental Lab.\nLe recordamos que mantiene un saldo pendiente de ${formatCurrency(clinica.deuda_neta)} correspondiente a ${clinica.pedidos_pendientes_count} trabajo(s).\n\nQuedamos a su disposición para coordinar la cancelación. ¡Muchas gracias!`;

        return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Finanzas y Cobranzas</h1>
                    <p>Seguimiento de estados de cuenta, control de deudas por clínica y facturación.</p>
                </div>
                <div className="page-header-right">
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setSaldoModalOpen(true)}
                    >
                        <i className="bi bi-piggy-bank" style={{ marginRight: '6px' }}></i>
                        Registrar Saldo a Favor / Anticipo
                    </button>
                </div>
            </div>

            <div className="section-tabs dashboard-view-switcher" role="group" aria-label="Secciones de finanzas">
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'finanzas' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('finanzas')}
                    aria-pressed={activeTab === 'finanzas'}
                >
                    <i className="bi bi-wallet2" aria-hidden="true"></i> Estado de Cuentas (Pedidos)
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'cobranzas' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('cobranzas')}
                    aria-pressed={activeTab === 'cobranzas'}
                >
                    <i className="bi bi-pie-chart" aria-hidden="true"></i> Gestión de Cobranzas y Deudas
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

            {/* TAB 1: ESTADO DE CUENTAS (PEDIDOS) */}
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
                        <div className="empty-state">
                            <i className="bi bi-cash-coin empty-state-icon"></i>
                            <h3 className="empty-state-title">No hay pedidos registrados</h3>
                            <p className="empty-state-text">No se encontraron pedidos con los filtros aplicados</p>
                        </div>
                    ) : (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Paciente</th>
                                        <th>Clínica</th>
                                        <th>Fecha Entrega</th>
                                        <th>Total</th>
                                        <th>Pagado</th>
                                        <th>Saldo</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {finanzas.map((f) => (
                                        <tr key={f.id} onClick={() => navigate(`/finanzas/${f.id}`)} style={{ cursor: 'pointer' }}>
                                            <td><strong>{f.codigo}</strong></td>
                                            <td>{f.paciente_nombre}</td>
                                            <td>{f.clinica_nombre || 'Sin clínica'}</td>
                                            <td>{formatDateShort(f.fecha_entrega)}</td>
                                            <td>{formatCurrency(f.total)}</td>
                                            <td style={{ color: 'var(--color-success)' }}>{formatCurrency(f.monto_pagado)}</td>
                                            <td style={{ color: parseFloat(f.saldo) > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                                                {formatCurrency(f.saldo)}
                                            </td>
                                            <td>
                                                <span className={`badge badge-dot badge-${f.estado_pago}`}>
                                                    {statusLabels[f.estado_pago]}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-sm btn-ghost btn-icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/finanzas/${f.id}`);
                                                    }}
                                                    title="Ver detalle"
                                                >
                                                    <i className="bi bi-eye"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* TAB 2: GESTIÓN DE COBRANZAS Y DEUDAS */}
            {activeTab === 'cobranzas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {/* KPI Cards */}
                    <div className="order-wizard-confirm-hero" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div className="order-wizard-confirm-stat">
                            <div className="order-wizard-confirm-stat-copy">
                                <span className="order-wizard-confirm-label">
                                    <i className="bi bi-cash-stack" aria-hidden="true"></i> Deuda Bruta en Calle
                                </span>
                                <strong>{formatCurrency(cobranzasData.kpis?.total_deuda_calle)}</strong>
                                <em className="order-wizard-confirm-meta">{cobranzasData.kpis?.clinicas_con_deuda_count || 0} clínica(s) con saldo</em>
                            </div>
                        </div>

                        <div className="order-wizard-confirm-stat" style={{ borderLeft: '3px solid #ef4444' }}>
                            <div className="order-wizard-confirm-stat-copy">
                                <span className="order-wizard-confirm-label" style={{ color: '#ef4444' }}>
                                    <i className="bi bi-exclamation-octagon" aria-hidden="true"></i> Vencido &gt; 30 Días
                                </span>
                                <strong style={{ color: '#ef4444' }}>{formatCurrency(cobranzasData.kpis?.total_deuda_30_mas)}</strong>
                                <em className="order-wizard-confirm-meta">Cobranza crítica / Alerta</em>
                            </div>
                        </div>

                        <div className="order-wizard-confirm-stat" style={{ borderLeft: '3px solid #10b981' }}>
                            <div className="order-wizard-confirm-stat-copy">
                                <span className="order-wizard-confirm-label" style={{ color: '#10b981' }}>
                                    <i className="bi bi-stars" aria-hidden="true"></i> Saldos a Favor Custodia
                                </span>
                                <strong style={{ color: '#10b981' }}>{formatCurrency(cobranzasData.kpis?.total_saldo_favor_custodia)}</strong>
                                <em className="order-wizard-confirm-meta">Anticipos disponibles a favor</em>
                            </div>
                        </div>

                        <div className="order-wizard-confirm-stat" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                            <div className="order-wizard-confirm-stat-copy">
                                <span className="order-wizard-confirm-label" style={{ color: 'var(--color-primary)' }}>
                                    <i className="bi bi-calculator" aria-hidden="true"></i> Deuda Neta Exigible
                                </span>
                                <strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(cobranzasData.kpis?.total_deuda_neta)}</strong>
                                <em className="order-wizard-confirm-meta">Deuda bruta menos anticipos</em>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                            <div className="search-box" style={{ maxWidth: '350px', width: '100%' }}>
                                <i className="bi bi-search"></i>
                                <input
                                    className="form-input"
                                    placeholder="Buscar clínica, contacto o RUC..."
                                    value={cobranzasSearch}
                                    onChange={(e) => setCobranzasSearch(e.target.value)}
                                />
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                Mostrando {filteredCobranzasClinicas.length} clínica(s)
                            </span>
                        </div>

                        {loadingCobranzas ? (
                            <div>
                                {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}
                            </div>
                        ) : filteredCobranzasClinicas.length === 0 ? (
                            <div className="empty-state">
                                <i className="bi bi-check-circle-fill empty-state-icon" style={{ color: '#10b981' }}></i>
                                <h3 className="empty-state-title">Excelente, no hay deudas pendientes</h3>
                                <p className="empty-state-text">Todas las clínicas se encuentran al día con sus pagos.</p>
                            </div>
                        ) : (
                            <div className="data-table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Clínica / Contacto</th>
                                            <th>Pedidos</th>
                                            <th>Deuda Total</th>
                                            <th>0–15 Días</th>
                                            <th>16–30 Días</th>
                                            <th>&gt;30 Días</th>
                                            <th>Saldo a Favor</th>
                                            <th>Deuda Neta</th>
                                            <th style={{ width: 120 }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCobranzasClinicas.map((c) => {
                                            const waLink = buildWhatsAppLink(c);
                                            return (
                                                <tr key={c.clinica_id}>
                                                    <td>
                                                        <strong>{c.clinica_nombre}</strong>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                            {c.clinica_contacto ? `${c.clinica_contacto} · ` : ''}
                                                            {c.clinica_telefono || 'Sin teléfono'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="badge badge-secondary">{c.pedidos_pendientes_count}</span>
                                                    </td>
                                                    <td><strong>{formatCurrency(c.total_deuda)}</strong></td>
                                                    <td style={{ color: '#10b981' }}>{formatCurrency(c.deuda_0_15)}</td>
                                                    <td style={{ color: '#f59e0b' }}>{formatCurrency(c.deuda_15_30)}</td>
                                                    <td style={{ color: '#ef4444', fontWeight: c.deuda_30_mas > 0 ? 700 : 400 }}>
                                                        {formatCurrency(c.deuda_30_mas)}
                                                    </td>
                                                    <td style={{ color: '#10b981', fontWeight: 600 }}>
                                                        {formatCurrency(c.saldo_favor_disponible)}
                                                    </td>
                                                    <td>
                                                        <strong style={{ color: c.deuda_neta > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontSize: '1rem' }}>
                                                            {formatCurrency(c.deuda_neta)}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-ghost btn-icon"
                                                                title="Ver pedidos y saldos de la clínica"
                                                                onClick={() => setSelectedClinicForDebt(c)}
                                                            >
                                                                <i className="bi bi-eye"></i>
                                                            </button>
                                                            {waLink && (
                                                                <a
                                                                    href={waLink}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="btn btn-sm btn-ghost btn-icon"
                                                                    title="Enviar recordatorio por WhatsApp"
                                                                    style={{ color: '#25D366' }}
                                                                >
                                                                    <i className="bi bi-whatsapp"></i>
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: HISTORIAL DE FACTURACIÓN */}
            {activeTab === 'comprobantes' && (
                <div className="card">
                    {loadingComprobantes ? (
                        <div>
                            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}
                        </div>
                    ) : comprobantes.length === 0 ? (
                        <div className="empty-state">
                            <i className="bi bi-receipt empty-state-icon"></i>
                            <h3 className="empty-state-title">No hay comprobantes emitidos</h3>
                            <p className="empty-state-text">Los comprobantes emitidos a SUNAT aparecerán aquí</p>
                        </div>
                    ) : (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Fecha Emisión</th>
                                        <th>Tipo / Serie</th>
                                        <th>Receptor</th>
                                        <th>Total</th>
                                        <th>Estado SUNAT</th>
                                        <th>Archivos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comprobantes.map((c) => (
                                        <tr key={c.id}>
                                            <td>{formatDateShort(c.fecha_emision || c.created_at)}</td>
                                            <td>
                                                <span className="badge badge-outline">
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

            {/* Modal Registrar Saldo a Favor / Anticipo */}
            <Modal
                open={saldoModalOpen}
                onClose={() => setSaldoModalOpen(false)}
                title="Registrar Saldo a Favor / Anticipo a Cuenta"
                size="md"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setSaldoModalOpen(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleCreateSaldoFavor}
                            disabled={registerSaldoFavorMutation.isPending}
                        >
                            {registerSaldoFavorMutation.isPending ? 'Guardando...' : 'Registrar Saldo'}
                        </button>
                    </div>
                )}
            >
                <form onSubmit={handleCreateSaldoFavor} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group">
                        <label className="form-label">Clínica <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <select
                            className="form-select"
                            value={saldoForm.clinica_id}
                            onChange={(e) => setSaldoForm((p) => ({ ...p, clinica_id: e.target.value }))}
                            required
                        >
                            {clinicasList.map((c) => (
                                <option key={c.id} value={c.id}>{c.nombre} {c.ruc ? `(RUC: ${c.ruc})` : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label className="form-label">Monto (S/.) <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="form-input"
                                placeholder="0.00"
                                value={saldoForm.monto}
                                onChange={(e) => setSaldoForm((p) => ({ ...p, monto: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Fecha de Cobro</label>
                            <input
                                type="date"
                                className="form-input"
                                value={saldoForm.fecha_pago}
                                onChange={(e) => setSaldoForm((p) => ({ ...p, fecha_pago: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label className="form-label">Origen / Destino</label>
                            <select
                                className="form-select"
                                value={saldoForm.tipo_fondo}
                                onChange={(e) => {
                                    const nextFondo = e.target.value;
                                    setSaldoForm((p) => ({
                                        ...p,
                                        tipo_fondo: nextFondo,
                                        metodo: nextFondo === 'caja' ? 'efectivo' : 'transferencia'
                                    }));
                                }}
                            >
                                <option value="banco">Banco (Transferencia / Yape)</option>
                                <option value="caja">Caja (Efectivo)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Cuenta</label>
                            <select
                                className="form-select"
                                value={saldoForm.cuenta_id}
                                onChange={(e) => setSaldoForm((p) => ({ ...p, cuenta_id: e.target.value }))}
                            >
                                {cuentasFiltradas.map((c) => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Nro. de Operación / Referencia</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Op. BCP 891245 o Voucher 012"
                            value={saldoForm.referencia}
                            onChange={(e) => setSaldoForm((p) => ({ ...p, referencia: e.target.value }))}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notas / Observaciones</label>
                        <textarea
                            className="form-textarea"
                            rows={2}
                            placeholder="Ej. Anticipo entregado por la clínica para futuros pedidos de coronas"
                            value={saldoForm.notas}
                            onChange={(e) => setSaldoForm((p) => ({ ...p, notas: e.target.value }))}
                        />
                    </div>
                </form>
            </Modal>

            {/* Modal Detalle Deuda de la Clínica */}
            <Modal
                open={Boolean(selectedClinicForDebt)}
                onClose={() => setSelectedClinicForDebt(null)}
                title={`Estado de Deuda · ${selectedClinicForDebt?.clinica_nombre}`}
                size="lg"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setSelectedClinicForDebt(null)}>
                            Cerrar
                        </button>
                    </div>
                )}
            >
                {clinicDebtDetailQuery.isLoading ? (
                    <div>
                        {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 50, marginBottom: 8, borderRadius: 8 }} />)}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Resumen Deuda y Anticipos */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', background: 'var(--color-background-subtle, rgba(0,0,0,0.03))', borderRadius: '8px' }}>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Deuda Total</span>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatCurrency(selectedClinicForDebt?.total_deuda)}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Saldo a Favor Disponible</span>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{formatCurrency(selectedClinicForDebt?.saldo_favor_disponible)}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>Deuda Neta</span>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-danger)' }}>{formatCurrency(selectedClinicForDebt?.deuda_neta)}</div>
                            </div>
                        </div>

                        {/* Pedidos Pendientes */}
                        <h4 style={{ margin: '8px 0 0', fontSize: '0.9rem', fontWeight: 600 }}>
                            <i className="bi bi-box-seam" style={{ marginRight: '6px' }}></i>
                            Pedidos Pendientes de Cancelación ({clinicDebtDetailQuery.data?.data?.pedidos_pendientes?.length || 0})
                        </h4>

                        <div className="data-table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Paciente</th>
                                        <th>Entrega</th>
                                        <th>Antigüedad</th>
                                        <th>Total</th>
                                        <th>Pagado</th>
                                        <th>Saldo</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(clinicDebtDetailQuery.data?.data?.pedidos_pendientes || []).map((p) => (
                                        <tr key={p.id}>
                                            <td><strong>{p.codigo}</strong></td>
                                            <td>{p.paciente_nombre}</td>
                                            <td>{formatDateShort(p.fecha_entrega)}</td>
                                            <td>
                                                <span className={`badge ${p.dias_antiguedad > 30 ? 'badge-danger' : p.dias_antiguedad > 15 ? 'badge-warning' : 'badge-secondary'}`}>
                                                    {p.dias_antiguedad} día(s)
                                                </span>
                                            </td>
                                            <td>{formatCurrency(p.total)}</td>
                                            <td style={{ color: '#10b981' }}>{formatCurrency(p.pagado)}</td>
                                            <td style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(p.saldo)}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => {
                                                        setSelectedClinicForDebt(null);
                                                        navigate(`/finanzas/${p.id}`);
                                                    }}
                                                >
                                                    Pagar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Finanzas;
