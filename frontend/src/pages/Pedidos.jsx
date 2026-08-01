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
        <div className="animate-fade-in pedidos-tracking">
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
                    <i className="bi bi-plus-lg" aria-hidden="true"></i> {isClient ? 'Pedir' : 'Nuevo Pedido'}
                </button>
            </div>

            {showApprovalCue ? (
                <div className="pedidos-approval-cue" role="status">
                    <div className="pedidos-approval-cue-copy">
                        <span className="pedidos-stat-icon" aria-hidden="true">
                            <i className="bi bi-check2-square"></i>
                        </span>
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

            <section className="pedidos-toolbar card" aria-label="Buscar y filtrar pedidos">
                <div className="pedidos-toolbar-row">
                    <div className="search-box pedidos-search">
                        <i className="bi bi-search" aria-hidden="true"></i>
                        <input
                            className="form-input"
                            placeholder={isClient ? 'Buscar por código o paciente...' : 'Buscar por código, paciente o clínica...'}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="pedidos-status-filters" role="group" aria-label="Filtrar por estado">
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
            </section>

            <section className="pedidos-list-panel card" aria-label="Listado de pedidos">
                {loading ? (
                    <div className="pedidos-skeleton-list">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="skeleton pedidos-skeleton-row" />
                        ))}
                    </div>
                ) : pedidos.length === 0 ? (
                    <div className="empty-state">
                        <i className="bi bi-clipboard2 empty-state-icon" aria-hidden="true"></i>
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
                                onClick={() => navigate(isClient ? '/catalogo' : '/pedidos/nuevo')}
                            >
                                <i className="bi bi-plus-lg" aria-hidden="true"></i> {isClient ? 'Ir a Pedir' : 'Crear Pedido'}
                            </button>
                        )}
                    </div>
                ) : (
                    <ul className="pedidos-order-list">
                        {pedidos.map((p) => {
                            const needsReview = isClient && p.estado === 'esperando_aprobacion';
                            return (
                                <li key={p.id}>
                                    <button
                                        type="button"
                                        className={`pedidos-order-card${needsReview ? ' is-attention' : ''}`}
                                        onClick={() => navigate(`/pedidos/${p.id}`)}
                                    >
                                        <span className="pedidos-stat-icon" aria-hidden="true">
                                            <i className={`bi ${needsReview ? 'bi-check2-square' : 'bi-clipboard2-pulse'}`}></i>
                                        </span>
                                        <span className="pedidos-order-main">
                                            <span className="pedidos-order-top">
                                                <strong className="pedidos-order-code">{p.codigo}</strong>
                                                <span className={`badge badge-dot badge-${p.estado}`}>
                                                    {getOrderStatusLabel(p.estado, { forClient: isClient })}
                                                </span>
                                            </span>
                                            <span className="pedidos-order-meta">
                                                <span>{p.paciente_nombre}</span>
                                                {!isClient && p.clinica_nombre ? (
                                                    <span>· {p.clinica_nombre}</span>
                                                ) : null}
                                            </span>
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
                                                {needsReview ? 'Revisar diseño' : 'Ver detalle'}
                                                <i className="bi bi-chevron-right" aria-hidden="true"></i>
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default Pedidos;
