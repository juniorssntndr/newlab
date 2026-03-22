import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config.js';
import Modal from '../components/Modal.jsx';
import OdontogramaInteractive from '../components/OdontogramaInteractive.jsx';
import { useCreateOrderMutation } from '../modules/orders/mutations/useCreateOrderMutation.js';
import OrderClinicalPanel from '../components/orders/OrderClinicalPanel.jsx';
import OrderComposerLayout from '../components/orders/OrderComposerLayout.jsx';
import OrderPricingSummary from '../components/orders/OrderPricingSummary.jsx';
import { useOrderComposerState } from '../modules/orders/composer/useOrderComposerState.js';
import { normalizeOrderItem } from '../modules/orders/composer/orderItemNormalizer.js';

// Derive backend base for local /uploads/ paths (strips trailing /api segment)
const BACKEND_BASE = API_URL.endsWith('/api')
    ? API_URL.slice(0, -4)
    : API_URL.startsWith('http') ? API_URL : '';

const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    // Local path like /uploads/... — serve from backend origin
    return `${BACKEND_BASE}${imageUrl}`;
};

const Skeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
        {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ borderRadius: '16px', height: '280px' }} />
        ))}
    </div>
);

const createQuickComposerItemId = (productId) => {
    return `quick-item-${productId}-${Date.now()}`;
};

const CatalogoCliente = () => {
    const { getHeaders, user } = useAuth();
    const navigate = useNavigate();
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCat, setSelectedCat] = useState('all');
    const [search, setSearch] = useState('');

    // Quick-order modal
    const [orderProduct, setOrderProduct] = useState(null);
    const [orderMeta, setOrderMeta] = useState({
        paciente_nombre: '',
        fecha_entrega: '',
        es_urgente: false
    });
    const [orderSaving, setOrderSaving] = useState(false);
    const [orderError, setOrderError] = useState('');
    const createOrderMutation = useCreateOrderMutation();
    const {
        items,
        total,
        selectedItem,
        ui,
        replaceItems,
        selectItem,
        updateItemField,
        updateDentalSelection,
        setMobileStep
    } = useOrderComposerState();

    const calculateDeliveryDate = (product, isUrgent) => {
        const baseDays = product?.tiempo_estimado_dias || 5;
        const days = isUrgent ? Math.max(1, Math.floor(baseDays / 2)) : baseDays; 
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + days);
        return deliveryDate.toISOString().split('T')[0];
    };

    const openOrder = (producto) => {
        const nextItem = normalizeOrderItem({
            id: createQuickComposerItemId(producto.id),
            product: producto,
            producto_id: producto.id,
            nombre: producto.nombre,
            precio_unitario: parseFloat(producto.precio_base),
            material: producto.material_nombre || '',
            color_vita: '',
            notas: '',
            cantidadManual: 1,
            piezas_dentales: [],
            es_puente: false,
            pieza_inicio: null,
            pieza_fin: null
        });

        setOrderProduct(producto);
        replaceItems([nextItem]);
        selectItem(nextItem.id);
        setMobileStep(1);
        setOrderMeta({
            paciente_nombre: '',
            fecha_entrega: calculateDeliveryDate(producto, false),
            es_urgente: false
        });
        setOrderError('');
    };

    const closeOrder = () => {
        setOrderProduct(null);
        replaceItems([]);
        selectItem(null);
        setMobileStep(1);
        setOrderError('');
    };

    const activeOrderItem = selectedItem || items[0] || null;
    const resolvedCantidad = activeOrderItem?.cantidad || 0;
    const urgentSurcharge = orderMeta.es_urgente
        ? Number(activeOrderItem?.precio_unitario || orderProduct?.precio_base || 0) * 0.25 * resolvedCantidad
        : 0;
    const totalAprox = total + urgentSurcharge;

    const isOrderReady = !!orderMeta.paciente_nombre
        && !!orderMeta.fecha_entrega
        && (
            activeOrderItem
            ? (!activeOrderItem.requiresDentalSelection || activeOrderItem.piezas_dentales.length > 0)
            : false
        );

    const handleOrderSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!orderMeta.paciente_nombre || !orderMeta.fecha_entrega) {
            setOrderError('Completa el nombre del paciente y la fecha de entrega.');
            return;
        }
        if (activeOrderItem?.requiresDentalSelection && !(activeOrderItem.piezas_dentales || []).length) {
            setOrderError('Selecciona al menos una pieza dental en el odontograma.');
            return;
        }
        setOrderSaving(true);
        setOrderError('');
        try {
            const data = await createOrderMutation.mutateAsync({
                clinica_id: user.clinica_id,
                paciente_nombre: orderMeta.paciente_nombre,
                fecha_entrega: orderMeta.fecha_entrega,
                observaciones: '',
                items: activeOrderItem
                    ? [{ ...activeOrderItem, es_urgente: orderMeta.es_urgente }]
                    : []
            });
            navigate(`/pedidos/${data.id}`);
        } catch (err) {
            setOrderError(err.message);
            setOrderSaving(false);
        } finally {
            setOrderSaving(false);
        }
    };

    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/productos?visible=true&activo=true`, { headers: getHeaders() }).then(r => r.json()),
            fetch(`${API_URL}/categorias`, { headers: getHeaders() }).then(r => r.json()),
        ])
            .then(([prods, cats]) => {
                setProductos(Array.isArray(prods) ? prods : []);
                setCategorias(Array.isArray(cats) ? cats : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        return productos.filter(p => {
            const matchCat = selectedCat === 'all' || String(p.categoria_id) === String(selectedCat);
            const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase()) ||
                (p.descripcion || '').toLowerCase().includes(search.toLowerCase());
            return matchCat && matchSearch;
        });
    }, [productos, selectedCat, search]);

    // Group by category for display
    const grouped = useMemo(() => {
        if (selectedCat !== 'all') {
            return [{ nombre: categorias.find(c => String(c.id) === String(selectedCat))?.nombre || 'Categoría', items: filtered }];
        }
        const map = {};
        filtered.forEach(p => {
            const key = p.categoria_nombre || 'Sin categoría';
            if (!map[key]) map[key] = [];
            map[key].push(p);
        });
        return Object.entries(map).map(([nombre, items]) => ({ nombre, items }));
    }, [filtered, selectedCat, categorias]);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Catálogo de Servicios</h1>
                    <p>Todos los trabajos y restauraciones que ofrecemos</p>
                </div>
            </div>

            {/* Search and filter bar */}
            <div className="catalog-search-filter-container">
                <div className="catalog-search-wrapper">
                    <i className="bi bi-search" style={{
                        position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--color-text-secondary)', pointerEvents: 'none'
                    }} />
                    <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: '2.5rem' }}
                        placeholder="Buscar producto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="catalog-filters-scrollable">
                    <button
                        onClick={() => setSelectedCat('all')}
                        className={`btn ${selectedCat === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '999px', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                        Todos
                    </button>
                    {categorias.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCat(String(cat.id))}
                            className={`btn ${String(selectedCat) === String(cat.id) ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '999px', whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                            {cat.nombre}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Skeleton />
            ) : filtered.length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <i className="bi bi-box-seam" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }} />
                    <h3>No se encontraron productos</h3>
                    <p>Intenta buscar con otros términos o selecciona otra categoría.</p>
                </div>
            ) : (
                grouped.map(group => (
                    <div key={group.nombre} style={{ marginBottom: '2.5rem' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            marginBottom: '1.25rem', paddingBottom: '0.75rem',
                            borderBottom: '2px solid var(--color-border)'
                        }}>
                            <div style={{
                                width: '4px', height: '24px', borderRadius: '2px',
                                background: 'var(--color-primary)'
                            }} />
                            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700' }}>{group.nombre}</h2>
                            <span style={{
                                background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)',
                                borderRadius: '999px', padding: '0.1rem 0.6rem',
                                fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: '500'
                            }}>
                                {group.items.length} producto{group.items.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                            gap: '1.25rem'
                        }}>
                            {group.items.map(producto => (
                                <ProductCard key={producto.id} producto={producto} resolveImageUrl={resolveImageUrl} onOrder={() => openOrder(producto)} />
                            ))}
                        </div>
                    </div>
                ))
            )}

            {/* ── Quick-Order Modal ── */}
            <Modal
                open={!!orderProduct}
                onClose={closeOrder}
                title="Solicitar Pedido"
                size="2xl"
                className="order-composer-modal"
                bodyClassName="order-composer-modal-body"
                footer={(
                    <>
                        <button type="button" className={`btn btn-ghost ${ui.mobileStep === 2 ? 'hide-on-mobile' : ''}`} onClick={closeOrder}>
                            Cancelar
                        </button>
                        <button type="button" className={`btn btn-ghost hide-on-desktop ${ui.mobileStep === 1 ? 'hide-on-mobile' : ''}`} onClick={() => setMobileStep(1)}>
                            Atrás
                        </button>
                        <button type="button" className={`btn btn-primary hide-on-desktop ${ui.mobileStep === 2 ? 'hide-on-mobile' : ''}`} disabled={!isOrderReady} onClick={() => setMobileStep(2)}>
                            Siguiente
                        </button>
                        <button type="submit" form="orderForm" className={`btn btn-primary ${ui.mobileStep === 1 ? 'hide-on-mobile' : ''}`} disabled={orderSaving || !isOrderReady}>
                            {orderSaving ? (
                                <><i className="bi bi-hourglass-split" /> Creando...</>
                            ) : (
                                <><i className="bi bi-bag-check" /> Solicitar Pedido</>
                            )}
                        </button>
                    </>
                )}
            >
                {orderProduct && (
                    <form id="orderForm" onSubmit={handleOrderSubmit} className="order-composer-modal-form">
                        {orderError && (
                            <div className="login-error order-composer-error-banner">
                                <i className="bi bi-exclamation-circle"></i> {orderError}
                            </div>
                        )}

                        <OrderComposerLayout
                            mobileStep={ui.mobileStep}
                            onMobileStepChange={setMobileStep}
                            disableClinicalStep={!activeOrderItem}
                            leftPane={(
                                <section className="order-composer-catalog-pane quick-order-left-pane">
                                    <article className="card order-composer-item-focus-card order-composer-item-focus-card-premium">
                                        <div className="order-composer-item-focus-media" aria-hidden="true">
                                            {orderProduct.image_url ? (
                                                <img
                                                    src={resolveImageUrl(orderProduct.image_url)}
                                                    alt={orderProduct.nombre}
                                                    loading="lazy"
                                                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <i className="bi bi-gem"></i>
                                            )}
                                        </div>

                                        <div className="order-composer-item-focus-main">
                                            <p className="order-composer-item-focus-kicker">Producto seleccionado</p>
                                            <h3>{orderProduct.nombre}</h3>
                                            {orderProduct.material_nombre && (
                                                <p className="order-composer-selected-meta">Material: {orderProduct.material_nombre}</p>
                                            )}
                                        </div>

                                        <div className="order-composer-item-focus-aside">
                                            <p className="order-composer-item-focus-price">S/. {Number(orderProduct.precio_base || 0).toFixed(2)}</p>
                                        </div>
                                    </article>

                                    <article className="card">
                                        <h6 className="order-composer-section-title"><i className="bi bi-person-lines-fill"></i> Datos Administrativos</h6>
                                        <div className="order-composer-fields-grid">
                                            <div className="form-group order-composer-field-reset">
                                                <label className="form-label">Nombre del Paciente *</label>
                                                <input
                                                    className="form-input"
                                                    placeholder="Nombre completo"
                                                    value={orderMeta.paciente_nombre}
                                                    onChange={(event) => setOrderMeta((prev) => ({ ...prev, paciente_nombre: event.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group order-composer-field-reset">
                                                <label className="form-label">Fecha de Entrega Estimada</label>
                                                <input
                                                    className="form-input"
                                                    type="date"
                                                    value={orderMeta.fecha_entrega}
                                                    readOnly
                                                    disabled
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className={`btn ${orderMeta.es_urgente ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                                            style={{ width: '100%', marginTop: 'var(--space-3)' }}
                                            onClick={() => {
                                                const nextUrgente = !orderMeta.es_urgente;
                                                setOrderMeta((prev) => ({
                                                    ...prev,
                                                    es_urgente: nextUrgente,
                                                    fecha_entrega: calculateDeliveryDate(orderProduct, nextUrgente)
                                                }));
                                            }}
                                        >
                                            <i className="bi bi-lightning-charge"></i>
                                            {orderMeta.es_urgente ? 'Pedido Express activo' : 'Solicitar como Pedido Express'}
                                        </button>
                                    </article>

                                    {activeOrderItem && (
                                        <OrderClinicalPanel
                                            form={activeOrderItem}
                                            resolvedCantidad={resolvedCantidad}
                                            requiresDentalSelection={activeOrderItem.requiresDentalSelection}
                                            showDerivedFields={false}
                                            onColorChange={(color_vita) => updateItemField(activeOrderItem.id, 'color_vita', color_vita)}
                                            onNotesChange={(notas) => updateItemField(activeOrderItem.id, 'notas', notas)}
                                        />
                                    )}

                                    {activeOrderItem && (
                                        <OrderPricingSummary
                                            item={activeOrderItem}
                                            total={totalAprox}
                                            title="Resumen del caso"
                                            showItemSubtotal={false}
                                            extraCharge={urgentSurcharge}
                                            extraChargeLabel="Recargo Express (+25%)"
                                        />
                                    )}
                                </section>
                            )}
                            rightPane={activeOrderItem ? (
                                <section className="quick-order-odonto-pane">
                                    <div className="order-composer-odontograma-slot quick-order-odonto-slot">
                                        {activeOrderItem.requiresDentalSelection ? (
                                            <OdontogramaInteractive
                                                product={activeOrderItem.product || orderProduct}
                                                selection={activeOrderItem}
                                                onChange={(dentalData) => updateDentalSelection(activeOrderItem.id, dentalData)}
                                                title="Selecciona las piezas del caso"
                                                showSidePanel={false}
                                                showProductPill={false}
                                                showHeader={false}
                                            />
                                        ) : (
                                            <article className="card order-composer-empty-clinical">
                                                <i className="bi bi-info-circle"></i>
                                                <h3>Este producto no requiere odontograma</h3>
                                                <p>Podes editar cantidad, color y notas desde la columna izquierda.</p>
                                            </article>
                                        )}
                                    </div>
                                </section>
                            ) : null}
                        />
                    </form>
                )}
            </Modal>
        </div>
    );
};

const ProductCard = React.memo(({ producto, resolveImageUrl, onOrder }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div
            className="card"
            style={{
                padding: 0, overflow: 'hidden', borderRadius: '16px',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'default'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '';
            }}
        >
            {/* Image / placeholder */}
            <div style={{
                height: '160px', overflow: 'hidden',
                background: 'linear-gradient(135deg, var(--color-bg-alt) 0%, var(--color-surface) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative'
            }}>
                {producto.image_url && !imgError ? (
                    <img
                        src={resolveImageUrl(producto.image_url)}
                        alt={producto.nombre}
                        onError={() => setImgError(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <i className="bi bi-gem" style={{ fontSize: '2.5rem', opacity: 0.4 }} />
                    </div>
                )}
                {/* Category badge */}
                {producto.categoria_nombre && (
                    <span style={{
                        position: 'absolute', top: '0.75rem', right: '0.75rem',
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                        color: '#fff', fontSize: '0.7rem', fontWeight: '600',
                        padding: '0.2rem 0.6rem', borderRadius: '999px'
                    }}>
                        {producto.categoria_nombre}
                    </span>
                )}
            </div>

            {/* Content */}
            <div style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: '700' }}>
                    {producto.nombre}
                </h3>
                {producto.material_nombre && (
                    <p style={{
                        margin: '0 0 0.5rem 0', fontSize: '0.8rem',
                        color: 'var(--color-primary)', fontWeight: '600',
                        display: 'flex', alignItems: 'center', gap: '0.3rem'
                    }}>
                        <i className="bi bi-layers" style={{ fontSize: '0.75rem' }} />
                        {producto.material_nombre}
                    </p>
                )}
                {producto.descripcion && (
                    <p style={{
                        margin: '0 0 1rem 0', fontSize: '0.825rem',
                        color: 'var(--color-text-secondary)', lineHeight: '1.4',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                        {producto.descripcion}
                    </p>
                )}

                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)'
                }}>
                    <div>
                        {producto.precio_base > 0 && (
                            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                                S/. {Number(producto.precio_base).toFixed(2)}
                            </div>
                        )}
                    </div>
                    {producto.tiempo_estimado_dias && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            fontSize: '0.78rem', color: 'var(--color-text-secondary)',
                            background: 'var(--color-bg-alt)', padding: '0.2rem 0.6rem',
                            borderRadius: '999px', border: '1px solid var(--color-border)'
                        }}>
                            <i className="bi bi-clock" />
                            {producto.tiempo_estimado_dias} día{producto.tiempo_estimado_dias !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                <button
                    onClick={onOrder}
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '0.85rem', fontSize: '0.875rem', gap: '0.4rem' }}
                >
                    <i className="bi bi-bag-plus" /> Solicitar Pedido
                </button>
            </div>
        </div>
    );
});

export default CatalogoCliente;
