import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config.js';
import Modal from '../components/Modal.jsx';
import OdontogramaInteractive from '../components/OdontogramaInteractive.jsx';
import { formatDentalSelection } from '../utils/odontograma.js';

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

const CatalogoCliente = () => {
    const { getHeaders, user } = useAuth();
    const navigate = useNavigate();
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCat, setSelectedCat] = useState('all');
    const [search, setSearch] = useState('');

    // Quick-order modal
    const [orderProduct, setOrderProduct] = useState(null); // product to order
    const [mobileOrderStep, setMobileOrderStep] = useState(1); // 1 = Odontograma, 2 = Resumen (Solo móviles)
    const [orderForm, setOrderForm] = useState({
        paciente_nombre: '',
        fecha_entrega: '',
        color_vita: '',
        notas: '',
        piezas_dentales: [],
        es_puente: false,
        pieza_inicio: null,
        pieza_fin: null,
        es_urgente: false
    });
    const [orderSaving, setOrderSaving] = useState(false);
    const [orderError, setOrderError] = useState('');

    const calculateDeliveryDate = (product, isUrgent) => {
        const baseDays = product?.tiempo_estimado_dias || 5;
        const days = isUrgent ? Math.max(1, Math.floor(baseDays / 2)) : baseDays; 
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + days);
        return deliveryDate.toISOString().split('T')[0];
    };

    const openOrder = (producto) => {
        setOrderProduct(producto);
        setMobileOrderStep(1);
        setOrderForm({
            paciente_nombre: '',
            fecha_entrega: calculateDeliveryDate(producto, false),
            color_vita: '',
            notas: '',
            piezas_dentales: [],
            es_puente: false,
            pieza_inicio: null,
            pieza_fin: null,
            es_urgente: false
        });
        setOrderError('');
    };

    const closeOrder = () => { setOrderProduct(null); setOrderError(''); };

    const isOrderReady = !!orderForm.paciente_nombre && !!orderForm.fecha_entrega && orderForm.piezas_dentales.length > 0;

    const handleOrderSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!orderForm.paciente_nombre || !orderForm.fecha_entrega) {
            setOrderError('Completa el nombre del paciente y la fecha de entrega.');
            return;
        }
        if (!orderForm.piezas_dentales.length) {
            setOrderError('Selecciona al menos una pieza dental en el odontograma.');
            return;
        }
        setOrderSaving(true);
        setOrderError('');
        try {
            const res = await fetch(`${API_URL}/pedidos`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    clinica_id: user.clinica_id,
                    paciente_nombre: orderForm.paciente_nombre,
                    fecha_entrega: orderForm.fecha_entrega,
                    observaciones: '',
                    items: [{
                        producto_id: orderProduct.id,
                        cantidad: 1,
                        precio_unitario: parseFloat(orderProduct.precio_base),
                        piezas_dentales: orderForm.piezas_dentales,
                        es_puente: orderForm.es_puente,
                        pieza_inicio: orderForm.pieza_inicio,
                        pieza_fin: orderForm.pieza_fin,
                        color_vita: orderForm.color_vita || '',
                        material: orderProduct.material_nombre || '',
                        notas: orderForm.notas || '',
                        es_urgente: orderForm.es_urgente
                    }]
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al crear pedido');
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
                className="order-modal-compact"
                bodyClassName="order-modal-compact-body"
                footer={(
                    <>
                        <button type="button" className={`btn btn-ghost ${mobileOrderStep === 2 ? 'hide-on-mobile' : ''}`} onClick={closeOrder}>
                            Cancelar
                        </button>
                        <button type="button" className={`btn btn-ghost hide-on-desktop ${mobileOrderStep === 1 ? 'hide-on-mobile' : ''}`} onClick={() => setMobileOrderStep(1)}>
                            Atrás
                        </button>
                        <button type="button" className={`btn btn-primary hide-on-desktop ${mobileOrderStep === 2 ? 'hide-on-mobile' : ''}`} onClick={() => setMobileOrderStep(2)}>
                            Siguiente
                        </button>
                        <button type="submit" form="orderForm" className={`btn btn-primary desktop-only-submit`} disabled={orderSaving || !isOrderReady}>
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
                    <form id="orderForm" onSubmit={handleOrderSubmit} className="order-modal-layout-v2">
                        <div className={`order-modal-bento-v2 modal-mobile-step-${mobileOrderStep}`}>

                            <aside className="order-modal-fields-v2">
                                <div className="order-modal-summary-v2 mobile-only-hide-step-1">
                                    {orderProduct.image_url ? (
                                        <img src={resolveImageUrl(orderProduct.image_url)} alt={orderProduct.nombre}
                                            style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                                            onError={e => { e.currentTarget.style.display = 'none'; }} />
                                    ) : (
                                        <div style={{
                                            width: 64, height: 64, borderRadius: 10, flexShrink: 0,
                                            background: 'var(--color-bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <i className="bi bi-gem" style={{ fontSize: '1.8rem', opacity: 0.3 }} />
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ fontWeight: '700', marginBottom: '0.2rem' }}>{orderProduct.nombre}</div>
                                        {orderProduct.material_nombre && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '0.2rem' }}>
                                                <i className="bi bi-layers" style={{ marginRight: '0.25rem' }} />{orderProduct.material_nombre}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                                                S/. {Number(orderProduct.precio_base).toFixed(2)}
                                            </span>
                                            {orderProduct.tiempo_estimado_dias && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                    <i className="bi bi-clock" /> {orderProduct.tiempo_estimado_dias} días
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {orderError && (
                                    <div className="order-modal-error-v2">
                                        <i className="bi bi-exclamation-circle" />{orderError}
                                    </div>
                                )}

                                <div className="order-form-section mobile-only-hide-step-2">
                                    <h6 className="order-section-title"><i className="bi bi-person-lines-fill"></i> Datos Administrativos</h6>
                                    
                                    <div className="order-fields-grid-v2">
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Nombre del Paciente *</label>
                                            <input className="form-input" placeholder="Nombre completo"
                                                value={orderForm.paciente_nombre}
                                                onChange={e => setOrderForm(f => ({ ...f, paciente_nombre: e.target.value }))} />
                                        </div>

                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Fecha de Entrega Estimada</label>
                                            <input className="form-input" type="date"
                                                value={orderForm.fecha_entrega}
                                                readOnly
                                                disabled
                                                style={{ backgroundColor: 'var(--color-bg-alt)', cursor: 'not-allowed', color: 'var(--color-text-secondary)', opacity: 0.8 }}
                                                onChange={() => {}} />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '0.75rem', padding: '0.6rem', background: orderForm.es_urgente ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-bg-alt)', border: `1px solid ${orderForm.es_urgente ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-border)'}`, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                                         onClick={() => {
                                             const newUrgente = !orderForm.es_urgente;
                                             setOrderForm(f => ({ 
                                                 ...f, 
                                                 es_urgente: newUrgente,
                                                 fecha_entrega: calculateDeliveryDate(orderProduct, newUrgente)
                                             }));
                                         }}>
                                        <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${orderForm.es_urgente ? 'var(--color-danger)' : 'var(--color-text-secondary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: orderForm.es_urgente ? 'var(--color-danger)' : 'transparent' }}>
                                            {orderForm.es_urgente && <i className="bi bi-check" style={{ color: 'white', fontSize: '1rem', marginTop: '1px' }}></i>}
                                        </div>
                                        <span style={{ fontSize: '0.85rem', fontWeight: orderForm.es_urgente ? 600 : 500, color: orderForm.es_urgente ? 'var(--color-danger)' : 'var(--color-text)' }}>
                                            <i className="bi bi-lightning-charge" style={{ marginRight: '0.3rem' }}></i> 
                                            Solicitar como Pedido Express (Urgente)
                                        </span>
                                    </div>
                                </div>

                                <div className="order-form-section mobile-only-hide-step-1">
                                    <h6 className="order-section-title"><i className="bi bi-journal-medical"></i> Especificaciones Clínicas</h6>
                                    
                                    <div className="form-group">
                                        <label className="form-label">Selección dental y Color</label>
                                        <div className="odonto-status-strip" style={{ marginTop: 0, height: '100%', minHeight: '42px', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span className="odonto-status-pill">{orderForm.piezas_dentales.length} piezas</span>
                                                <span className="odonto-status-divider">•</span>
                                                <span className="odonto-status-text">{orderForm.es_puente ? 'Modo puente' : 'Modo unitario'}</span>
                                            </div>
                                            {orderForm.es_puente && orderForm.pieza_inicio && orderForm.pieza_fin && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span className="odonto-status-divider">•</span>
                                                    <span className="odonto-status-text">Pilares: {orderForm.pieza_inicio} / {orderForm.pieza_fin}</span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                                                <i className="bi bi-palette" style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}></i>
                                                <select 
                                                    className="form-input" 
                                                    style={{ padding: '0.2rem 1.8rem 0.2rem 0.6rem', minHeight: '30px', fontSize: '0.8rem', width: 'auto' }}
                                                    value={orderForm.color_vita}
                                                    onChange={e => setOrderForm(f => ({ ...f, color_vita: e.target.value }))}
                                                >
                                                    <option value="">Color VITA...</option>
                                                    <optgroup label="Tonos A">
                                                        <option value="A1">A1</option><option value="A2">A2</option>
                                                        <option value="A3">A3</option><option value="A3.5">A3.5</option><option value="A4">A4</option>
                                                    </optgroup>
                                                    <optgroup label="Tonos B">
                                                        <option value="B1">B1</option><option value="B2">B2</option>
                                                        <option value="B3">B3</option><option value="B4">B4</option>
                                                    </optgroup>
                                                    <optgroup label="Tonos C / D / Bleach">
                                                        <option value="C1">C1</option><option value="D2">D2</option><option value="BL1">BL1</option>
                                                    </optgroup>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Notas del ítem</label>
                                        <textarea className="form-textarea" rows={1} placeholder="Instrucciones para esta restauración (ej. cofia, blindaje...)"
                                            value={orderForm.notas}
                                            onChange={e => setOrderForm(f => ({ ...f, notas: e.target.value }))} />
                                    </div>
                                </div>

                                <div className="order-form-section mobile-only-hide-step-1" style={{ background: 'rgba(var(--color-primary-rgb), 0.04)', borderColor: 'rgba(var(--color-primary-rgb), 0.15)' }}>
                                    <h6 className="order-section-title" style={{ color: 'var(--color-primary)', borderBottomColor: 'rgba(var(--color-primary-rgb), 0.2)', marginBottom: '0.6rem' }}>
                                        <i className="bi bi-receipt"></i> Resumen de Orden
                                    </h6>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                                        <span>Precio Unitario (Base)</span>
                                        <span>S/. {Number(orderProduct.precio_base).toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: orderForm.es_urgente ? '0.35rem' : '0.5rem', paddingBottom: orderForm.es_urgente ? '0' : '0.5rem', borderBottom: orderForm.es_urgente ? 'none' : '1px dashed var(--color-border)' }}>
                                        <span>Piezas Clínicas Seleccionadas</span>
                                        <span>× {Math.max(1, orderForm.piezas_dentales.length)}</span>
                                    </div>
                                    {orderForm.es_urgente && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-danger)', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px dashed var(--color-border)' }}>
                                            <span>Recargo Express (+25%)</span>
                                            <span>S/. {(Number(orderProduct.precio_base) * 0.25 * Math.max(1, orderForm.piezas_dentales.length)).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>Total Aprox.</span>
                                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                                            S/. {((Number(orderProduct.precio_base) + (orderForm.es_urgente ? Number(orderProduct.precio_base) * 0.25 : 0)) * Math.max(1, orderForm.piezas_dentales.length)).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </aside>

                            <div className="order-modal-odonto-v2 mobile-only-hide-step-2">
                                <OdontogramaInteractive
                                    product={orderProduct}
                                    selection={orderForm}
                                    onChange={(dentalData) => setOrderForm(f => ({ ...f, ...dentalData }))}
                                    title="Selecciona las piezas del caso"
                                    showSidePanel={false}
                                    showProductPill={false}
                                    showHeader={false}
                                />
                            </div>
                        </div>
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
