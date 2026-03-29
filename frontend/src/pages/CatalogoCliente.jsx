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
    <div className="catalog-products-grid">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton catalog-product-skeleton" />
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
                    <i className="bi bi-search catalog-search-icon" />
                    <input
                        type="text"
                        className="form-input catalog-search-input"
                        placeholder="Buscar producto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="catalog-filters-scrollable">
                    <button
                        onClick={() => setSelectedCat('all')}
                        className={`btn ${selectedCat === 'all' ? 'btn-primary' : 'btn-ghost'} catalog-filter-chip`}
                    >
                        Todos
                    </button>
                    {categorias.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCat(String(cat.id))}
                            className={`btn ${String(selectedCat) === String(cat.id) ? 'btn-primary' : 'btn-ghost'} catalog-filter-chip`}
                        >
                            {cat.nombre}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Skeleton />
            ) : filtered.length === 0 ? (
                <div className="catalog-empty-state">
                    <i className="bi bi-box-seam catalog-empty-state-icon" />
                    <h3>No se encontraron productos</h3>
                    <p>Intenta buscar con otros términos o selecciona otra categoría.</p>
                </div>
            ) : (
                grouped.map(group => (
                    <div key={group.nombre} className="catalog-group">
                        <div className="catalog-group-header">
                            <div className="catalog-group-accent" />
                            <h2 className="catalog-group-title">{group.nombre}</h2>
                            <span className="catalog-group-count">
                                {group.items.length} producto{group.items.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="catalog-products-grid">
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

                                    <article className="card catalog-order-admin-card">
                                        <h6 className="order-composer-section-title"><i className="bi bi-person-lines-fill"></i> Datos Administrativos</h6>
                                        <div className="order-composer-fields-grid catalog-order-admin-grid">
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

                                        <div className={`nuevo-pedido-express-toggle-wrapper catalog-order-express-wrapper ${orderMeta.es_urgente ? 'is-express' : ''}`}>
                                            <i className={orderMeta.es_urgente ? 'bi bi-lightning-charge-fill' : 'bi bi-lightning-charge'}></i>
                                            <div className="nuevo-pedido-express-toggle-info">
                                                <strong>Pedido Express ⚡</strong>
                                                <p>Marca esta opcion si el trabajo requiere prioridad maxima en laboratorio.</p>
                                            </div>
                                            <div className="nuevo-pedido-express-switch">
                                                <input
                                                    type="checkbox"
                                                    id="expressOrderToggleCatalog"
                                                    className="toggle-switch-input"
                                                    checked={orderMeta.es_urgente}
                                                    onChange={(e) => {
                                                        const nextUrgente = e.target.checked;
                                                        setOrderMeta((prev) => ({
                                                            ...prev,
                                                            es_urgente: nextUrgente,
                                                            fecha_entrega: calculateDeliveryDate(orderProduct, nextUrgente)
                                                        }));
                                                    }}
                                                />
                                                <label htmlFor="expressOrderToggleCatalog" className="toggle-switch-label"></label>
                                            </div>
                                        </div>
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
        <div className="card catalog-product-card">
            {/* Image / placeholder */}
            <div className="catalog-product-card-media">
                {producto.image_url && !imgError ? (
                    <img
                        src={resolveImageUrl(producto.image_url)}
                        alt={producto.nombre}
                        onError={() => setImgError(true)}
                        className="catalog-product-card-image"
                    />
                ) : (
                    <div className="catalog-product-card-media-fallback">
                        <i className="bi bi-gem" />
                    </div>
                )}
                {/* Category badge */}
                {producto.categoria_nombre && (
                    <span className="catalog-product-card-category">
                        {producto.categoria_nombre}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="catalog-product-card-content">
                <h3 className="catalog-product-card-title">
                    {producto.nombre}
                </h3>
                {producto.material_nombre && (
                    <p className="catalog-product-card-material">
                        <i className="bi bi-layers" />
                        {producto.material_nombre}
                    </p>
                )}
                {producto.descripcion && (
                    <p className="catalog-product-card-description">
                        {producto.descripcion}
                    </p>
                )}

                <div className="catalog-product-card-footer">
                    <div>
                        {producto.precio_base > 0 && (
                            <div className="catalog-product-card-price">
                                S/. {Number(producto.precio_base).toFixed(2)}
                            </div>
                        )}
                    </div>
                    {producto.tiempo_estimado_dias && (
                        <div className="catalog-product-card-time">
                            <i className="bi bi-clock" />
                            {producto.tiempo_estimado_dias} día{producto.tiempo_estimado_dias !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                <button
                    onClick={onOrder}
                    className="btn btn-primary catalog-product-card-cta"
                >
                    <i className="bi bi-bag-plus" /> Solicitar Pedido
                </button>
            </div>
        </div>
    );
});

export default CatalogoCliente;
