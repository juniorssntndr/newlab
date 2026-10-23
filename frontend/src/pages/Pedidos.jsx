import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOrdersListQuery } from '../modules/orders/queries/useOrdersListQuery.js';
import { isClientRole, isTechnicianRole, isVisitorRole } from '../utils/accessControl.js';
import { getOrderStatusLabel, ORDER_STATUS_FLOW } from '../utils/orderStatusLabels.js';
import OrderProductThumb from '../components/orders/OrderProductThumb.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import { sortTeethByArchOrder } from '../utils/odontograma.js';
import { fetchVisibleCatalog } from '../modules/orders/catalog/visibleCatalogCache.js';

const MAX_TEETH_PREVIEW = 4;

const orderStatusColorMap = {
    pendiente: '#f59e0b',
    en_diseno: '#8b5cf6',
    esperando_aprobacion: '#06b6d4',
    en_produccion: '#3b82f6',
    terminado: '#10b981',
    enviado: '#64748b'
};

const Pedidos = () => {
    const { user, getHeaders } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const isClient = isClientRole(user);
    const isTechnician = isTechnicianRole(user);
    const canCreateOrders = !isTechnician && !isVisitorRole(user);
    const estadoParam = searchParams.get('estado') || '';
    const filtroParam = searchParams.get('filtro') || '';
    const isSpecialState = estadoParam === 'retrasados' || estadoParam === 'entregas_hoy';
    const initialFiltroOperativo = filtroParam || (isSpecialState ? estadoParam : '');
    const initialFiltroEstado = isSpecialState ? '' : estadoParam;

    const [filtroEstado, setFiltroEstado] = useState(initialFiltroEstado);
    const [filtroOperativo, setFiltroOperativo] = useState(initialFiltroOperativo);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const currentEstado = searchParams.get('estado') || '';
        const currentFiltro = searchParams.get('filtro') || '';
        if (currentEstado === 'retrasados' || currentEstado === 'entregas_hoy') {
            setFiltroOperativo(currentEstado);
            setFiltroEstado('');
        } else {
            setFiltroEstado(currentEstado);
            setFiltroOperativo(currentFiltro);
        }
    }, [searchParams]);

    // Prefetch catálogo para lab: Nuevo Pedido abre sin flash vacío.
    useEffect(() => {
        if (isClient) return undefined;
        let cancelled = false;
        void fetchVisibleCatalog(getHeaders).catch(() => {
            if (cancelled) return;
        });
        return () => {
            cancelled = true;
        };
    }, [getHeaders, isClient]);

    const prefetchCatalog = useCallback(() => {
        if (isClient) return;
        void fetchVisibleCatalog(getHeaders);
    }, [getHeaders, isClient]);

    const goNewOrder = useCallback(() => {
        void fetchVisibleCatalog(getHeaders);
        navigate('/pedidos/nuevo');
    }, [getHeaders, navigate]);

    const filters = useMemo(() => ({
        estado: filtroEstado,
        filtro: filtroOperativo,
        search: debouncedSearch
    }), [filtroEstado, filtroOperativo, debouncedSearch]);

    const {
        data: pedidos = [],
        isLoading,
        isFetching,
        isError,
        refetch
    } = useOrdersListQuery({ filters });

    const pendingApprovalQuery = useOrdersListQuery({
        filters: { estado: 'esperando_aprobacion' },
        enabled: isClient,
    });
    const pendingApprovalCount = isClient && Array.isArray(pendingApprovalQuery.data)
        ? pendingApprovalQuery.data.length
        : 0;

    const loading = isLoading || isFetching;
    const estados = useMemo(() => {
        if (!isClient) return ['', ...ORDER_STATUS_FLOW];
        // Cliente: primero lo accionable / útil; "Recibido" al final.
        return [
            '',
            'esperando_aprobacion',
            'terminado',
            'en_produccion',
            'enviado',
            'en_diseno',
            'pendiente',
        ];
    }, [isClient]);

    const estadoOptions = useMemo(() => [
        { value: '', label: 'Todas las fases', icon: 'bi-grid' },
        ...estados.filter(Boolean).map((est) => ({
            value: est,
            label: getOrderStatusLabel(est, { forClient: isClient }),
            dotColor: orderStatusColorMap[est] || 'var(--color-primary)'
        }))
    ], [estados, isClient]);

    const setEstadoFilter = (estado) => {
        setFiltroEstado(estado);
        setFiltroOperativo('');
        if (estado) {
            setSearchParams({ estado });
        } else {
            setSearchParams({});
        }
    };

    const setOperativoFilter = (filtro) => {
        setFiltroOperativo(filtro);
        setFiltroEstado('');
        if (filtro) {
            setSearchParams({ filtro });
        } else {
            setSearchParams({});
        }
    };

    const formatDateShort = (value) => {
        if (!value) return '—';
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            const [y, m, d] = value.slice(0, 10).split('-').map(Number);
            const date = new Date(y, m - 1, d);
            return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    };

    const pageTitle = isClient ? 'Mis pedidos' : 'Gestión de pedidos';
    const showApprovalCue = isClient
        && pendingApprovalCount > 0
        && filtroEstado !== 'esperando_aprobacion';

    return (
        <div className="animate-fade-in pedidos-tracking page-container">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>
                        <i className="bi bi-clipboard2-pulse text-primary" aria-hidden="true"></i> {pageTitle}
                    </h1>
                </div>
                {canCreateOrders && (
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={goNewOrder}
                        onMouseEnter={prefetchCatalog}
                        onFocus={prefetchCatalog}
                    >
                        <i className="bi bi-plus-lg" aria-hidden="true"></i> {isClient ? 'Pedir' : 'Nuevo Pedido'}
                    </button>
                )}
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
                            aria-label="Buscar pedidos"
                            placeholder={isClient ? 'Buscar por código o paciente...' : 'Buscar por código, paciente o clínica...'}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Desktop Toolbar: Operative Filters outside + Custom Status Dropdown */}
                    <div className="pedidos-desktop-filters desktop-only">
                        {!isClient && (
                            <>
                                <button
                                    type="button"
                                    className={`btn btn-sm pedidos-filter-chip pedidos-chip-danger${filtroOperativo === 'retrasados' ? ' is-active' : ''}`}
                                    onClick={() => setOperativoFilter(filtroOperativo === 'retrasados' ? '' : 'retrasados')}
                                >
                                    <i className="bi bi-exclamation-octagon-fill" aria-hidden="true"></i>
                                    <span>Retrasados</span>
                                    {filtroOperativo === 'retrasados' && <span className="pedidos-chip-clear">✕</span>}
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm pedidos-filter-chip pedidos-chip-warning${filtroOperativo === 'entregas_hoy' ? ' is-active' : ''}`}
                                    onClick={() => setOperativoFilter(filtroOperativo === 'entregas_hoy' ? '' : 'entregas_hoy')}
                                >
                                    <i className="bi bi-calendar-check-fill" aria-hidden="true"></i>
                                    <span>Entregas hoy</span>
                                    {filtroOperativo === 'entregas_hoy' && <span className="pedidos-chip-clear">✕</span>}
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm pedidos-filter-chip${filtroOperativo === 'en_taller' ? ' is-active' : ''}`}
                                    onClick={() => setOperativoFilter(filtroOperativo === 'en_taller' ? '' : 'en_taller')}
                                >
                                    <i className="bi bi-gear-wide-connected" aria-hidden="true"></i>
                                    <span>En taller</span>
                                    {filtroOperativo === 'en_taller' && <span className="pedidos-chip-clear">✕</span>}
                                </button>
                            </>
                        )}

                        <div className="pedidos-custom-select-wrap">
                            <CustomSelect
                                value={filtroEstado}
                                onChange={(e, val) => setEstadoFilter(val || '')}
                                options={estadoOptions}
                                placeholder="Fase del trabajo"
                                size="sm"
                                variant="pill"
                                className="pedidos-desktop-status-select"
                                aria-label="Filtrar por fase del trabajo"
                            />
                        </div>
                    </div>

                    {/* Mobile: touch-sliding row */}
                    <div className="pedidos-status-filters-scroller mobile-only">
                        <div className="pedidos-status-filters" role="group" aria-label="Filtrar pedidos">
                            <button
                                type="button"
                                className={`btn btn-sm pedidos-filter-chip${!filtroEstado && !filtroOperativo ? ' is-active' : ''}`}
                                onClick={(e) => {
                                    setEstadoFilter('');
                                    setOperativoFilter('');
                                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                }}
                            >
                                Todos
                            </button>

                            {!isClient && (
                                <>
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip pedidos-chip-danger${filtroOperativo === 'retrasados' ? ' is-active' : ''}`}
                                        onClick={(e) => {
                                            setOperativoFilter(filtroOperativo === 'retrasados' ? '' : 'retrasados');
                                            e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                        }}
                                    >
                                        <i className="bi bi-exclamation-octagon-fill" aria-hidden="true"></i>
                                        <span>Retrasados</span>
                                        {filtroOperativo === 'retrasados' && <span className="pedidos-chip-clear">✕</span>}
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip pedidos-chip-warning${filtroOperativo === 'entregas_hoy' ? ' is-active' : ''}`}
                                        onClick={(e) => {
                                            setOperativoFilter(filtroOperativo === 'entregas_hoy' ? '' : 'entregas_hoy');
                                            e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                        }}
                                    >
                                        <i className="bi bi-calendar-check-fill" aria-hidden="true"></i>
                                        <span>Entregas hoy</span>
                                        {filtroOperativo === 'entregas_hoy' && <span className="pedidos-chip-clear">✕</span>}
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${filtroOperativo === 'en_taller' ? ' is-active' : ''}`}
                                        onClick={(e) => {
                                            setOperativoFilter(filtroOperativo === 'en_taller' ? '' : 'en_taller');
                                            e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                        }}
                                    >
                                        <i className="bi bi-gear-wide-connected" aria-hidden="true"></i>
                                        <span>En taller</span>
                                        {filtroOperativo === 'en_taller' && <span className="pedidos-chip-clear">✕</span>}
                                    </button>
                                </>
                            )}

                            {estados.filter(Boolean).map((est) => (
                                <button
                                    key={est}
                                    type="button"
                                    className={`btn btn-sm pedidos-filter-chip${filtroEstado === est ? ' is-active' : ''}`}
                                    onClick={(e) => {
                                        setEstadoFilter(filtroEstado === est ? '' : est);
                                        e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                    }}
                                >
                                    <span
                                        className="pedidos-filter-dot"
                                        style={{ backgroundColor: orderStatusColorMap[est] || 'var(--color-primary)' }}
                                        aria-hidden="true"
                                    />
                                    <span>{getOrderStatusLabel(est, { forClient: isClient })}</span>
                                    {filtroEstado === est && <span className="pedidos-chip-clear">✕</span>}
                                </button>
                            ))}
                        </div>
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
                ) : isError ? (
                    <div className="empty-state">
                        <i className="bi bi-exclamation-triangle empty-state-icon text-danger" aria-hidden="true"></i>
                        <h3 className="empty-state-title">Error al cargar pedidos</h3>
                        <p className="empty-state-text">No se pudieron recuperar los pedidos en este momento.</p>
                        <button type="button" className="btn btn-secondary" onClick={() => refetch()}>
                            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i> Reintentar
                        </button>
                    </div>
                ) : pedidos.length === 0 ? (
                    <div className="empty-state">
                        <i className="bi bi-clipboard2 empty-state-icon" aria-hidden="true"></i>
                        <h3 className="empty-state-title">
                            {filtroOperativo === 'retrasados' ? 'No hay pedidos retrasados'
                                : filtroOperativo === 'entregas_hoy' ? 'No hay entregas para hoy'
                                : filtroEstado === 'esperando_aprobacion' ? 'Nada por aprobar' : 'Sin pedidos'}
                        </h3>
                        <p className="empty-state-text">
                            {filtroOperativo === 'retrasados' ? '¡Excelente! Todo el taller está al día con los compromisos de entrega.'
                                : filtroOperativo === 'entregas_hoy' ? 'No hay trabajos programados con fecha de entrega de hoy.'
                                : filtroEstado === 'esperando_aprobacion'
                                ? 'Cuando el laboratorio envíe un diseño, aparecerá aquí.'
                                : (isClient ? 'Pide tu primer trabajo desde el catálogo' : 'Crea tu primer pedido para comenzar')}
                        </p>
                        {canCreateOrders && filtroEstado !== 'esperando_aprobacion' && !filtroOperativo && (
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={goNewOrder}
                                onMouseEnter={prefetchCatalog}
                                onFocus={prefetchCatalog}
                            >
                                <i className="bi bi-plus-lg" aria-hidden="true"></i> {isClient ? 'Ir a Pedir' : 'Crear Pedido'}
                            </button>
                        )}
                    </div>
                ) : (
                    <ul className="pedidos-order-list">
                        {pedidos.map((p) => {
                            const needsReview = isClient && p.estado === 'esperando_aprobacion';
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
                                        className={`pedidos-order-card${needsReview ? ' is-attention' : ''}`}
                                        onClick={() => navigate(`/pedidos/${p.id}`)}
                                        aria-label={`Pedido ${p.codigo}, paciente ${p.paciente_nombre || 'Sin paciente'}, fase ${getOrderStatusLabel(p.estado, { forClient: isClient })}${!isTechnician ? `, total S/. ${parseFloat(p.total ?? 0).toFixed(2)}` : ''}`}
                                    >
                                        <span className="pedidos-order-thumb" aria-hidden="true">
                                            {productName ? (
                                                <OrderProductThumb product={product} />
                                            ) : (
                                                <i className={`bi ${needsReview ? 'bi-check2-square' : 'bi-clipboard2-pulse'}`}></i>
                                            )}
                                        </span>
                                        <span className="pedidos-order-main">
                                            <span className="pedidos-order-top">
                                                <strong className="pedidos-order-patient">
                                                    {p.paciente_nombre || 'Sin paciente'}
                                                </strong>
                                                <span className={`badge badge-dot badge-${p.estado}`}>
                                                    {getOrderStatusLabel(p.estado, { forClient: isClient })}
                                                </span>
                                            </span>
                                            <span className="pedidos-order-meta">
                                                <span className="pedidos-order-code">{p.codigo}</span>
                                                {!isClient && p.clinica_nombre ? (
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
                                            {!isTechnician && (
                                                <strong className="pedidos-order-total">
                                                    S/. {parseFloat(p.total ?? 0).toFixed(2)}
                                                </strong>
                                            )}
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
