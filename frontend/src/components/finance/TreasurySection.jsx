import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../state/AuthContext.jsx';
import Modal from '../Modal.jsx';
import CustomSelect from '../CustomSelect.jsx';
import {
    fetchTreasuryAccounts,
    createTreasuryAccount,
    updateTreasuryAccount,
    fetchTreasuryTransfers,
    registerTreasuryTransfer,
    fetchSocios,
    createSocio,
    updateSocio,
    deleteSocio,
    fetchRetirosSocios,
    registerRetiroSocio
} from '../../modules/finance/api/financeApi.js';

const BANCO_OPTIONS = [
    { value: 'BCP', label: 'Banco de Crédito (BCP)', icon: 'bi-bank', dotColor: '#002B49', color: '#002B49' },
    { value: 'BBVA', label: 'BBVA Continental', icon: 'bi-bank', dotColor: '#004481', color: '#004481' },
    { value: 'Interbank', label: 'Interbank', icon: 'bi-bank', dotColor: '#009B3A', color: '#009B3A' },
    { value: 'Scotiabank', label: 'Scotiabank', icon: 'bi-bank', dotColor: '#ED1B2D', color: '#ED1B2D' },
    { value: 'BanBif', label: 'BanBif', icon: 'bi-bank', dotColor: '#0072CE', color: '#0072CE' },
    { value: 'Pichincha', label: 'Banco Pichincha', icon: 'bi-bank', dotColor: '#FFD100', color: '#FFD100' },
    { value: 'Caja Arequipa', label: 'Caja Arequipa', icon: 'bi-bank2', dotColor: '#D9261C', color: '#D9261C' },
    { value: 'Caja Cusco', label: 'Caja Cusco', icon: 'bi-bank2', dotColor: '#B82228', color: '#B82228' },
    { value: 'Yape/Plin', label: 'Billetera Digital (Yape / Plin)', icon: 'bi-qr-code-scan', dotColor: '#742284', color: '#742284' },
    { value: 'Efectivo', label: 'Efectivo en Caja', icon: 'bi-cash-stack', dotColor: '#10B981', color: '#10B981' },
    { value: 'Otro', label: 'Otra Entidad Financiera', icon: 'bi-wallet2', dotColor: '#64748B', color: '#64748B' }
];

const TIPO_CUENTA_OPTIONS = [
    { value: 'banco', label: 'Banco / Billetera Digital', icon: 'bi-bank', dotColor: '#0284c7' },
    { value: 'caja', label: 'Caja / Efectivo', icon: 'bi-cash-stack', dotColor: '#10b981' }
];

const MONEDA_OPTIONS = [
    { value: 'PEN', label: 'Soles (PEN - S/.)', icon: 'bi-coin', dotColor: '#10b981' },
    { value: 'USD', label: 'Dólares (USD - $)', icon: 'bi-currency-dollar', dotColor: '#0284c7' }
];

const DOC_TIPO_OPTIONS = [
    { value: 'DNI', label: 'DNI (Documento Nacional)', icon: 'bi-person-badge' },
    { value: 'RUC', label: 'RUC (Persona con Negocio)', icon: 'bi-building' },
    { value: 'CE', label: 'Carné de Extranjería (CE)', icon: 'bi-globe' }
];

export default function TreasurySection() {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    // Queries
    const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
        queryKey: ['treasury', 'accounts'],
        queryFn: () => fetchTreasuryAccounts({ headers: getHeaders() })
    });

    const { data: transfers = [], isLoading: loadingTransfers } = useQuery({
        queryKey: ['treasury', 'transfers'],
        queryFn: () => fetchTreasuryTransfers({ headers: getHeaders() })
    });

    const { data: socios = [], isLoading: loadingSocios } = useQuery({
        queryKey: ['treasury', 'socios'],
        queryFn: () => fetchSocios({ headers: getHeaders() })
    });

    const { data: retiros = [], isLoading: loadingRetiros } = useQuery({
        queryKey: ['treasury', 'retiros'],
        queryFn: () => fetchRetirosSocios({ headers: getHeaders() })
    });

    // Sub-tab de historial ('transferencias' | 'retiros')
    const [historyTab, setHistoryTab] = useState('transferencias');

    // Modales
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [accountForm, setAccountForm] = useState({
        nombre: '',
        tipo_cuenta: 'banco',
        banco: 'BCP',
        numero_cuenta: '',
        cci: '',
        moneda: 'PEN',
        saldo_inicial: '',
        color: '#002B49',
        descripcion: ''
    });

    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferForm, setTransferForm] = useState({
        cuenta_origen_id: '',
        cuenta_destino_id: '',
        monto: '',
        referencia: '',
        motivo: ''
    });

    const [socioModalOpen, setSocioModalOpen] = useState(false);
    const [editingSocio, setEditingSocio] = useState(null);
    const [socioForm, setSocioForm] = useState({
        nombre: '',
        documento_tipo: 'DNI',
        documento_numero: '',
        porcentaje_participacion: '',
        telefono: '',
        email: ''
    });

    const [retiroModalOpen, setRetiroModalOpen] = useState(false);
    const [retiroForm, setRetiroForm] = useState({
        socio_id: '',
        cuenta_id: '',
        monto: '',
        referencia: '',
        descripcion: 'Retiro de utilidades / dividendos'
    });

    // Mutations
    const saveAccountMutation = useMutation({
        mutationFn: (payload) => {
            if (editingAccount) {
                return updateTreasuryAccount({ accountId: editingAccount.id, payload, headers: getHeaders() });
            }
            return createTreasuryAccount({ payload, headers: getHeaders() });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['treasury', 'accounts'] });
            toast.success(editingAccount ? 'Cuenta actualizada con éxito' : 'Cuenta financiera creada con éxito');
            setAccountModalOpen(false);
            setEditingAccount(null);
        },
        onError: (err) => toast.error(err.message || 'Error al guardar cuenta')
    });

    const transferMutation = useMutation({
        mutationFn: (payload) => registerTreasuryTransfer({ payload, headers: getHeaders() }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['treasury', 'accounts'] });
            queryClient.invalidateQueries({ queryKey: ['treasury', 'transfers'] });
            toast.success('Transferencia entre cuentas realizada con éxito');
            setTransferModalOpen(false);
        },
        onError: (err) => toast.error(err.message || 'Error al transferir')
    });

    const saveSocioMutation = useMutation({
        mutationFn: (payload) => {
            if (editingSocio) {
                return updateSocio({ socioId: editingSocio.id, payload, headers: getHeaders() });
            }
            return createSocio({ payload, headers: getHeaders() });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['treasury', 'socios'] });
            toast.success(editingSocio ? 'Socio actualizado' : 'Socio registrado con éxito');
            setSocioModalOpen(false);
            setEditingSocio(null);
        },
        onError: (err) => toast.error(err.message || 'Error al guardar socio')
    });

    const deleteSocioMutation = useMutation({
        mutationFn: (socioId) => deleteSocio({ socioId, headers: getHeaders() }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['treasury', 'socios'] });
            if (res?.data?.inactivated) {
                toast.success('Socio inactivado y participación fijada en 0%');
            } else {
                toast.success('Socio eliminado correctamente');
            }
        },
        onError: (err) => toast.error(err.message || 'Error al eliminar socio')
    });

    const handleDeleteSocio = (s) => {
        if (!window.confirm(`¿Estás seguro de eliminar al socio "${s.nombre}"? Si tiene retiros históricos se inactivará para no desbalancear la contabilidad.`)) {
            return;
        }
        deleteSocioMutation.mutate(s.id);
    };

    const retiroMutation = useMutation({
        mutationFn: (payload) => registerRetiroSocio({ payload, headers: getHeaders() }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['treasury', 'accounts'] });
            queryClient.invalidateQueries({ queryKey: ['treasury', 'socios'] });
            queryClient.invalidateQueries({ queryKey: ['treasury', 'retiros'] });
            toast.success('Retiro de utilidades registrado con éxito');
            setRetiroModalOpen(false);
        },
        onError: (err) => toast.error(err.message || 'Error al registrar retiro')
    });

    // Métricas calculadas
    const metrics = useMemo(() => {
        let totalFondos = 0;
        let totalBancos = 0;
        let totalCaja = 0;

        accounts.forEach((acc) => {
            const saldo = parseFloat(acc.saldo_actual || 0);
            totalFondos += saldo;
            if (acc.tipo_cuenta === 'caja') {
                totalCaja += saldo;
            } else {
                totalBancos += saldo;
            }
        });

        const totalRetiros = retiros.reduce((sum, r) => sum + parseFloat(r.monto || 0), 0);

        return {
            totalFondos,
            totalBancos,
            totalCaja,
            totalRetiros
        };
    }, [accounts, retiros]);

    const formatCurrency = (val, moneda = 'PEN') => {
        const num = parseFloat(val || 0);
        const symbol = moneda === 'USD' ? '$' : 'S/.';
        return `${symbol} ${num.toFixed(2)}`;
    };

    const formatDateShort = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    };

    const copyToClipboard = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado al portapapeles`);
    };

    const handleOpenEditAccount = (acc) => {
        setEditingAccount(acc);
        setAccountForm({
            nombre: acc.nombre || '',
            tipo_cuenta: acc.tipo_cuenta || 'banco',
            banco: acc.banco || 'BCP',
            numero_cuenta: acc.numero_cuenta || '',
            cci: acc.cci || '',
            moneda: acc.moneda || 'PEN',
            saldo_inicial: acc.saldo_inicial !== undefined ? String(acc.saldo_inicial) : '0',
            color: acc.color || '#002B49',
            descripcion: acc.descripcion || ''
        });
        setAccountModalOpen(true);
    };

    const handleOpenNewAccount = () => {
        setEditingAccount(null);
        setAccountForm({
            nombre: '',
            tipo_cuenta: 'banco',
            banco: 'BCP',
            numero_cuenta: '',
            cci: '',
            moneda: 'PEN',
            saldo_inicial: '0',
            color: '#002B49',
            descripcion: ''
        });
        setAccountModalOpen(true);
    };

    const handleOpenTransfer = (origenAccId = null) => {
        setTransferForm({
            cuenta_origen_id: origenAccId ? String(origenAccId) : (accounts[0]?.id ? String(accounts[0].id) : ''),
            cuenta_destino_id: accounts.find(a => String(a.id) !== String(origenAccId))?.id ? String(accounts.find(a => String(a.id) !== String(origenAccId)).id) : '',
            monto: '',
            referencia: '',
            motivo: 'Transferencia operativa entre cuentas'
        });
        setTransferModalOpen(true);
    };

    const handleOpenRetiro = (socioId = null) => {
        const bankAccounts = accounts.filter(a => a.tipo_cuenta !== 'caja');
        setRetiroForm({
            socio_id: socioId ? String(socioId) : (socios[0]?.id ? String(socios[0].id) : ''),
            cuenta_id: bankAccounts[0]?.id ? String(bankAccounts[0].id) : '',
            monto: '',
            referencia: '',
            descripcion: 'Retiro de utilidades / dividendos'
        });
        setRetiroModalOpen(true);
    };

    const handleOpenEditSocio = (socio) => {
        setEditingSocio(socio);
        setSocioForm({
            nombre: socio.nombre || '',
            documento_tipo: socio.documento_tipo || 'DNI',
            documento_numero: socio.documento_numero || '',
            porcentaje_participacion: socio.porcentaje_participacion !== undefined && socio.porcentaje_participacion !== null ? String(socio.porcentaje_participacion) : '',
            telefono: socio.telefono || '',
            email: socio.email || ''
        });
        setSocioModalOpen(true);
    };

    const handleOpenNewSocio = () => {
        setEditingSocio(null);
        setSocioForm({
            nombre: '',
            documento_tipo: 'DNI',
            documento_numero: '',
            porcentaje_participacion: '',
            telefono: '',
            email: ''
        });
        setSocioModalOpen(true);
    };

    const totalParticipacion = useMemo(() => {
        return socios.reduce((sum, s) => sum + parseFloat(s.porcentaje_participacion || 0), 0);
    }, [socios]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* 1. KPI Cards de Tesorería */}
            <div className="card dashboard-ops-panel">
                <div className="card-header dashboard-card-header treasury-header">
                    <div>
                        <h3 className="card-title">Resumen de Tesorería y Fondos Líquidos</h3>
                        <p className="card-subtitle">Balance consolidado en tiempo real de todas las cuentas bancarias y caja</p>
                    </div>
                    <div className="treasury-header-actions">
                        <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenTransfer()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                        >
                            <i className="bi bi-arrow-left-right"></i> Transferir entre Cuentas
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={handleOpenNewAccount}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                        >
                            <i className="bi bi-plus-lg"></i> Nueva Cuenta
                        </button>
                    </div>
                </div>

                <div className="grid dashboard-kpi-grid-liquid dashboard-staggered-grid">
                    {/* Total Fondos */}
                    <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--primary">
                        <div className="dashboard-kpi-shell">
                            <div className="dashboard-kpi-row">
                                <div className="kpi-icon" aria-hidden="true">
                                    <i className="bi bi-wallet-fill"></i>
                                </div>
                                <div className="dashboard-kpi-heading-group">
                                    <div className="dashboard-kpi-heading">Total Fondos Disponibles</div>
                                    <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                        {formatCurrency(metrics.totalFondos)}
                                    </div>
                                    <div className="dashboard-kpi-note">{accounts.length} cuenta(s) activa(s)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bancos */}
                    <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--success">
                        <div className="dashboard-kpi-shell">
                            <div className="dashboard-kpi-row">
                                <div className="kpi-icon" aria-hidden="true" style={{ backgroundColor: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
                                    <i className="bi bi-bank2"></i>
                                </div>
                                <div className="dashboard-kpi-heading-group">
                                    <div className="dashboard-kpi-heading">Saldo en Bancos</div>
                                    <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                        {formatCurrency(metrics.totalBancos)}
                                    </div>
                                    <div className="dashboard-kpi-note">Cuentas corrientes y ahorros</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Efectivo en Caja */}
                    <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--warning">
                        <div className="dashboard-kpi-shell">
                            <div className="dashboard-kpi-row">
                                <div className="kpi-icon" aria-hidden="true" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                    <i className="bi bi-cash-coin"></i>
                                </div>
                                <div className="dashboard-kpi-heading-group">
                                    <div className="dashboard-kpi-heading">Efectivo en Caja</div>
                                    <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                        {formatCurrency(metrics.totalCaja)}
                                    </div>
                                    <div className="dashboard-kpi-note">Dinero físico en mostrador</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Retiros de Socios */}
                    <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--danger">
                        <div className="dashboard-kpi-shell">
                            <div className="dashboard-kpi-row">
                                <div className="kpi-icon" aria-hidden="true" style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: '#9333ea' }}>
                                    <i className="bi bi-people-fill"></i>
                                </div>
                                <div className="dashboard-kpi-heading-group">
                                    <div className="dashboard-kpi-heading">Utilidades Distribuidas</div>
                                    <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                        {formatCurrency(metrics.totalRetiros)}
                                    </div>
                                    <div className="dashboard-kpi-note">{socios.length} socio(s) registrados</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Grid de Cuentas Financieras */}
            <div className="card">
                <div className="card-header treasury-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="bi bi-credit-card-2-front text-primary"></i> Cuentas Bancarias y de Efectivo
                        </h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                            Gestión multi-cuenta para depósitos, cobranzas y egresos directos
                        </p>
                    </div>
                </div>

                {loadingAccounts ? (
                    <div style={{ padding: '20px' }}>
                        {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12, borderRadius: 12 }} />)}
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px' }}>
                        <i className="bi bi-bank empty-state-icon"></i>
                        <h4 className="empty-state-title">No hay cuentas financieras registradas</h4>
                        <p className="empty-state-text">Crea tu primera cuenta de banco o caja chica para comenzar.</p>
                    </div>
                ) : (
                    <div className="treasury-accounts-grid">
                        {accounts.map((acc) => {
                            const isCaja = acc.tipo_cuenta === 'caja';
                            const bankIcon = isCaja
                                ? 'bi-cash-stack'
                                : (acc.banco === 'Yape/Plin' ? 'bi-qr-code-scan' : 'bi-bank2');
                            const brandColor = acc.color || (isCaja ? '#10B981' : '#0284C7');

                            return (
                                <div
                                    key={acc.id}
                                    className="card"
                                    style={{
                                        padding: '1.25rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        borderRadius: '14px',
                                        border: '1px solid var(--color-border-light, #e2e8f0)',
                                        background: 'var(--color-surface, #ffffff)',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                                        transition: 'all 0.2s ease',
                                        position: 'relative'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div
                                                    style={{
                                                        width: '44px',
                                                        height: '44px',
                                                        borderRadius: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '1.25rem',
                                                        backgroundColor: `${brandColor}18`,
                                                        color: brandColor,
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    <i className={`bi ${bankIcon}`}></i>
                                                </div>
                                                <div>
                                                    <span className="badge badge-secondary" style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-block', marginBottom: '3px' }}>
                                                        {isCaja ? 'Efectivo en Caja' : (acc.banco || 'Banco')}
                                                    </span>
                                                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                                                        {acc.nombre}
                                                    </h4>
                                                </div>
                                            </div>
                                            <span className="badge" style={{ backgroundColor: 'rgba(2, 132, 199, 0.1)', color: 'var(--color-primary, #0284c7)', fontWeight: 700, fontSize: '0.75rem', padding: '4px 8px' }}>
                                                {acc.moneda || 'PEN'}
                                            </span>
                                        </div>

                                        {/* Números de cuenta y CCI en contenedor sobrio */}
                                        {(acc.numero_cuenta || acc.cci || acc.descripcion) && (
                                            <div
                                                style={{
                                                    backgroundColor: 'var(--color-bg-secondary, rgba(0, 0, 0, 0.02))',
                                                    border: '1px solid var(--color-border-light, #e2e8f0)',
                                                    borderRadius: '8px',
                                                    padding: '8px 10px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                    marginBottom: '14px'
                                                }}
                                            >
                                                {acc.numero_cuenta && (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                                        <span style={{ color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                            <strong style={{ color: 'var(--color-text)' }}>Cta:</strong> {acc.numero_cuenta}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-ghost"
                                                            onClick={() => copyToClipboard(acc.numero_cuenta, 'N° de Cuenta')}
                                                            title="Copiar N° de Cuenta"
                                                            style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                                        >
                                                            <i className="bi bi-clipboard"></i>
                                                        </button>
                                                    </div>
                                                )}

                                                {acc.cci && (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                                        <span style={{ color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                            <strong style={{ color: 'var(--color-text)' }}>CCI:</strong> {acc.cci}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-ghost"
                                                            onClick={() => copyToClipboard(acc.cci, 'CCI')}
                                                            title="Copiar CCI"
                                                            style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                                        >
                                                            <i className="bi bi-clipboard"></i>
                                                        </button>
                                                    </div>
                                                )}

                                                {acc.descripcion && (
                                                    <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                                        {acc.descripcion}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Pie de Card: Saldo disponible y acciones */}
                                    <div
                                        style={{
                                            paddingTop: '12px',
                                            borderTop: '1px solid var(--color-border-light, #e2e8f0)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-end',
                                            gap: '8px'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                                                Saldo Disponible
                                            </div>
                                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: parseFloat(acc.saldo_actual) >= 0 ? 'var(--color-text)' : 'var(--color-danger)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                                                {formatCurrency(acc.saldo_actual, acc.moneda)}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleOpenTransfer(acc.id)}
                                                title="Transferir desde esta cuenta"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', fontSize: '0.8125rem' }}
                                            >
                                                <i className="bi bi-arrow-left-right"></i> Mover
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-ghost"
                                                onClick={() => handleOpenEditAccount(acc)}
                                                title="Editar información de la cuenta"
                                                style={{ padding: '6px 8px', fontSize: '0.8125rem' }}
                                            >
                                                <i className="bi bi-pencil"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 3. Sección: Socios y Retiro de Utilidades */}
            <div className="card">
                <div className="card-header treasury-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="bi bi-people text-primary"></i> Socios y Distribución de Utilidades
                            </h4>
                            <span
                                className={`badge ${Math.abs(totalParticipacion - 100) < 0.01 ? 'badge-success' : 'badge-warning'}`}
                                style={{ fontWeight: 700, fontSize: '0.75rem' }}
                                title={Math.abs(totalParticipacion - 100) < 0.01 ? 'Participación total distribuida al 100%' : `Suma actual: ${totalParticipacion}%. Debería sumar 100%`}
                            >
                                Total: {totalParticipacion.toFixed(2)}%
                            </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                            Control patrimonial de retiros y dividendos sin alterar los costos operativos ni el P&L
                        </p>
                    </div>
                    <div className="treasury-section-actions">
                        <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleOpenRetiro()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                        >
                            <i className="bi bi-wallet2"></i> Registrar Retiro de Utilidades
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={handleOpenNewSocio}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                            <i className="bi bi-person-plus"></i> Nuevo Socio
                        </button>
                    </div>
                </div>

                {loadingSocios ? (
                    <div style={{ padding: '20px' }}>
                        {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}
                    </div>
                ) : socios.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px' }}>
                        <i className="bi bi-people empty-state-icon"></i>
                        <h4 className="empty-state-title">No hay socios registrados</h4>
                        <p className="empty-state-text">Registra a los socios o accionistas para monitorear retiros de utilidades.</p>
                    </div>
                ) : (
                    <div className="treasury-socios-grid">
                        {socios.map((s) => (
                            <div
                                key={s.id}
                                className="card"
                                style={{
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    borderRadius: '14px',
                                    border: '1px solid var(--color-border-light, #e2e8f0)',
                                    background: 'var(--color-surface, #ffffff)',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div
                                                style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    borderRadius: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.2rem',
                                                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                                                    color: 'var(--color-primary, #0284c7)',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <i className="bi bi-person-circle"></i>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                                                    {s.nombre}
                                                </h4>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                    {s.documento_tipo}: {s.documento_numero || '—'}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span className="badge badge-secondary" style={{ fontWeight: 700, fontSize: '0.75rem', padding: '4px 8px' }}>
                                                {s.porcentaje_participacion ? `${s.porcentaje_participacion}%` : 'Socio'}
                                            </span>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-ghost"
                                                onClick={() => handleOpenEditSocio(s)}
                                                title="Editar socio y porcentaje"
                                                style={{ padding: '4px 6px', color: 'var(--color-text-secondary)' }}
                                            >
                                                <i className="bi bi-pencil"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-ghost text-danger"
                                                onClick={() => handleDeleteSocio(s)}
                                                disabled={deleteSocioMutation.isPending}
                                                title="Eliminar o dar de baja al socio"
                                                style={{ padding: '4px 6px' }}
                                            >
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        </div>
                                    </div>

                                    {(s.telefono || s.email) && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: '12px', padding: '6px 8px', borderRadius: '6px', background: 'var(--color-bg-secondary, rgba(0,0,0,0.02))' }}>
                                            {s.telefono && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <i className="bi bi-telephone" style={{ fontSize: '0.75rem' }}></i> {s.telefono}
                                                </div>
                                            )}
                                            {s.email && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <i className="bi bi-envelope" style={{ fontSize: '0.75rem' }}></i> {s.email}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div
                                    style={{
                                        paddingTop: '12px',
                                        borderTop: '1px solid var(--color-border-light, #e2e8f0)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-end',
                                        gap: '8px'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                                            Retiros Acumulados
                                        </div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-primary, #0284c7)', lineHeight: 1.2 }}>
                                            {formatCurrency(s.total_retirado)}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => handleOpenRetiro(s.id)}
                                        title="Registrar retiro de utilidades para este socio"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', fontSize: '0.8125rem' }}
                                    >
                                        <i className="bi bi-wallet2"></i> Retirar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 4. Historial de Movimientos de Tesorería */}
            <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '12px' }}>
                    <div className="treasury-history-tabs" style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            className={`btn btn-sm ${historyTab === 'transferencias' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setHistoryTab('transferencias')}
                        >
                            <i className="bi bi-arrow-left-right"></i>
                            <span className="treasury-tab-text-desktop">Transferencias entre Cuentas ({transfers.length})</span>
                            <span className="treasury-tab-text-mobile">Transferencias ({transfers.length})</span>
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${historyTab === 'retiros' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setHistoryTab('retiros')}
                        >
                            <i className="bi bi-journal-arrow-down"></i>
                            <span className="treasury-tab-text-desktop">Retiros de Socios ({retiros.length})</span>
                            <span className="treasury-tab-text-mobile">Retiros ({retiros.length})</span>
                        </button>
                    </div>
                </div>

                {historyTab === 'transferencias' && (
                    <>
                        {loadingTransfers ? (
                            <div style={{ padding: '20px' }}>
                                {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 40, marginBottom: 8, borderRadius: 6 }} />)}
                            </div>
                        ) : transfers.length === 0 ? (
                            <div className="empty-state" style={{ padding: '32px' }}>
                                <i className="bi bi-arrow-left-right empty-state-icon"></i>
                                <h4 className="empty-state-title">No hay transferencias registradas</h4>
                                <p className="empty-state-text">Las transferencias entre cuentas aparecerán aquí.</p>
                            </div>
                        ) : (
                            <>
                                {/* Tabla para Desktop */}
                                <div className="data-table-wrapper treasury-table-wrapper">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Cuenta Origen</th>
                                                <th></th>
                                                <th>Cuenta Destino</th>
                                                <th>Monto</th>
                                                <th>Referencia / Motivo</th>
                                                <th>Responsable</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transfers.map((t) => (
                                                <tr key={t.id}>
                                                    <td>{formatDateShort(t.fecha || t.created_at)}</td>
                                                    <td>
                                                        <span className="badge badge-secondary" style={{ marginRight: '6px' }}>{t.cuenta_origen_banco || 'Origen'}</span>
                                                        <strong>{t.cuenta_origen_nombre}</strong>
                                                    </td>
                                                    <td style={{ textAlign: 'center', color: 'var(--color-primary)' }}>
                                                        <i className="bi bi-arrow-right"></i>
                                                    </td>
                                                    <td>
                                                        <span className="badge badge-secondary" style={{ marginRight: '6px' }}>{t.cuenta_destino_banco || 'Destino'}</span>
                                                        <strong>{t.cuenta_destino_nombre}</strong>
                                                    </td>
                                                    <td>
                                                        <strong style={{ color: 'var(--color-text)', fontSize: '0.95rem' }}>
                                                            {formatCurrency(t.monto)}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        {t.referencia && <div style={{ fontWeight: 600 }}>{t.referencia}</div>}
                                                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{t.motivo || '—'}</div>
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                        {t.creado_por_nombre || 'Sistema'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Lista de Cards para Mobile */}
                                <div className="treasury-mobile-list">
                                    {transfers.map((t) => (
                                        <div key={t.id} className="treasury-mobile-card">
                                            <div className="treasury-mobile-card-top">
                                                <span className="treasury-mobile-date">
                                                    <i className="bi bi-calendar-event"></i> {formatDateShort(t.fecha || t.created_at)}
                                                </span>
                                                <span className="treasury-mobile-amount text-primary">
                                                    {formatCurrency(t.monto)}
                                                </span>
                                            </div>
                                            <div className="treasury-mobile-flow">
                                                <div className="treasury-mobile-flow-item">
                                                    <span className="badge badge-secondary" style={{ width: 'fit-content' }}>{t.cuenta_origen_banco || 'Origen'}</span>
                                                    <span className="treasury-mobile-acc-name">{t.cuenta_origen_nombre}</span>
                                                </div>
                                                <div className="treasury-mobile-flow-arrow">
                                                    <i className="bi bi-arrow-right"></i>
                                                </div>
                                                <div className="treasury-mobile-flow-item">
                                                    <span className="badge badge-secondary" style={{ width: 'fit-content' }}>{t.cuenta_destino_banco || 'Destino'}</span>
                                                    <span className="treasury-mobile-acc-name">{t.cuenta_destino_nombre}</span>
                                                </div>
                                            </div>
                                            {(t.referencia || t.motivo || t.creado_por_nombre) && (
                                                <div className="treasury-mobile-card-bottom">
                                                    {t.referencia && <span className="treasury-mobile-ref">{t.referencia}</span>}
                                                    {t.motivo && <span className="treasury-mobile-motivo">{t.motivo}</span>}
                                                    <span className="treasury-mobile-author">
                                                        <i className="bi bi-person"></i> {t.creado_por_nombre || 'Sistema'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}

                {historyTab === 'retiros' && (
                    <>
                        {loadingRetiros ? (
                            <div style={{ padding: '20px' }}>
                                {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 40, marginBottom: 8, borderRadius: 6 }} />)}
                            </div>
                        ) : retiros.length === 0 ? (
                            <div className="empty-state" style={{ padding: '32px' }}>
                                <i className="bi bi-cash-stack empty-state-icon"></i>
                                <h4 className="empty-state-title">No hay retiros de utilidades registrados</h4>
                                <p className="empty-state-text">Los retiros de socios registrados figurarán aquí.</p>
                            </div>
                        ) : (
                            <>
                                {/* Tabla para Desktop */}
                                <div className="data-table-wrapper treasury-table-wrapper">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Socio / Accionista</th>
                                                <th>Cuenta Origen</th>
                                                <th>Monto Retirado</th>
                                                <th>Referencia</th>
                                                <th>Concepto</th>
                                                <th>Responsable</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {retiros.map((r) => (
                                                <tr key={r.id}>
                                                    <td>{formatDateShort(r.fecha_movimiento || r.created_at)}</td>
                                                    <td>
                                                        <strong>{r.socio_nombre}</strong>
                                                        {r.socio_documento && (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                                DNI/RUC: {r.socio_documento}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className="badge badge-secondary" style={{ marginRight: '6px' }}>{r.cuenta_banco || 'Banco'}</span>
                                                        {r.cuenta_nombre}
                                                    </td>
                                                    <td>
                                                        <strong style={{ color: 'var(--color-danger)', fontSize: '0.95rem' }}>
                                                            {formatCurrency(r.monto)}
                                                        </strong>
                                                    </td>
                                                    <td>{r.referencia || '—'}</td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{r.descripcion || '—'}</td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                        {r.creado_por_nombre || 'Sistema'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Lista de Cards para Mobile */}
                                <div className="treasury-mobile-list">
                                    {retiros.map((r) => (
                                        <div key={r.id} className="treasury-mobile-card">
                                            <div className="treasury-mobile-card-top">
                                                <span className="treasury-mobile-date">
                                                    <i className="bi bi-calendar-event"></i> {formatDateShort(r.fecha_movimiento || r.created_at)}
                                                </span>
                                                <span className="treasury-mobile-amount" style={{ color: '#9333ea' }}>
                                                    - {formatCurrency(r.monto)}
                                                </span>
                                            </div>
                                            <div className="treasury-mobile-socio-row">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                    <div className="treasury-mobile-socio-avatar">
                                                        <i className="bi bi-person-fill"></i>
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {r.socio_nombre}
                                                        </strong>
                                                        {r.socio_documento && (
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                                DNI/RUC: {r.socio_documento}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <span className="badge badge-secondary">{r.cuenta_banco || 'Cuenta'}</span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {r.cuenta_nombre}
                                                    </div>
                                                </div>
                                            </div>
                                            {(r.referencia || r.descripcion) && (
                                                <div className="treasury-mobile-card-bottom">
                                                    {r.referencia && <span className="treasury-mobile-ref">Ref: {r.referencia}</span>}
                                                    {r.descripcion && <span className="treasury-mobile-motivo">{r.descripcion}</span>}
                                                    <span className="treasury-mobile-author">
                                                        <i className="bi bi-person"></i> {r.creado_por_nombre || 'Sistema'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* MODAL: Crear / Editar Cuenta Financiera */}
            <Modal
                open={accountModalOpen}
                onClose={() => setAccountModalOpen(false)}
                title={editingAccount ? 'Editar Cuenta Financiera' : 'Nueva Cuenta Financiera'}
                kicker="Tesorería • Cuentas Bancarias y Fondos"
                subtitle="Configura una cuenta bancaria, billetera o caja para registrar pagos y transferencias"
                icon="bi-bank"
                size="md"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setAccountModalOpen(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={saveAccountMutation.isPending || !accountForm.nombre.trim()}
                            onClick={() => saveAccountMutation.mutate(accountForm)}
                        >
                            {saveAccountMutation.isPending ? 'Guardando...' : (editingAccount ? 'Actualizar Cuenta' : 'Crear Cuenta')}
                        </button>
                    </div>
                )}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="form-group">
                        <label className="form-label">Nombre Identificador de la Cuenta *</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. BCP Operativo Soles, BBVA Ahorros, Caja Chica"
                            value={accountForm.nombre}
                            onChange={(e) => setAccountForm(p => ({ ...p, nombre: e.target.value }))}
                        />
                    </div>

                    <div className="treasury-form-row">
                        <div className="form-group">
                            <label className="form-label">Tipo de Fondo</label>
                            <CustomSelect
                                value={accountForm.tipo_cuenta}
                                onChange={(_e, val) => setAccountForm(p => ({ ...p, tipo_cuenta: val }))}
                                options={TIPO_CUENTA_OPTIONS}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Entidad Bancaria</label>
                            <CustomSelect
                                value={accountForm.banco}
                                onChange={(_e, val) => {
                                    const opt = BANCO_OPTIONS.find(b => b.value === val);
                                    setAccountForm(p => ({
                                        ...p,
                                        banco: val,
                                        color: opt ? opt.color : p.color
                                    }));
                                }}
                                options={BANCO_OPTIONS}
                                searchable
                            />
                        </div>
                    </div>

                    <div className="treasury-form-row">
                        <div className="form-group">
                            <label className="form-label">Número de Cuenta</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej. 191-99887766-0-12"
                                value={accountForm.numero_cuenta}
                                onChange={(e) => setAccountForm(p => ({ ...p, numero_cuenta: e.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Código Interbancario (CCI)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej. 002-191-0099887766012-55"
                                value={accountForm.cci}
                                onChange={(e) => setAccountForm(p => ({ ...p, cci: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="treasury-form-row">
                        <div className="form-group">
                            <label className="form-label">Moneda</label>
                            <CustomSelect
                                value={accountForm.moneda}
                                onChange={(_e, val) => setAccountForm(p => ({ ...p, moneda: val }))}
                                options={MONEDA_OPTIONS}
                            />
                        </div>

                        {!editingAccount && (
                            <div className="form-group">
                                <label className="form-label">Saldo Inicial</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-input"
                                    placeholder="0.00"
                                    value={accountForm.saldo_inicial}
                                    onChange={(e) => setAccountForm(p => ({ ...p, saldo_inicial: e.target.value }))}
                                />
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Descripción / Notas Adicionales</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Cuenta asignada para pago a proveedores y recepción de transferencias"
                            value={accountForm.descripcion}
                            onChange={(e) => setAccountForm(p => ({ ...p, descripcion: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>

            {/* MODAL: Transferencia entre Cuentas */}
            <Modal
                open={transferModalOpen}
                onClose={() => setTransferModalOpen(false)}
                title="Transferir entre Cuentas"
                kicker="Tesorería • Movimiento Interno de Fondos"
                subtitle="Mueve dinero entre tus cuentas bancarias o cajas sin alterar ingresos por ventas ni gastos operativos"
                icon="bi-arrow-left-right"
                size="md"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setTransferModalOpen(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={transferMutation.isPending || !transferForm.cuenta_origen_id || !transferForm.cuenta_destino_id || parseFloat(transferForm.monto || 0) <= 0}
                            onClick={() => transferMutation.mutate(transferForm)}
                        >
                            {transferMutation.isPending ? 'Transfiriendo...' : 'Confirmar Transferencia'}
                        </button>
                    </div>
                )}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="treasury-form-row">
                        <div className="form-group">
                            <label className="form-label">Cuenta de Origen *</label>
                            <CustomSelect
                                value={transferForm.cuenta_origen_id}
                                onChange={(_e, val) => setTransferForm(p => ({ ...p, cuenta_origen_id: val }))}
                                placeholder="Selecciona origen..."
                                options={accounts.map(a => ({
                                    value: String(a.id),
                                    label: `${a.nombre} (${formatCurrency(a.saldo_actual, a.moneda)})`,
                                    icon: a.tipo_cuenta === 'caja' ? 'bi-cash-stack' : 'bi-bank2',
                                    dotColor: a.color || (a.tipo_cuenta === 'caja' ? '#10B981' : '#0284C7')
                                }))}
                                searchable={accounts.length > 5}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Cuenta de Destino *</label>
                            <CustomSelect
                                value={transferForm.cuenta_destino_id}
                                onChange={(_e, val) => setTransferForm(p => ({ ...p, cuenta_destino_id: val }))}
                                placeholder="Selecciona destino..."
                                options={accounts
                                    .filter(a => String(a.id) !== String(transferForm.cuenta_origen_id))
                                    .map(a => ({
                                        value: String(a.id),
                                        label: `${a.nombre} (${formatCurrency(a.saldo_actual, a.moneda)})`,
                                        icon: a.tipo_cuenta === 'caja' ? 'bi-cash-stack' : 'bi-bank2',
                                        dotColor: a.color || (a.tipo_cuenta === 'caja' ? '#10B981' : '#0284C7')
                                    }))}
                                searchable={accounts.length > 5}
                            />
                        </div>
                    </div>

                    <div className="treasury-form-row">
                        <div className="form-group">
                            <label className="form-label">Monto a Transferir *</label>
                            <div className="form-input-box has-prefix">
                                <span className="form-input-prefix">S/.</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-input"
                                    placeholder="0.00"
                                    value={transferForm.monto}
                                    onChange={(e) => setTransferForm(p => ({ ...p, monto: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">N° Operación / Referencia</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej. OP-123456"
                                value={transferForm.referencia}
                                onChange={(e) => setTransferForm(p => ({ ...p, referencia: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Motivo de la Transferencia</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Depósito de recaudación de caja a cuenta bancaria"
                            value={transferForm.motivo}
                            onChange={(e) => setTransferForm(p => ({ ...p, motivo: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>

            {/* MODAL: Registrar Retiro de Utilidades a Socio */}
            <Modal
                open={retiroModalOpen}
                onClose={() => setRetiroModalOpen(false)}
                title="Registrar Retiro de Utilidades"
                kicker="Patrimonio • Retiro de Socios / Dividendos"
                subtitle="El retiro descuenta el saldo bancario pero no afecta el margen operativo ni el P&L del laboratorio"
                icon="bi-cash-coin"
                size="md"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setRetiroModalOpen(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={retiroMutation.isPending || !retiroForm.socio_id || !retiroForm.cuenta_id || parseFloat(retiroForm.monto || 0) <= 0}
                            onClick={() => retiroMutation.mutate(retiroForm)}
                        >
                            {retiroMutation.isPending ? 'Registrando...' : 'Confirmar Retiro'}
                        </button>
                    </div>
                )}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="treasury-form-row">
                        <div className="form-group">
                            <label className="form-label">Socio Beneficiario *</label>
                            <CustomSelect
                                value={retiroForm.socio_id}
                                onChange={(_e, val) => setRetiroForm(p => ({ ...p, socio_id: val }))}
                                placeholder="Selecciona socio..."
                                options={socios.map(s => ({
                                    value: String(s.id),
                                    label: `${s.nombre} (${s.porcentaje_participacion ? `${s.porcentaje_participacion}%` : 'Socio'})`,
                                    icon: 'bi-person-circle',
                                    dotColor: '#0284c7'
                                }))}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Cuenta Bancaria de Salida (Transferencia) *</label>
                            <CustomSelect
                                value={retiroForm.cuenta_id}
                                onChange={(_e, val) => setRetiroForm(p => ({ ...p, cuenta_id: val }))}
                                placeholder="Selecciona cuenta bancaria..."
                                options={accounts.filter(a => a.tipo_cuenta !== 'caja').map(a => ({
                                    value: String(a.id),
                                    label: `${a.nombre} — ${a.banco || 'Banco'} (${formatCurrency(a.saldo_actual, a.moneda)})`,
                                    icon: a.banco === 'Yape/Plin' ? 'bi-qr-code-scan' : 'bi-bank2',
                                    dotColor: a.color || '#0284C7'
                                }))}
                            />
                        </div>
                    </div>

                    <div className="treasury-form-row">
                        <div className="form-group">
                            <label className="form-label">Monto de Retiro *</label>
                            <div className="form-input-box has-prefix">
                                <span className="form-input-prefix">S/.</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-input"
                                    placeholder="0.00"
                                    value={retiroForm.monto}
                                    onChange={(e) => setRetiroForm(p => ({ ...p, monto: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">N° Operación / Transferencia</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej. OP-998877"
                                value={retiroForm.referencia}
                                onChange={(e) => setRetiroForm(p => ({ ...p, referencia: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Concepto / Motivo</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Distribución de dividendos quincena / mes"
                            value={retiroForm.descripcion}
                            onChange={(e) => setRetiroForm(p => ({ ...p, descripcion: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>

            {/* MODAL: Crear / Editar Socio */}
            <Modal
                open={socioModalOpen}
                onClose={() => setSocioModalOpen(false)}
                title={editingSocio ? 'Editar Socio' : 'Registrar Nuevo Socio'}
                kicker="Patrimonio • Socios y Accionistas"
                subtitle="Registra la participación accionaria de los socios de AFINIX DENTAL LAB S.A.C."
                icon="bi-person-plus"
                size="md"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setSocioModalOpen(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={saveSocioMutation.isPending || !socioForm.nombre.trim()}
                            onClick={() => saveSocioMutation.mutate(socioForm)}
                        >
                            {saveSocioMutation.isPending ? 'Guardando...' : (editingSocio ? 'Actualizar' : 'Registrar Socio')}
                        </button>
                    </div>
                )}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="form-group">
                        <label className="form-label">Nombre Completo del Socio *</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Brandon Santander Yanqui"
                            value={socioForm.nombre}
                            onChange={(e) => setSocioForm(p => ({ ...p, nombre: e.target.value }))}
                        />
                    </div>

                    <div className="treasury-form-row treasury-form-row--1-2">
                        <div className="form-group">
                            <label className="form-label">Tipo Doc.</label>
                            <CustomSelect
                                value={socioForm.documento_tipo}
                                onChange={(_e, val) => setSocioForm(p => ({ ...p, documento_tipo: val }))}
                                options={DOC_TIPO_OPTIONS}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Número de Documento</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej. 70000001"
                                value={socioForm.documento_numero}
                                onChange={(e) => setSocioForm(p => ({ ...p, documento_numero: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="treasury-form-row">
                        <div className="form-group">
                            <label className="form-label">% Participación Accionaria</label>
                            <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                placeholder="Ej. 50.00"
                                value={socioForm.porcentaje_participacion}
                                onChange={(e) => setSocioForm(p => ({ ...p, porcentaje_participacion: e.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Teléfono</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej. 987654321"
                                value={socioForm.telefono}
                                onChange={(e) => setSocioForm(p => ({ ...p, telefono: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Correo Electrónico</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="socio@afinixlab.com"
                            value={socioForm.email}
                            onChange={(e) => setSocioForm(p => ({ ...p, email: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
