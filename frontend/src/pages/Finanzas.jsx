import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Modal from '../components/Modal.jsx';
import { useFinanceAccountsQuery } from '../modules/finance/queries/useFinanceAccountsQuery.js';
import { useFinanceCatalogsQuery } from '../modules/finance/queries/useFinanceCatalogsQuery.js';
import { useCobranzasOverviewQuery } from '../modules/finance/queries/useCobranzasOverviewQuery.js';
import { useClinicDebtDetailQuery } from '../modules/finance/queries/useClinicDebtDetailQuery.js';
import { useRegisterBulkPaymentMutation } from '../modules/finance/mutations/useRegisterBulkPaymentMutation.js';
import CustomSelect from '../components/CustomSelect.jsx';
import '../styles/modal-pago-masivo.css';

const statusLabels = {
    por_cancelar: 'Por cancelar',
    pago_parcial: 'Pago parcial',
    cancelado: 'Cancelado'
};

const paymentStatusColors = {
    por_cancelar: '#ef4444',
    pago_parcial: '#f59e0b',
    cancelado: '#10b981'
};

const Finanzas = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('cobranzas'); // 'cobranzas' | 'finanzas'
    const [filtroEstado, setFiltroEstado] = useState('');
    const [search, setSearch] = useState('');
    const [cobranzasSearch, setCobranzasSearch] = useState('');
    const [riskFilter, setRiskFilter] = useState('all'); // 'all' | 'critica' | 'alerta' | 'corriente'
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const statusDropdownRef = useRef(null);

    useEffect(() => {
        if (!statusDropdownOpen) return;
        const handleClickOutside = (e) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
                setStatusDropdownOpen(false);
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') setStatusDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [statusDropdownOpen]);

    // Modal Detalle Deuda Clínica
    const [selectedClinicForDebt, setSelectedClinicForDebt] = useState(null);

    // Modal Cobranza / Abono Global en Cascada
    const [selectedClinicForBulkPayment, setSelectedClinicForBulkPayment] = useState(null);
    const [bulkPaymentForm, setBulkPaymentForm] = useState({
        monto_total: '',
        metodo: 'transferencia',
        tipo_fondo: 'banco',
        cuenta_id: '',
        referencia: '',
        fecha_pago: new Date().toISOString().split('T')[0],
        notas: ''
    });

    const filters = useMemo(() => ({
        estado_pago: filtroEstado,
        search
    }), [filtroEstado, search]);

    const financeAccountsQuery = useFinanceAccountsQuery({
        filters,
        enabled: activeTab === 'finanzas'
    });
    const cobranzasOverviewQuery = useCobranzasOverviewQuery(activeTab === 'cobranzas');
    const financeCatalogsQuery = useFinanceCatalogsQuery();
    const registerBulkPaymentMutation = useRegisterBulkPaymentMutation();

    const activeClinicIdForDetail = selectedClinicForBulkPayment?.clinica_id || selectedClinicForDebt?.clinica_id;
    const clinicDebtDetailQuery = useClinicDebtDetailQuery(
        activeClinicIdForDetail,
        Boolean(activeClinicIdForDetail)
    );

    const finanzas = financeAccountsQuery.data || [];
    const rawCobranzas = cobranzasOverviewQuery.data?.data || cobranzasOverviewQuery.data || {};
    const cobranzasData = {
        kpis: rawCobranzas.kpis || {},
        clinicas: Array.isArray(rawCobranzas.clinicas) ? rawCobranzas.clinicas : []
    };
    const catalogos = {
        cuentas: Array.isArray(financeCatalogsQuery.data?.cuentas) ? financeCatalogsQuery.data.cuentas : []
    };
    const loading = financeAccountsQuery.isLoading && finanzas.length === 0;
    const loadingCobranzas = cobranzasOverviewQuery.isLoading && !cobranzasData.clinicas.length;

    const estados = ['', 'por_cancelar', 'pago_parcial', 'cancelado'];

    const cuentasFiltradasBulk = useMemo(() => {
        const target = bulkPaymentForm.tipo_fondo === 'caja' ? 'caja' : 'banco';
        return (catalogos.cuentas || []).filter((c) => c.tipo_cuenta === target);
    }, [catalogos.cuentas, bulkPaymentForm.tipo_fondo]);

    useEffect(() => {
        if (cuentasFiltradasBulk.length > 0 && !cuentasFiltradasBulk.some((c) => String(c.id) === String(bulkPaymentForm.cuenta_id))) {
            setBulkPaymentForm((p) => ({ ...p, cuenta_id: String(cuentasFiltradasBulk[0].id) }));
        }
    }, [cuentasFiltradasBulk, bulkPaymentForm.cuenta_id]);

    const openBulkPaymentModal = (clinica) => {
        setSelectedClinicForBulkPayment(clinica);
        setBulkPaymentForm({
            monto_total: clinica.total_deuda ? String(clinica.total_deuda) : '',
            metodo: 'transferencia',
            tipo_fondo: 'banco',
            cuenta_id: '',
            referencia: '',
            fecha_pago: new Date().toISOString().split('T')[0],
            notas: ''
        });
    };

    const rawClinicDebt = clinicDebtDetailQuery.data?.data || clinicDebtDetailQuery.data || {};
    const pendingOrdersForBulk = Array.isArray(rawClinicDebt.pedidos_pendientes) ? rawClinicDebt.pedidos_pendientes : [];

    const cascadeSimulation = useMemo(() => {
        const entered = parseFloat(bulkPaymentForm.monto_total) || 0;
        if (entered <= 0 || pendingOrdersForBulk.length === 0) {
            return {
                fullyPaidCount: 0,
                partialPaidCount: 0,
                description: 'Ingresa un monto para calcular los pedidos que serán cancelados.'
            };
        }

        let remaining = entered;
        let fullyPaid = 0;
        let partialPaid = 0;

        for (const order of pendingOrdersForBulk) {
            if (remaining <= 0) break;
            const saldo = parseFloat(order.saldo || 0);
            if (remaining >= saldo - 0.001) {
                fullyPaid++;
                remaining -= saldo;
            } else {
                partialPaid++;
                remaining = 0;
            }
        }

        let text = '';
        if (fullyPaid === pendingOrdersForBulk.length && remaining >= 0) {
            text = `Este pago cancelará el 100% de la deuda (${fullyPaid} pedidos completos).`;
        } else if (fullyPaid > 0 && partialPaid > 0) {
            text = `Este pago cancelará ${fullyPaid} pedido(s) y abonará parcialmente a 1 pedido (del más antiguo al más nuevo).`;
        } else if (fullyPaid > 0) {
            text = `Este pago cancelará ${fullyPaid} pedido(s) (del más antiguo al más nuevo).`;
        } else if (partialPaid > 0) {
            text = `Este pago se registrará como abono parcial al pedido más antiguo pendiente.`;
        }

        return {
            fullyPaidCount: fullyPaid,
            partialPaidCount: partialPaid,
            description: text
        };
    }, [bulkPaymentForm.monto_total, pendingOrdersForBulk]);

    const handleRegisterBulkPayment = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!selectedClinicForBulkPayment?.clinica_id) {
            toast.error('Selecciona una clínica');
            return;
        }

        const montoNum = parseFloat(bulkPaymentForm.monto_total);
        if (Number.isNaN(montoNum) || montoNum <= 0) {
            toast.error('Ingresa un monto válido mayor a 0');
            return;
        }

        try {
            const res = await registerBulkPaymentMutation.mutateAsync({
                clinica_id: selectedClinicForBulkPayment.clinica_id,
                monto_total: montoNum,
                metodo: bulkPaymentForm.metodo,
                tipo_fondo: bulkPaymentForm.tipo_fondo,
                cuenta_id: bulkPaymentForm.cuenta_id ? parseInt(bulkPaymentForm.cuenta_id, 10) : null,
                referencia: bulkPaymentForm.referencia?.trim() || null,
                fecha_pago: bulkPaymentForm.fecha_pago || null,
                notas: bulkPaymentForm.notas?.trim() || 'Abono global en cascada'
            });

            const pedidosCount = res?.data?.pagos_registrados?.length || res?.meta?.pedidos_afectados || 0;
            toast.success(`Cobro registrado con éxito. Se abonó/canceló ${pedidosCount} pedido(s).`);
            setSelectedClinicForBulkPayment(null);
        } catch (err) {
            toast.error(err.message || 'Error al procesar el cobro global');
        }
    };

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

    const filteredCobranzasClinicas = useMemo(() => {
        const query = cobranzasSearch.trim().toLowerCase();
        let list = cobranzasData.clinicas;

        if (riskFilter === 'critica') {
            list = list.filter((c) => parseFloat(c.deuda_30_mas || 0) > 0);
        } else if (riskFilter === 'alerta') {
            list = list.filter((c) => parseFloat(c.deuda_15_30 || 0) > 0);
        } else if (riskFilter === 'corriente') {
            list = list.filter((c) => parseFloat(c.deuda_0_15 || 0) > 0);
        }

        if (!query) return list;
        return list.filter((c) => {
            const nom = (c.clinica_nombre || '').toLowerCase();
            const con = (c.clinica_contacto || '').toLowerCase();
            const ruc = (c.clinica_ruc || '').toLowerCase();
            return nom.includes(query) || con.includes(query) || ruc.includes(query);
        });
    }, [cobranzasData.clinicas, cobranzasSearch, riskFilter]);

    const buildWhatsAppLink = (clinica) => {
        const phone = (clinica.clinica_telefono || '').replace(/\D/g, '');
        if (!phone) return null;

        const formattedPhone = phone.startsWith('51') ? phone : `51${phone}`;
        const message = `Estimado(a) ${clinica.clinica_contacto || clinica.clinica_nombre},\nLe saludamos de AFINIX Dental Lab.\nLe recordamos que mantiene un saldo pendiente de ${formatCurrency(clinica.total_deuda)} correspondiente a ${clinica.pedidos_pendientes_count} trabajo(s).\n\nQuedamos a su disposición para coordinar la cancelación. ¡Muchas gracias!`;

        // Protocolo nativo de la aplicación de escritorio de WhatsApp (Windows/Mac)
        return `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
    };

    return (
        <div className="animate-fade-in page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div className="page-header-left">
                    <h1>
                        <i className="bi bi-cash-stack text-primary" aria-hidden="true"></i> Gestión de Deudas y Cobranzas
                    </h1>
                    <p>Monitoreo de cartera por clínica, alertas de morosidad y cobranza en cascada.</p>
                </div>
            </div>

            <div className="section-tabs dashboard-view-switcher" role="group" aria-label="Secciones de cobranzas">
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'cobranzas' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('cobranzas')}
                    aria-pressed={activeTab === 'cobranzas'}
                >
                    <i className="bi bi-shield-exclamation" aria-hidden="true"></i> Cartera y Deudas por Clínica
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${activeTab === 'finanzas' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('finanzas')}
                    aria-pressed={activeTab === 'finanzas'}
                >
                    <i className="bi bi-clock-history" aria-hidden="true"></i> Historial y Cuentas por Cobrar
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
                            <div className="pedidos-custom-select-wrap" ref={statusDropdownRef}>
                                <button
                                    type="button"
                                    className={`btn btn-sm pedidos-custom-select-trigger${filtroEstado ? ' is-active' : ''}${statusDropdownOpen ? ' is-open' : ''}`}
                                    onClick={() => setStatusDropdownOpen((prev) => !prev)}
                                    aria-expanded={statusDropdownOpen}
                                    aria-haspopup="listbox"
                                >
                                    {filtroEstado ? (
                                        <>
                                            <span
                                                className="pedidos-filter-dot"
                                                style={{ backgroundColor: paymentStatusColors[filtroEstado] || 'var(--color-primary)' }}
                                                aria-hidden="true"
                                            />
                                            <span className="pedidos-custom-select-text">
                                                {statusLabels[filtroEstado]}
                                            </span>
                                            <span
                                                className="pedidos-chip-clear"
                                                role="button"
                                                tabIndex={0}
                                                title="Limpiar filtro de estado"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFiltroEstado('');
                                                }}
                                            >
                                                ✕
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-funnel" aria-hidden="true"></i>
                                            <span className="pedidos-custom-select-text">Estado de pago</span>
                                            <i className={`bi bi-chevron-down pedidos-custom-select-chevron${statusDropdownOpen ? ' is-rotated' : ''}`} aria-hidden="true"></i>
                                        </>
                                    )}
                                </button>

                                {statusDropdownOpen && (
                                    <div className="pedidos-custom-select-menu" role="listbox">
                                        <button
                                            type="button"
                                            className={`pedidos-custom-select-item${!filtroEstado ? ' is-selected' : ''}`}
                                            onClick={() => {
                                                setFiltroEstado('');
                                                setStatusDropdownOpen(false);
                                            }}
                                            role="option"
                                            aria-selected={!filtroEstado}
                                        >
                                            <i className="bi bi-grid text-secondary" style={{ width: 14, textAlign: 'center' }}></i>
                                            <span>Todos los estados</span>
                                            {!filtroEstado && <i className="bi bi-check2 text-primary" style={{ marginLeft: 'auto', fontWeight: 800 }}></i>}
                                        </button>
                                        <div className="pedidos-custom-select-divider" />
                                        {[
                                            { id: 'por_cancelar', label: 'Por cancelar', color: '#ef4444' },
                                            { id: 'pago_parcial', label: 'Pago parcial', color: '#f59e0b' },
                                            { id: 'cancelado', label: 'Cancelado', color: '#10b981' }
                                        ].map((st) => (
                                            <button
                                                key={st.id}
                                                type="button"
                                                className={`pedidos-custom-select-item${filtroEstado === st.id ? ' is-selected' : ''}`}
                                                onClick={() => {
                                                    setFiltroEstado(st.id);
                                                    setStatusDropdownOpen(false);
                                                }}
                                                role="option"
                                                aria-selected={filtroEstado === st.id}
                                            >
                                                <span
                                                    className="pedidos-filter-dot"
                                                    style={{ backgroundColor: st.color }}
                                                    aria-hidden="true"
                                                />
                                                <span>{st.label}</span>
                                                {filtroEstado === st.id && <i className="bi bi-check2 text-primary" style={{ marginLeft: 'auto', fontWeight: 800 }}></i>}
                                            </button>
                                        ))}
                                    </div>
                                )}
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
                        <>
                            <div className="data-table-wrapper desktop-only">
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

                            <div className="mobile-cards mobile-only finanzas-mobile-cards">
                                {finanzas.map((f) => {
                                    const total = parseFloat(f.total || 0);
                                    const pagado = parseFloat(f.monto_pagado || 0);
                                    const saldo = parseFloat(f.saldo || 0);
                                    const pct = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;
                                    return (
                                        <div
                                            key={f.id}
                                            className="finanzas-card-bento"
                                            onClick={() => navigate(`/finanzas/${f.id}`)}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div className="finanzas-card-head">
                                                <div className="finanzas-card-main-info">
                                                    <span className="finanzas-card-patient">{f.paciente_nombre || 'Sin paciente'}</span>
                                                    <div className="finanzas-card-meta">
                                                        <span className="finanzas-card-code">{f.codigo}</span>
                                                        <span>•</span>
                                                        <span className="finanzas-card-clinic">{f.clinica_nombre || 'Sin clínica'}</span>
                                                        {f.fecha_entrega && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="finanzas-card-date">{formatDateShort(f.fecha_entrega)}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`badge badge-dot badge-${f.estado_pago}`}>
                                                    {statusLabels[f.estado_pago]}
                                                </span>
                                            </div>

                                            <div className="finanzas-card-progress-bar">
                                                <div className="finanzas-card-progress-fill" style={{ width: `${pct}%` }} />
                                            </div>

                                            <div className="finanzas-card-foot">
                                                <div className="finanzas-card-breakdown">
                                                    <div className="finanzas-card-breakdown-item">
                                                        <em>Total:</em> <strong>{formatCurrency(total)}</strong>
                                                    </div>
                                                    <div className="finanzas-card-breakdown-item">
                                                        <em>Abonado:</em> <span style={{ color: 'var(--color-success)' }}>{formatCurrency(pagado)}</span>
                                                    </div>
                                                </div>
                                                <div className="finanzas-card-saldo">
                                                    <span className="finanzas-card-saldo-label">Saldo Pendiente</span>
                                                    <span className={`finanzas-card-saldo-amount ${saldo > 0 ? 'is-pending' : 'is-paid'}`}>
                                                        {formatCurrency(saldo)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </>
            )}

            {/* TAB 2: GESTIÓN DE COBRANZAS Y DEUDAS */}
            {activeTab === 'cobranzas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {/* Panel de Indicadores de Cartera */}
                    <div className="card dashboard-ops-panel">
                        <div className="card-header dashboard-card-header">
                            <div>
                                <h3 className="card-title">Resumen de cartera y cobranzas</h3>
                                <p className="card-subtitle">Seguimiento de deudas por clínica y alertas de antigüedad</p>
                            </div>
                        </div>
                        <div className="grid dashboard-kpi-grid-liquid dashboard-staggered-grid">
                            <div
                                className={`card kpi-card dashboard-kpi-card dashboard-kpi-card--primary animate-slide-up${riskFilter === 'all' ? ' is-active' : ''}`}
                                onClick={() => setRiskFilter('all')}
                                style={{ cursor: 'pointer', border: riskFilter === 'all' ? '2px solid var(--color-primary)' : undefined }}
                                title="Ver todas las deudas"
                            >
                                <div className="dashboard-kpi-shell">
                                    <div className="dashboard-kpi-row">
                                        <div className="kpi-icon" aria-hidden="true">
                                            <i className="bi bi-cash-stack"></i>
                                        </div>
                                        <div className="dashboard-kpi-heading-group">
                                            <div className="dashboard-kpi-heading">Total por cobrar</div>
                                            <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                                {formatCurrency(cobranzasData.kpis?.total_deuda_calle)}
                                            </div>
                                            <div className="dashboard-kpi-note">
                                                {cobranzasData.kpis?.clinicas_con_deuda_count || 0} clínica(s) con saldo
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                className={`card kpi-card dashboard-kpi-card dashboard-kpi-card--danger animate-slide-up${riskFilter === 'critica' ? ' is-active' : ''}`}
                                onClick={() => setRiskFilter(r => r === 'critica' ? 'all' : 'critica')}
                                style={{ cursor: 'pointer', border: riskFilter === 'critica' ? '2px solid var(--color-danger, #ef4444)' : undefined }}
                                title="Filtrar morosidad crítica mayor a 30 días"
                            >
                                <div className="dashboard-kpi-shell">
                                    <div className="dashboard-kpi-row">
                                        <div className="kpi-icon" aria-hidden="true">
                                            <i className="bi bi-exclamation-octagon-fill"></i>
                                        </div>
                                        <div className="dashboard-kpi-heading-group">
                                            <div className="dashboard-kpi-heading">Mora Crítica (&gt;30 Días)</div>
                                            <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                                {formatCurrency(cobranzasData.kpis?.total_deuda_30_mas)}
                                            </div>
                                            <div className="dashboard-kpi-note">Cobranza crítica / Clic para filtrar</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                className={`card kpi-card dashboard-kpi-card dashboard-kpi-card--warning animate-slide-up${riskFilter === 'alerta' ? ' is-active' : ''}`}
                                onClick={() => setRiskFilter(r => r === 'alerta' ? 'all' : 'alerta')}
                                style={{ cursor: 'pointer', border: riskFilter === 'alerta' ? '2px solid #f59e0b' : undefined }}
                                title="Filtrar deudas en seguimiento (16 a 30 días)"
                            >
                                <div className="dashboard-kpi-shell">
                                    <div className="dashboard-kpi-row">
                                        <div className="kpi-icon" aria-hidden="true">
                                            <i className="bi bi-hourglass-split"></i>
                                        </div>
                                        <div className="dashboard-kpi-heading-group">
                                            <div className="dashboard-kpi-heading">Seguimiento (16–30 Días)</div>
                                            <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                                {formatCurrency(cobranzasData.kpis?.total_deuda_15_30)}
                                            </div>
                                            <div className="dashboard-kpi-note">Recordatorio / Clic para filtrar</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                className={`card kpi-card dashboard-kpi-card dashboard-kpi-card--success animate-slide-up${riskFilter === 'corriente' ? ' is-active' : ''}`}
                                onClick={() => setRiskFilter(r => r === 'corriente' ? 'all' : 'corriente')}
                                style={{ cursor: 'pointer', border: riskFilter === 'corriente' ? '2px solid #10b981' : undefined }}
                                title="Filtrar deudas al día (0 a 15 días)"
                            >
                                <div className="dashboard-kpi-shell">
                                    <div className="dashboard-kpi-row">
                                        <div className="kpi-icon" aria-hidden="true">
                                            <i className="bi bi-check-circle-fill"></i>
                                        </div>
                                        <div className="dashboard-kpi-heading-group">
                                            <div className="dashboard-kpi-heading">Al Día (0–15 Días)</div>
                                            <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                                {formatCurrency(cobranzasData.kpis?.total_deuda_0_15)}
                                            </div>
                                            <div className="dashboard-kpi-note">En plazo / Clic para filtrar</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card dashboard-ops-panel">
                        <div className="card-header dashboard-card-header dashboard-card-header--split">
                            <div>
                                <h3 className="card-title">Deudas por Clínica</h3>
                                <p className="card-subtitle">Gestión individual y liquidación de pedidos en cascada</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <div className="segmented-control" style={{ maxWidth: '440px' }}>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${riskFilter === 'all' ? ' is-active' : ''}`}
                                        onClick={() => setRiskFilter('all')}
                                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                    >
                                        Todas ({cobranzasData.clinicas.length})
                                    </button>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${riskFilter === 'critica' ? ' is-active' : ''}`}
                                        onClick={() => setRiskFilter('critica')}
                                        style={{ fontSize: '0.75rem', padding: '4px 8px', color: riskFilter === 'critica' ? undefined : '#ef4444' }}
                                    >
                                        🔴 &gt;30d ({cobranzasData.clinicas.filter(c => parseFloat(c.deuda_30_mas || 0) > 0).length})
                                    </button>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${riskFilter === 'alerta' ? ' is-active' : ''}`}
                                        onClick={() => setRiskFilter('alerta')}
                                        style={{ fontSize: '0.75rem', padding: '4px 8px', color: riskFilter === 'alerta' ? undefined : '#f59e0b' }}
                                    >
                                        🟡 16–30d ({cobranzasData.clinicas.filter(c => parseFloat(c.deuda_15_30 || 0) > 0).length})
                                    </button>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${riskFilter === 'corriente' ? ' is-active' : ''}`}
                                        onClick={() => setRiskFilter('corriente')}
                                        style={{ fontSize: '0.75rem', padding: '4px 8px', color: riskFilter === 'corriente' ? undefined : '#10b981' }}
                                    >
                                        🟢 0–15d ({cobranzasData.clinicas.filter(c => parseFloat(c.deuda_0_15 || 0) > 0).length})
                                    </button>
                                </div>

                                <div className="search-box" style={{ width: '240px' }}>
                                    <i className="bi bi-search"></i>
                                    <input
                                        className="form-input"
                                        placeholder="Buscar clínica, contacto..."
                                        value={cobranzasSearch}
                                        onChange={(e) => setCobranzasSearch(e.target.value)}
                                        style={{ fontSize: '0.8125rem' }}
                                    />
                                </div>
                            </div>
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
                            <>
                                <div className="data-table-wrapper desktop-only">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Clínica / Contacto</th>
                                                <th>Pedidos</th>
                                                <th>Deuda Total</th>
                                                <th>&gt;30 Días</th>
                                                <th>16–30 Días</th>
                                                <th>0–15 Días</th>
                                                <th style={{ width: 140 }}>Acciones</th>
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
                                                        <td>
                                                            <strong style={{ color: 'var(--color-danger)', fontSize: '0.95rem' }}>
                                                                {formatCurrency(c.total_deuda)}
                                                            </strong>
                                                        </td>
                                                        <td style={{ color: '#ef4444', fontWeight: c.deuda_30_mas > 0 ? 700 : 400 }}>
                                                            {formatCurrency(c.deuda_30_mas)}
                                                        </td>
                                                        <td style={{ color: '#f59e0b' }}>{formatCurrency(c.deuda_15_30)}</td>
                                                        <td style={{ color: '#10b981' }}>{formatCurrency(c.deuda_0_15)}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-primary"
                                                                    onClick={() => openBulkPaymentModal(c)}
                                                                    title="Cobranza y liquidación en cascada de pedidos"
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
                                                                >
                                                                    <i className="bi bi-wallet2"></i> Cobrar
                                                                </button>
                                                                {waLink && (
                                                                    <a
                                                                        href={waLink}
                                                                        className="btn btn-sm btn-ghost btn-icon"
                                                                        title="Abrir recordatorio en WhatsApp Desktop"
                                                                        style={{
                                                                            color: '#25D366',
                                                                            border: '1px solid rgba(37, 211, 102, 0.35)',
                                                                            backgroundColor: 'rgba(37, 211, 102, 0.08)',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            width: '32px',
                                                                            height: '32px',
                                                                            borderRadius: '8px'
                                                                        }}
                                                                    >
                                                                        <i className="bi bi-whatsapp" style={{ fontSize: '1.05rem' }}></i>
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

                                <div className="mobile-cards mobile-only cobranzas-mobile-cards">
                                    {filteredCobranzasClinicas.map((c) => {
                                        const waLink = buildWhatsAppLink(c);
                                        return (
                                            <div key={c.clinica_id} className="mobile-card cobranzas-card">
                                                <div className="mobile-card-head" style={{ marginBottom: '8px' }}>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div className="mobile-card-title" style={{ fontSize: '1rem', fontWeight: 700 }}>
                                                            {c.clinica_nombre}
                                                        </div>
                                                        {(c.clinica_contacto || c.clinica_telefono) && (
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                                {c.clinica_contacto ? `${c.clinica_contacto}` : ''}
                                                                {c.clinica_contacto && c.clinica_telefono ? ' · ' : ''}
                                                                {c.clinica_telefono && (
                                                                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                                                                        <i className="bi bi-telephone-fill" style={{ fontSize: '0.7rem' }}></i> {c.clinica_telefono}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="badge badge-secondary" style={{ flexShrink: 0 }}>
                                                        {c.pedidos_pendientes_count} {c.pedidos_pendientes_count === 1 ? 'pedido' : 'pedidos'}
                                                    </span>
                                                </div>

                                                <div style={{ background: 'var(--color-bg-alt)', borderRadius: '10px', padding: '10px 12px', margin: '8px 0 12px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
                                                            Deuda Total
                                                        </span>
                                                        <strong style={{ fontSize: '1.2rem', color: 'var(--color-danger)', fontWeight: 800 }}>
                                                            {formatCurrency(c.total_deuda)}
                                                        </strong>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
                                                        <div style={{ background: 'var(--color-surface)', padding: '6px 4px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                            <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 700 }}>&gt;30 DÍAS</div>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: c.deuda_30_mas > 0 ? '#ef4444' : 'var(--color-text-secondary)' }}>
                                                                {formatCurrency(c.deuda_30_mas)}
                                                            </div>
                                                        </div>
                                                        <div style={{ background: 'var(--color-surface)', padding: '6px 4px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                                            <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700 }}>16–30 DÍAS</div>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: c.deuda_15_30 > 0 ? '#f59e0b' : 'var(--color-text-secondary)' }}>
                                                                {formatCurrency(c.deuda_15_30)}
                                                            </div>
                                                        </div>
                                                        <div style={{ background: 'var(--color-surface)', padding: '6px 4px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                                            <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700 }}>0–15 DÍAS</div>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: c.deuda_0_15 > 0 ? '#10b981' : 'var(--color-text-secondary)' }}>
                                                                {formatCurrency(c.deuda_0_15)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '4px' }}>
                                                    {waLink && (
                                                        <a
                                                            href={waLink}
                                                            className="btn btn-sm btn-ghost"
                                                            title="Abrir chat en WhatsApp Desktop"
                                                            style={{ color: '#25D366', borderColor: 'rgba(37, 211, 102, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px' }}
                                                        >
                                                            <i className="bi bi-whatsapp"></i> WhatsApp
                                                        </a>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => openBulkPaymentModal(c)}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 14px', fontWeight: 600 }}
                                                    >
                                                        <i className="bi bi-wallet2"></i> Cobrar
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Estado de Cuenta y Cobranza en Cascada */}
            <Modal
                open={Boolean(selectedClinicForBulkPayment)}
                onClose={() => setSelectedClinicForBulkPayment(null)}
                title={selectedClinicForBulkPayment?.clinica_nombre ? `Estado de Cuenta: ${selectedClinicForBulkPayment.clinica_nombre}` : 'Estado de Cuenta'}
                kicker="Cobranzas • Conciliación global"
                subtitle="Liquidación automática en cascada para pedidos pendientes de pago"
                icon="bi-wallet2"
                size="xl"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setSelectedClinicForBulkPayment(null)}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleRegisterBulkPayment}
                            disabled={registerBulkPaymentMutation.isPending || pendingOrdersForBulk.length === 0}
                        >
                            {registerBulkPaymentMutation.isPending ? 'Procesando...' : 'Registrar Pago Global'}
                        </button>
                    </div>
                )}
            >
                {clinicDebtDetailQuery.isLoading ? (
                    <div>
                        {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}
                    </div>
                ) : (
                    <div className="bulk-pay-layout">
                        {/* Columna Izquierda: Pedidos Pendientes */}
                        <div className="bulk-pay-statement">
                            <div className="bulk-pay-summary">
                                <div>
                                    <span className="bulk-pay-summary-label">
                                        <i className="bi bi-exclamation-octagon" aria-hidden="true" />
                                        Deuda total pendiente
                                    </span>
                                    <div className="bulk-pay-summary-amount is-debt">
                                        {formatCurrency(selectedClinicForBulkPayment?.total_deuda)}
                                    </div>
                                </div>
                                <div className="bulk-pay-summary-meta">
                                    <span className="badge badge-secondary">
                                        {pendingOrdersForBulk.length} pedidos sin cancelar
                                    </span>
                                </div>
                            </div>

                            <div className="bulk-pay-table-shell">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Pedido</th>
                                            <th>Fecha</th>
                                            <th className="bulk-pay-num">Total</th>
                                            <th className="bulk-pay-num">Saldo Deudor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingOrdersForBulk.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>
                                                    No hay pedidos pendientes para esta clínica
                                                </td>
                                            </tr>
                                        ) : (
                                            pendingOrdersForBulk.map((p) => (
                                                <tr key={p.id}>
                                                    <td className="bulk-pay-code"><strong>{p.codigo}</strong></td>
                                                    <td>{formatDateShort(p.fecha_entrega || p.created_at)}</td>
                                                    <td className="bulk-pay-num">{formatCurrency(p.total)}</td>
                                                    <td className="bulk-pay-num is-debt"><strong>{formatCurrency(p.saldo)}</strong></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Columna Derecha: Formulario de Cobro en Cascada */}
                        <div className="bulk-pay-form">
                            <h4 className="bulk-pay-form-title">
                                <i className="bi bi-wallet2" aria-hidden="true" /> Registrar cobranza
                            </h4>

                            <form onSubmit={handleRegisterBulkPayment} className="bulk-pay-fields">
                                <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label className="form-label" style={{ margin: 0 }}>Monto a abonar <span className="bulk-pay-required">*</span></label>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-ghost"
                                            style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.75rem', padding: '0 4px' }}
                                            onClick={() => setBulkPaymentForm((p) => ({ ...p, monto_total: selectedClinicForBulkPayment?.total_deuda ? String(selectedClinicForBulkPayment.total_deuda) : '' }))}
                                        >
                                            Liquidar total ({formatCurrency(selectedClinicForBulkPayment?.total_deuda)})
                                        </button>
                                    </div>
                                    <div className="form-input-box has-prefix">
                                        <span className="form-input-prefix">S/.</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            className="form-input bulk-pay-amount-input"
                                            placeholder="0.00"
                                            value={bulkPaymentForm.monto_total}
                                            onChange={(e) => setBulkPaymentForm((p) => ({ ...p, monto_total: e.target.value }))}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Box informativo de asignación en cascada */}
                                <div className="bulk-pay-cascade" role="status">
                                    <strong className="bulk-pay-cascade-title">
                                        <i className="bi bi-arrow-repeat" aria-hidden="true" /> Asignación en cascada
                                    </strong>
                                    <p className="bulk-pay-cascade-body">
                                        {cascadeSimulation.description}
                                    </p>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Método de pago <span className="bulk-pay-required">*</span></label>
                                    <CustomSelect
                                        value={bulkPaymentForm.metodo}
                                        onChange={(e, m) => {
                                            const fondo = m === 'efectivo' ? 'caja' : 'banco';
                                            setBulkPaymentForm((p) => ({ ...p, metodo: m, tipo_fondo: fondo }));
                                        }}
                                        options={[
                                            { value: 'transferencia', label: 'Transferencia Bancaria', icon: 'bi-bank', dotColor: '#3b82f6' },
                                            { value: 'yape_plin', label: 'Yape / Plin', icon: 'bi-qr-code-scan', dotColor: '#7c3aed' },
                                            { value: 'efectivo', label: 'Efectivo (Caja)', icon: 'bi-cash-stack', dotColor: '#10b981' },
                                            { value: 'tarjeta', label: 'Tarjeta Débito/Crédito', icon: 'bi-credit-card', dotColor: '#0ea5e9' },
                                            { value: 'deposito', label: 'Depósito en Cuenta', icon: 'bi-piggy-bank', dotColor: '#f59e0b' }
                                        ]}
                                    />
                                </div>

                                <div className="bulk-pay-fields-row">
                                    <div className="form-group">
                                        <label className="form-label">N° Ref. / Operación</label>
                                        <div className="form-input-box has-lead">
                                            <i className="bi bi-receipt form-input-lead" aria-hidden="true" />
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="Ej: OP-987654"
                                                value={bulkPaymentForm.referencia}
                                                onChange={(e) => setBulkPaymentForm((p) => ({ ...p, referencia: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fecha de pago <span className="bulk-pay-required">*</span></label>
                                        <div className="form-input-box has-lead">
                                            <i className="bi bi-calendar-event form-input-lead" aria-hidden="true" />
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={bulkPaymentForm.fecha_pago}
                                                onChange={(e) => setBulkPaymentForm((p) => ({ ...p, fecha_pago: e.target.value }))}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Cuenta de destino</label>
                                    <CustomSelect
                                        value={String(bulkPaymentForm.cuenta_id || '')}
                                        onChange={(e, val) => setBulkPaymentForm((p) => ({ ...p, cuenta_id: val }))}
                                        placeholder="Seleccionar cuenta destino..."
                                        options={cuentasFiltradasBulk.map((c) => ({
                                            value: String(c.id),
                                            label: c.nombre,
                                            icon: c.tipo_cuenta === 'caja' ? 'bi-cash-coin' : 'bi-building'
                                        }))}
                                    />
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Finanzas;
