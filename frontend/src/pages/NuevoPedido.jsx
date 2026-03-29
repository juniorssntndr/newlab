import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import OdontogramaInteractive from '../components/OdontogramaInteractive.jsx';
import OrderClinicalPanel from '../components/orders/OrderClinicalPanel.jsx';
import OrderCatalogPane from '../components/orders/OrderCatalogPane.jsx';
import { useCreateOrderMutation } from '../modules/orders/mutations/useCreateOrderMutation.js';
import { useOrderComposerState } from '../modules/orders/composer/useOrderComposerState.js';
import { apiClient } from '../services/http/apiClient.js';

const BACKEND_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');

const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    return `${BACKEND_BASE}${imageUrl}`;
};

const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const calculateEstimatedDeliveryDate = (product, isUrgent) => {
    if (!product) return '';
    const rawDays = Number(product.tiempo_estimado_dias);
    const baseDays = Number.isFinite(rawDays) && rawDays > 0 ? Math.trunc(rawDays) : 5;
    const estimatedDays = isUrgent ? Math.max(1, Math.floor(baseDays / 2)) : baseDays;
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + estimatedDays);
    return formatDateForInput(deliveryDate);
};

const NuevoPedido = () => {
    const { getHeaders, user } = useAuth();
    const navigate = useNavigate();
    const [clinicas, setClinicas] = useState([]);
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [clinicSearch, setClinicSearch] = useState('');
    const [form, setForm] = useState({
        clinica_id: '',
        paciente_nombre: '',
        fecha_entrega: '',
        observaciones: ''
    });
    const [isExpressOrder, setIsExpressOrder] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [selectedImageError, setSelectedImageError] = useState(false);
    const createOrderMutation = useCreateOrderMutation();
    const {
        items,
        total,
        selectedItem,
        selectedItemId,
        addProduct,
        removeItem,
        replaceItems,
        selectItem,
        updateItemField,
        updateQuantity,
        updateDentalSelection
    } = useOrderComposerState();

    useEffect(() => {
        Promise.all([
            apiClient('/clinicas', { headers: getHeaders() }),
            apiClient('/productos', { headers: getHeaders() }),
            apiClient('/categorias', { headers: getHeaders() })
        ]).then(([clinics, products, categories]) => {
            setClinicas(clinics);
            setProductos(products);
            setCategorias(categories);
            if (user?.clinica_id) {
                setForm((prevForm) => ({ ...prevForm, clinica_id: user.clinica_id }));
            }
        });
    }, []);

    useEffect(() => {
        if (!selectedItemId && items.length > 0) {
            selectItem(items[0].id);
        }
    }, [items, selectedItemId, selectItem]);

    const addItem = (producto) => {
        const existingItem = items.find((item) => {
            const itemProductId = item.product?.id || item.product_id || item.id_producto;
            return itemProductId === producto.id;
        });

        if (existingItem) {
            setError('');
            selectItem(existingItem.id);
            return;
        }

        if (items.length > 0) {
            replaceItems([]);
        }

        const itemId = addProduct(producto);
        setError('');
        selectItem(itemId);
        if (isExpressOrder) {
            updateItemField(itemId, 'es_urgente', true);
        }
    };

    const removeOrderItem = (itemId) => {
        removeItem(itemId);
        if (selectedItemId === itemId) {
            const nextSelected = items.find((item) => item.id !== itemId);
            selectItem(nextSelected?.id || null);
        }
    };

    const hasMissingDentalSelection = items.some((item) => {
        return item.requiresDentalSelection && (!item.piezas_dentales || item.piezas_dentales.length === 0);
    });

    const handleSubmit = async () => {
        if (!form.clinica_id || !form.paciente_nombre || !form.fecha_entrega || items.length === 0) {
            setError('Completa clinica, paciente, fecha de entrega y agrega al menos un producto.');
            return;
        }

        if (hasMissingDentalSelection) {
            setError('Cada item clinico debe tener al menos una pieza seleccionada en el odontograma.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const pedido = await createOrderMutation.mutateAsync({
                ...form,
                items
            });
            navigate(`/pedidos/${pedido.id}`);
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setSaving(false);
        }
    };

    const selectedItemNeedsOdontograma = !!selectedItem?.requiresDentalSelection;
    const clinicalPanelForm = selectedItem || {
        piezas_dentales: [],
        color_vita: '',
        notas: ''
    };
    const selectedProductImage = selectedItem?.product?.image_url || selectedItem?.image_url || '';
    const selectedClinic = useMemo(() => {
        return clinicas.find((clinic) => String(clinic.id) === String(form.clinica_id)) || null;
    }, [clinicas, form.clinica_id]);
    const clinicSearchValue = clinicSearch.trim().toLowerCase();
    const filteredClinicas = useMemo(() => {
        if (!clinicSearchValue) return clinicas;
        return clinicas.filter((clinic) => clinic.nombre?.toLowerCase().includes(clinicSearchValue));
    }, [clinicas, clinicSearchValue]);
    const clinicOptions = useMemo(() => {
        if (user?.clinica_id && selectedClinic) return [selectedClinic];
        return filteredClinicas;
    }, [user?.clinica_id, selectedClinic, filteredClinicas]);
    const estimatedDeliveryDate = useMemo(() => {
        const selectedProduct = selectedItem?.product || selectedItem || items[0]?.product || items[0] || null;
        return calculateEstimatedDeliveryDate(selectedProduct, isExpressOrder);
    }, [selectedItem, items, isExpressOrder]);

    useEffect(() => {
        setSelectedImageError(false);
    }, [selectedProductImage, selectedItem?.id]);

    useEffect(() => {
        if (user?.clinica_id && selectedClinic?.nombre) {
            setClinicSearch(selectedClinic.nombre);
        }
    }, [user?.clinica_id, selectedClinic?.nombre]);

    useEffect(() => {
        setForm((prevForm) => {
            if (prevForm.fecha_entrega === estimatedDeliveryDate) return prevForm;
            return { ...prevForm, fecha_entrega: estimatedDeliveryDate };
        });
    }, [estimatedDeliveryDate]);

    return (
        <div className="animate-fade-in nuevo-pedido-page-shell">
            <div className="page-header">
                <div className="page-header-left">
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/pedidos')}>
                        <i className="bi bi-arrow-left"></i>
                    </button>
                    <div>
                        <h1>Nuevo Pedido</h1>
                        <p>Prescripcion digital de trabajo dental</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="login-error order-composer-error-banner">
                    <i className="bi bi-exclamation-circle"></i> {error}
                </div>
            )}

            <div className="animate-slide-up nuevo-pedido-layout">
                <aside className="nuevo-pedido-sidebar">
                    <OrderCatalogPane
                        categorias={categorias}
                        productos={productos}
                        items={items}
                        selectedItemId={selectedItemId}
                        onAddProduct={addItem}
                        onSelectItem={selectItem}
                        onRemoveItem={removeOrderItem}
                        hideOrderItems
                    />
                </aside>

                <section className="nuevo-pedido-main">
                    <article className="card nuevo-pedido-admin-card">
                        {selectedItem ? (
                            <article className="nuevo-pedido-selected-product-card">
                                <div className="nuevo-pedido-selected-product-media">
                                    {selectedProductImage && !selectedImageError ? (
                                        <img
                                            src={resolveImageUrl(selectedProductImage)}
                                            alt={selectedItem.nombre}
                                            onError={() => setSelectedImageError(true)}
                                        />
                                    ) : (
                                        <div className="nuevo-pedido-selected-product-fallback">
                                            <i className="bi bi-box-seam"></i>
                                        </div>
                                    )}
                                </div>
                                <div className="nuevo-pedido-selected-product-copy">
                                    <span>Producto seleccionado</span>
                                    <strong>{selectedItem.nombre}</strong>
                                </div>
                                <div className="nuevo-pedido-selected-product-side">
                                    <strong>S/. {Number(selectedItem?.precio_unitario || 0).toFixed(2)}</strong>
                                    <button type="button" className="btn btn-ghost btn-sm nuevo-pedido-selected-product-remove" onClick={() => removeOrderItem(selectedItem.id)}>
                                        <i className="bi bi-trash"></i> Quitar
                                    </button>
                                </div>
                            </article>
                        ) : null}

                        <div className="nuevo-pedido-section-heading">
                            <div>
                                <h6 className="order-composer-section-title"><i className="bi bi-person-lines-fill"></i> Datos administrativos</h6>
                                <p className="nuevo-pedido-section-copy">La informacion general del caso queda siempre visible y estable.</p>
                            </div>
                        </div>

                        <div className="order-composer-fields-grid nuevo-pedido-admin-reference-grid nuevo-pedido-admin-clinic-row">
                            <div className="form-group order-composer-field-reset">
                                <label className="form-label">Clinica *</label>
                                <div className="nuevo-pedido-clinic-search">
                                    <i className="bi bi-search" aria-hidden="true"></i>
                                    <input
                                        className="form-input nuevo-pedido-clinic-search-input"
                                        placeholder="Buscar clinica..."
                                        value={clinicSearch}
                                        onChange={(event) => setClinicSearch(event.target.value)}
                                        disabled={!!user?.clinica_id}
                                    />
                                </div>
                                <select
                                    className="form-select"
                                    value={form.clinica_id}
                                    onChange={(event) => setForm({ ...form, clinica_id: event.target.value })}
                                    disabled={!!user?.clinica_id}
                                >
                                    <option value="">Seleccionar clinica...</option>
                                    {clinicOptions.map((clinic) => (
                                        <option key={clinic.id} value={clinic.id}>{clinic.nombre}</option>
                                    ))}
                                </select>
                                {!user?.clinica_id && clinicSearchValue && clinicOptions.length === 0 && (
                                    <small className="nuevo-pedido-clinic-empty">No hay clinicas que coincidan con tu busqueda.</small>
                                )}
                            </div>
                        </div>

                        <div className="order-composer-fields-grid nuevo-pedido-admin-reference-grid">
                            <div className="form-group order-composer-field-reset">
                                <label className="form-label">Nombre del paciente *</label>
                                <input
                                    className="form-input"
                                    placeholder="Nombre completo"
                                    value={form.paciente_nombre}
                                    onChange={(event) => setForm({ ...form, paciente_nombre: event.target.value })}
                                />
                            </div>
                            <div className="form-group order-composer-field-reset">
                                <label className="form-label">Fecha de entrega estimada</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={form.fecha_entrega}
                                    readOnly
                                    disabled
                                />
                            </div>
                        </div>

                        <div className={`nuevo-pedido-express-toggle-wrapper ${isExpressOrder ? 'is-express' : ''}`}>
                            <i className={isExpressOrder ? "bi bi-lightning-charge-fill" : "bi bi-lightning-charge"}></i>
                            <div className="nuevo-pedido-express-toggle-info">
                                <strong>Pedido Express ⚡</strong>
                                <p>Marca esta opcion si el trabajo requiere prioridad maxima en laboratorio.</p>
                            </div>
                            <div className="nuevo-pedido-express-switch">
                                <input
                                    type="checkbox"
                                    id="expressOrderToggle"
                                    className="toggle-switch-input"
                                    checked={isExpressOrder}
                                    onChange={(e) => {
                                        const nextExpress = e.target.checked;
                                        setIsExpressOrder(nextExpress);
                                        items.forEach((item) => updateItemField(item.id, 'es_urgente', nextExpress));
                                    }}
                                />
                                <label htmlFor="expressOrderToggle" className="toggle-switch-label"></label>
                            </div>
                        </div>

                        <div className="nuevo-pedido-clinical-stack">
                            <OrderClinicalPanel
                                className="nuevo-pedido-clinical-card"
                                form={clinicalPanelForm}
                                resolvedCantidad={selectedItem?.cantidad || 0}
                                requiresDentalSelection={selectedItem ? selectedItem.requiresDentalSelection : true}
                                showDerivedFields={false}
                                disabled={!selectedItem}
                                onColorChange={(color_vita) => {
                                    if (selectedItem) updateItemField(selectedItem.id, 'color_vita', color_vita);
                                }}
                                onNotesChange={(notas) => {
                                    if (selectedItem) updateItemField(selectedItem.id, 'notas', notas);
                                }}
                                onQuantityChange={(cantidad_manual) => {
                                    if (selectedItem) updateQuantity(selectedItem.id, parseInt(cantidad_manual, 10) || 1);
                                }}
                            />

                            <article className="card nuevo-pedido-case-summary-card">
                                <h6 className="order-composer-section-title"><i className="bi bi-receipt"></i> Resumen del caso</h6>
                                <div className="nuevo-pedido-case-summary-row">
                                    <span>Precio unitario</span>
                                    <strong>S/. {Number(selectedItem?.precio_unitario || 0).toFixed(2)}</strong>
                                </div>
                                <div className="nuevo-pedido-case-summary-row">
                                    <span>Piezas seleccionadas</span>
                                    <strong>{selectedItem?.piezas_dentales?.length || 0}</strong>
                                </div>
                                <div className="nuevo-pedido-case-summary-total-row">
                                    <span>TOTAL PEDIDO</span>
                                    <strong>S/. {Number(total || 0).toFixed(2)}</strong>
                                </div>
                            </article>
                        </div>

                    </article>

                </section>

                <aside className="nuevo-pedido-odontograma-column">
                    <section className="card nuevo-pedido-odontograma-pane">
                        <div className="nuevo-pedido-odontograma-body">
                            {selectedItem ? (
                                <div className="order-composer-odontograma-slot nuevo-pedido-odontograma-slot">
                                    <OdontogramaInteractive
                                        product={selectedItem.product || selectedItem}
                                        selection={selectedItem}
                                        onChange={(dentalData) => updateDentalSelection(selectedItem.id, dentalData)}
                                        title="Selecciona las piezas del producto"
                                        showSidePanel={false}
                                        showProductPill={false}
                                        showHeader={false}
                                        preserveAspectRatio="xMidYMid meet"
                                    />
                                </div>
                            ) : (
                                <article className="order-composer-empty-clinical nuevo-pedido-odontograma-empty">
                                    <i className="bi bi-grid-1x2"></i>
                                    <h3>Odontograma disponible</h3>
                                    <p>
                                        Agrega un producto desde el catalogo y el odontograma quedara listo para trabajar sin seleccionarlo manualmente.
                                    </p>
                                </article>
                            )}
                        </div>
                    </section>
                </aside>
            </div>

            <div className="nuevo-pedido-bottom-bar">
                <div className="nuevo-pedido-bottom-bar-inner">
                    <div className="nuevo-pedido-bottom-total">
                        <span>Total Pedido:</span>
                        <strong>S/. {Number(total || 0).toFixed(2)}</strong>
                    </div>
                    <button
                        type="button"
                        className="btn btn-primary btn-crear-pedido"
                        onClick={handleSubmit}
                        disabled={saving}
                    >
                        {saving ? (
                            <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...</>
                        ) : (
                            <><i className="bi bi-check-circle-fill"></i> Crear Prescripcion</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NuevoPedido;
