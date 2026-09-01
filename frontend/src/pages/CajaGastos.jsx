import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import Modal from '../components/Modal.jsx';
import FormDatePicker from '../components/FormDatePicker.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { useFinanceCatalogsQuery } from '../modules/finance/queries/useFinanceCatalogsQuery.js';
import { useFinanceMovementsQuery } from '../modules/finance/queries/useFinanceMovementsQuery.js';
import { useActiveCashSessionQuery } from '../modules/finance/queries/useActiveCashSessionQuery.js';
import { useCashSessionsQuery } from '../modules/finance/queries/useCashSessionsQuery.js';
import { useCreateFinanceMovementMutation } from '../modules/finance/mutations/useCreateFinanceMovementMutation.js';
import { useUpdateFinanceMovementMutation } from '../modules/finance/mutations/useUpdateFinanceMovementMutation.js';
import { useDeleteFinanceMovementMutation } from '../modules/finance/mutations/useDeleteFinanceMovementMutation.js';
import {
    useOpenCashSessionMutation,
    useCloseCashSessionMutation,
    useReopenCashSessionMutation
} from '../modules/finance/mutations/useCashSessionMutations.js';
import '../styles/caja-gastos.css';

const FALLBACK_CATEGORIES = {
    operativo: ['servicios', 'sueldos', 'alquiler', 'logistica', 'combustible', 'movilidad', 'marketing', 'otros'],
    costo_directo: ['materiales'],
    otro: ['otros']
};

const localDateInputValue = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const createDefaultForm = (defaultCategory = 'alquiler', overrides = {}) => ({
    tipo_fondo: 'caja',
    fecha_movimiento: localDateInputValue(),
    monto: '',
    categoria_gasto: defaultCategory,
    beneficiario: '',
    descripcion: '',
    sustento_tipo: 'ninguno',
    sustento_comprobante_tipo: 'factura',
    sustento_emisor_doc: '',
    sustento_emisor_razon_social: '',
    sustento_serie: '',
    sustento_numero: '',
    sustento_fecha_emision: localDateInputValue(),
    sustento_archivo_url: '',
    sustento_nota: '',
    sustento_observacion: '',
    ...overrides,
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
    const beneficiarioInputId = `${mode}-expense-beneficiario`;
    const obsInputId = `${mode}-expense-obs`;

    return (
        <>
            <div className="segmented-control expense-origin-toggle" role="group" aria-label="Origen del gasto">
                {['caja', 'banco'].map((origin) => {
                    const active = form.tipo_fondo === origin;
                    return (
                        <button
                            key={origin}
                            type="button"
                            className={`segmented-control__btn${active ? ' is-active' : ''}`}
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
                    <label className="form-label" htmlFor={dateInputId}>Fecha de Pago</label>
                    <FormDatePicker
                        id={dateInputId}
                        value={form.fecha_movimiento}
                        onChange={(fecha_movimiento) => setForm((prev) => ({ ...prev, fecha_movimiento }))}
                        aria-label="Fecha del gasto"
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
                        required
                    />
                </div>

                <div className="form-group">
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

                <div className="form-group">
                    <label className="form-label" htmlFor={beneficiarioInputId}>Proveedor / Beneficiario</label>
                    <input
                        id={beneficiarioInputId}
                        className="form-input"
                        type="text"
                        value={form.beneficiario || ''}
                        onChange={(event) => setForm((prev) => ({ ...prev, beneficiario: event.target.value }))}
                        placeholder="Ej. Distribuidora Dental S.A.C."
                    />
                </div>

                <div className="form-group expense-form-grid-span">
                    <label className="form-label" htmlFor={detailInputId}>Descripción del gasto</label>
                    <textarea
                        id={detailInputId}
                        className="form-textarea"
                        rows={2}
                        value={form.descripcion || ''}
                        onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                        placeholder="Ej. Compra de fresas de zirconio, pago de luz del local, etc."
                    ></textarea>
                </div>

                {/* Sustento del Gasto Section */}
                <div className="form-group expense-form-grid-span expense-sustento-box">
                    <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        <i className="bi bi-file-earmark-check" style={{ marginRight: '6px' }}></i>
                        Tipo de Sustento Documentario
                    </label>

                    <div className="segmented-control" style={{ marginBottom: '12px' }}>
                        {[
                            { value: 'fiscal', label: 'Fiscal (Factura/Boleta)', icon: 'bi-receipt' },
                            { value: 'simple', label: 'Simple (Recibo/Foto)', icon: 'bi-camera' },
                            { value: 'ninguno', label: 'Sin sustento', icon: 'bi-exclamation-circle' },
                        ].map((item) => {
                            const active = form.sustento_tipo === item.value;
                            return (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={`segmented-control__btn${active ? ' is-active' : ''}`}
                                    onClick={() => setForm((prev) => ({ ...prev, sustento_tipo: item.value }))}
                                >
                                    <i className={`bi ${item.icon}`} style={{ marginRight: '4px' }}></i>
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>

                    {form.sustento_tipo === 'fiscal' && (
                        <div className="expense-fiscal-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Tipo Comprobante</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={form.sustento_comprobante_tipo || 'factura'}
                                    onChange={(e) => setForm((prev) => ({ ...prev, sustento_comprobante_tipo: e.target.value }))}
                                >
                                    <option value="factura">Factura Electrónica</option>
                                    <option value="boleta">Boleta de Venta</option>
                                    <option value="recibo_honorarios">Recibo por Honorarios</option>
                                    <option value="otro">Otro Comprobante</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>RUC / Documento Emisor</label>
                                <input
                                    type="text"
                                    className="form-input form-input-sm"
                                    placeholder="20XXXXXXXXX"
                                    value={form.sustento_emisor_doc || ''}
                                    onChange={(e) => setForm((prev) => ({ ...prev, sustento_emisor_doc: e.target.value }))}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Razón Social Emisor</label>
                                <input
                                    type="text"
                                    className="form-input form-input-sm"
                                    placeholder="Nombre de la empresa o proveedor"
                                    value={form.sustento_emisor_razon_social || ''}
                                    onChange={(e) => setForm((prev) => ({ ...prev, sustento_emisor_razon_social: e.target.value }))}
                                />
                            </div>

                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px' }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Serie</label>
                                    <input
                                        type="text"
                                        className="form-input form-input-sm"
                                        placeholder="F001"
                                        value={form.sustento_serie || ''}
                                        onChange={(e) => setForm((prev) => ({ ...prev, sustento_serie: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Número</label>
                                    <input
                                        type="text"
                                        className="form-input form-input-sm"
                                        placeholder="00012345"
                                        value={form.sustento_numero || ''}
                                        onChange={(e) => setForm((prev) => ({ ...prev, sustento_numero: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {form.sustento_tipo === 'simple' && (
                        <div className="expense-simple-fields">
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Nota de sustento / Referencia de comprobante</label>
                                <input
                                    type="text"
                                    className="form-input form-input-sm"
                                    placeholder="Ej. Recibo simple #124, voucher de transferencia, etc."
                                    value={form.sustento_nota || ''}
                                    onChange={(e) => setForm((prev) => ({ ...prev, sustento_nota: e.target.value }))}
                                />
                            </div>
                        </div>
                    )}

                    {form.sustento_tipo === 'ninguno' && (
                        <div className="expense-ninguno-fields">
                            <div className="form-group">
                                <label className="form-label" htmlFor={obsInputId} style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                                    <i className="bi bi-exclamation-triangle" style={{ marginRight: '4px' }}></i>
                                    Observación explicativa obligatoria (¿Por qué no hay sustento?)
                                </label>
                                <input
                                    id={obsInputId}
                                    type="text"
                                    className="form-input form-input-sm"
                                    placeholder="Ej. Pago de pasajes en taxi sin recibo, propina, compra informal autorizada"
                                    value={form.sustento_observacion || ''}
                                    onChange={(e) => setForm((prev) => ({ ...prev, sustento_observacion: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

const CajaGastos = () => {
    const { user } = useAuth();
    const isAdmin = user?.tipo === 'admin';

    const [currentTab, setCurrentTab] = useState('egresos'); // 'egresos' | 'arqueo' | 'historial'

    // Egresos State
    const [movSearch, setMovSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [originFilter, setOriginFilter] = useState('all');
    const [sustentoFilter, setSustentoFilter] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMovement, setEditingMovement] = useState(null);
    const [movementToDelete, setMovementToDelete] = useState(null);

    // Arqueo / Cierre State
    const [aperturaMonto, setAperturaMonto] = useState('');
    const [aperturaTurno, setAperturaTurno] = useState('general');
    const [arqueoRealEfectivo, setArqueoRealEfectivo] = useState('');
    const [cierreObservaciones, setCierreObservaciones] = useState('');
    const [reaperturaModalOpen, setReaperturaModalOpen] = useState(false);
    const [selectedSessionToReopen, setSelectedSessionToReopen] = useState(null);
    const [reaperturaMotivo, setReaperturaMotivo] = useState('');

    const catalogosQuery = useFinanceCatalogsQuery();
    const movementsFilters = useMemo(() => ({
        tipo: 'egreso',
        limit: '100',
        search: movSearch
    }), [movSearch]);
    const movimientosQuery = useFinanceMovementsQuery({ filters: movementsFilters });
    const activeCashSessionQuery = useActiveCashSessionQuery();
    const cashSessionsHistoryQuery = useCashSessionsQuery(currentTab === 'historial');

    const createMovementMutation = useCreateFinanceMovementMutation();
    const updateMovementMutation = useUpdateFinanceMovementMutation();
    const deleteMovementMutation = useDeleteFinanceMovementMutation();
    const openCashSessionMutation = useOpenCashSessionMutation();
    const closeCashSessionMutation = useCloseCashSessionMutation();
    const reopenCashSessionMutation = useReopenCashSessionMutation();

    const activeSessionData = activeCashSessionQuery.data?.data || null;
    const activeSession = activeSessionData?.session || null;
    const resumenEnVivo = activeSessionData?.resumenEnVivo || {
        monto_apertura: 0,
        total_ingresos_efectivo: 0,
        total_egresos_efectivo: 0,
        saldo_teorico_efectivo: 0,
        total_ingresos_banco: 0,
        total_egresos_banco: 0,
        balance_neto_banco: 0,
        balance_neto_dia: 0
    };

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
    const filteredMovimientos = useMemo(() => {
        return movimientos.filter((movement) => {
            if (originFilter !== 'all' && movement.tipo_fondo !== originFilter) return false;
            if (sustentoFilter !== 'all' && (movement.sustento_tipo || 'ninguno') !== sustentoFilter) return false;
            return true;
        });
    }, [movimientos, originFilter, sustentoFilter]);

    const loadingMovimientos = (catalogosQuery.isLoading || movimientosQuery.isLoading) && movimientos.length === 0;
    const creatingMovimiento = createMovementMutation.isPending;
    const updatingMovimiento = updateMovementMutation.isPending;

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setMovSearch(searchInput.trim());
        }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const resetCreateForm = () => {
        setCreateForm((prev) => createDefaultForm(defaultCategory, {
            tipo_fondo: prev.tipo_fondo,
            fecha_movimiento: prev.fecha_movimiento || localDateInputValue(),
        }));
    };

    const resetModalState = () => {
        setEditingMovement(null);
        setEditForm(createDefaultForm(defaultCategory));
        setModalOpen(false);
    };

    const openEditModal = (movement) => {
        setEditingMovement(movement);
        setEditForm({
            tipo_fondo: movement.tipo_fondo || 'caja',
            fecha_movimiento: movement.fecha_movimiento
                ? String(movement.fecha_movimiento).slice(0, 10)
                : localDateInputValue(),
            monto: movement.monto ? String(movement.monto) : '',
            categoria_gasto: movement.categoria_gasto || defaultCategory,
            beneficiario: movement.beneficiario || '',
            descripcion: movement.descripcion || '',
            sustento_tipo: movement.sustento_tipo || 'ninguno',
            sustento_comprobante_tipo: movement.sustento_comprobante_tipo || 'factura',
            sustento_emisor_doc: movement.sustento_emisor_doc || '',
            sustento_emisor_razon_social: movement.sustento_emisor_razon_social || '',
            sustento_serie: movement.sustento_serie || '',
            sustento_numero: movement.sustento_numero || '',
            sustento_fecha_emision: movement.sustento_fecha_emision
                ? String(movement.sustento_fecha_emision).slice(0, 10)
                : localDateInputValue(),
            sustento_archivo_url: movement.sustento_archivo_url || '',
            sustento_nota: movement.sustento_nota || '',
            sustento_observacion: movement.sustento_observacion || ''
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
            grupo_gasto: selectedCategory?.group || 'operativo',
            categoria_gasto: form.categoria_gasto,
            beneficiario: form.beneficiario?.trim() || null,
            descripcion: form.descripcion?.trim() || null,
            sustento_tipo: form.sustento_tipo || 'ninguno',
            sustento_comprobante_tipo: form.sustento_tipo === 'fiscal' ? form.sustento_comprobante_tipo : null,
            sustento_emisor_doc: form.sustento_tipo === 'fiscal' ? form.sustento_emisor_doc?.trim() || null : null,
            sustento_emisor_razon_social: form.sustento_tipo === 'fiscal' ? form.sustento_emisor_razon_social?.trim() || null : null,
            sustento_serie: form.sustento_tipo === 'fiscal' ? form.sustento_serie?.trim() || null : null,
            sustento_numero: form.sustento_tipo === 'fiscal' ? form.sustento_numero?.trim() || null : null,
            sustento_fecha_emision: form.sustento_tipo === 'fiscal' ? form.sustento_fecha_emision || null : null,
            sustento_archivo_url: form.sustento_archivo_url?.trim() || null,
            sustento_nota: form.sustento_tipo === 'simple' ? form.sustento_nota?.trim() || null : null,
            sustento_observacion: form.sustento_tipo === 'ninguno' ? form.sustento_observacion?.trim() || null : null
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
        if (form.sustento_tipo === 'ninguno' && (!form.sustento_observacion || !form.sustento_observacion.trim())) {
            toast.error('Para gastos sin comprobante, la observación explicativa es obligatoria.');
            return false;
        }
        if (form.sustento_tipo === 'fiscal') {
            if (!form.sustento_emisor_doc || !form.sustento_emisor_doc.trim()) {
                toast.error('El RUC o documento del emisor es obligatorio para sustento fiscal.');
                return false;
            }
            if (!form.sustento_numero || !form.sustento_numero.trim()) {
                toast.error('El número de comprobante es obligatorio para sustento fiscal.');
                return false;
            }
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

    // Arqueo handlers
    const handleAbrirCaja = async (e) => {
        e.preventDefault();
        const monto = parseFloat(aperturaMonto || 0);
        try {
            await openCashSessionMutation.mutateAsync({
                payload: {
                    monto_apertura: Number.isNaN(monto) ? 0 : monto,
                    turno: aperturaTurno
                }
            });
            toast.success('Caja abierta exitosamente.');
            setAperturaMonto('');
        } catch (err) {
            toast.error(err.message || 'Error al abrir caja');
        }
    };

    const handleCerrarCaja = async (e) => {
        e.preventDefault();
        if (!activeSession) return;
        const realEfectivo = parseFloat(arqueoRealEfectivo);
        if (Number.isNaN(realEfectivo) || realEfectivo < 0) {
            toast.error('Ingresa el monto de efectivo contado en caja.');
            return;
        }

        try {
            await closeCashSessionMutation.mutateAsync({
                sesionId: activeSession.id,
                payload: {
                    monto_real_efectivo: realEfectivo,
                    observaciones_cierre: cierreObservaciones.trim() || null
                }
            });
            toast.success('Caja cerrada y arqueo registrado correctamente.');
            setArqueoRealEfectivo('');
            setCierreObservaciones('');
        } catch (err) {
            toast.error(err.message || 'Error al cerrar caja');
        }
    };

    const handleReabrirCaja = async (e) => {
        e.preventDefault();
        if (!selectedSessionToReopen) return;
        try {
            await reopenCashSessionMutation.mutateAsync({
                sesionId: selectedSessionToReopen.id,
                payload: {
                    motivo: reaperturaMotivo.trim() || 'Reapertura autorizada por administración'
                }
            });
            toast.success('Caja reabierta exitosamente.');
            setReaperturaModalOpen(false);
            setSelectedSessionToReopen(null);
            setReaperturaMotivo('');
        } catch (err) {
            toast.error(err.message || 'Error al reabrir caja');
        }
    };

    const liveDiferencia = useMemo(() => {
        if (!arqueoRealEfectivo || Number.isNaN(parseFloat(arqueoRealEfectivo))) return null;
        return parseFloat(arqueoRealEfectivo) - resumenEnVivo.saldo_teorico_efectivo;
    }, [arqueoRealEfectivo, resumenEnVivo.saldo_teorico_efectivo]);

    return (
        <div className="animate-fade-in expenses-page-shell">
            <div className="page-header expenses-page-header">
                <div className="page-header-left">
                    <h1>Caja y Gastos</h1>
                    <p>Control integral de caja diaria, arqueos, sustentos y balance financiero.</p>
                </div>
                {activeSession && (
                    <div className="page-header-right">
                        <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>
                            <i className="bi bi-unlock-fill" style={{ marginRight: '6px' }}></i>
                            Caja Abierta (Turno {activeSession.turno})
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="section-tabs dashboard-view-switcher" role="group" aria-label="Secciones de caja">
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${currentTab === 'egresos' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setCurrentTab('egresos')}
                    aria-pressed={currentTab === 'egresos'}
                >
                    <i className="bi bi-receipt-cutoff" aria-hidden="true"></i> Gastos y Egresos
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${currentTab === 'arqueo' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setCurrentTab('arqueo')}
                    aria-pressed={currentTab === 'arqueo'}
                >
                    <i className="bi bi-calculator" aria-hidden="true"></i> Arqueo y Cierre Diario
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${currentTab === 'historial' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setCurrentTab('historial')}
                    aria-pressed={currentTab === 'historial'}
                >
                    <i className="bi bi-clock-history" aria-hidden="true"></i> Historial de Cierres
                </button>
            </div>

            {/* TAB 1: GASTOS Y EGRESOS */}
            {currentTab === 'egresos' && (
                <div className="expenses-layout">
                    <section className="card expenses-create-card">
                        <div className="expenses-panel-head">
                            <h2 className="card-title">Registrar Gasto</h2>
                            <p className="expenses-panel-sub">Egresos operativos o de materiales con clasificación</p>
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
                                    <i className="bi bi-plus-lg" aria-hidden="true"></i>
                                    {creatingMovimiento ? 'Registrando...' : 'Registrar gasto'}
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="card expenses-table-card">
                        <div className="expenses-panel-head expenses-panel-head--table">
                            <div>
                                <h2 className="card-title">Gastos Registrados</h2>
                                <p className="expenses-panel-sub">{filteredMovimientos.length} egresos en total</p>
                            </div>

                            <div className="expenses-table-toolbar">
                                <div className="search-box expenses-search-box">
                                    <i className="bi bi-search" aria-hidden="true"></i>
                                    <input
                                        className="form-input"
                                        placeholder="Buscar categoría, proveedor o detalle..."
                                        value={searchInput}
                                        onChange={(event) => setSearchInput(event.target.value)}
                                        aria-label="Buscar gastos"
                                    />
                                </div>
                                <div className="expenses-table-pills" role="group" aria-label="Filtrar por origen">
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${originFilter === 'all' ? ' is-active' : ''}`}
                                        aria-pressed={originFilter === 'all'}
                                        onClick={() => setOriginFilter('all')}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${originFilter === 'caja' ? ' is-active' : ''}`}
                                        aria-pressed={originFilter === 'caja'}
                                        onClick={() => setOriginFilter('caja')}
                                    >
                                        <i className="bi bi-cash-coin" aria-hidden="true"></i>
                                        Caja
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm pedidos-filter-chip${originFilter === 'banco' ? ' is-active' : ''}`}
                                        aria-pressed={originFilter === 'banco'}
                                        onClick={() => setOriginFilter('banco')}
                                    >
                                        <i className="bi bi-bank" aria-hidden="true"></i>
                                        Banco
                                    </button>
                                </div>
                            </div>
                        </div>

                        {loadingMovimientos ? (
                            <div className="expenses-skeleton-list" aria-busy="true">
                                {[1, 2, 3].map((item) => (
                                    <div key={item} className="skeleton expenses-skeleton-row" />
                                ))}
                            </div>
                        ) : filteredMovimientos.length === 0 ? (
                            <div className="empty-state expenses-empty-state">
                                <i className="bi bi-receipt-cutoff empty-state-icon" aria-hidden="true"></i>
                                <h3 className="empty-state-title">
                                    {movimientos.length === 0 ? 'Sin gastos registrados' : 'Sin resultados'}
                                </h3>
                                <p className="empty-state-text">
                                    {movimientos.length === 0
                                        ? 'Registra el primer gasto con el formulario de la izquierda.'
                                        : 'Prueba otro origen o cambia la búsqueda.'}
                                </p>
                            </div>
                        ) : (
                            <div className="data-table-wrapper expenses-table-wrapper">
                                <table className="data-table expenses-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Origen</th>
                                        <th>Categoría</th>
                                        <th>Beneficiario / Detalle</th>
                                        <th>Sustento</th>
                                        <th>Monto</th>
                                        <th style={{ width: 100 }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMovimientos.map((movimiento) => {
                                        const sustentoTipo = movimiento.sustento_tipo || 'ninguno';
                                        return (
                                            <tr key={movimiento.id}>
                                                <td>{formatDateShort(movimiento.fecha_movimiento)}</td>
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
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        {movimiento.beneficiario && (
                                                            <strong style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
                                                                {movimiento.beneficiario}
                                                            </strong>
                                                        )}
                                                        <div className="expenses-detail-cell">{movimiento.descripcion || '—'}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {sustentoTipo === 'fiscal' ? (
                                                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                                            <i className="bi bi-file-earmark-check"></i>
                                                            {movimiento.sustento_serie && movimiento.sustento_numero
                                                                ? `${movimiento.sustento_serie}-${movimiento.sustento_numero}`
                                                                : 'Fiscal'}
                                                        </span>
                                                    ) : sustentoTipo === 'simple' ? (
                                                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                                            <i className="bi bi-camera"></i>
                                                            Simple
                                                        </span>
                                                    ) : (
                                                        <span className="badge badge-secondary" title={movimiento.sustento_observacion || 'Sin sustento'} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', opacity: 0.85 }}>
                                                            <i className="bi bi-dash-circle"></i>
                                                            Ninguno
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <strong className="expenses-amount-cell">{formatCurrency(movimiento.monto)}</strong>
                                                </td>
                                                <td>
                                                    <div className="expenses-action-row">
                                                        <button type="button" className="btn btn-ghost btn-sm btn-icon expenses-action-btn" title="Editar gasto" aria-label="Editar gasto" onClick={() => openEditModal(movimiento)}>
                                                            <i className="bi bi-pencil" aria-hidden="true"></i>
                                                        </button>
                                                        <button type="button" className="btn btn-ghost btn-sm btn-icon expenses-action-btn is-danger" title="Eliminar gasto" aria-label="Eliminar gasto" onClick={() => setMovementToDelete(movimiento)} disabled={deleteMovementMutation.isPending}>
                                                            <i className="bi bi-trash" aria-hidden="true"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
            )}

            {/* TAB 2: ARQUEO Y CIERRE DIARIO */}
            {currentTab === 'arqueo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {/* Live Summary Cards */}
                    <div className="order-wizard-confirm-hero" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                        <div className="order-wizard-confirm-stat">
                            <div className="order-wizard-confirm-stat-copy">
                                <span className="order-wizard-confirm-label">
                                    <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i> Apertura de Caja
                                </span>
                                <strong>{formatCurrency(resumenEnVivo.monto_apertura)}</strong>
                                <em className="order-wizard-confirm-meta">Fondo inicial del turno</em>
                            </div>
                        </div>

                        <div className="order-wizard-confirm-stat" style={{ borderLeft: '3px solid var(--color-success)' }}>
                            <div className="order-wizard-confirm-stat-copy">
                                <span className="order-wizard-confirm-label" style={{ color: 'var(--color-success)' }}>
                                    <i className="bi bi-cash-coin" aria-hidden="true"></i> Saldo Teórico en Caja
                                </span>
                                <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(resumenEnVivo.saldo_teorico_efectivo)}</strong>
                                <em className="order-wizard-confirm-meta">
                                    + Ing: {formatCurrency(resumenEnVivo.total_ingresos_efectivo)} | - Egr: {formatCurrency(resumenEnVivo.total_egresos_efectivo)}
                                </em>
                            </div>
                        </div>

                        <div className="order-wizard-confirm-stat" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                            <div className="order-wizard-confirm-stat-copy">
                                <span className="order-wizard-confirm-label" style={{ color: 'var(--color-primary)' }}>
                                    <i className="bi bi-bank" aria-hidden="true"></i> Balance Neto Bancos
                                </span>
                                <strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(resumenEnVivo.balance_neto_banco)}</strong>
                                <em className="order-wizard-confirm-meta">
                                    + Ing: {formatCurrency(resumenEnVivo.total_ingresos_banco)} | - Egr: {formatCurrency(resumenEnVivo.total_egresos_banco)}
                                </em>
                            </div>
                        </div>

                        <div className="order-wizard-confirm-stat">
                            <div className="order-wizard-confirm-stat-copy">
                                <span className="order-wizard-confirm-label">
                                    <i className="bi bi-graph-up" aria-hidden="true"></i> Flujo Neto Total
                                </span>
                                <strong>{formatCurrency(resumenEnVivo.balance_neto_dia)}</strong>
                                <em className="order-wizard-confirm-meta">Efectivo + Bancos del día</em>
                            </div>
                        </div>
                    </div>

                    {/* Operational Session Action Box */}
                    {!activeSession ? (
                        <div className="card" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                            <div className="card-header">
                                <h3 className="card-title">
                                    <i className="bi bi-key" style={{ marginRight: '8px' }}></i>
                                    Apertura de Caja Diaria
                                </h3>
                                <p className="expenses-panel-sub">Inicia la sesión de caja del día para registrar cobros y egresos.</p>
                            </div>
                            <form onSubmit={handleAbrirCaja} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Monto de Apertura en Efectivo (S/.)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        placeholder="0.00"
                                        value={aperturaMonto}
                                        onChange={(e) => setAperturaMonto(e.target.value)}
                                    />
                                    <p className="detail-finanza-field-hint">Monto físico inicial con el que abre la caja.</p>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Turno</label>
                                    <select
                                        className="form-select"
                                        value={aperturaTurno}
                                        onChange={(e) => setAperturaTurno(e.target.value)}
                                    >
                                        <option value="general">Turno General / Día Completo</option>
                                        <option value="manana">Turno Mañana</option>
                                        <option value="tarde">Turno Tarde</option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={openCashSessionMutation.isPending}
                                >
                                    <i className="bi bi-unlock" style={{ marginRight: '6px' }}></i>
                                    {openCashSessionMutation.isPending ? 'Abriendo caja...' : 'Abrir Sesión de Caja'}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="card" style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
                            <div className="card-header">
                                <h3 className="card-title">
                                    <i className="bi bi-calculator" style={{ marginRight: '8px' }}></i>
                                    Arqueo y Cierre de Caja
                                </h3>
                                <p className="expenses-panel-sub">
                                    Sesión abierta por <strong>{activeSession.abierto_por_nombre || 'Usuario'}</strong> desde las {formatDateShort(activeSession.abierto_at)}.
                                </p>
                            </div>

                            <form onSubmit={handleCerrarCaja} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">
                                        Efectivo Contado Físicamente en Caja (S/.) <span style={{ color: 'var(--color-danger)' }}>*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        placeholder="0.00"
                                        value={arqueoRealEfectivo}
                                        onChange={(e) => setArqueoRealEfectivo(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                    <p className="detail-finanza-field-hint">
                                        Saldo teórico esperado según sistema: <strong>{formatCurrency(resumenEnVivo.saldo_teorico_efectivo)}</strong>
                                    </p>
                                </div>

                                {liveDiferencia !== null && (
                                    <div
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: liveDiferencia === 0
                                                ? 'rgba(16, 185, 129, 0.1)'
                                                : liveDiferencia < 0
                                                ? 'rgba(239, 68, 68, 0.1)'
                                                : 'rgba(59, 130, 246, 0.1)',
                                            border: `1px solid ${
                                                liveDiferencia === 0
                                                    ? '#10b981'
                                                    : liveDiferencia < 0
                                                    ? '#ef4444'
                                                    : '#3b82f6'
                                            }`
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <i className={`bi ${liveDiferencia === 0 ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`}></i>
                                            <strong>
                                                {liveDiferencia === 0
                                                    ? 'Cuadre Perfecto'
                                                    : liveDiferencia < 0
                                                    ? 'Faltante de Efectivo'
                                                    : 'Sobrante de Efectivo'}
                                            </strong>
                                        </div>
                                        <strong style={{ fontSize: '1.1rem' }}>
                                            {formatCurrency(liveDiferencia)}
                                        </strong>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">Observaciones / Justificación de Cierre</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={2}
                                        placeholder="Ej. Redondeo en sencillo, entrega a gerencia, etc."
                                        value={cierreObservaciones}
                                        onChange={(e) => setCierreObservaciones(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={closeCashSessionMutation.isPending}
                                >
                                    <i className="bi bi-lock-fill" style={{ marginRight: '6px' }}></i>
                                    {closeCashSessionMutation.isPending ? 'Cerrando caja...' : 'Confirmar Arqueo y Cerrar Caja'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: HISTORIAL DE CIERRES */}
            {currentTab === 'historial' && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Historial de Sesiones y Cierres de Caja</h3>
                        <p className="expenses-panel-sub">Registro auditable de aperturas, conteos y discrepancias.</p>
                    </div>

                    {cashSessionsHistoryQuery.isLoading ? (
                        <div>
                            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}
                        </div>
                    ) : (cashSessionsHistoryQuery.data?.data || []).length === 0 ? (
                        <div className="empty-state">
                            <i className="bi bi-clock-history empty-state-icon"></i>
                            <h3 className="empty-state-title">Sin cierres registrados</h3>
                            <p className="empty-state-text">Los cierres diarios de caja aparecerán aquí.</p>
                        </div>
                    ) : (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Fecha / Turno</th>
                                        <th>Apertura</th>
                                        <th>Ingresos Ef.</th>
                                        <th>Egresos Ef.</th>
                                        <th>Esperado</th>
                                        <th>Real Contado</th>
                                        <th>Diferencia</th>
                                        <th>Estado</th>
                                        <th>Auditoría</th>
                                        {isAdmin && <th>Acciones</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(cashSessionsHistoryQuery.data?.data || []).map((s) => {
                                        const dif = s.diferencia_efectivo !== null ? parseFloat(s.diferencia_efectivo) : null;
                                        return (
                                            <tr key={s.id}>
                                                <td>
                                                    <strong>{formatDateShort(s.fecha)}</strong>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                        Turno {s.turno}
                                                    </div>
                                                </td>
                                                <td>{formatCurrency(s.monto_apertura)}</td>
                                                <td style={{ color: 'var(--color-success)' }}>{formatCurrency(s.total_ingresos_efectivo)}</td>
                                                <td style={{ color: 'var(--color-danger)' }}>{formatCurrency(s.total_egresos_efectivo)}</td>
                                                <td><strong>{formatCurrency(s.monto_esperado_efectivo)}</strong></td>
                                                <td>
                                                    {s.monto_real_efectivo !== null ? (
                                                        <strong>{formatCurrency(s.monto_real_efectivo)}</strong>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    {dif !== null ? (
                                                        <span style={{
                                                            fontWeight: 600,
                                                            color: dif === 0 ? 'var(--color-success)' : dif < 0 ? 'var(--color-danger)' : 'var(--color-primary)'
                                                        }}>
                                                            {formatCurrency(dif)}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    <span className={`badge ${s.estado === 'abierta' ? 'badge-success' : 'badge-secondary'}`}>
                                                        {s.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '0.75rem' }}>
                                                        <div>Abierto: {s.abierto_por_nombre || '—'}</div>
                                                        {s.cerrado_por_nombre && <div>Cerrado: {s.cerrado_por_nombre}</div>}
                                                        {s.reabierto_por_nombre && <div style={{ color: '#f59e0b' }}>Reabierto: {s.reabierto_por_nombre}</div>}
                                                    </div>
                                                </td>
                                                {isAdmin && (
                                                    <td>
                                                        {s.estado === 'cerrada' && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-ghost"
                                                                title="Reabrir caja para ajustes"
                                                                onClick={() => {
                                                                    setSelectedSessionToReopen(s);
                                                                    setReaperturaModalOpen(true);
                                                                }}
                                                            >
                                                                <i className="bi bi-unlock" style={{ color: '#f59e0b' }}></i> Reabrir
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Editar Gasto */}
            <Modal
                open={modalOpen}
                onClose={resetModalState}
                title="Editar gasto"
                size="lg"
                className="expenses-edit-modal"
                footer={(
                    <div className="modal-footer-actions">
                        <button type="button" className="btn btn-secondary" onClick={resetModalState}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleUpdateMovimiento}
                            disabled={updatingMovimiento}
                        >
                            {updatingMovimiento ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                )}
            >
                <form className="expenses-form-card" onSubmit={handleUpdateMovimiento}>
                    <ExpenseFormFields
                        form={editForm}
                        setForm={setEditForm}
                        categoryOptions={categoryOptions}
                        mode="edit"
                    />
                </form>
            </Modal>

            {/* Modal Confirmar Eliminación Gasto */}
            <Modal
                open={Boolean(movementToDelete)}
                onClose={() => setMovementToDelete(null)}
                title="Confirmar eliminación"
                size="sm"
                footer={(
                    <div className="modal-footer-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setMovementToDelete(null)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleDeleteMovimiento(movementToDelete)}
                            disabled={deleteMovementMutation.isPending}
                        >
                            {deleteMovementMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                        </button>
                    </div>
                )}
            >
                <p>
                    ¿Estás seguro de que deseas eliminar este gasto de <strong>{formatCurrency(movementToDelete?.monto)}</strong> ({prettifyLabel(movementToDelete?.categoria_gasto)})?
                </p>
            </Modal>

            {/* Modal Reabrir Caja (Admin Only) */}
            <Modal
                open={reaperturaModalOpen}
                onClose={() => {
                    setReaperturaModalOpen(false);
                    setSelectedSessionToReopen(null);
                }}
                title="Reapertura de Caja Diaria (Auditoría)"
                size="md"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setReaperturaModalOpen(false);
                                setSelectedSessionToReopen(null);
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleReabrirCaja}
                            disabled={reopenCashSessionMutation.isPending}
                        >
                            {reopenCashSessionMutation.isPending ? 'Reabriendo...' : 'Confirmar Reapertura'}
                        </button>
                    </div>
                )}
            >
                <form onSubmit={handleReabrirCaja} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '10px 14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: '8px', color: '#b45309', fontSize: '0.85rem' }}>
                        <i className="bi bi-shield-lock" style={{ marginRight: '6px' }}></i>
                        Acción administrativa: La reapertura quedará registrada en el log de auditoría.
                    </div>
                    <div className="form-group">
                        <label className="form-label">Motivo de la Reapertura <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <textarea
                            className="form-textarea"
                            rows={3}
                            placeholder="Explica el motivo por el cual se reabre la caja cerrada..."
                            value={reaperturaMotivo}
                            onChange={(e) => setReaperturaMotivo(e.target.value)}
                            required
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default CajaGastos;
