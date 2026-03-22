import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { apiClient } from '../services/http/apiClient.js';
import { formatDentalSelection } from '../utils/odontograma.js';
import OdontogramaInteractive from '../components/OdontogramaInteractive.jsx';
import OrderClinicalPanel from '../components/orders/OrderClinicalPanel.jsx';
import OrderComposerLayout from '../components/orders/OrderComposerLayout.jsx';
import OrderCatalogPane from '../components/orders/OrderCatalogPane.jsx';
import OrderPricingSummary from '../components/orders/OrderPricingSummary.jsx';
import { useCreateOrderMutation } from '../modules/orders/mutations/useCreateOrderMutation.js';
import { useOrderComposerState } from '../modules/orders/composer/useOrderComposerState.js';

const NuevoPedido = () => {
    const { getHeaders, user } = useAuth();
    const navigate = useNavigate();
    const [clinicas, setClinicas] = useState([]);
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [form, setForm] = useState({
        clinica_id: '',
        paciente_nombre: '',
        fecha_entrega: '',
        observaciones: ''
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState(1);
    const createOrderMutation = useCreateOrderMutation();
    const {
        items,
        total,
        selectedItem,
        selectedItemId,
        ui,
        addProduct,
        removeItem,
        selectItem,
        updateItemField,
        updateDentalSelection,
        updateQuantity,
        setMobileStep
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

    const addItem = (producto) => {
        const itemId = addProduct(producto);
        selectItem(itemId);
        setMobileStep(2);
    };

    const removeOrderItem = (itemId) => {
        removeItem(itemId);
        if (selectedItemId === itemId) {
            const nextSelected = items.find((item) => item.id !== itemId);
            selectItem(nextSelected?.id || null);
            setMobileStep(nextSelected ? 2 : 1);
        }
    };

    const hasMissingDentalSelection = items.some((item) => {
        return item.requiresDentalSelection && (!item.piezas_dentales || item.piezas_dentales.length === 0);
    });

    const handleOpenSummary = () => {
        if (items.length === 0) {
            setError('Agrega al menos un producto para continuar.');
            return;
        }
        if (hasMissingDentalSelection) {
            setError('Completa la seleccion dental en todos los items clinicos antes de revisar el resumen.');
            return;
        }
        setError('');
        setStep(3);
    };

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

    const stepLabels = ['Datos del Paciente', 'Compositor Clinico', 'Resumen'];

    return (
        <div className="animate-fade-in">
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

            <div className="order-composer-stepper">
                {stepLabels.map((label, index) => {
                    const currentStep = index + 1;
                    const buttonClass = step === currentStep
                        ? 'btn-primary'
                        : currentStep < step
                            ? 'btn-accent'
                            : 'btn-ghost';

                    return (
                        <button
                            key={label}
                            className={`btn btn-sm ${buttonClass}`}
                            onClick={() => setStep(currentStep)}
                        >
                            <span>{currentStep}</span> {label}
                        </button>
                    );
                })}
            </div>

            {step === 1 && (
                <div className="card animate-slide-up">
                    <div className="card-header">
                        <h3 className="card-title">Datos del Paciente</h3>
                    </div>
                    <div className="grid grid-cols-2">
                        <div className="form-group">
                            <label className="form-label">Clinica *</label>
                            <select
                                className="form-select"
                                value={form.clinica_id}
                                onChange={(event) => setForm({ ...form, clinica_id: event.target.value })}
                                disabled={!!user?.clinica_id}
                            >
                                <option value="">Seleccionar clinica...</option>
                                {clinicas.map((clinic) => (
                                    <option key={clinic.id} value={clinic.id}>{clinic.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Nombre del Paciente *</label>
                            <input
                                className="form-input"
                                placeholder="Nombre completo del paciente"
                                value={form.paciente_nombre}
                                onChange={(event) => setForm({ ...form, paciente_nombre: event.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Fecha de Entrega *</label>
                            <input
                                className="form-input"
                                type="date"
                                value={form.fecha_entrega}
                                onChange={(event) => setForm({ ...form, fecha_entrega: event.target.value })}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Observaciones Generales</label>
                        <textarea
                            className="form-textarea"
                            rows={3}
                            value={form.observaciones}
                            onChange={(event) => setForm({ ...form, observaciones: event.target.value })}
                        />
                    </div>
                    <div className="order-composer-actions-row">
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setStep(2);
                                setMobileStep(1);
                            }}
                            disabled={!form.paciente_nombre || !form.clinica_id || !form.fecha_entrega}
                        >
                            Siguiente <i className="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="animate-slide-up">
                    <OrderComposerLayout
                        mobileStep={ui.mobileStep}
                        onMobileStepChange={setMobileStep}
                        disableClinicalStep={items.length === 0}
                        leftPane={(
                            <OrderCatalogPane
                                categorias={categorias}
                                productos={productos}
                                items={items}
                                selectedItemId={selectedItemId}
                                onAddProduct={addItem}
                                onSelectItem={(itemId) => {
                                    selectItem(itemId);
                                    setMobileStep(2);
                                }}
                                onRemoveItem={removeOrderItem}
                            />
                        )}
                        rightPane={selectedItem ? (
                            <section className="order-composer-clinical-pane">
                                <article className="card order-composer-item-focus-card">
                                    <div>
                                        <p className="order-composer-item-focus-kicker">Producto activo</p>
                                        <h3>{selectedItem.nombre}</h3>
                                    </div>
                                    <p className="order-composer-item-focus-price">S/. {Number(selectedItem.precio_unitario || 0).toFixed(2)}</p>
                                </article>

                                <OrderClinicalPanel
                                    form={selectedItem}
                                    resolvedCantidad={selectedItem.cantidad}
                                    requiresDentalSelection={selectedItem.requiresDentalSelection}
                                    onColorChange={(color_vita) => updateItemField(selectedItem.id, 'color_vita', color_vita)}
                                    onNotesChange={(notas) => updateItemField(selectedItem.id, 'notas', notas)}
                                    onQuantityChange={(cantidad_manual) => updateQuantity(selectedItem.id, parseInt(cantidad_manual, 10) || 1)}
                                />

                                {selectedItem.requiresDentalSelection && (
                                    <div className="order-composer-odontograma-slot">
                                        <OdontogramaInteractive
                                            product={selectedItem.product || selectedItem}
                                            selection={selectedItem}
                                            onChange={(dentalData) => updateDentalSelection(selectedItem.id, dentalData)}
                                            title="Selecciona las piezas del producto"
                                        />
                                    </div>
                                )}

                                <OrderPricingSummary item={selectedItem} total={total} title="Subtotal reactivo" />
                            </section>
                        ) : (
                            <article className="card order-composer-empty-clinical">
                                <i className="bi bi-hand-index"></i>
                                <h3>Elegi un item para editar detalles clinicos</h3>
                                <p>
                                    Selecciona un producto desde el panel izquierdo para configurar odontograma,
                                    color VITA, notas y ver el subtotal en tiempo real.
                                </p>
                            </article>
                        )}
                    />

                    <div className="order-composer-actions-between">
                        <button className="btn btn-ghost" onClick={() => setStep(1)}>
                            <i className="bi bi-arrow-left"></i> Anterior
                        </button>
                        <button className="btn btn-primary" onClick={handleOpenSummary} disabled={items.length === 0}>
                            Siguiente <i className="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="card animate-slide-up">
                    <div className="card-header">
                        <h3 className="card-title">Resumen del Pedido</h3>
                    </div>

                    <div className="grid grid-cols-2" style={{ marginBottom: 'var(--space-4)' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Clinica</div>
                            <div style={{ fontWeight: 600 }}>{clinicas.find((clinic) => clinic.id == form.clinica_id)?.nombre}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Paciente</div>
                            <div style={{ fontWeight: 600 }}>{form.paciente_nombre}</div>
                        </div>
                        {form.fecha_entrega && (
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Fecha de Entrega</div>
                                <div style={{ fontWeight: 600 }}>{form.fecha_entrega}</div>
                            </div>
                        )}
                    </div>

                    <div className="data-table-wrapper table-scroll-dense desktop-only" style={{ marginBottom: 'var(--space-4)' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Pieza</th>
                                    <th>Color</th>
                                    <th>Cant.</th>
                                    <th>P.U.</th>
                                    <th>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td>{item.nombre}</td>
                                        <td>{formatDentalSelection(item)}</td>
                                        <td>{item.color_vita || '—'}</td>
                                        <td>{item.cantidad}</td>
                                        <td>S/. {Number(item.precio_unitario || 0).toFixed(2)}</td>
                                        <td><strong>S/. {Number(item.subtotal || 0).toFixed(2)}</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '1.25rem', fontWeight: 700 }}>
                        Total: S/. {total.toFixed(2)}
                    </div>

                    <div className="order-composer-actions-between">
                        <button className="btn btn-ghost" onClick={() => setStep(2)}>
                            <i className="bi bi-arrow-left"></i> Anterior
                        </button>
                        <button className="btn btn-accent" onClick={handleSubmit} disabled={saving}>
                            {saving ? 'Creando...' : '✓ Crear Pedido'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NuevoPedido;
