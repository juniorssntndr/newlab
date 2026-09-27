import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import OrderWizardShell from '../components/orders/wizard/OrderWizardShell.jsx';
import OrderWizardTimeline from '../components/orders/wizard/OrderWizardTimeline.jsx';
import OrderTeethStep from '../components/orders/wizard/OrderTeethStep.jsx';
import OrderIntakeStep from '../components/orders/wizard/OrderIntakeStep.jsx';
import { AFINIX_LAB_ADDRESS } from '../constants/labInfo.js';
import OrderSelectedProductCard from '../components/orders/wizard/OrderSelectedProductCard.jsx';
import DeliveryDateCoordModal from '../components/orders/wizard/DeliveryDateCoordModal.jsx';
import ProductCatalogCard from '../components/orders/ProductCatalogCard.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import { useCreateOrderMutation } from '../modules/orders/mutations/useCreateOrderMutation.js';
import { useOrderComposerState } from '../modules/orders/composer/useOrderComposerState.js';
import { fetchVisibleCatalog, peekVisibleCatalog } from '../modules/orders/catalog/visibleCatalogCache.js';
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
import { buildItemSelection, getToothRole } from '../utils/odontograma.js';

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

const formatDeliveryShort = (isoDate) => {
    if (!isoDate) return '';
    const [year, month, day] = String(isoDate).split('-').map(Number);
    if (!year || !month || !day) return String(isoDate);
    return new Date(year, month - 1, day).toLocaleDateString('es-PE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
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
    const { getHeaders, user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isClient = isClientRole(user);
    const preselectProductId = searchParams.get('productoId');
    const warmCatalog = peekVisibleCatalog();
    const startsOnProductPicker = !isClient && !preselectProductId;

    const [clinicas, setClinicas] = useState([]);
    const [productos, setProductos] = useState(() => warmCatalog?.products || []);
    const [categorias, setCategorias] = useState(() => warmCatalog?.categories || []);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [productSearch, setProductSearch] = useState('');
    const [form, setForm] = useState({
        clinica_id: user?.clinica_id || '',
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
    const [pickingProduct, setPickingProduct] = useState(startsOnProductPicker);
    const [appliedProductId, setAppliedProductId] = useState(null);
    const [catalogReady, setCatalogReady] = useState(() => Boolean(warmCatalog));
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
        ? `Entrega: ${displayDays} día${displayDays === 1 ? '' : 's'}${form.fecha_entrega ? ` · ${formatDeliveryShort(form.fecha_entrega)}` : ''}`
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
        let cancelled = false;
        const load = async () => {
            try {
                const catalogPromise = fetchVisibleCatalog(getHeaders);
                const clinicsPromise = isClient
                    ? Promise.resolve([])
                    : apiClient('/clinicas', { headers: getHeaders() });
                const [{ products, categories }, clinics] = await Promise.all([
                    catalogPromise,
                    clinicsPromise,
                ]);
                if (cancelled) return;
                setProductos(products);
                setCategorias(categories);
                setClinicas(Array.isArray(clinics) ? clinics : []);
                setCatalogReady(true);
            } catch (err) {
                if (!cancelled) setError(err.message || 'No se pudo cargar el catálogo');
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [getHeaders, isClient]);

    // Clínica del cliente: no esperar /clinicas (evita flash "Tu clínica")
    useEffect(() => {
        if (!user?.clinica_id) return;
        setForm((prev) => (
            String(prev.clinica_id) === String(user.clinica_id)
                ? prev
                : { ...prev, clinica_id: user.clinica_id }
        ));
    }, [user?.clinica_id]);

    // Rescatar dirección del consultorio si la sesión local aún no la traía en memoria
    useEffect(() => {
        if (isClient && user && !user.clinica_direccion && typeof refreshUser === 'function') {
            refreshUser().catch(() => {});
        }
    }, [isClient, user?.id, user?.clinica_direccion, refreshUser]);

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
    const clinicDisplayName = selectedClinic?.nombre || user?.clinica_nombre || '';
    const awaitingPreselectedProduct = Boolean(preselectProductId) && !selectedItem;
    const productCardLoading = !catalogReady || awaitingPreselectedProduct;

    const clinicOptions = useMemo(() => {
        return (clinicas || []).map((clinic) => ({
            value: String(clinic.id),
            label: clinic.nombre,
            icon: 'bi-hospital',
        }));
    }, [clinicas]);

    const filteredProductos = useMemo(() => {
        const query = productSearch.trim().toLowerCase();
        return productos.filter((product) => {
            const byCat = categoryFilter === 'all'
                || String(product.categoria_id) === String(categoryFilter);
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
        if (user?.clinica_id && clinicDisplayName) {
            setClinicSearch(clinicDisplayName);
        }
    }, [user?.clinica_id, clinicDisplayName]);

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
        const stepOrder = { paciente: 0, piezas: 1, confirmar: 2 };
        // En picker de producto aún no hay paso activo en la guía.
        const currentIndex = pickingProduct ? -1 : (stepOrder[macroStep] ?? 0);

        const statusFor = (stepKey) => {
            const stepIndex = stepOrder[stepKey];
            if (stepIndex < currentIndex) return 'done';
            if (stepIndex === currentIndex) return 'current';
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
                status: statusFor('paciente'),
            },
            {
                id: 'piezas',
                label: needsDental ? 'Piezas e indicaciones' : 'Tono e indicaciones',
                description: needsDental
                    ? 'Selecciona las piezas en el odontograma.'
                    : 'Define tono e instrucciones del trabajo.',
                detail: piezasDetail,
                status: statusFor('piezas'),
            },
            {
                id: 'confirmar',
                label: 'Confirmar e ingreso',
                description: 'Revisa el resumen y cómo llega el caso al lab.',
                detail: intakeMode || 'Pendiente de coordinar',
                status: statusFor('confirmar'),
            },
        ];
    }, [
        items.length,
        form.paciente_nombre,
        needsDental,
        selectedItem,
        macroStep,
        pickingProduct,
        intakeMode,
    ]);

    const closeWizard = () => navigate(isClient ? '/catalogo' : '/pedidos');

    const goBack = () => {
        setError('');
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
        setPickingProduct(false);
        setMacroStep('paciente');
    };

    const continueFromPaciente = () => {
        if (!form.clinica_id || !form.paciente_nombre?.trim()) {
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
        if (!String(selectedItem?.color_vita || '').trim()) {
            setError('Elige un tono para continuar.');
            return;
        }
        setError('');
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
                    <aside className="order-wizard-aside desktop-only" aria-label="Progreso del caso">
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
                            <div className="order-wizard-product-toolbar productos-filters-row">
                                <div className="search-box productos-search-box">
                                    <i className="bi bi-search"></i>
                                    <input
                                        className="form-input"
                                        placeholder="Buscar producto..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        disabled={!catalogReady}
                                    />
                                </div>
                                <div className="productos-filter-chips" role="group" aria-label="Filtrar por categoría">
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${categoryFilter === 'all' ? ' is-active' : ''}`}
                                        onClick={() => setCategoryFilter('all')}
                                        disabled={!catalogReady}
                                    >
                                        Todos
                                    </button>
                                    {categorias.map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            className={`btn btn-sm pedidos-filter-chip${String(categoryFilter) === String(cat.id) ? ' is-active' : ''}`}
                                            onClick={() => setCategoryFilter(String(categoryFilter) === String(cat.id) ? 'all' : String(cat.id))}
                                            disabled={!catalogReady}
                                        >
                                            {cat.nombre}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {!catalogReady ? (
                                <div className="order-wizard-product-grid catalog-products-grid" aria-busy="true" aria-label="Cargando catálogo">
                                    {[1, 2, 3, 4, 5, 6].map((i) => (
                                        <div key={i} className="skeleton catalog-product-skeleton" />
                                    ))}
                                </div>
                            ) : filteredProductos.length === 0 ? (
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
                            ) : productCardLoading ? (
                                <OrderSelectedProductCard loading variant="featured" />
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

                            <div className="order-wizard-paciente-body">
                                <div className="order-wizard-paciente-fields">
                                    {!isClient ? (
                                        <div className="form-group order-wizard-clinic-field">
                                            <label className="form-label" htmlFor="wizard-clinica">
                                                <i className="bi bi-hospital" aria-hidden="true" style={{ marginRight: '0.4rem', color: 'var(--color-primary)' }}></i>
                                                <span>Clínica <span className="order-wizard-required" aria-hidden="true">*</span></span>
                                            </label>
                                            <CustomSelect
                                                id="wizard-clinica"
                                                options={clinicOptions}
                                                value={form.clinica_id ? String(form.clinica_id) : ''}
                                                onChange={(_, val) => setForm((prev) => ({ ...prev, clinica_id: val }))}
                                                placeholder="Seleccionar clínica..."
                                                searchable
                                                disabled={Boolean(user?.clinica_id)}
                                            />
                                        </div>
                                    ) : null}

                                    <div className="form-group order-wizard-paciente-name-field">
                                        <label className="form-label order-wizard-paciente-name-label" htmlFor="wizard-paciente">
                                            <i className="bi bi-person-fill" aria-hidden="true"></i>
                                            <span>Nombre del paciente <span className="order-wizard-required" aria-hidden="true">*</span></span>
                                        </label>
                                        <input
                                            id="wizard-paciente"
                                            className="form-input"
                                            value={form.paciente_nombre}
                                            onChange={(e) => setForm((prev) => ({ ...prev, paciente_nombre: e.target.value }))}
                                            placeholder="Nombre del paciente"
                                            autoComplete="name"
                                            required
                                            aria-required="true"
                                        />
                                        {!String(form.paciente_nombre || '').trim() ? (
                                            <span className="order-wizard-paciente-name-hint">Escribe el nombre para continuar.</span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="order-wizard-paciente-footer">
                                <div className="order-wizard-urgency-block">
                                    <button
                                        type="button"
                                        className={`order-wizard-express${isExpressOrder ? ' is-on' : ''}`}
                                        onClick={() => setIsExpressOrder((prev) => !prev)}
                                        aria-pressed={isExpressOrder}
                                        aria-label={
                                            isExpressOrder
                                                ? `Pedido Express activo, +${Math.round(ORDER_EXPRESS_SURCHARGE_RATE * 100)}%`
                                                : `Activar Pedido Express, +${Math.round(ORDER_EXPRESS_SURCHARGE_RATE * 100)}%`
                                        }
                                    >
                                        <span className="order-wizard-express-copy">
                                            <strong>
                                                <i className="bi bi-lightning-charge-fill" aria-hidden="true"></i>
                                                Express
                                            </strong>
                                            <span className="order-wizard-express-badge">
                                                +{Math.round(ORDER_EXPRESS_SURCHARGE_RATE * 100)}%
                                            </span>
                                            {productPrice > 0 ? (
                                                <span className="order-wizard-express-price">
                                                    {isExpressOrder
                                                        ? `S/. ${applyExpressSurcharge(productPrice, true).toFixed(2)}`
                                                        : `S/. ${productPrice.toFixed(2)} → ${applyExpressSurcharge(productPrice, true).toFixed(2)}`}
                                                </span>
                                            ) : null}
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
                                <button
                                    type="button"
                                    className="btn btn-primary order-wizard-paciente-cta"
                                    onClick={continueFromPaciente}
                                    disabled={!String(form.paciente_nombre || '').trim() || !form.clinica_id}
                                >
                                    Continuar a piezas
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {!pickingProduct && macroStep === 'piezas' && selectedItem ? (
                        <OrderTeethStep
                            product={productForUi || selectedItem.product || selectedItem}
                            selection={selectedItem}
                            productLabel={selectedItem.nombre || 'Trabajo'}
                            showOdontogram={needsDental}
                            colorVita={selectedItem.color_vita || ''}
                            guiaColor={selectedItem.guia_color || 'vita'}
                            notes={selectedItem.notas || ''}
                            onColorChange={(value) => updateItemField(selectedItem.id, 'color_vita', value)}
                            onGuiaColorChange={(value) => updateItemField(selectedItem.id, 'guia_color', value)}
                            onNotesChange={(value) => updateItemField(selectedItem.id, 'notas', value)}
                            onChange={(dentalData) => updateDentalSelection(selectedItem.id, dentalData)}
                            onClear={() => updateDentalSelection(selectedItem.id, buildItemSelection([], false))}
                            onContinue={continueFromTeeth}
                        />
                    ) : null}

                    {!pickingProduct && macroStep === 'confirmar' ? (
                        <div className="order-wizard-card order-wizard-confirm">
                            <section
                                className="order-wizard-confirm-section order-wizard-confirm-ingreso"
                                aria-label="Ingreso del caso"
                            >
                                <OrderIntakeStep
                                    compact
                                    value={intakeMode}
                                    onChange={setIntakeMode}
                                    note={intakeNote}
                                    onNoteChange={setIntakeNote}
                                    title="¿Cómo llegará el caso?"
                                    labAddress={user?.laboratorio_direccion || AFINIX_LAB_ADDRESS}
                                    clinicAddress={
                                        selectedClinic?.direccion
                                        || user?.clinica_direccion
                                        || ''
                                    }
                                    patientName={form.paciente_nombre}
                                    productName={selectedItem?.nombre || productForUi?.nombre || ''}
                                />
                            </section>

                            <section
                                className="order-wizard-confirm-section order-wizard-confirm-datos"
                                aria-label="Datos del caso"
                            >
                                <h3 className="order-wizard-confirm-section-title">Resumen del caso</h3>
                                <div className="order-wizard-confirm-stack">
                                    <div className="order-wizard-confirm-stat order-wizard-confirm-stat-paciente">
                                        <div className="order-wizard-confirm-stat-copy">
                                            <span className="order-wizard-confirm-label">
                                                <i className="bi bi-person" aria-hidden="true"></i>
                                                Paciente
                                            </span>
                                            <strong>{form.paciente_nombre}</strong>
                                            {!isClient && selectedClinic?.nombre ? (
                                                <em className="order-wizard-confirm-meta">{selectedClinic.nombre}</em>
                                            ) : null}
                                        </div>
                                    </div>

                                    <ul className="order-wizard-confirm-items">
                                        {items.map((item) => {
                                            const teeth = Array.isArray(item.piezas_dentales) ? item.piezas_dentales : [];
                                            const tone = String(item.color_vita || '').trim();
                                            return (
                                                <li key={item.id} className="order-wizard-confirm-item is-text-only">
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
                                                                    {teeth.map((tooth) => {
                                                                        const role = getToothRole(tooth, item);
                                                                        const roleLabel = role === 'pilar' ? 'Pilar' : role === 'pontico' ? 'Póntico' : 'Unitaria';
                                                                        return (
                                                                            <span
                                                                                key={`${item.id}-${tooth}`}
                                                                                className={`order-wizard-confirm-tooth is-${role}`}
                                                                                title={`Pieza ${tooth} (${roleLabel})`}
                                                                            >
                                                                                {tooth}
                                                                            </span>
                                                                        );
                                                                    })}
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

                                    <div className="order-wizard-confirm-stat order-wizard-confirm-stat-entrega">
                                        <div className="order-wizard-confirm-stat-copy order-wizard-confirm-entrega">
                                            <span className="order-wizard-confirm-label">
                                                <i className="bi bi-calendar3" aria-hidden="true"></i>
                                                Entrega
                                            </span>
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

                                    <div className="order-wizard-confirm-stat is-total order-wizard-confirm-stat-total">
                                        <div className="order-wizard-confirm-stat-copy">
                                            <span className="order-wizard-confirm-label">
                                                <i className="bi bi-cash-stack" aria-hidden="true"></i>
                                                Total
                                            </span>
                                            <strong className="order-wizard-confirm-total-value">
                                                S/. {displayTotal.toFixed(2)}
                                            </strong>
                                        </div>
                                    </div>
                                </div>

                                {selectedItem ? (
                                    <div className="order-wizard-confirm-instructions-row">
                                        <span className="order-wizard-confirm-instructions-label">
                                            <i className="bi bi-chat-left-text" aria-hidden="true"></i>
                                            Instrucciones:
                                        </span>
                                        <input
                                            id="order-confirm-notes"
                                            className="form-input order-wizard-confirm-instructions-input"
                                            placeholder="Indicaciones para el laboratorio (opcional)..."
                                            value={selectedItem.notas || ''}
                                            onChange={(event) => updateItemField(selectedItem.id, 'notas', event.target.value)}
                                            aria-label="Instrucciones para el laboratorio"
                                        />
                                    </div>
                                ) : null}
                            </section>

                            <button
                                type="button"
                                className="btn btn-primary order-wizard-confirm-cta"
                                onClick={handleSubmit}
                                disabled={saving || !intakeMode}
                            >
                                {saving ? 'Creando...' : 'Crear pedido'}
                            </button>

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
                        </div>
                    ) : null}
                </section>
            </div>
        </OrderWizardShell>
    );
};

export default NuevoPedido;
