import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOrdersListQuery } from '../modules/orders/queries/useOrdersListQuery.js';
import { isClientRole } from '../utils/accessControl.js';
import { getOrderStatusLabel, ORDER_STATUS_FLOW } from '../utils/orderStatusLabels.js';

const Pedidos = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const isClient = isClientRole(user);
    const estadoFromUrl = searchParams.get('estado') || '';

    const [filtroEstado, setFiltroEstado] = useState(estadoFromUrl);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setFiltroEstado(estadoFromUrl);
    }, [estadoFromUrl]);

    const filters = useMemo(() => ({
        estado: filtroEstado,
        search
    }), [filtroEstado, search]);

    const {
        data: pedidos = [],
        isLoading,
        isFetching
    } = useOrdersListQuery({ filters });

    const pendingApprovalQuery = useOrdersListQuery({
        filters: { estado: 'esperando_aprobacion' },
        enabled: isClient,
    });
    const pendingApprovalCount = isClient && Array.isArray(pendingApprovalQuery.data)
        ? pendingApprovalQuery.data.length
        : 0;

    const loading = isLoading || isFetching;
    const estados = ['', ...ORDER_STATUS_FLOW];

    const setEstadoFilter = (estado) => {
        setFiltroEstado(estado);
        if (estado) {
            setSearchParams({ estado });
        } else {
            setSearchParams({});
        }
    };

    const formatDateShort = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    };

    const pageTitle = isClient ? 'Mis pedidos' : 'Cola de pedidos';
    const pageSubtitle = isClient
        ? (filtroEstado === 'esperando_aprobacion'
            ? 'Diseños que esperan tu visto bueno'
            : 'Sigue el avance de tus trabajos')
        : 'Gestión y seguimiento de trabajos dentales';
    const showApprovalCue = isClient
        && pendingApprovalCount > 0
        && filtroEstado !== 'esperando_aprobacion';

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>{pageTitle}</h1>
                    <p>{pageSubtitle}</p>
                </div>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(isClient ? '/catalogo' : '/pedidos/nuevo')}
                >
                    <i className="bi bi-plus-lg"></i> {isClient ? 'Pedir' : 'Nuevo Pedido'}
                </button>
            </div>

            {showApprovalCue ? (
                <div className="pedidos-approval-cue" role="status">
                    <div className="pedidos-approval-cue-copy">
                        <i className="bi bi-check2-square" aria-hidden="true"></i>
                        <div>
                            <strong>
                                {pendingApprovalCount === 1
                                    ? 'Tienes 1 diseño por aprobar'
                                    : `Tienes ${pendingApprovalCount} diseños por aprobar`}
                            </strong>
                            <p>Revísalos para que el laboratorio pueda continuar.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setEstadoFilter('esperando_aprobacion')}
                    >
                        Ver por aprobar
                    </button>
                </div>
            ) : null}

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
                        <i className="bi bi-search"></i>
                        <input
                            className="form-input"
                            placeholder={isClient ? 'Buscar por código o paciente...' : 'Buscar por código, paciente o clínica...'}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="pedidos-status-filters" style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                        {estados.map((e) => {
                            const isApprovalChip = e === 'esperando_aprobacion';
                            const showChipBadge = isClient && isApprovalChip && pendingApprovalCount > 0;
                            return (
                                <button
                                    key={e || 'all'}
                                    type="button"
                                    className={[
                                        'btn',
                                        'btn-sm',
                                        filtroEstado === e ? 'btn-primary' : 'btn-ghost',
                                        showChipBadge && filtroEstado !== e ? 'pedidos-filter-chip is-attention' : '',
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => setEstadoFilter(e)}
                                >
                                    {e ? getOrderStatusLabel(e, { forClient: isClient }) : 'Todos'}
                                    {showChipBadge ? (
                                        <span className="pedidos-filter-badge" aria-hidden="true">
                                            {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div>{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}</div>
                ) : pedidos.length === 0 ? (
                    <div className="empty-state">
                        <i className="bi bi-clipboard2 empty-state-icon"></i>
                        <h3 className="empty-state-title">
                            {filtroEstado === 'esperando_aprobacion' ? 'Nada por aprobar' : 'Sin pedidos'}
                        </h3>
                        <p className="empty-state-text">
                            {filtroEstado === 'esperando_aprobacion'
                                ? 'Cuando el laboratorio envíe un diseño, aparecerá aquí.'
                                : (isClient ? 'Pide tu primer trabajo desde el catálogo' : 'Crea tu primer pedido para comenzar')}
                        </p>
                        {filtroEstado !== 'esperando_aprobacion' && (
                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ marginTop: 'var(--space-4)' }}
                                onClick={() => navigate(isClient ? '/catalogo' : '/pedidos/nuevo')}
                            >
                                <i className="bi bi-plus-lg"></i> {isClient ? 'Ir a Pedir' : 'Crear Pedido'}
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="data-table-wrapper desktop-only" style={{ border: 'none' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Paciente</th>
                                        {!isClient && <th>Clínica</th>}
                                        <th>Estado</th>
                                        <th>Fecha</th>
                                        <th>Entrega</th>
                                        <th>Total</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedidos.map((p) => (
                                        <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/pedidos/${p.id}`)}>
                                            <td><strong style={{ fontFamily: 'var(--font-mono)' }}>{p.codigo}</strong></td>
                                            <td>{p.paciente_nombre}</td>
                                            {!isClient && <td>{p.clinica_nombre}</td>}
                                            <td>
                                                <span className={`badge badge-dot badge-${p.estado}`}>
                                                    {getOrderStatusLabel(p.estado, { forClient: isClient })}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDateShort(p.fecha || p.created_at)}</td>
                                            <td style={{ fontSize: '0.8125rem' }}>{formatDateShort(p.fecha_entrega)}</td>
                                            <td><strong>S/. {parseFloat(p.total ?? 0).toFixed(2)}</strong></td>
                                            <td>
                                                <button type="button" className="btn btn-ghost btn-sm btn-icon" title="Ver detalle">
                                                    <i className="bi bi-chevron-right"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mobile-cards mobile-only">
                            {pedidos.map((p) => (
                                <div key={p.id} className="mobile-card" onClick={() => navigate(`/pedidos/${p.id}`)} style={{ cursor: 'pointer' }}>
                                    <div className="mobile-card-head">
                                        <div className="mobile-card-title">{p.codigo}</div>
                                        <span className={`badge badge-dot badge-${p.estado}`}>
                                            {getOrderStatusLabel(p.estado, { forClient: isClient })}
                                        </span>
                                    </div>
                                    <div className="mobile-card-grid">
                                        <div className="mobile-field"><span className="mobile-field-label">Paciente</span><span className="mobile-field-value">{p.paciente_nombre}</span></div>
                                        {!isClient && (
                                            <div className="mobile-field"><span className="mobile-field-label">Clinica</span><span className="mobile-field-value">{p.clinica_nombre}</span></div>
                                        )}
                                        <div className="mobile-field"><span className="mobile-field-label">Fecha</span><span className="mobile-field-value">{formatDateShort(p.fecha || p.created_at)}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Entrega</span><span className="mobile-field-value">{formatDateShort(p.fecha_entrega)}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Total</span><span className="mobile-field-value"><strong>S/. {parseFloat(p.total ?? 0).toFixed(2)}</strong></span></div>
                                    </div>
                                    <div className="mobile-card-actions">
                                        <button type="button" className="btn btn-ghost btn-sm">
                                            {p.estado === 'esperando_aprobacion' && isClient ? 'Revisar diseño' : 'Ver detalle'}
                                            {' '}<i className="bi bi-chevron-right"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Pedidos;
