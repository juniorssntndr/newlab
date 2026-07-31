import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import OrderWizardShell from '../components/orders/wizard/OrderWizardShell.jsx';
import OrderWizardTimeline from '../components/orders/wizard/OrderWizardTimeline.jsx';
import OrderTeethStep from '../components/orders/wizard/OrderTeethStep.jsx';
import OrderIntakeStep from '../components/orders/wizard/OrderIntakeStep.jsx';
import OrderSelectedProductCard from '../components/orders/wizard/OrderSelectedProductCard.jsx';
import DeliveryDateCoordModal from '../components/orders/wizard/DeliveryDateCoordModal.jsx';
import ProductCatalogCard from '../components/orders/ProductCatalogCard.jsx';
import { useCreateOrderMutation } from '../modules/orders/mutations/useCreateOrderMutation.js';
import { useOrderComposerState } from '../modules/orders/composer/useOrderComposerState.js';
import { apiClient } from '../services/http/apiClient.js';
import { isClientRole } from '../utils/accessControl.js';
import {
    applyExpressSurcharge,
    expressSurchargeAmount,
    formatObservacionesWithIntake,
    ORDER_EXPRESS_SURCHARGE_RATE,
    ORDER_INTAKE_DEFAULT,
} from '../modules/orders/wizard/orderWizardConstants.js';
import {
    clearOrderWizardDraft,
    readOrderWizardDraft,
    saveOrderWizardDraft,
} from '../modules/orders/wizard/orderWizardDraft.js';
import { buildItemSelection } from '../utils/odontograma.js';
import { resolveImageUrl, resolveProductImageUrl } from '../utils/resolveImageUrl.js';
import { matchLandingProductImage } from '../utils/productCatalogImages.js';

const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDeliveryLabel = (isoDate) => {
    if (!isoDate) return '—';
    const [year, month, day] = String(isoDate).split('-').map(Number);
    if (!year || !month || !day) return isoDate;
    const date = new Date(year, month - 1, day);
    const label = date.toLocaleDateString('es-PE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
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

const ConfirmProductThumb = ({ product }) => {
    const primarySrc = resolveProductImageUrl(product);
    const landingSrc = resolveImageUrl(matchLandingProductImage(product));
    const preferredSrc = primarySrc || landingSrc;
    const [src, setSrc] = useState(preferredSrc);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setSrc(preferredSrc);
        setImgError(false);
    }, [preferredSrc]);

    if (!src || imgError) {
        return <i className="bi bi-gem" aria-hidden="true"></i>;
    }

    return (
        <img
            src={src}
            alt=""
            loading="lazy"
            onError={() => {
                if (landingSrc && src !== landingSrc) {
                    setSrc(landingSrc);
                    return;
                }
                setImgError(true);
            }}
        />
    );
};

const NuevoPedido = () => {
    const { getHeaders, user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isClient = isClientRole(user);
    const preselectProductId = searchParams.get('productoId');

    const [clinicas, setClinicas] = useState([]);
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [clinicSearch, setClinicSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [productSearch, setProductSearch] = useState('');
    const [form, setForm] = useState({
        clinica_id: '',
        paciente_nombre: '',
        fecha_entrega: '',
        observaciones: '',
    });
    const [intakeMode, setIntakeMode] = useState(ORDER_INTAKE_DEFAULT);
    const [intakeNote, setIntakeNote] = useState('');
    const [isExpressOrder, setIsExpressOrder] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    /** @type {['paciente'|'piezas'|'confirmar', Function]} */
    const [macroStep, setMacroStep] = useState('paciente');
    const [pickingProduct, setPickingProduct] = useState(false);
    const [showAddItemPrompt, setShowAddItemPrompt] = useState(false);
    const [appliedProductId, setAppliedProductId] = useState(null);
    const [catalogReady, setCatalogReady] = useState(false);
    const [coordinatingDelivery, setCoordinatingDelivery] = useState(false);

    const createOrderMutation = useCreateOrderMutation();
    const {
        items,
        total,
        selectedItem,
        selectedItemId,
        addProduct,
        selectItem,
        updateItemField,
        updateDentalSelection,
    } = useOrderComposerState();

    const daysForProduct = (product, urgent) => {
        if (!product) return null;
        const rawDays = Number(product.tiempo_estimado_dias);
        const baseDays = Number.isFinite(rawDays) && rawDays > 0 ? Math.trunc(rawDays) : 5;
        return urgent ? Math.max(1, Math.floor(baseDays / 2)) : baseDays;
    };

    const productForUi = useMemo(() => {
        const productId = selectedItem?.producto_id || selectedItem?.product?.id || selectedItem?.id;
        const fromCatalog = productos.find((item) => String(item.id) === String(productId));
        return fromCatalog || selectedItem?.product || selectedItem || null;
    }, [productos, selectedItem]);

    const standardDays = daysForProduct(productForUi || items[0], false);
    const urgentDays = daysForProduct(productForUi || items[0], true);
    const displayDays = isExpressOrder ? urgentDays : standardDays;
    const productPrice = Number(productForUi?.precio_base ?? selectedItem?.precio_unitario ?? 0);
    const expressSurcharge = expressSurchargeAmount(productPrice, isExpressOrder);
    const displayUnitPrice = applyExpressSurcharge(productPrice, isExpressOrder);
    const displayTotal = useMemo(() => {
        const base = Number(total || 0);
        if (!isExpressOrder || base <= 0) return base;
        return Number((base * (1 + ORDER_EXPRESS_SURCHARGE_RATE)).toFixed(2));
    }, [total, isExpressOrder]);
    const priceLabel = productPrice > 0 ? `S/. ${displayUnitPrice.toFixed(2)}` : null;
    const etaLabel = displayDays
        ? `Entrega estimada: ${displayDays} día${displayDays === 1 ? '' : 's'}${form.fecha_entrega ? ` · ${form.fecha_entrega}` : ''}`
        : null;
    const priceNote = isExpressOrder && expressSurcharge > 0
        ? `Incluye recargo express +${Math.round(ORDER_EXPRESS_SURCHARGE_RATE * 100)}% (S/. ${expressSurcharge.toFixed(2)})`
        : null;

    const persistDraftAndGoCatalog = () => {
        saveOrderWizardDraft({
            form,
            intakeMode,
            intakeNote,
            isExpressOrder,
            macroStep: 'paciente',
        });
        navigate('/catalogo');
    };

    const goToProductSelection = () => {
        if (isClient) {
            persistDraftAndGoCatalog();
            return;
        }
        setPickingProduct(true);
        setMacroStep('paciente');
    };

    useEffect(() => {
        Promise.all([
            apiClient('/clinicas', { headers: getHeaders() }),
            apiClient('/productos', {
                headers: getHeaders(),
                query: { activo: true, visible: true },
            }),
            apiClient('/categorias', { headers: getHeaders() }),
        ]).then(([clinics, products, categories]) => {
            setClinicas(clinics);
            const visibleProducts = (Array.isArray(products) ? products : []).filter(
                (product) => product?.activo !== false && product?.visible !== false
            );
            setProductos(visibleProducts);
            setCategorias(categories);
            if (user?.clinica_id) {
                setForm((prev) => ({ ...prev, clinica_id: user.clinica_id }));
            }
            setCatalogReady(true);
        }).catch((err) => setError(err.message || 'No se pudo cargar el catálogo'));
    }, [getHeaders, user?.clinica_id]);

    useEffect(() => {
        const draft = readOrderWizardDraft();
        if (!draft) return;
        if (draft.form) {
            setForm((prev) => ({
                ...prev,
                ...draft.form,
                clinica_id: user?.clinica_id || draft.form.clinica_id || prev.clinica_id,
            }));
        }
        if (draft.intakeMode) setIntakeMode(draft.intakeMode);
        if (typeof draft.intakeNote === 'string') setIntakeNote(draft.intakeNote);
        if (typeof draft.isExpressOrder === 'boolean') setIsExpressOrder(draft.isExpressOrder);
    }, [user?.clinica_id]);

    useEffect(() => {
        if (!preselectProductId || productos.length === 0) return;
        if (String(appliedProductId) === String(preselectProductId)) return;

        const product = productos.find((item) => String(item.id) === String(preselectProductId));
        if (!product) return;

        const itemId = addProduct(product);
        selectItem(itemId);
        if (isExpressOrder) updateItemField(itemId, 'es_urgente', true);
        setAppliedProductId(String(product.id));
        setMacroStep('paciente');
        setPickingProduct(false);
        clearOrderWizardDraft();
    }, [
        preselectProductId,
        productos,
        appliedProductId,
        addProduct,
        selectItem,
        isExpressOrder,
        updateItemField,
    ]);

    useEffect(() => {
        if (!catalogReady || isClient || preselectProductId) return;
        if (items.length > 0) return;
        setPickingProduct(true);
    }, [catalogReady, isClient, preselectProductId, items.length]);

    useEffect(() => {
        if (!selectedItemId && items.length > 0) {
            selectItem(items[0].id);
        }
    }, [items, selectedItemId, selectItem]);

    const selectedClinic = useMemo(
        () => clinicas.find((clinic) => String(clinic.id) === String(form.clinica_id)) || null,
        [clinicas, form.clinica_id]
    );

    const clinicSearchValue = clinicSearch.trim().toLowerCase();
    const filteredClinicas = useMemo(() => {
        if (!clinicSearchValue) return clinicas;
        return clinicas.filter((clinic) => clinic.nombre?.toLowerCase().includes(clinicSearchValue));
    }, [clinicas, clinicSearchValue]);

    const filteredProductos = useMemo(() => {
        const query = productSearch.trim().toLowerCase();
        return productos.filter((product) => {
            const byCat = categoryFilter === 'all' || String(product.categoria_id) === String(categoryFilter);
            const byQuery = !query
                || product.nombre?.toLowerCase().includes(query)
                || product.categoria_nombre?.toLowerCase().includes(query);
            return byCat && byQuery;
        });
    }, [productos, categoryFilter, productSearch]);

    const estimatedDeliveryDate = useMemo(() => {
        const selectedProduct = productForUi || items[0]?.product || items[0] || null;
        return calculateEstimatedDeliveryDate(selectedProduct, isExpressOrder);
    }, [productForUi, items, isExpressOrder]);

    useEffect(() => {
        if (user?.clinica_id && selectedClinic?.nombre) {
            setClinicSearch(selectedClinic.nombre);
        }
    }, [user?.clinica_id, selectedClinic?.nombre]);

    useEffect(() => {
        setForm((prev) => {
            if (!estimatedDeliveryDate) return prev;
            // Solo autoajusta si no hay fecha o si quedó por debajo del mínimo del lab.
            if (!prev.fecha_entrega || prev.fecha_entrega < estimatedDeliveryDate) {
                return { ...prev, fecha_entrega: estimatedDeliveryDate };
            }
            return prev;
        });
    }, [estimatedDeliveryDate]);

    const isCoordinatedDelivery = Boolean(
        estimatedDeliveryDate
        && form.fecha_entrega
        && form.fecha_entrega > estimatedDeliveryDate
    );

    const setDeliveryDate = (nextDate) => {
        const safeDate = estimatedDeliveryDate && nextDate && nextDate < estimatedDeliveryDate
            ? estimatedDeliveryDate
            : nextDate;
        setForm((prev) => ({ ...prev, fecha_entrega: safeDate || estimatedDeliveryDate || '' }));
    };

    const needsDental = !!selectedItem?.requiresDentalSelection;

    const checklistItems = useMemo(() => {
        const productDone = items.length > 0;
        const pacienteDone = Boolean(form.paciente_nombre?.trim() && form.clinica_id);
        const piezasDone = needsDental
            ? Boolean(selectedItem?.piezas_dentales?.length)
            : (macroStep === 'confirmar' || Boolean(selectedItem?.color_vita || selectedItem?.notas));
        const confirmarDone = Boolean(intakeMode);

        const status = (done, isCurrent) => {
            if (done && !isCurrent) return 'done';
            if (isCurrent) return 'current';
            if (done) return 'done';
            return 'pending';
        };

        const piezasDetail = (() => {
            if (needsDental) {
                const teeth = selectedItem?.piezas_dentales?.length
                    ? `${selectedItem.piezas_dentales.length} pieza(s)`
                    : 'Sin piezas aún';
                return selectedItem?.color_vita ? `${teeth} · ${selectedItem.color_vita}` : teeth;
            }
            return selectedItem?.color_vita || 'Sin tono aún';
        })();

        return [
            {
                id: 'paciente',
                label: 'Paciente y prioridad',
                description: 'Datos del caso y entrega estándar o express.',
                detail: productDone
                    ? (form.paciente_nombre?.trim() || selectedItem?.nombre || 'Producto listo')
                    : 'Elige un producto primero',
                status: status(
                    pacienteDone,
                    !pickingProduct && macroStep === 'paciente'
                ),
            },
            {
                id: 'piezas',
                label: needsDental ? 'Piezas e indicaciones' : 'Tono e indicaciones',
                description: needsDental
                    ? 'Selecciona dientes, tono VITA y notas clínicas.'
                    : 'Define tono e instrucciones del trabajo.',
                detail: piezasDetail,
                status: status(piezasDone, macroStep === 'piezas'),
            },
            {
                id: 'confirmar',
                label: 'Confirmar e ingreso',
                description: 'Revisa el resumen y cómo llega el caso al lab.',
                detail: intakeMode || 'Pendiente de coordinar',
                status: status(confirmarDone, macroStep === 'confirmar'),
            },
        ];
    }, [
        items.length,
        form.paciente_nombre,
        form.clinica_id,
        needsDental,
        selectedItem,
        macroStep,
        pickingProduct,
        intakeMode,
    ]);

    const closeWizard = () => navigate(isClient ? '/catalogo' : '/pedidos');

    const goBack = () => {
        setError('');
        setShowAddItemPrompt(false);
        if (pickingProduct) {
            if (items.length > 0) {
                setPickingProduct(false);
                return;
            }
            closeWizard();
            return;
        }
        if (macroStep === 'confirmar') {
            setMacroStep('piezas');
            return;
        }
        if (macroStep === 'piezas') {
            setMacroStep('paciente');
            return;
        }
        closeWizard();
    };

    const handleProductPick = (producto) => {
        const itemId = addProduct(producto);
        selectItem(itemId);
        if (isExpressOrder) updateItemField(itemId, 'es_urgente', true);
        setError('');
        setShowAddItemPrompt(false);
        setPickingProduct(false);
        setMacroStep('paciente');
    };

    const continueFromPaciente = () => {
        if (!form.clinica_id || !form.paciente_nombre?.trim()) {
            setError('Completa clínica y nombre del paciente.');
            return;
        }
        if (!items.length) {
            setError('Elige un producto para continuar.');
            goToProductSelection();
            return;
        }
        setError('');
        setMacroStep('piezas');
    };

    const continueFromTeeth = () => {
        if (needsDental && (!selectedItem?.piezas_dentales || selectedItem.piezas_dentales.length < 1)) {
            setError('Selecciona al menos un diente.');
            return;
        }
        setError('');
        if (isClient) {
            setMacroStep('confirmar');
            return;
        }
        setShowAddItemPrompt(true);
    };

    const goToConfirmar = () => {
        setShowAddItemPrompt(false);
        setMacroStep('confirmar');
    };

    const handleSubmit = async () => {
        if (!form.clinica_id || !form.paciente_nombre || !form.fecha_entrega || items.length === 0) {
            setError('Completa clínica, paciente, fecha de entrega y al menos un producto.');
            return;
        }
        if (items.some((item) => item.requiresDentalSelection && (!item.piezas_dentales || item.piezas_dentales.length === 0))) {
            setError('Cada ítem clínico debe tener al menos una pieza seleccionada.');
            return;
        }
        if (!intakeMode) {
            setError('Elige cómo llegará el caso al laboratorio.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            const observaciones = formatObservacionesWithIntake(
                intakeMode,
                [intakeNote, form.observaciones].filter(Boolean).join('\n')
            );
            const pedido = await createOrderMutation.mutateAsync({
                ...form,
                observaciones,
                items: items.map((item) => {
                    const baseUnit = Number(item.precio_unitario || item.precio_base || 0);
                    return {
                        ...item,
                        es_urgente: isExpressOrder,
                        precio_unitario: applyExpressSurcharge(baseUnit, isExpressOrder),
                    };
                }),
            });
            navigate(`/pedidos/${pedido.id}`);
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setSaving(false);
        }
    };

    const stepTitle = (() => {
        if (pickingProduct) return 'Producto';
        if (macroStep === 'confirmar') return 'Confirmar pedido';
        if (macroStep === 'piezas') return needsDental ? null : 'Tono e instrucciones';
        return null;
    })();

    const showChecklist = !pickingProduct;

    return (
        <OrderWizardShell
            macroStep={macroStep}
            title={stepTitle}
            subtitle={null}
            onBack={goBack}
            onClose={closeWizard}
        >
            {error ? (
                <div className="login-error order-composer-error-banner" role="alert" aria-live="assertive">
                    <i className="bi bi-exclamation-circle" aria-hidden="true"></i> {error}
                </div>
            ) : null}

            <div className={`order-wizard-layout${showChecklist ? '' : ' is-full'}`}>
                {showChecklist ? (
                    <aside className="order-wizard-aside">
                        <OrderWizardTimeline
                            items={checklistItems}
                            title="Caso rápido"
                            subtitle="Completa el pedido en 3 pasos claros."
                        />
                    </aside>
                ) : null}

                <section className="order-wizard-main">
                    {pickingProduct && !isClient ? (
                        <div className="order-wizard-card">
                            <div className="order-wizard-product-toolbar">
                                <input
                                    className="form-input"
                                    placeholder="Buscar producto..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                />
                                <select
                                    className="form-select"
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    aria-label="Filtrar por categoría"
                                >
                                    <option value="all">Todas las categorías</option>
                                    {categorias.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            {filteredProductos.length === 0 ? (
                                <p className="order-wizard-empty-hint">No hay productos visibles para mostrar.</p>
                            ) : (
                                <div className="order-wizard-product-grid catalog-products-grid">
                                    {filteredProductos.map((product) => (
                                        <ProductCatalogCard
                                            key={product.id}
                                            producto={product}
                                            ctaLabel="Seleccionar"
                                            ctaIcon="bi-check2-circle"
                                            onOrder={() => handleProductPick(product)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : null}

                    {!pickingProduct && macroStep === 'paciente' ? (
                        <div className="order-wizard-card order-wizard-card-paciente">
                            {selectedItem ? (
                                <OrderSelectedProductCard
                                    product={productForUi}
                                    variant="featured"
                                    onChange={goToProductSelection}
                                    priceLabel={priceLabel}
                                    etaLabel={etaLabel}
                                    priceNote={priceNote}
                                />
                            ) : isClient ? (
                                <OrderSelectedProductCard
                                    empty
                                    variant="featured"
                                    onEmptyAction={persistDraftAndGoCatalog}
                                />
                            ) : (
                                <OrderSelectedProductCard
                                    empty
                                    variant="featured"
                                    emptyHint="Selecciona un producto del catálogo interno"
                                    emptyActionLabel="Elegir producto"
                                    onEmptyAction={() => setPickingProduct(true)}
                                />
                            )}

                            <div className="order-wizard-paciente-fields">
                                {!isClient ? (
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="wizard-clinica">Clínica *</label>
                                        <input
                                            className="form-input"
                                            placeholder="Buscar clínica..."
                                            value={clinicSearch}
                                            onChange={(e) => setClinicSearch(e.target.value)}
                                            disabled={Boolean(user?.clinica_id)}
                                            style={{ marginBottom: '0.5rem' }}
                                        />
                                        <select
                                            id="wizard-clinica"
                                            className="form-select"
                                            value={form.clinica_id}
                                            onChange={(e) => setForm((prev) => ({ ...prev, clinica_id: e.target.value }))}
                                            disabled={Boolean(user?.clinica_id)}
                                        >
                                            <option value="">Seleccionar clínica</option>
                                            {filteredClinicas.map((clinic) => (
                                                <option key={clinic.id} value={clinic.id}>{clinic.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">Clínica</label>
                                        <input className="form-input" value={selectedClinic?.nombre || 'Tu clínica'} readOnly />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label" htmlFor="wizard-paciente">Paciente *</label>
                                    <input
                                        id="wizard-paciente"
                                        className="form-input"
                                        value={form.paciente_nombre}
                                        onChange={(e) => setForm((prev) => ({ ...prev, paciente_nombre: e.target.value }))}
                                        placeholder="Nombre del paciente"
                                    />
                                </div>
                            </div>

                            <div className="order-wizard-urgency-block">
                                <button
                                    type="button"
                                    className={`order-wizard-express${isExpressOrder ? ' is-on' : ''}`}
                                    onClick={() => setIsExpressOrder((prev) => !prev)}
                                    aria-pressed={isExpressOrder}
                                >
                                    <span className="order-wizard-express-icon" aria-hidden="true">
                                        <i className="bi bi-lightning-charge-fill"></i>
                                    </span>
                                    <span className="order-wizard-express-copy">
                                        <strong>
                                            Pedido Express
                                            <i className="bi bi-lightning-charge-fill" aria-hidden="true"></i>
                                            <span className="order-wizard-express-badge">
                                                +{Math.round(ORDER_EXPRESS_SURCHARGE_RATE * 100)}% cargo extra
                                            </span>
                                        </strong>
                                        <span>
                                            {isExpressOrder
                                                ? 'Prioridad máxima en laboratorio. El precio y el plazo ya incluyen el recargo express.'
                                                : (
                                                    productPrice > 0
                                                        ? `Marca esta opción si el trabajo requiere prioridad máxima. Total express: S/. ${applyExpressSurcharge(productPrice, true).toFixed(2)}.`
                                                        : 'Marca esta opción si el trabajo requiere prioridad máxima en laboratorio.'
                                                )}
                                        </span>
                                    </span>
                                    <span
                                        className="order-wizard-express-switch"
                                        role="presentation"
                                        aria-hidden="true"
                                    >
                                        <span className="order-wizard-express-knob"></span>
                                    </span>
                                </button>
                            </div>

                            <button type="button" className="btn btn-primary order-wizard-paciente-cta" onClick={continueFromPaciente}>
                                Continuar a piezas
                            </button>
                        </div>
                    ) : null}

                    {!pickingProduct && macroStep === 'piezas' && selectedItem ? (
                        <OrderTeethStep
                            product={productForUi || selectedItem.product || selectedItem}
                            selection={selectedItem}
                            productLabel={selectedItem.nombre || 'Trabajo'}
                            showOdontogram={needsDental}
                            colorVita={selectedItem.color_vita || ''}
                            notes={selectedItem.notas || ''}
                            onColorChange={(value) => updateItemField(selectedItem.id, 'color_vita', value)}
                            onNotesChange={(value) => updateItemField(selectedItem.id, 'notas', value)}
                            onChange={(dentalData) => updateDentalSelection(selectedItem.id, dentalData)}
                            onClear={() => updateDentalSelection(selectedItem.id, buildItemSelection([], false))}
                            onContinue={continueFromTeeth}
                        />
                    ) : null}

                    {!pickingProduct && macroStep === 'confirmar' ? (
                        <div className="order-wizard-card order-wizard-confirm">
                            <section className="order-wizard-confirm-section" aria-label="Datos del caso">
                                <h3 className="order-wizard-confirm-section-title">Datos del caso</h3>
                                <header className="order-wizard-confirm-hero" aria-label="Resumen del caso">
                                    <div className="order-wizard-confirm-stat">
                                        <span className="order-wizard-confirm-stat-icon" aria-hidden="true">
                                            <i className="bi bi-person"></i>
                                        </span>
                                        <div className="order-wizard-confirm-stat-copy">
                                            <span className="order-wizard-confirm-label">Paciente</span>
                                            <strong>{form.paciente_nombre}</strong>
                                            {!isClient && selectedClinic?.nombre ? (
                                                <em className="order-wizard-confirm-meta">{selectedClinic.nombre}</em>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="order-wizard-confirm-stat">
                                        <span className="order-wizard-confirm-stat-icon" aria-hidden="true">
                                            <i className="bi bi-calendar3"></i>
                                        </span>
                                        <div className="order-wizard-confirm-stat-copy order-wizard-confirm-entrega">
                                            <span className="order-wizard-confirm-label">Entrega</span>
                                            <div className="order-wizard-confirm-date-row">
                                                <strong className="order-wizard-confirm-date-value">
                                                    {formatDeliveryLabel(form.fecha_entrega || estimatedDeliveryDate)}
                                                </strong>
                                                <button
                                                    type="button"
                                                    className="order-wizard-confirm-coord-icon"
                                                    onClick={() => setCoordinatingDelivery(true)}
                                                    title="Coordinar otra fecha"
                                                    aria-label="Coordinar otra fecha"
                                                >
                                                    <i className="bi bi-pencil-square" aria-hidden="true"></i>
                                                </button>
                                            </div>
                                            {isExpressOrder || isCoordinatedDelivery ? (
                                                <em className="order-wizard-confirm-meta">
                                                    {[
                                                        isExpressOrder
                                                            ? `Express · +${Math.round(ORDER_EXPRESS_SURCHARGE_RATE * 100)}%`
                                                            : null,
                                                        isCoordinatedDelivery ? 'Coordinada' : null,
                                                    ].filter(Boolean).join(' · ')}
                                                </em>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="order-wizard-confirm-stat is-total">
                                        <span className="order-wizard-confirm-stat-icon" aria-hidden="true">
                                            <i className="bi bi-cash-stack"></i>
                                        </span>
                                        <div className="order-wizard-confirm-stat-copy">
                                            <span className="order-wizard-confirm-label">Total</span>
                                            <strong className="order-wizard-confirm-total-value">
                                                S/. {displayTotal.toFixed(2)}
                                            </strong>
                                        </div>
                                    </div>
                                </header>

                                <ul className="order-wizard-confirm-items">
                                    {items.map((item) => {
                                        const teeth = Array.isArray(item.piezas_dentales) ? item.piezas_dentales : [];
                                        const tone = String(item.color_vita || '').trim();
                                        const productId = item.producto_id || item.product?.id;
                                        const product = productos.find((p) => String(p.id) === String(productId))
                                            || item.product
                                            || item;
                                        return (
                                            <li key={item.id} className="order-wizard-confirm-item">
                                                <div className="order-wizard-confirm-item-media" aria-hidden="true">
                                                    <ConfirmProductThumb product={product} />
                                                </div>
                                                <div className="order-wizard-confirm-item-main">
                                                    <strong>{item.nombre}</strong>
                                                    <div className="order-wizard-confirm-clinical">
                                                        {teeth.length > 0 ? (
                                                            <div
                                                                className={[
                                                                    'order-wizard-confirm-teeth',
                                                                    teeth.length > 24 ? 'is-dense-xl' : '',
                                                                    teeth.length > 16 && teeth.length <= 24 ? 'is-dense-lg' : '',
                                                                    teeth.length > 8 && teeth.length <= 16 ? 'is-dense-md' : '',
                                                                ].filter(Boolean).join(' ')}
                                                                data-count={teeth.length}
                                                                aria-label="Piezas seleccionadas"
                                                            >
                                                                {teeth.map((tooth) => (
                                                                    <span key={`${item.id}-${tooth}`} className="order-wizard-confirm-tooth">
                                                                        {tooth}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="order-wizard-confirm-qty">{item.cantidad} u.</span>
                                                        )}
                                                        {tone ? (
                                                            <span className="order-wizard-confirm-tone">
                                                                Tono {tone}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>

                            <DeliveryDateCoordModal
                                open={coordinatingDelivery}
                                onClose={() => setCoordinatingDelivery(false)}
                                minDate={estimatedDeliveryDate}
                                value={form.fecha_entrega || estimatedDeliveryDate}
                                onConfirm={(nextDate) => {
                                    setDeliveryDate(nextDate);
                                    setCoordinatingDelivery(false);
                                }}
                                onUseEstimated={() => {
                                    setDeliveryDate(estimatedDeliveryDate);
                                    setCoordinatingDelivery(false);
                                }}
                            />

                            <section className="order-wizard-confirm-section" aria-label="Ingreso del caso">
                                <OrderIntakeStep
                                    compact
                                    value={intakeMode}
                                    onChange={setIntakeMode}
                                    note={intakeNote}
                                    onNoteChange={setIntakeNote}
                                    title="¿Cómo llegará el caso?"
                                />
                            </section>

                            <button
                                type="button"
                                className="btn btn-primary order-wizard-confirm-cta"
                                onClick={handleSubmit}
                                disabled={saving || !intakeMode}
                            >
                                {saving ? 'Creando...' : 'Crear pedido'}
                            </button>
                        </div>
                    ) : null}
                </section>
            </div>

            {showAddItemPrompt ? (
                <div className="order-wizard-modal-backdrop" role="presentation" onClick={() => setShowAddItemPrompt(false)}>
                    <div
                        className="order-wizard-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="order-wizard-add-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 id="order-wizard-add-title">¿Agregar otro artículo?</h3>
                        <p>Puedes editar este ítem, agregar otro producto o continuar a confirmar.</p>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setShowAddItemPrompt(false);
                                setMacroStep('piezas');
                            }}
                        >
                            Editar artículo
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setShowAddItemPrompt(false);
                                goToProductSelection();
                            }}
                        >
                            Agregar otro artículo
                        </button>
                        <button type="button" className="btn btn-primary" onClick={goToConfirmar}>
                            Continuar a confirmar
                        </button>
                    </div>
                </div>
            ) : null}
        </OrderWizardShell>
    );
};

export default NuevoPedido;
