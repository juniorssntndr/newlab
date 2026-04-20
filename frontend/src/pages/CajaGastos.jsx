import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import Modal from '../components/Modal.jsx';
import { useFinanceCatalogsQuery } from '../modules/finance/queries/useFinanceCatalogsQuery.js';
import { useFinanceMovementsQuery } from '../modules/finance/queries/useFinanceMovementsQuery.js';
import { useCreateFinanceMovementMutation } from '../modules/finance/mutations/useCreateFinanceMovementMutation.js';
import { useUpdateFinanceMovementMutation } from '../modules/finance/mutations/useUpdateFinanceMovementMutation.js';
import { useDeleteFinanceMovementMutation } from '../modules/finance/mutations/useDeleteFinanceMovementMutation.js';
import '../styles/caja-gastos.css';

const FALLBACK_CATEGORIES = {
    operativo: ['alquiler', 'servicios', 'sueldos', 'logistica', 'marketing'],
    costo_directo: ['materiales'],
    otro: ['otros']
};

const createDefaultForm = (defaultCategory = 'alquiler') => ({
    tipo_fondo: 'banco',
    fecha_movimiento: new Date().toISOString().slice(0, 10),
    monto: '',
    categoria_gasto: defaultCategory,
    descripcion: ''
});

const prettifyLabel = (value = '') => {
    if (!value) return '';
    return value
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const formatDateShort = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const formatCurrency = (value) => {
    const number = parseFloat(value || 0);
    if (Number.isNaN(number)) return 'S/. 0.00';
    return `S/. ${number.toFixed(2)}`;
};

const getOriginLabel = (tipoFondo) => (tipoFondo === 'caja' ? 'Caja' : 'Banco');

const ExpenseFormFields = ({ form, setForm, categoryOptions, mode = 'create' }) => {
    const amountInputId = `${mode}-expense-amount`;
    const dateInputId = `${mode}-expense-date`;
    const categoryInputId = `${mode}-expense-category`;
    const detailInputId = `${mode}-expense-detail`;

    return (
        <>
            <div className="expense-origin-toggle" role="group" aria-label="Origen del gasto">
                {['banco', 'caja'].map((origin) => {
                    const active = form.tipo_fondo === origin;
                    return (
                        <button
                            key={origin}
                            type="button"
                            className={`expense-origin-chip ${active ? 'is-active' : ''}`}
                            aria-pressed={active}
                            onClick={() => setForm((prev) => ({ ...prev, tipo_fondo: origin }))}
                        >
                            <i className={`bi ${origin === 'banco' ? 'bi-bank' : 'bi-cash-coin'}`} aria-hidden="true"></i>
                            {getOriginLabel(origin)}
                        </button>
                    );
                })}
            </div>

            <div className="expense-form-grid">
                <div className="form-group">
                    <label className="form-label" htmlFor={dateInputId}>Fecha</label>
                    <input
                        id={dateInputId}
                        className="form-input"
                        type="date"
                        value={form.fecha_movimiento}
                        onChange={(event) => setForm((prev) => ({ ...prev, fecha_movimiento: event.target.value }))}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor={amountInputId}>Monto (S/.)</label>
                    <input
                        id={amountInputId}
                        className="form-input expense-amount-input"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={form.monto}
                        onChange={(event) => setForm((prev) => ({ ...prev, monto: event.target.value }))}
                        placeholder="0.00"
                    />
                </div>

                <div className="form-group expense-form-grid-span">
                    <label className="form-label" htmlFor={categoryInputId}>Categoría</label>
                    <select
                        id={categoryInputId}
                        className="form-select"
                        value={form.categoria_gasto}
                        onChange={(event) => setForm((prev) => ({ ...prev, categoria_gasto: event.target.value }))}
                    >
                        {categoryOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group expense-form-grid-span">
                    <label className="form-label" htmlFor={detailInputId}>Detalle libre</label>
                    <textarea
                        id={detailInputId}
                        className="form-textarea"
                        rows={mode === 'edit' ? 3 : 4}
                        value={form.descripcion}
                        onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                        placeholder="Ej. Pago de alquiler del local, servicio de internet o compra puntual."
                    ></textarea>
                </div>
            </div>
        </>
    );
};

const CajaGastos = () => {
    const [movSearch, setMovSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMovement, setEditingMovement] = useState(null);
    const [movementToDelete, setMovementToDelete] = useState(null);

    const catalogosQuery = useFinanceCatalogsQuery();
    const movementsFilters = useMemo(() => ({
        tipo: 'egreso',
        limit: '60',
        search: movSearch
    }), [movSearch]);
    const movimientosQuery = useFinanceMovementsQuery({ filters: movementsFilters });
    const createMovementMutation = useCreateFinanceMovementMutation();
    const updateMovementMutation = useUpdateFinanceMovementMutation();
    const deleteMovementMutation = useDeleteFinanceMovementMutation();

    const categoriasByGroup = catalogosQuery.data?.categorias_gasto || FALLBACK_CATEGORIES;
    const categoryOptions = useMemo(() => {
        return Object.entries(categoriasByGroup).flatMap(([group, categories]) => (
            (categories || []).map((category) => ({
                value: category,
                label: prettifyLabel(category),
                group
            }))
        ));
    }, [categoriasByGroup]);
    const defaultCategory = categoryOptions[0]?.value || 'alquiler';

    const [createForm, setCreateForm] = useState(() => createDefaultForm(defaultCategory));
    const [editForm, setEditForm] = useState(() => createDefaultForm(defaultCategory));

    const movimientos = movimientosQuery.data || [];
    const loadingMovimientos = (catalogosQuery.isLoading || movimientosQuery.isLoading) && movimientos.length === 0;
    const creatingMovimiento = createMovementMutation.isPending;
    const updatingMovimiento = updateMovementMutation.isPending;

    useEffect(() => {
        if (!createForm.categoria_gasto && defaultCategory) {
            setCreateForm((prev) => ({ ...prev, categoria_gasto: defaultCategory }));
        }
        if (!editForm.categoria_gasto && defaultCategory) {
            setEditForm((prev) => ({ ...prev, categoria_gasto: defaultCategory }));
        }
    }, [defaultCategory, createForm.categoria_gasto, editForm.categoria_gasto]);

    const visibleCajaCount = useMemo(() => movimientos.filter((movement) => movement.tipo_fondo === 'caja').length, [movimientos]);
    const visibleBancoCount = movimientos.length - visibleCajaCount;

    const applyMovementSearch = () => {
        setMovSearch(searchInput.trim());
    };

    const resetCreateForm = () => {
        setCreateForm(createDefaultForm(defaultCategory));
    };

    const resetModalState = () => {
        setEditingMovement(null);
        setEditForm(createDefaultForm(defaultCategory));
        setModalOpen(false);
    };

    const openEditModal = (movement) => {
        setEditingMovement(movement);
        setEditForm({
            tipo_fondo: movement.tipo_fondo || 'banco',
            fecha_movimiento: movement.fecha_movimiento ? String(movement.fecha_movimiento).slice(0, 10) : new Date().toISOString().slice(0, 10),
            monto: movement.monto ? String(movement.monto) : '',
            categoria_gasto: movement.categoria_gasto || defaultCategory,
            descripcion: movement.descripcion || ''
        });
        setModalOpen(true);
    };

    const buildPayload = (form) => {
        const selectedCategory = categoryOptions.find((option) => option.value === form.categoria_gasto);
        return {
            tipo: 'egreso',
            tipo_fondo: form.tipo_fondo,
            fecha_movimiento: form.fecha_movimiento,
            monto: parseFloat(form.monto),
            grupo_gasto: selectedCategory?.group || 'otro',
            categoria_gasto: form.categoria_gasto,
            descripcion: form.descripcion?.trim() || null
        };
    };

    const validateForm = (form) => {
        if (!form.fecha_movimiento) {
            toast.error('Selecciona una fecha para el gasto.');
            return false;
        }
        if (!form.monto || parseFloat(form.monto) <= 0) {
            toast.error('Ingresa un monto válido mayor a 0.');
            return false;
        }
        if (!form.categoria_gasto) {
            toast.error('Selecciona una categoría para clasificar el gasto.');
            return false;
        }
        return true;
    };

    const handleCreateMovimiento = async (event) => {
        event.preventDefault();
        if (!validateForm(createForm)) return;

        try {
            await createMovementMutation.mutateAsync(buildPayload(createForm));
            toast.success('Gasto registrado correctamente.');
            resetCreateForm();
        } catch (error) {
            toast.error(error.message || 'No se pudo registrar el gasto.');
        }
    };

    const handleUpdateMovimiento = async (event) => {
        event.preventDefault();
        if (!editingMovement || !validateForm(editForm)) return;

        try {
            await updateMovementMutation.mutateAsync({
                movementId: editingMovement.id,
                payload: buildPayload(editForm)
            });
            toast.success('Gasto actualizado correctamente.');
            resetModalState();
        } catch (error) {
            toast.error(error.message || 'No se pudo guardar el gasto.');
        }
    };

    const handleDeleteMovimiento = async (movement) => {
        try {
            await deleteMovementMutation.mutateAsync(movement.id);
            toast.success('Gasto eliminado correctamente.');
            setMovementToDelete(null);
        } catch (error) {
            toast.error(error.message || 'No se pudo eliminar el gasto.');
        }
    };

    return (
        <div className="animate-fade-in expenses-page-shell">
            <div className="page-header expenses-page-header">
                <div className="page-header-left">
                    <h1>Caja y Gastos</h1>
                    <p>Registra, corrige y controla los gastos del laboratorio desde un solo lugar.</p>
                </div>
            </div>

            <div className="expenses-layout">
                <section className="card expenses-create-card">
                    <div className="expenses-panel-head">
                        <div>
                            <span className="expenses-panel-kicker">Registro directo</span>
                            <h2 className="card-title">Nuevo gasto</h2>
                        </div>
                    </div>

                    <form className="expenses-form-card" onSubmit={handleCreateMovimiento}>
                        <ExpenseFormFields
                            form={createForm}
                            setForm={setCreateForm}
                            categoryOptions={categoryOptions}
                            mode="create"
                        />

                        <div className="expenses-form-footer">
                            <button type="submit" className="btn btn-primary expenses-submit-btn" disabled={creatingMovimiento}>
                                <i className="bi bi-plus-circle" aria-hidden="true"></i>
                                {creatingMovimiento ? 'Registrando...' : 'Registrar gasto'}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="card expenses-table-card">
                    <div className="expenses-panel-head expenses-panel-head--table">
                        <div>
                            <span className="expenses-panel-kicker">Historial reciente</span>
                            <h2 className="card-title">Gastos registrados</h2>
                        </div>

                        <div className="expenses-table-toolbar">
                            <div className="expenses-table-pills" aria-label="Resumen rápido de origen">
                                <span className="expenses-table-pill">Caja: {visibleCajaCount}</span>
                                <span className="expenses-table-pill">Banco: {visibleBancoCount}</span>
                            </div>
                            <div className="search-box expenses-search-box">
                                <i className="bi bi-search" aria-hidden="true"></i>
                                <input
                                    className="form-input"
                                    placeholder="Buscar categoría o detalle"
                                    value={searchInput}
                                    onChange={(event) => setSearchInput(event.target.value)}
                                    onKeyDown={(event) => event.key === 'Enter' && applyMovementSearch()}
                                />
                            </div>
                        </div>
                    </div>

                    {loadingMovimientos ? (
                        <div>{[1, 2, 3].map((item) => <div key={item} className="skeleton" style={{ height: 72, marginBottom: 10, borderRadius: 12 }} />)}</div>
                    ) : movimientos.length === 0 ? (
                        <div className="empty-state expenses-empty-state">
                            <i className="bi bi-receipt-cutoff empty-state-icon" aria-hidden="true"></i>
                            <h3 className="empty-state-title">Sin gastos registrados</h3>
                            <p className="empty-state-text">Usa el formulario de la izquierda para empezar a construir el historial financiero del laboratorio.</p>
                        </div>
                    ) : (
                        <div className="data-table-wrapper expenses-table-wrapper">
                            <table className="data-table expenses-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Origen</th>
                                        <th>Categoría</th>
                                        <th>Detalle</th>
                                        <th>Monto</th>
                                        <th style={{ width: 132 }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimientos.map((movimiento, index) => (
                                        <tr key={movimiento.id}>
                                            <td>
                                                <div className="expenses-date-cell">
                                                    <strong>{formatDateShort(movimiento.fecha_movimiento)}</strong>
                                                    <span>{index === 0 ? 'Más reciente' : 'Registrado'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`expenses-origin-badge ${movimiento.tipo_fondo === 'caja' ? 'is-cash' : 'is-bank'}`}>
                                                    <i className={`bi ${movimiento.tipo_fondo === 'caja' ? 'bi-cash-coin' : 'bi-bank'}`} aria-hidden="true"></i>
                                                    {getOriginLabel(movimiento.tipo_fondo)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="expenses-category-badge">{prettifyLabel(movimiento.categoria_gasto) || '—'}</span>
                                            </td>
                                            <td>
                                                <div className="expenses-detail-cell">{movimiento.descripcion || 'Sin detalle adicional'}</div>
                                            </td>
                                            <td>
                                                <strong className="expenses-amount-cell">{formatCurrency(movimiento.monto)}</strong>
                                            </td>
                                            <td>
                                                <div className="expenses-action-row">
                                                    <button type="button" className="btn btn-ghost btn-sm btn-icon expenses-action-btn" title="Editar gasto" aria-label="Editar gasto" onClick={() => openEditModal(movimiento)}>
                                                        <i className="bi bi-pencil-square" aria-hidden="true"></i>
                                                    </button>
                                                    <button type="button" className="btn btn-ghost btn-sm btn-icon expenses-action-btn is-danger" title="Eliminar gasto" aria-label="Eliminar gasto" onClick={() => setMovementToDelete(movimiento)} disabled={deleteMovementMutation.isPending}>
                                                        <i className="bi bi-trash" aria-hidden="true"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            <Modal
                open={modalOpen}
                onClose={resetModalState}
                title="Editar gasto"
                size="lg"
                className="expenses-edit-modal"
                footer={(
                    <>
                        <button type="button" className="btn btn-ghost" onClick={resetModalState}>
                            Cancelar
                        </button>
                        <button type="submit" form="gasto-edit-form" className="btn btn-primary" disabled={updatingMovimiento}>
                            {updatingMovimiento ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </>
                )}
            >
                <form id="gasto-edit-form" onSubmit={handleUpdateMovimiento}>
                    <div className="expenses-edit-copy">
                        <p>Corrige origen, categoría o detalle sin perder el contexto del historial.</p>
                    </div>
                    <ExpenseFormFields
                        form={editForm}
                        setForm={setEditForm}
                        categoryOptions={categoryOptions}
                        mode="edit"
                    />
                </form>
            </Modal>

            <Modal
                open={!!movementToDelete}
                onClose={() => setMovementToDelete(null)}
                title="Eliminar gasto"
                size="lg"
                footer={(
                    <>
                        <button type="button" className="btn btn-ghost" onClick={() => setMovementToDelete(null)} disabled={deleteMovementMutation.isPending}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => movementToDelete && handleDeleteMovimiento(movementToDelete)}
                            disabled={deleteMovementMutation.isPending}
                        >
                            <i className="bi bi-trash" aria-hidden="true"></i>
                            {deleteMovementMutation.isPending ? 'Eliminando...' : 'Confirmar eliminación'}
                        </button>
                    </>
                )}
            >
                <div className="expenses-edit-copy">
                    <p>
                        ¿Eliminar definitivamente el gasto de <strong>{movementToDelete ? formatCurrency(movementToDelete.monto) : 'S/. 0.00'}</strong>
                        {movementToDelete ? ` en ${prettifyLabel(movementToDelete.categoria_gasto)}` : ''}? Esta acción no podrá deshacerse.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default CajaGastos;
