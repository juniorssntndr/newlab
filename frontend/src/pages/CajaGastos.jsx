import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Modal from '../components/Modal.jsx';
import FormDatePicker from '../components/FormDatePicker.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { useFinanceCatalogsQuery } from '../modules/finance/queries/useFinanceCatalogsQuery.js';
import { useFinanceMovementsQuery } from '../modules/finance/queries/useFinanceMovementsQuery.js';
import { useFacturacionListQuery } from '../modules/finance/queries/useFacturacionListQuery.js';
import { useActiveCashSessionQuery } from '../modules/finance/queries/useActiveCashSessionQuery.js';
import { useCashSessionsQuery } from '../modules/finance/queries/useCashSessionsQuery.js';
import { useFinanceAccountsQuery } from '../modules/finance/queries/useFinanceAccountsQuery.js';
import { useCreateFinanceMovementMutation } from '../modules/finance/mutations/useCreateFinanceMovementMutation.js';
import { useUpdateFinanceMovementMutation } from '../modules/finance/mutations/useUpdateFinanceMovementMutation.js';
import { useDeleteFinanceMovementMutation } from '../modules/finance/mutations/useDeleteFinanceMovementMutation.js';
import { useRegisterPaymentMutation } from '../modules/finance/mutations/useRegisterPaymentMutation.js';
import { useRegisterConsolidatedPaymentMutation } from '../modules/finance/mutations/useRegisterConsolidatedPaymentMutation.js';
import { useCreateInvoiceMutation } from '../modules/billing/mutations/useCreateInvoiceMutation.js';
import { syncInvoice } from '../modules/billing/api/billingApi.js';
import { useEmpresaFiscalQuery } from '../modules/billing/queries/useEmpresaFiscalQuery.js';
import {
    useOpenCashSessionMutation,
    useCloseCashSessionMutation,
    useReopenCashSessionMutation
} from '../modules/finance/mutations/useCashSessionMutations.js';
import OrderProductThumb from '../components/orders/OrderProductThumb.jsx';
import AfinixLogo from '../components/AfinixLogo.jsx';
import ComprobantePrintSheet from '../components/billing/ComprobantePrintSheet.jsx';
import CajaCierrePrintSheet from '../components/billing/CajaCierrePrintSheet.jsx';
import { generateReceiptHash } from '../utils/sunatReceipt.js';
import { CATEGORIA_GASTO_LABELS, formatCategoriaGasto } from '../constants/financeCategories.js';
import '../styles/caja-gastos.css';

export { CATEGORIA_GASTO_LABELS, formatCategoriaGasto };

const FALLBACK_CATEGORIES = {
    costo_directo: ['materiales'],
    operativo: ['logistica', 'servicios', 'alquiler', 'sueldos', 'mantenimiento', 'gastos_generales', 'marketing', 'otros'],
    otro: []
};

const INGRESO_CATEGORIES = [
    { value: 'cobro_directo', label: 'Cobro de Pedido / Trabajo' },
    { value: 'anticipo_cuenta', label: 'Anticipo a Cuenta' },
    { value: 'aporte_capital', label: 'Aporte de Capital / Inyección' },
    { value: 'venta_insumos', label: 'Venta de Insumos / Desechos' },
    { value: 'ajuste_caja', label: 'Ajuste / Sobrante de Caja' },
    { value: 'otros_ingresos', label: 'Otros Ingresos' }
];

const localDateInputValue = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const createDefaultForm = (defaultCategory = 'materiales', overrides = {}) => ({
    tipo: 'ingreso', // 'ingreso' | 'egreso'
    tipo_fondo: 'caja',
    sub_medio: 'yape_plin', // 'yape_plin' | 'tarjeta' | 'interbancaria'
    fecha_movimiento: localDateInputValue(),
    monto: '',
    categoria_gasto: INGRESO_CATEGORIES[0].value,
    beneficiario: '',
    descripcion: '',
    sustento_tipo: 'simple',
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
    const key = String(value).toLowerCase().trim();
    if (CATEGORIA_GASTO_LABELS[key]) return CATEGORIA_GASTO_LABELS[key];
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
    if (Number.isNaN(number)) return 'S/.\u00A00.00';
    return `S/.\u00A0${number.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getOriginLabel = (tipoFondo) => (tipoFondo === 'caja' ? 'Efectivo' : 'Transferencia');

const getGastoCategoryMeta = (categoria) => {
    const cat = String(categoria || '').toLowerCase();
    if (cat.includes('material')) return { icon: 'bi-box-seam', cls: 'materiales' };
    if (cat.includes('servicio') || cat.includes('luz') || cat.includes('agua') || cat.includes('internet')) return { icon: 'bi-lightning-charge', cls: 'servicios' };
    if (cat.includes('logistica') || cat.includes('transporte') || cat.includes('combustible') || cat.includes('movilidad') || cat.includes('delivery') || cat.includes('envio')) return { icon: 'bi-truck', cls: 'logistica' };
    if (cat.includes('sueldo') || cat.includes('personal') || cat.includes('planilla')) return { icon: 'bi-people', cls: 'sueldos' };
    if (cat.includes('alquiler')) return { icon: 'bi-building', cls: 'alquiler' };
    if (cat.includes('mantenimiento') || cat.includes('equipo')) return { icon: 'bi-tools', cls: 'mantenimiento' };
    if (cat.includes('administra') || cat.includes('limpieza') || cat.includes('oficina')) return { icon: 'bi-clipboard-check', cls: 'administracion' };
    if (cat.includes('marketing') || cat.includes('publicidad')) return { icon: 'bi-megaphone', cls: 'marketing' };
    return { icon: 'bi-receipt', cls: 'otros' };
};

const formatTimeOnly = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
};

const UNIDADES_TEXT = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
    'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
const DECENAS_TEXT = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS_TEXT = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

const decenasToText = (n) => {
    if (n <= 20) return UNIDADES_TEXT[n];
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (d === 2 && u > 0) return 'VEINTI' + UNIDADES_TEXT[u];
    return DECENAS_TEXT[d] + (u > 0 ? ' Y ' + UNIDADES_TEXT[u] : '');
};

const centenasToText = (n) => {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    let txt = c > 0 ? CENTENAS_TEXT[c] : '';
    if (resto > 0) txt += (txt ? ' ' : '') + decenasToText(resto);
    return txt;
};

const grupoToText = (n) => {
    if (n === 0) return '';
    if (n < 100) return decenasToText(n);
    return centenasToText(n);
};

const numeroALetras = (monto, currency = { singular: 'SOL', plural: 'SOLES' }) => {
    const num = Math.abs(parseFloat(monto) || 0);
    const entero = Math.floor(num);
    const decimal = Math.round((num - entero) * 100);
    const decStr = String(decimal).padStart(2, '0');

    if (entero === 0) return `CERO CON ${decStr}/100 ${decimal === 1 ? currency.singular : currency.plural}`;

    const millones = Math.floor(entero / 1_000_000);
    const miles = Math.floor((entero % 1_000_000) / 1_000);
    const resto = entero % 1_000;

    let texto = '';
    if (millones > 0) {
        texto += (millones === 1 ? 'UN MILLÓN' : grupoToText(millones) + ' MILLONES') + ' ';
    }
    if (miles > 0) {
        texto += (miles === 1 ? 'MIL' : grupoToText(miles) + ' MIL') + ' ';
    }
    if (resto > 0) {
        texto += grupoToText(resto);
    }

    return `${texto.trim()} CON ${decStr}/100 ${entero === 1 ? currency.singular : currency.plural}`;
};

const generateTicketHash = (seed = '') => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${Date.now().toString(16).slice(-4)}`;
};

const GASTO_SIN_SUSTENTO_OPCIONES = [
    { id: 'movilidad', label: 'Movilidad / Taxi', icon: 'bi-bicycle', hint: 'Pasajes, taxi o delivery urgente de trabajos' },
    { id: 'refrigerio', label: 'Refrigerio / Almuerzo', icon: 'bi-cup-hot', hint: 'Refrigerio, almuerzo o café del equipo' },
    { id: 'ferreteria', label: 'Compra al paso / Ferretería', icon: 'bi-tools', hint: 'Lijas, pegamento, tornillos o útiles sin boleta' },
    { id: 'vale', label: 'Vale interno / Anticipo', icon: 'bi-receipt-cutoff', hint: 'Vale provisional firmado o recibo manual' },
    { id: 'otro', label: 'Otro gasto menor', icon: 'bi-pencil-square', hint: 'Especificar motivo del gasto' }
];

const MovementFormFields = ({ form, setForm, categoryOptions, defaultCategory, mode = 'create', hideTipoToggle = false, hideFondoToggle = false }) => {
    const isIngreso = form.tipo === 'ingreso';
    const amountInputId = `${mode}-movement-amount`;
    const dateInputId = `${mode}-movement-date`;
    const categoryInputId = `${mode}-movement-category`;
    const detailInputId = `${mode}-movement-detail`;
    const beneficiarioInputId = `${mode}-movement-beneficiario`;

    return (
        <>
            {/* Selector de Tipo: 1° Ingreso vs 2° Egreso */}
            {!hideTipoToggle && (
                <div className="segmented-control expense-type-toggle" style={{ width: '100%', marginBottom: 'var(--space-3)' }} role="group" aria-label="Tipo de movimiento">
                    <button
                        type="button"
                        className={`segmented-control__btn${isIngreso ? ' is-active' : ''}`}
                        onClick={() => setForm((prev) => ({
                            ...prev,
                            tipo: 'ingreso',
                            categoria_gasto: INGRESO_CATEGORIES[0].value
                        }))}
                    >
                        <i className="bi bi-arrow-up-circle" style={{ marginRight: '6px', color: isIngreso ? 'var(--color-success)' : 'inherit' }}></i>
                        Ingreso
                    </button>
                    <button
                        type="button"
                        className={`segmented-control__btn${!isIngreso ? ' is-active' : ''}`}
                        onClick={() => setForm((prev) => ({
                            ...prev,
                            tipo: 'egreso',
                            categoria_gasto: defaultCategory
                        }))}
                    >
                        <i className="bi bi-arrow-down-circle" style={{ marginRight: '6px', color: !isIngreso ? 'var(--color-danger)' : 'inherit' }}></i>
                        Egreso
                    </button>
                </div>
            )}

            {/* Selector de Fondo / Método: Efectivo vs Transferencia */}
            {!hideFondoToggle && (
                <div className="segmented-control expense-origin-toggle" role="group" aria-label="Método o Fondo" style={{ marginBottom: 'var(--space-3)' }}>
                    {[
                        { value: 'caja', label: 'Efectivo', icon: 'bi-cash-coin' },
                        { value: 'banco', label: 'Transferencia', icon: 'bi-arrow-left-right' }
                    ].map((item) => {
                        const active = form.tipo_fondo === item.value;
                        return (
                            <button
                                key={item.value}
                                type="button"
                                className={`segmented-control__btn${active ? ' is-active' : ''}`}
                                aria-pressed={active}
                                onClick={() => setForm((prev) => ({ ...prev, tipo_fondo: item.value }))}
                            >
                                <i className={`bi ${item.icon}`} style={{ marginRight: '6px' }} aria-hidden="true"></i>
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="expense-form-grid">
                {/* Sustento del Gasto Section (Solo para Egresos) */}
                {!isIngreso && (
                    <div className="form-group expense-form-grid-span expense-sustento-box" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="bi bi-file-earmark-check" style={{ color: 'var(--color-primary)' }}></i>
                            Comprobante / Sustento del Gasto
                        </label>

                        <div className="segmented-control expense-sustento-toggle" role="group" aria-label="Tipo de comprobante" style={{ marginBottom: '10px' }}>
                            {[
                                { value: 'simple', label: 'Boleta', icon: 'bi-receipt', title: 'Boleta de venta física o electrónica' },
                                { value: 'fiscal', label: 'Factura', icon: 'bi-file-earmark-text', title: 'Factura Electrónica con RUC' },
                                { value: 'ninguno', label: 'Sin sustento', icon: 'bi-dash-circle', title: 'Gastos menores: pasajes, taxi, refrigerio o compras al paso' },
                            ].map((item) => {
                                const active = form.sustento_tipo === item.value;
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        title={item.title}
                                        className={`segmented-control__btn${active ? ' is-active' : ''}`}
                                        aria-pressed={active}
                                        onClick={() => setForm((prev) => ({
                                            ...prev,
                                            sustento_tipo: item.value,
                                            ...(item.value === 'ninguno' && !prev.sustento_observacion ? {
                                                sustento_observacion: 'Movilidad / Taxi',
                                                sustento_motivo_rapido: 'movilidad'
                                            } : {})
                                        }))}
                                    >
                                        <i className={`bi ${item.icon}`} aria-hidden="true" style={{ marginRight: '4px' }}></i>
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>

                        {form.sustento_tipo === 'fiscal' && (
                            <div className="expense-fiscal-fields" style={{ display: 'grid', gridTemplateColumns: '125px 1fr', gap: '8px' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Serie Factura</label>
                                    <input
                                        type="text"
                                        className="form-input form-input-sm"
                                        placeholder="F001"
                                        style={{ textTransform: 'uppercase' }}
                                        value={form.sustento_serie || ''}
                                        onChange={(e) => setForm((prev) => ({ ...prev, sustento_serie: e.target.value.toUpperCase() }))}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Número Factura</label>
                                    <input
                                        type="text"
                                        className="form-input form-input-sm"
                                        placeholder="00012345"
                                        value={form.sustento_numero || ''}
                                        onChange={(e) => setForm((prev) => ({ ...prev, sustento_numero: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {form.sustento_tipo === 'simple' && (
                            <div className="expense-simple-fields">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>N° de Boleta (Opcional)</label>
                                    <input
                                        type="text"
                                        className="form-input form-input-sm"
                                        placeholder="Ej. B001-492..."
                                        value={form.sustento_nota || form.sustento_numero || ''}
                                        onChange={(e) => setForm((prev) => ({ ...prev, sustento_nota: e.target.value, sustento_numero: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {form.sustento_tipo === 'ninguno' && (
                            <div className="expense-ninguno-fields animate-fadeIn">
                                <div style={{ marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                        ¿Qué tipo de gasto menor es?
                                    </span>
                                </div>
                                <div className="gasto-menor-presets">
                                    {GASTO_SIN_SUSTENTO_OPCIONES.map((opt) => {
                                        const isSelected = form.sustento_motivo_rapido === opt.id || (form.sustento_observacion && form.sustento_observacion.startsWith(opt.label));
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                className={`gasto-menor-chip${isSelected ? ' is-active' : ''}`}
                                                onClick={() => {
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        sustento_motivo_rapido: opt.id,
                                                        sustento_observacion: opt.id === 'otro'
                                                            ? (prev.sustento_observacion?.startsWith('Otro') ? prev.sustento_observacion : '')
                                                            : opt.label
                                                    }));
                                                }}
                                            >
                                                <i className={`bi ${opt.icon}`} aria-hidden="true"></i>
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="form-group" style={{ marginBottom: 0, marginTop: '6px' }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>
                                        Detalle o motivo del gasto (para arqueo de caja)
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input form-input-sm"
                                        placeholder={
                                            form.sustento_motivo_rapido === 'movilidad' ? 'Ej. Taxi a clínica San Isidro para entrega urgente...' :
                                            form.sustento_motivo_rapido === 'refrigerio' ? 'Ej. Almuerzo del equipo técnico en turno corrido...' :
                                            form.sustento_motivo_rapido === 'ferreteria' ? 'Ej. Compra de lijas finas o insumos de limpieza...' :
                                            form.sustento_motivo_rapido === 'vale' ? 'Ej. Vale provisional a técnico Juan...' :
                                            'Ej. Motivo o destino del gasto...'
                                        }
                                        value={form.sustento_observacion || ''}
                                        onChange={(e) => setForm((prev) => ({ ...prev, sustento_observacion: e.target.value }))}
                                    />
                                </div>

                                {form.sustento_motivo_rapido === 'vale' && (
                                    <div className="form-group" style={{ marginBottom: 0, marginTop: '6px' }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>N° de Vale o Recibo interno (Opcional)</label>
                                        <input
                                            type="text"
                                            className="form-input form-input-sm"
                                            placeholder="Ej. Vale N° 042"
                                            value={form.sustento_nota || ''}
                                            onChange={(e) => setForm((prev) => ({ ...prev, sustento_nota: e.target.value }))}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Fecha solo editable en modo edición histórica */}
                {mode === 'edit' && (
                    <div className="form-group expense-form-grid-span">
                        <label className="form-label" htmlFor={dateInputId}>
                            {isIngreso ? 'Fecha de Ingreso' : 'Fecha de Pago'}
                        </label>
                        <FormDatePicker
                            id={dateInputId}
                            value={form.fecha_movimiento}
                            onChange={(fecha_movimiento) => setForm((prev) => ({ ...prev, fecha_movimiento }))}
                            aria-label="Fecha del movimiento"
                        />
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label" htmlFor={categoryInputId}>
                        {isIngreso ? 'Categoría de Ingreso' : 'Categoría de Gasto'}
                    </label>
                    <select
                        id={categoryInputId}
                        className="form-select"
                        value={form.categoria_gasto}
                        onChange={(event) => setForm((prev) => ({ ...prev, categoria_gasto: event.target.value }))}
                    >
                        {isIngreso
                            ? INGRESO_CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))
                            : categoryOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))
                        }
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor={beneficiarioInputId}>
                        {isIngreso ? 'Pagador / Cliente / Origen' : 'Proveedor / Beneficiario'}
                    </label>
                    <input
                        id={beneficiarioInputId}
                        className="form-input"
                        type="text"
                        value={form.beneficiario || ''}
                        onChange={(event) => setForm((prev) => ({ ...prev, beneficiario: event.target.value }))}
                        placeholder={isIngreso ? 'Ej. Clínica Dental Smile, Aporte Socio...' : 'Ej. Distribuidora Dental S.A.C., Juan Pérez...'}
                    />
                </div>

                <div className="form-group expense-form-grid-span">
                    <label className="form-label" htmlFor={detailInputId}>
                        {isIngreso ? 'Concepto o Detalle del Ingreso' : 'Descripción del Gasto'}
                    </label>
                    <textarea
                        id={detailInputId}
                        className="form-textarea"
                        rows={2}
                        value={form.descripcion || ''}
                        onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                        placeholder={isIngreso ? 'Ej. Cobro en efectivo por trabajo urgente, anticipo directo...' : 'Ej. Compra de fresas de zirconio, pago de luz del local, taxi a clínica...'}
                    ></textarea>
                </div>

                {/* Nota opcional para Ingresos */}
                {isIngreso && (
                    <div className="form-group expense-form-grid-span">
                        <label className="form-label">Referencia o Número de Operación (Opcional)</label>
                        <input
                            type="text"
                            className="form-input form-input-sm"
                            placeholder="Ej. Op. BCP 893412, Yape 987654321..."
                            value={form.sustento_nota || ''}
                            onChange={(e) => setForm((prev) => ({ ...prev, sustento_nota: e.target.value }))}
                        />
                    </div>
                )}

                {/* Monto del Gasto con estilo de Total/Precio de Ingresos */}
                <div className="form-group expense-form-grid-span" style={{ marginTop: '2px', marginBottom: 0 }}>
                    <div className="finance-ticket-total">
                        <div className="finance-ticket-main-total-row">
                            <div>
                                <div className="finance-ticket-main-total-label">
                                    {isIngreso ? 'Total a ingresar' : 'Total a pagar'}
                                </div>
                            </div>
                            <div className="finance-ticket-total-display">
                                <div className="finance-ticket-amount-wrapper">
                                    <span className="finance-currency-symbol">S/.</span>
                                    <input
                                        id={amountInputId}
                                        className="finance-ticket-amount-input"
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={form.monto}
                                        onChange={(event) => setForm((prev) => ({ ...prev, monto: event.target.value }))}
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const CajaGastos = () => {
    const { user } = useAuth();
    const isAdmin = user?.tipo === 'admin';
    const { data: empresaFiscal } = useEmpresaFiscalQuery();

    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [currentTab, setCurrentTab] = useState(urlTab || 'registro');

    useEffect(() => {
        if (urlTab && ['registro', 'gastos', 'resumen', 'facturacion', 'historial'].includes(urlTab)) {
            setCurrentTab(urlTab);
        }
    }, [urlTab]);

    const handleTabChange = (tab) => {
        setCurrentTab(tab);
        setSearchParams({ tab }, { replace: true });
    };

    // Sub-estado para Facturación Electrónica (prioridad: pendientes de emitir)
    const [facturacionSubTab, setFacturacionSubTab] = useState('pendientes'); // 'pendientes' | 'emitidos'
    const [facturacionEmitirModalOpen, setFacturacionEmitirModalOpen] = useState(false);
    const [facturacionOrderSearch, setFacturacionOrderSearch] = useState('');
    const [syncingInvoiceId, setSyncingInvoiceId] = useState(null);

    // Estados para flujo de Cobros de Pedidos
    const [pedidoSearch, setPedidoSearch] = useState('');
    const [selectedOrdersForPayment, setSelectedOrdersForPayment] = useState([]);
    const [orderPaymentConfigs, setOrderPaymentConfigs] = useState({});
    const [customTotalCobrar, setCustomTotalCobrar] = useState(null);
    const [showGlobalDiscount, setShowGlobalDiscount] = useState(false);
    const [globalDiscount, setGlobalDiscount] = useState('');
    const [globalDiscountMotivo, setGlobalDiscountMotivo] = useState('');

    // Comprobante a emitir en Ticket de Cobro (por defecto siempre nota interna)
    const [ticketComprobanteTipo, setTicketComprobanteTipo] = useState('nota'); // 'nota' | 'boleta' | 'factura'
    const [ticketDocIdentidad, setTicketDocIdentidad] = useState('');
    const [ticketRazonSocial, setTicketRazonSocial] = useState('');
    const [ticketDocManuallyEdited, setTicketDocManuallyEdited] = useState(false);
    const [ticketRazonSocialManuallyEdited, setTicketRazonSocialManuallyEdited] = useState(false);

    // Modal de Impresión de Ticket de Cobro
    const [cobroExitosoTicket, setCobroExitosoTicket] = useState(null);
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [ticketPrintFormat, setTicketPrintFormat] = useState('ticket80'); // 'ticket80' | 'a4' | 'a5'
    const ticketPrintRootRef = useRef(null);
    const [, setTicketPrinting] = useState(false);

    const ticketSheetData = useMemo(() => {
        if (!cobroExitosoTicket) return null;
        const tipo = cobroExitosoTicket.comprobanteTipo;
        const tipoCodigo = tipo === 'factura' ? '01' : (tipo === 'boleta' ? '03' : '00');
        const isFiscal = ['factura', 'boleta', '01', '03'].includes(tipo);
        const subtotal = parseFloat(cobroExitosoTicket.subtotal || 0);
        const totalCobrado = parseFloat(cobroExitosoTicket.totalCobrado || 0);
        const descuento = parseFloat(cobroExitosoTicket.descuento || 0);
        const totalVenta = Math.max(0, Math.round((subtotal - descuento) * 100) / 100);
        const baseGravada = isFiscal ? Math.round((totalVenta / 1.18) * 100) / 100 : 0;
        const totalIgv = isFiscal ? Math.round((totalVenta - baseGravada) * 100) / 100 : 0;
        const saldoRestante = parseFloat(cobroExitosoTicket.saldoRestante || 0);

        return {
            comprobante: {
                tipo_comprobante: tipoCodigo,
                serie: isFiscal ? (tipo === 'factura' ? (empresaFiscal?.serie_factura || 'F001') : (empresaFiscal?.serie_boleta || 'B001')) : 'NV01',
                correlativo: cobroExitosoTicket.ticketNumero || '00000001',
                fecha_emision: cobroExitosoTicket.fecha,
                receptor_tipo_doc: (cobroExitosoTicket.docIdentidad || '').length === 11 ? '6' : '1',
                receptor_documento: cobroExitosoTicket.docIdentidad || '',
                receptor_razon_social: cobroExitosoTicket.razonSocial || 'Cliente General',
                total_gravada: baseGravada,
                total_igv: totalIgv,
                total_venta: totalVenta,
                total_cobrado: totalCobrado,
                subtotal_original: subtotal,
                descuento,
                descuento_motivo: cobroExitosoTicket.descuentoMotivo || '',
                saldo_restante: saldoRestante,
                forma_pago: saldoRestante > 0.01 ? 'CRÉDITO / PARCIAL' : 'AL CONTADO',
                medio_pago: cobroExitosoTicket.tipoFondo === 'caja'
                    ? 'EFECTIVO'
                    : (cobroExitosoTicket.subMedio === 'yape_plin'
                        ? 'TRANSFERENCIA (YAPE / PLIN)'
                        : cobroExitosoTicket.subMedio === 'tarjeta'
                            ? 'TARJETA (POS)'
                            : 'TRANSFERENCIA INTERBANCARIA'),
                referencia: cobroExitosoTicket.referencia || '',
                responsable: cobroExitosoTicket.responsable || 'Caja Central',
                hash_cpe: cobroExitosoTicket.hash || generateReceiptHash(`${cobroExitosoTicket.ticketNumero}-${totalCobrado}`)
            },
            emisor: {
                ruc: empresaFiscal?.ruc || '20616033973',
                razon_social: empresaFiscal?.razon_social || 'AFINIX DENTAL LAB S.A.C.',
                nombre_comercial: empresaFiscal?.nombre_comercial || 'AFINIX Dental Lab',
                direccion_fiscal: 'Calle Piura 316, Mariano Melgar, Arequipa.',
                ubigeo: empresaFiscal?.ubigeo || '040126'
            },
            pedido: {
                paciente_nombre: null
            },
            lineas: (cobroExitosoTicket.orders || []).map((ord) => {
                const cant = Math.max(1, parseInt(ord.cantidad || 1, 10));
                const prodName = ord.producto || ord.producto_principal || 'Servicio técnico dental';
                const sub = parseFloat(ord.montoCobrado ?? ord.saldoOriginal ?? 0);
                const unitPrice = cant > 0 ? Math.round((sub / cant) * 100) / 100 : sub;
                return {
                    descripcion: prodName,
                    cantidad: cant,
                    unidad_medida: 'NIU',
                    precio_unitario: unitPrice,
                    subtotal: sub
                };
            })
        };
    }, [cobroExitosoTicket, empresaFiscal]);

    const handlePrintTicket = useCallback(() => {
        if (!ticketPrintRootRef.current) return;
        setTicketPrinting(true);
        document.body.classList.add(`cpe-printing--${ticketPrintFormat}`);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'visible';
        ticketPrintRootRef.current.style.display = 'block';

        requestAnimationFrame(() => {
            window.print();
            setTimeout(() => {
                if (ticketPrintRootRef.current) {
                    ticketPrintRootRef.current.style.display = 'none';
                }
                document.body.classList.remove(`cpe-printing--${ticketPrintFormat}`);
                document.body.style.overflow = prevOverflow;
                setTicketPrinting(false);
            }, 500);
        });
    }, [ticketPrintFormat]);

    const populateComprobanteData = (comprobanteTipo, orders, force = false) => {
        const primaryOrder = orders[0];
        if (!primaryOrder) {
            if (!ticketDocManuallyEdited || force) setTicketDocIdentidad('');
            if (!ticketRazonSocialManuallyEdited || force) setTicketRazonSocial('');
            return;
        }

        const clientName = primaryOrder.clinica_razon_social || primaryOrder.clinica_nombre || '';
        const clientRuc = primaryOrder.clinica_ruc || primaryOrder.ruc || '';
        const clientDni = primaryOrder.clinica_dni || primaryOrder.dni || '';

        if (comprobanteTipo === 'factura') {
            if (!ticketDocManuallyEdited || force) {
                setTicketDocIdentidad(clientRuc);
            }
            if (!ticketRazonSocialManuallyEdited || force) {
                setTicketRazonSocial(primaryOrder.clinica_razon_social || primaryOrder.clinica_nombre || '');
            }
        } else if (comprobanteTipo === 'boleta') {
            if (!ticketDocManuallyEdited || force) {
                // Si el doctor/clínica tiene DNI o RUC 10 de persona natural
                setTicketDocIdentidad(clientDni || (clientRuc && clientRuc.length === 8 ? clientRuc : ''));
            }
            if (!ticketRazonSocialManuallyEdited || force) {
                setTicketRazonSocial(clientName);
            }
        } else {
            // Nota de Venta / Recibo de Caja interno
            if (!ticketDocManuallyEdited || force) {
                setTicketDocIdentidad(clientDni || clientRuc || '');
            }
            if (!ticketRazonSocialManuallyEdited || force) {
                setTicketRazonSocial(clientName);
            }
        }
    };

    const handleTicketComprobanteChange = (newTipo) => {
        setTicketComprobanteTipo(newTipo);
        setTicketDocManuallyEdited(false);
        setTicketRazonSocialManuallyEdited(false);
        populateComprobanteData(newTipo, selectedOrdersForPayment, true);
    };

    useEffect(() => {
        if (!ticketDocManuallyEdited && !ticketRazonSocialManuallyEdited) {
            populateComprobanteData(ticketComprobanteTipo, selectedOrdersForPayment, false);
        }
    }, [selectedOrdersForPayment, ticketComprobanteTipo]);

    const toggleOrderSelection = (ped) => {
        setCustomTotalCobrar(null);
        setSelectedOrdersForPayment(prev => {
            const exists = prev.some(p => p.id === ped.id);
            if (exists) {
                setOrderPaymentConfigs(cfgs => {
                    const next = { ...cfgs };
                    delete next[ped.id];
                    return next;
                });
                return prev.filter(p => p.id !== ped.id);
            }
            return [...prev, ped];
        });
    };

    const updateOrderConfig = (orderId, field, value) => {
        setOrderPaymentConfigs(prev => {
            const current = prev[orderId] || {};
            return {
                ...prev,
                [orderId]: {
                    ...current,
                    [field]: value
                }
            };
        });
    };

    const orderPaymentSummary = useMemo(() => {
        let subtotal = 0;
        for (const ped of selectedOrdersForPayment) {
            subtotal += parseFloat(ped?.saldo ?? ped?.saldo_pendiente ?? ped?.total ?? 0);
        }
        subtotal = Math.round(subtotal * 100) / 100;

        const discountNum = parseFloat(globalDiscount || 0);
        const totalDescuentos = isNaN(discountNum) ? 0 : Math.min(Math.max(0, Math.round(discountNum * 100) / 100), subtotal);
        const totalNeto = Math.max(0, Math.round((subtotal - totalDescuentos) * 100) / 100);

        let totalCobrarHoy = totalNeto;
        if (customTotalCobrar !== null && customTotalCobrar !== '') {
            const parsed = parseFloat(customTotalCobrar);
            totalCobrarHoy = isNaN(parsed) ? 0 : Math.min(Math.max(0, Math.round(parsed * 100) / 100), totalNeto);
        } else if (customTotalCobrar === '') {
            totalCobrarHoy = 0;
        }
        const totalSaldoRestante = Math.max(0, Math.round((totalNeto - totalCobrarHoy) * 100) / 100);

        return {
            subtotal,
            totalOriginal: subtotal,
            totalDescuentos,
            totalNeto,
            totalCobrarHoy,
            totalSaldoRestante,
            hasPartial: totalSaldoRestante > 0.01,
            hasDiscount: totalDescuentos > 0.01
        };
    }, [selectedOrdersForPayment, globalDiscount, customTotalCobrar]);

    const totalSelectedOrdersAmount = orderPaymentSummary.totalCobrarHoy;

    // Estados para panel de Pedidos Listos para Cobro (Terminados / Enviados)
    const [readyOrdersFilter, setReadyOrdersFilter] = useState('prioritarios'); // 'prioritarios' | 'todos'
    const [readyOrdersSearch, setReadyOrdersSearch] = useState('');

    // Egresos / Ingresos State
    const [movSearch, setMovSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [tipoFilter, setTipoFilter] = useState('all'); // 'all' | 'ingreso' | 'egreso'
    const [originFilter, setOriginFilter] = useState('all'); // 'all' | 'caja' | 'banco'
    const [sustentoFilter, setSustentoFilter] = useState('all');
    const [bitacoraScope, setBitacoraScope] = useState('turno'); // 'turno' | 'dia' | 'todos'
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMovement, setEditingMovement] = useState(null);
    const [movementToDelete, setMovementToDelete] = useState(null);
    const [gastoSearch, setGastoSearch] = useState('');
    const [gastoFilterFondo, setGastoFilterFondo] = useState('todos'); // 'todos' | 'caja' | 'banco'
    const [gastosScope, setGastosScope] = useState('turno'); // 'turno' | 'dia' | 'todos'

    // Arqueo / Cierre State
    const [aperturaModalOpen, setAperturaModalOpen] = useState(false);
    const [cierreModalOpen, setCierreModalOpen] = useState(false);
    const [reporteModalOpen, setReporteModalOpen] = useState(false);
    const [cierreReportPrintData, setCierreReportPrintData] = useState(null);
    const [selectedHistorySessionForReport, setSelectedHistorySessionForReport] = useState(null);
    const [reportScope, setReportScope] = useState('turno'); // 'turno' | 'dia'
    const [aperturaMonto, setAperturaMonto] = useState('');
    const [aperturaTurno, setAperturaTurno] = useState('general');
    const [arqueoRealEfectivo, setArqueoRealEfectivo] = useState('');
    const [cierreObservaciones, setCierreObservaciones] = useState('');
    const [reaperturaModalOpen, setReaperturaModalOpen] = useState(false);
    const [selectedSessionToReopen, setSelectedSessionToReopen] = useState(null);
    const [reaperturaMotivo, setReaperturaMotivo] = useState('');

    useEffect(() => {
        window.__openAperturaModal = () => setAperturaModalOpen(true);
        return () => {
            delete window.__openAperturaModal;
        };
    }, []);

    // Calculadora opcional de billetes y monedas para arqueo
    const [showCalculadoraBilletes, setShowCalculadoraBilletes] = useState(false);
    const [billetesConteo, setBilletesConteo] = useState({
        b200: '', b100: '', b50: '', b20: '', b10: '',
        m5: '', m2: '', m1: '', m05: ''
    });

    const handleBilleteChange = (denomKey, value) => {
        const nextConteo = { ...billetesConteo, [denomKey]: value };
        setBilletesConteo(nextConteo);

        const denoms = {
            b200: 200, b100: 100, b50: 50, b20: 20, b10: 10,
            m5: 5, m2: 2, m1: 1, m05: 0.50
        };
        let total = 0;
        let hasAny = false;
        Object.entries(denoms).forEach(([key, multiplier]) => {
            const qty = parseInt(nextConteo[key], 10);
            if (!isNaN(qty) && qty > 0) {
                total += qty * multiplier;
                hasAny = true;
            }
        });
        if (hasAny) {
            setArqueoRealEfectivo(total.toFixed(2));
        }
    };

    const handleResetCalculadora = () => {
        setBilletesConteo({
            b200: '', b100: '', b50: '', b20: '', b10: '',
            m5: '', m2: '', m1: '', m05: ''
        });
        setArqueoRealEfectivo('');
    };

    // Dropdown de filtro de fondos en Bitácora
    const [fondoDropdownOpen, setFondoDropdownOpen] = useState(false);
    const fondoDropdownRef = useRef(null);
    const hasAutoOpenedAperturaRef = useRef(false);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (fondoDropdownRef.current && !fondoDropdownRef.current.contains(e.target)) {
                setFondoDropdownOpen(false);
            }
        };
        if (fondoDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [fondoDropdownOpen]);

    const catalogosQuery = useFinanceCatalogsQuery();
    const movementsFilters = useMemo(() => ({
        limit: '150',
        search: movSearch
    }), [movSearch]);
    const movimientosQuery = useFinanceMovementsQuery({ filters: movementsFilters });
    const facturacionQuery = useFacturacionListQuery(currentTab === 'facturacion');
    const [facturacionSearch, setFacturacionSearch] = useState('');
    const activeCashSessionQuery = useActiveCashSessionQuery();
    const cashSessionsHistoryQuery = useCashSessionsQuery(currentTab === 'historial');

    const registerPaymentMutation = useRegisterPaymentMutation();
    const registerConsolidatedPaymentMutation = useRegisterConsolidatedPaymentMutation();
    const createInvoiceMutation = useCreateInvoiceMutation();

    const pendingOrdersQuery = useFinanceAccountsQuery({
        filters: { search: pedidoSearch },
        enabled: currentTab === 'registro' || currentTab === 'facturacion'
    });
    const pendingOrders = useMemo(() => {
        const list = pendingOrdersQuery.data || [];
        return list.filter((p) => p.estado_pago !== 'cancelado');
    }, [pendingOrdersQuery.data]);

    const finishedOrShippedOrders = useMemo(() => {
        return pendingOrders.filter((p) => ['terminado', 'enviado'].includes(p.estado));
    }, [pendingOrders]);

    const displayedReadyOrders = useMemo(() => {
        const base = readyOrdersFilter === 'prioritarios' ? finishedOrShippedOrders : pendingOrders;
        if (!readyOrdersSearch.trim()) return base;
        const q = readyOrdersSearch.toLowerCase().trim();
        return base.filter((p) =>
            (p.codigo || '').toLowerCase().includes(q) ||
            (p.paciente_nombre || '').toLowerCase().includes(q) ||
            (p.clinica_nombre || '').toLowerCase().includes(q) ||
            (p.doctor_nombre || '').toLowerCase().includes(q)
        );
    }, [readyOrdersFilter, finishedOrShippedOrders, pendingOrders, readyOrdersSearch]);

    const billingOrdersQuery = useFinanceAccountsQuery({
        filters: { search: facturacionOrderSearch },
        enabled: currentTab === 'facturacion'
    });
    const ordersReadyToInvoice = useMemo(() => {
        const orders = billingOrdersQuery.data || [];
        const issuedPedidoCodigos = new Set(
            (facturacionQuery.data?.comprobantes || []).flatMap(c => {
                const codes = [c.pedido_codigo];
                if (Array.isArray(c.pedidos_codigos)) {
                    codes.push(...c.pedidos_codigos);
                }
                return codes;
            }).filter(Boolean)
        );
        return orders.filter(p => !issuedPedidoCodigos.has(p.codigo));
    }, [billingOrdersQuery.data, facturacionQuery.data?.comprobantes]);

    // Selección múltiple para Facturación Consolidada
    const [selectedOrdersToInvoice, setSelectedOrdersToInvoice] = useState([]);

    const selectedOrdersList = useMemo(() => {
        return ordersReadyToInvoice.filter(p => selectedOrdersToInvoice.includes(p.id));
    }, [ordersReadyToInvoice, selectedOrdersToInvoice]);

    const activeSelectionClinicId = useMemo(() => {
        if (selectedOrdersList.length === 0) return null;
        return selectedOrdersList[0].clinica_id ?? selectedOrdersList[0].clinica_nombre;
    }, [selectedOrdersList]);

    const activeSelectionClinicName = useMemo(() => {
        if (selectedOrdersList.length === 0) return '';
        return selectedOrdersList[0].clinica_nombre || 'Cliente directo';
    }, [selectedOrdersList]);

    const totalSelectedMonto = useMemo(() => {
        return selectedOrdersList.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    }, [selectedOrdersList]);

    const createMovementMutation = useCreateFinanceMovementMutation();
    const updateMovementMutation = useUpdateFinanceMovementMutation();
    const deleteMovementMutation = useDeleteFinanceMovementMutation();
    const openCashSessionMutation = useOpenCashSessionMutation();
    const closeCashSessionMutation = useCloseCashSessionMutation();
    const reopenCashSessionMutation = useReopenCashSessionMutation();

    const activeSessionData = activeCashSessionQuery.data?.session
        ? activeCashSessionQuery.data
        : (activeCashSessionQuery.data?.data || null);
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

    const isCajaTrasnochada = useMemo(() => {
        if (activeSessionData?.isCajaTrasnochada) return true;
        if (!activeSession) return false;
        const hoyStr = localDateInputValue();
        const fechaStr = activeSession.abierto_at
            ? localDateInputValue(new Date(activeSession.abierto_at))
            : (activeSession.fecha ? String(activeSession.fecha).slice(0, 10) : hoyStr);
        const fechaCol = activeSession.fecha ? String(activeSession.fecha).slice(0, 10) : hoyStr;
        return fechaStr < hoyStr || fechaCol < hoyStr;
    }, [activeSession, activeSessionData]);

    // Aviso / modal pop up de apertura al ingresar a cobros o gastos si la caja está cerrada
    useEffect(() => {
        if (!activeCashSessionQuery.isLoading && !activeSession && !hasAutoOpenedAperturaRef.current) {
            if (currentTab === 'registro' || currentTab === 'gastos') {
                hasAutoOpenedAperturaRef.current = true;
                setAperturaModalOpen(true);
            }
        }
    }, [activeCashSessionQuery.isLoading, activeSession, currentTab]);

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
    const defaultCategory = categoryOptions[0]?.value || 'materiales';

    const [createForm, setCreateForm] = useState(() => createDefaultForm(defaultCategory, { tipo: 'ingreso' }));
    const [editForm, setEditForm] = useState(() => createDefaultForm(defaultCategory));
    const [gastoForm, setGastoForm] = useState(() =>
        createDefaultForm(defaultCategory, { tipo: 'egreso', tipo_fondo: 'caja' })
    );

    const movimientos = movimientosQuery.data || [];
    const todayDateStr = localDateInputValue();
    const activeBitacoraScope = (!activeSession && bitacoraScope === 'turno') ? 'dia' : bitacoraScope;
    const activeGastosScope = (!activeSession && gastosScope === 'turno') ? 'dia' : gastosScope;

    const scopedEgresos = useMemo(() => {
        return movimientos.filter((m) => {
            if (m.tipo !== 'egreso') return false;
            if (m.tipo === 'retiro_socio' || m.grupo_gasto === 'patrimonio_socio') return false;
            const movDate = m.fecha_movimiento
                ? String(m.fecha_movimiento).slice(0, 10)
                : (m.created_at ? String(m.created_at).slice(0, 10) : null);

            if (activeGastosScope === 'turno' && activeSession) {
                if (m.sesion_caja_id && activeSession.id) {
                    if (Number(m.sesion_caja_id) !== Number(activeSession.id)) return false;
                } else if (movDate !== todayDateStr) {
                    return false;
                }
            } else if (activeGastosScope === 'dia') {
                if (movDate !== todayDateStr) return false;
            }
            return true;
        });
    }, [movimientos, activeGastosScope, activeSession, todayDateStr]);

    const filteredMovimientos = useMemo(() => {
        return movimientos.filter((movement) => {
            if (movement.tipo === 'retiro_socio' || movement.grupo_gasto === 'patrimonio_socio') return false;
            const movDate = movement.fecha_movimiento
                ? String(movement.fecha_movimiento).slice(0, 10)
                : (movement.created_at ? String(movement.created_at).slice(0, 10) : null);

            if (activeBitacoraScope === 'turno' && activeSession) {
                if (movement.sesion_caja_id && activeSession.id) {
                    if (Number(movement.sesion_caja_id) !== Number(activeSession.id)) return false;
                } else if (movDate !== todayDateStr) {
                    return false;
                }
            } else if (activeBitacoraScope === 'dia') {
                if (movDate !== todayDateStr) return false;
            }

            if (tipoFilter !== 'all' && (movement.tipo || 'egreso') !== tipoFilter) return false;
            if (originFilter !== 'all' && movement.tipo_fondo !== originFilter) return false;
            if (sustentoFilter !== 'all' && (movement.sustento_tipo || 'ninguno') !== sustentoFilter) return false;
            return true;
        });
    }, [movimientos, activeBitacoraScope, activeSession, todayDateStr, tipoFilter, originFilter, sustentoFilter]);

    // Movimientos que pertenecen estrictamente al turno/sesión en consulta
    const sessionMovimientosForReport = useMemo(() => {
        const s = selectedHistorySessionForReport || activeSession;
        if (!s) return [];

        const sessionDateStr = s.fecha
            ? (s.fecha instanceof Date ? s.fecha.toISOString().split('T')[0] : String(s.fecha).slice(0, 10))
            : todayDateStr;

        return movimientos.filter((m) => {
            if (m.tipo === 'retiro_socio' || m.grupo_gasto === 'patrimonio_socio') return false;
            if (m.sesion_caja_id && s.id && Number(m.sesion_caja_id) === Number(s.id)) {
                return true;
            }
            if (!m.sesion_caja_id && sessionDateStr) {
                const movDate = m.fecha_movimiento
                    ? String(m.fecha_movimiento).slice(0, 10)
                    : (m.created_at ? String(m.created_at).slice(0, 10) : null);
                return movDate === sessionDateStr;
            }
            return false;
        });
    }, [selectedHistorySessionForReport, activeSession, movimientos, todayDateStr]);

    // Movimientos de todo el día (consolidado de todos los turnos del día)
    const todayMovimientosForReport = useMemo(() => {
        const s = selectedHistorySessionForReport || activeSession;
        const targetDate = s?.fecha
            ? (s.fecha instanceof Date ? s.fecha.toISOString().split('T')[0] : String(s.fecha).slice(0, 10))
            : todayDateStr;

        return movimientos.filter((m) => {
            if (m.tipo === 'retiro_socio' || m.grupo_gasto === 'patrimonio_socio') return false;
            const movDate = m.fecha_movimiento
                ? String(m.fecha_movimiento).slice(0, 10)
                : (m.created_at ? String(m.created_at).slice(0, 10) : null);
            return movDate === targetDate;
        });
    }, [selectedHistorySessionForReport, activeSession, movimientos, todayDateStr]);

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
            tipo: prev.tipo || 'egreso',
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
        const isIngreso = movement.tipo === 'ingreso';
        setEditingMovement(movement);
        setEditForm({
            tipo: movement.tipo || 'egreso',
            tipo_fondo: movement.tipo_fondo || 'caja',
            fecha_movimiento: movement.fecha_movimiento
                ? String(movement.fecha_movimiento).slice(0, 10)
                : localDateInputValue(),
            monto: movement.monto ? String(movement.monto) : '',
            categoria_gasto: movement.categoria_gasto || (isIngreso ? INGRESO_CATEGORIES[0].value : defaultCategory),
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
        const isIngreso = form.tipo === 'ingreso';
        const selectedCategory = isIngreso
            ? INGRESO_CATEGORIES.find((c) => c.value === form.categoria_gasto)
            : categoryOptions.find((option) => option.value === form.categoria_gasto);

        return {
            tipo: form.tipo || 'egreso',
            tipo_fondo: form.tipo_fondo,
            fecha_movimiento: form.fecha_movimiento || localDateInputValue(),
            monto: parseFloat(form.monto),
            grupo_gasto: isIngreso ? 'ingreso' : (selectedCategory?.group || 'operativo'),
            categoria_gasto: form.categoria_gasto,
            beneficiario: form.beneficiario?.trim() || null,
            descripcion: form.descripcion?.trim() || null,
            sustento_tipo: isIngreso ? (form.sustento_nota ? 'simple' : 'ninguno') : (form.sustento_tipo || 'ninguno'),
            sustento_comprobante_tipo: !isIngreso && form.sustento_tipo === 'fiscal' ? form.sustento_comprobante_tipo : null,
            sustento_emisor_doc: !isIngreso && form.sustento_tipo === 'fiscal' ? form.sustento_emisor_doc?.trim() || null : null,
            sustento_emisor_razon_social: !isIngreso && form.sustento_tipo === 'fiscal' ? form.sustento_emisor_razon_social?.trim() || null : null,
            sustento_serie: !isIngreso && form.sustento_tipo === 'fiscal' ? form.sustento_serie?.trim() || null : null,
            sustento_numero: !isIngreso && form.sustento_tipo === 'fiscal' ? form.sustento_numero?.trim() || null : null,
            sustento_fecha_emision: !isIngreso && form.sustento_tipo === 'fiscal' ? form.sustento_fecha_emision || null : null,
            sustento_archivo_url: form.sustento_archivo_url?.trim() || null,
            sustento_nota: form.sustento_nota?.trim() || null,
            sustento_observacion: !isIngreso && form.sustento_tipo === 'ninguno' ? form.sustento_observacion?.trim() || null : null
        };
    };

    const validateForm = (form) => {
        if (!form.fecha_movimiento) {
            form.fecha_movimiento = localDateInputValue();
        }
        if (!form.monto || parseFloat(form.monto) <= 0) {
            toast.error('Ingresa un monto válido mayor a 0.');
            return false;
        }
        if (!form.categoria_gasto) {
            toast.error('Selecciona una categoría para clasificar el movimiento.');
            return false;
        }
        if (form.tipo === 'egreso') {
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
        }
        return true;
    };

    const handleCreateMovimiento = async (event) => {
        event.preventDefault();
        if (!validateForm(createForm)) return;

        try {
            await createMovementMutation.mutateAsync(buildPayload(createForm));
            toast.success(createForm.tipo === 'ingreso' ? 'Ingreso registrado correctamente.' : 'Gasto registrado correctamente.');
            resetCreateForm();
        } catch (error) {
            toast.error(error.message || 'No se pudo registrar el movimiento.');
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
            toast.success('Movimiento actualizado correctamente.');
            resetModalState();
        } catch (error) {
            toast.error(error.message || 'No se pudo guardar el movimiento.');
        }
    };

    const handleDeleteMovimiento = async (movement) => {
        try {
            await deleteMovementMutation.mutateAsync(movement.id);
            toast.success('Movimiento eliminado correctamente.');
            setMovementToDelete(null);
        } catch (error) {
            toast.error(error.message || 'No se pudo eliminar el movimiento.');
        }
    };

    const handleSyncComprobante = async (invoiceId) => {
        try {
            setSyncingInvoiceId(invoiceId);
            const res = await syncInvoice({ invoiceId });
            toast.success(res.message || 'Comprobante sincronizado con SUNAT.');
            facturacionQuery.refetch();
        } catch (error) {
            toast.error(error.message || 'No se pudo sincronizar con SUNAT.');
        } finally {
            setSyncingInvoiceId(null);
        }
    };

    // Arqueo handlers
    const handleAbrirCaja = async (e) => {
        if (e) e.preventDefault();
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
            setAperturaModalOpen(false);
        } catch (err) {
            toast.error(err.message || 'Error al abrir caja');
        }
    };

    const handleCerrarCaja = async (e) => {
        if (e) e.preventDefault();
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
            setCierreModalOpen(false);
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

    const handleCopyWhatsAppReport = () => {
        const isDia = reportScope === 'dia';
        const targetSession = selectedHistorySessionForReport || activeSession;
        const fechaStr = targetSession ? new Date(targetSession.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('es-PE');

        const dayIngEfec = todayMovimientosForReport.filter(m => m.tipo === 'ingreso' && m.tipo_fondo === 'caja').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
        const dayEgEfec = todayMovimientosForReport.filter(m => m.tipo === 'egreso' && m.tipo_fondo === 'caja').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
        const dayIngBanco = todayMovimientosForReport.filter(m => m.tipo === 'ingreso' && m.tipo_fondo === 'banco').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
        const dayEgBanco = todayMovimientosForReport.filter(m => m.tipo === 'egreso' && m.tipo_fondo === 'banco').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);

        const isHist = Boolean(selectedHistorySessionForReport);
        const montoAp = isDia ? parseFloat(activeSession?.monto_apertura || 0) : (isHist ? parseFloat(targetSession?.monto_apertura || 0) : resumenEnVivo.monto_apertura);
        const ingEf = isDia ? dayIngEfec : (isHist ? parseFloat(targetSession?.total_ingresos_efectivo || 0) : resumenEnVivo.total_ingresos_efectivo);
        const ingBco = isDia ? dayIngBanco : (isHist ? parseFloat(targetSession?.total_ingresos_banco || 0) : resumenEnVivo.total_ingresos_banco);
        const egEf = isDia ? dayEgEfec : (isHist ? parseFloat(targetSession?.total_egresos_efectivo || 0) : resumenEnVivo.total_egresos_efectivo);
        const egBco = isDia ? dayEgBanco : (isHist ? parseFloat(targetSession?.total_egresos_banco || 0) : resumenEnVivo.total_egresos_banco);
        const saldoEf = isDia ? (montoAp + dayIngEfec - dayEgEfec) : (isHist ? parseFloat(targetSession?.monto_esperado_efectivo ?? (montoAp + ingEf - egEf)) : resumenEnVivo.saldo_teorico_efectivo);
        const diferencia = arqueoRealEfectivo !== '' ? (parseFloat(arqueoRealEfectivo) - saldoEf).toFixed(2) : null;

        const text = `📊 *${isDia ? 'REPORTE DIARIO' : 'REPORTE DE CIERRE Y ARQUEO'} - AFINIX LAB*
📅 *Fecha:* ${fechaStr} | *Turno:* ${isDia ? 'JORNADA COMPLETA' : (targetSession?.turno?.toUpperCase() || 'GENERAL')}
👤 *Responsable:* ${targetSession?.cerrado_por_nombre || targetSession?.abierto_por_nombre || user?.nombre || 'Administración'}

💵 *Fondo Inicial:* ${formatCurrency(montoAp)}
🟢 *Total Ingresos:* ${formatCurrency(ingEf + ingBco)}
   • Efectivo: ${formatCurrency(ingEf)}
   • Bancos (Yape/BCP): ${formatCurrency(ingBco)}
🔴 *Total Egresos:* ${formatCurrency(egEf + egBco)}
   • Efectivo: ${formatCurrency(egEf)}
   • Bancos: ${formatCurrency(egBco)}

💰 *Efectivo en Caja:* ${formatCurrency(saldoEf)}
${!isDia && isHist && targetSession?.monto_real_efectivo !== null ? `🔎 *Conteo Real:* ${formatCurrency(targetSession.monto_real_efectivo)} (Dif: ${parseFloat(targetSession.diferencia_efectivo || 0) === 0 ? 'S/. 0.00 CUADRADO ✅' : `${formatCurrency(targetSession.diferencia_efectivo)} ⚠️`})` : (!isDia && arqueoRealEfectivo !== '' ? `🔎 *Conteo Real:* ${formatCurrency(arqueoRealEfectivo)} (Dif: ${diferencia === '0.00' ? 'S/. 0.00 CUADRADO ✅' : `S/. ${diferencia} ⚠️`})` : '')}

_Generado automáticamente por AFINIX Dental Lab_`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success('¡Reporte copiado al portapapeles para WhatsApp!');
        } else {
            toast.info('Copia el texto del reporte en pantalla.');
        }
    };

    const handleExportCSV = () => {
        if (!filteredMovimientos.length) {
            toast.error('No hay movimientos para exportar.');
            return;
        }
        const headers = ['Fecha', 'Hora', 'Tipo', 'Fondo', 'Categoria', 'Beneficiario_Cliente', 'Detalle_Pedido', 'Sustento', 'Monto'];
        const rows = filteredMovimientos.map((m) => [
            formatDateShort(m.fecha_movimiento),
            m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
            m.tipo_fondo?.toUpperCase(),
            m.categoria_gasto,
            `"${(m.beneficiario || '').replace(/"/g, '""')}"`,
            `"${(m.descripcion || '').replace(/"/g, '""')}"`,
            `"${(m.sustento_numero || m.referencia || m.sustento_tipo || '').replace(/"/g, '""')}"`,
            m.tipo === 'ingreso' ? m.monto : `-${m.monto}`
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `caja_diaria_${localDateInputValue()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Archivo CSV descargado correctamente.');
    };

    const handlePrintReport = (targetSession = null, targetMovimientos = null) => {
        const sessionToPrint = targetSession || selectedHistorySessionForReport || activeSession;
        if (!sessionToPrint && !targetMovimientos) {
            toast.error('No hay datos de sesión de caja para imprimir.');
            return;
        }

        const isDiaScope = reportScope === 'dia';
        const movsToPrint = targetMovimientos || (isDiaScope ? todayMovimientosForReport : sessionMovimientosForReport);

        let consolidatedSession;
        if (isDiaScope) {
            const dayIngEfec = todayMovimientosForReport.filter(m => m.tipo === 'ingreso' && m.tipo_fondo === 'caja').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
            const dayEgEfec = todayMovimientosForReport.filter(m => m.tipo === 'egreso' && m.tipo_fondo === 'caja').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
            const dayIngBanco = todayMovimientosForReport.filter(m => m.tipo === 'ingreso' && m.tipo_fondo === 'banco').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
            const dayEgBanco = todayMovimientosForReport.filter(m => m.tipo === 'egreso' && m.tipo_fondo === 'banco').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
            const fondoAp = parseFloat(activeSession?.monto_apertura || 0);

            consolidatedSession = {
                id: activeSession?.id || 'DIA',
                fecha: activeSession?.fecha || new Date(),
                turno: 'TODO EL DÍA',
                isConsolidadoDia: true,
                monto_apertura: fondoAp,
                total_ingresos_efectivo: dayIngEfec,
                total_egresos_efectivo: dayEgEfec,
                total_ingresos_banco: dayIngBanco,
                total_egresos_banco: dayEgBanco,
                monto_esperado_efectivo: fondoAp + dayIngEfec - dayEgEfec,
                monto_real_efectivo: fondoAp + dayIngEfec - dayEgEfec,
                diferencia_efectivo: 0,
                estado: 'CONSOLIDADO',
                abierto_por_nombre: user?.nombre || 'Administración',
                cerrado_por_nombre: 'Gerencia / Socios'
            };
        } else {
            const isLive = !targetSession && !selectedHistorySessionForReport;
            consolidatedSession = isLive ? {
                ...activeSession,
                monto_apertura: resumenEnVivo.monto_apertura,
                total_ingresos_efectivo: resumenEnVivo.total_ingresos_efectivo,
                total_egresos_efectivo: resumenEnVivo.total_egresos_efectivo,
                total_ingresos_banco: resumenEnVivo.total_ingresos_banco,
                total_egresos_banco: resumenEnVivo.total_egresos_banco,
                monto_esperado_efectivo: resumenEnVivo.saldo_teorico_efectivo,
                monto_real_efectivo: resumenEnVivo.saldo_teorico_efectivo,
                diferencia_efectivo: 0,
                estado: activeSession?.estado || 'abierta'
            } : sessionToPrint;
        }

        setCierreReportPrintData({
            session: consolidatedSession,
            movimientos: movsToPrint
        });

        document.body.classList.add('caja-reporte-printing');
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'visible';

        requestAnimationFrame(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('caja-reporte-printing');
                document.body.style.overflow = prevOverflow;
                setCierreReportPrintData(null);
            }, 600);
        });
    };

    const handleOpenHistorySessionReport = (session) => {
        setSelectedHistorySessionForReport(session);
        setReporteModalOpen(true);
    };

    const handleReprintMovement = (mov) => {
        const compTipo = mov.sustento_comprobante_tipo === '01' || (mov.sustento_numero && mov.sustento_numero.startsWith('F'))
            ? 'factura'
            : (mov.sustento_comprobante_tipo === '03' || (mov.sustento_numero && mov.sustento_numero.startsWith('B'))
                ? 'boleta'
                : 'nota');
        const defaultPrefix = compTipo === 'factura' ? (empresaFiscal?.serie_factura || 'F001') : (compTipo === 'boleta' ? (empresaFiscal?.serie_boleta || 'B001') : 'NV01');
        let ticketNum = (mov.sustento_numero || '').trim();
        if (!ticketNum || ticketNum.includes('TEST') || ticketNum.includes('-T')) {
            ticketNum = `${defaultPrefix}-${String(mov.id).padStart(8, '0')}`;
        }
        const fechaStr = mov.fecha_movimiento 
            ? (String(mov.fecha_movimiento).includes('T') ? String(mov.fecha_movimiento).split('T')[0] : String(mov.fecha_movimiento))
            : (mov.created_at ? String(mov.created_at).split('T')[0] : new Date().toISOString().split('T')[0]);
        const montoNum = parseFloat(mov.monto || 0);
        const cleanProdFromDesc = mov.descripcion
            ? mov.descripcion
                .replace(/\(Pac:[^)]*\)?/gi, '')
                .replace(/^Paciente:\s*[^|]+(\| )?/i, '')
                .replace(/^Cobro de pedido [^:]+:\s*/i, '')
                .replace(/^Cobro de pedido [^-\n]+/i, '')
                .replace(/^Cobro [^-\n]+-\s*/i, '')
                .trim()
            : '';
        const productoFinal = mov.producto_principal || mov.producto_nombre || (cleanProdFromDesc.length > 2 ? cleanProdFromDesc : 'Servicio técnico dental');

        setCobroExitosoTicket({
            ticketNumero: ticketNum,
            fecha: fechaStr,
            comprobanteTipo: compTipo,
            docIdentidad: mov.sustento_emisor_doc || '',
            razonSocial: mov.beneficiario || 'Cliente Directo',
            tipoFondo: mov.tipo_fondo || 'caja',
            subMedio: mov.metodo_pago || (mov.tipo_fondo === 'caja' ? 'efectivo' : 'transferencia'),
            referencia: mov.referencia || mov.sustento_nota || '',
            saldoRestante: 0,
            orders: [{
                id: mov.pedido_id || mov.id,
                codigo: mov.pedido_codigo || 'PED-S/N',
                paciente: mov.paciente_nombre || 'Cliente',
                clinica: mov.beneficiario || 'Clínica',
                producto: productoFinal,
                cantidad: mov.producto_cantidad || mov.cantidad || 1,
                saldoOriginal: montoNum,
                montoCobrado: montoNum
            }],
            subtotal: montoNum,
            descuento: 0,
            descuentoMotivo: '',
            totalCobrado: montoNum,
            responsable: mov.creado_por_nombre || user?.nombre || 'Caja Central',
            hash: generateReceiptHash(`${ticketNum}-${montoNum}`)
        });
        setTicketModalOpen(true);
    };

    const handleRegisterOrderPayment = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!activeSession) {
            toast.error('Debes abrir la caja antes de registrar cobros o movimientos.');
            setAperturaModalOpen(true);
            return;
        }
        if (isCajaTrasnochada) {
            toast.error('Tienes una caja abierta del día anterior sin cerrar. Realiza el arqueo y ciérrala antes de registrar cobros de hoy.');
            setArqueoRealEfectivo(String(resumenEnVivo.saldo_teorico_efectivo || 0));
            setCierreModalOpen(true);
            return;
        }
        if (selectedOrdersForPayment.length === 0) {
            toast.error('Por favor selecciona al menos un pedido para registrar el cobro.');
            return;
        }

        if (ticketComprobanteTipo === 'factura') {
            const cleanRuc = (ticketDocIdentidad || '').trim();
            if (cleanRuc.length !== 11) {
                toast.error('Para emitir Factura electrónica, el receptor debe tener un RUC de 11 dígitos válido.');
                return;
            }
            if (!ticketRazonSocial || !ticketRazonSocial.trim()) {
                toast.error('Para emitir Factura electrónica, ingrese la Razón Social de la empresa o clínica.');
                return;
            }
        }

        const count = selectedOrdersForPayment.length;
        const totalCobrar = orderPaymentSummary.totalCobrarHoy;
        if (totalCobrar <= 0 && orderPaymentSummary.totalDescuentos <= 0) {
            toast.error('El monto total a cobrar debe ser mayor a 0.');
            return;
        }

        const toastId = toast.loading(`Registrando cobro de ${count} pedido(s)...`);

        try {
            // Descuento y abono en cascada (sin decimales rotos)
            let remainingDiscount = Math.round((orderPaymentSummary.totalDescuentos || 0) * 100) / 100;
            let remainingAbono = Math.round((orderPaymentSummary.totalCobrarHoy || 0) * 100) / 100;

            const orderPayments = [];
            for (let i = 0; i < selectedOrdersForPayment.length; i++) {
                const ped = selectedOrdersForPayment[i];
                const pedSaldo = parseFloat(ped?.saldo ?? ped?.saldo_pendiente ?? ped?.total ?? 0);

                // Descuento en cascada: absorbe el descuento en este pedido hasta cubrir su saldo o agotar el descuento
                const pedDiscount = Math.min(remainingDiscount, pedSaldo);
                remainingDiscount = Math.max(0, Math.round((remainingDiscount - pedDiscount) * 100) / 100);

                const pedNeto = Math.max(0, Math.round((pedSaldo - pedDiscount) * 100) / 100);

                // Abono en cascada
                const pedMontoCobrar = Math.min(remainingAbono, pedNeto);
                remainingAbono = Math.max(0, Math.round((remainingAbono - pedMontoCobrar) * 100) / 100);

                const productoNombre = ped.producto_principal || ped.tipo_trabajo || 'Servicio técnico dental';
                const cant = Array.isArray(ped.producto_piezas) && ped.producto_piezas.length > 0
                    ? ped.producto_piezas.length
                    : (Array.isArray(ped.piezas) && ped.piezas.length > 0
                        ? ped.piezas.length
                        : (parseInt(ped.producto_cantidad || ped.cantidad || 1, 10) || 1));

                orderPayments.push({
                    orderId: ped.id,
                    monto: pedMontoCobrar,
                    descuento: pedDiscount,
                    motivo_descuento: pedDiscount > 0 ? (globalDiscountMotivo?.trim() || 'Ajuste comercial') : null,
                    pedCodigo: ped.codigo,
                    paciente: ped.paciente_nombre,
                    clinica: ped.clinica_nombre,
                    producto: productoNombre,
                    cantidad: cant,
                    saldoOriginal: pedSaldo
                });
            }

            // Información del Comprobante único
            const tipoCompCode = ticketComprobanteTipo === 'factura' ? '01' : (ticketComprobanteTipo === 'boleta' ? '03' : '00');
            let comprobanteInfo = {
                tipo: ticketComprobanteTipo,
                tipo_comprobante: tipoCompCode,
                serie: ticketComprobanteTipo === 'factura' ? 'F001' : (ticketComprobanteTipo === 'boleta' ? 'B001' : 'NV'),
                numero: null,
                docIdentidad: ticketDocIdentidad?.trim() || '',
                razonSocial: ticketRazonSocial?.trim() || '',
                pdfUrl: null,
                comprobanteId: null
            };

            // Emisión de UN SOLO comprobante electrónico si es Factura o Boleta
            if (ticketComprobanteTipo === 'factura' || ticketComprobanteTipo === 'boleta') {
                const primaryOrder = selectedOrdersForPayment[0];
                try {
                    const gravadaTotal = Math.round((totalCobrar / 1.18) * 100) / 100;
                    const igvTotal = Math.round((totalCobrar - gravadaTotal) * 100) / 100;

                    const invoicePayload = {
                        tipoComprobante: tipoCompCode,
                        billingData: {
                            client: {
                                tipoDoc: ticketComprobanteTipo === 'factura' ? '6' : ((ticketDocIdentidad || '').length === 11 ? '6' : '1'),
                                numDoc: ticketDocIdentidad?.trim() || primaryOrder.clinica_dni || primaryOrder.clinica_ruc || '',
                                rznSocial: ticketRazonSocial?.trim() || primaryOrder.clinica_razon_social || primaryOrder.clinica_nombre || 'Cliente'
                            },
                            mtoOperGravadas: gravadaTotal,
                            mtoIGV: igvTotal,
                            mtoImpVenta: totalCobrar,
                            details: orderPayments
                                .filter(item => item.monto > 0)
                                .map(item => {
                                    const qty = Math.max(1, parseInt(item.cantidad || 1, 10));
                                    const montoItem = parseFloat(item.monto || 0);
                                    const itemGravada = Math.round((montoItem / 1.18) * 100) / 100;
                                    const itemValorUnitario = qty > 0 ? Math.round((itemGravada / qty) * 1000000) / 1000000 : itemGravada;
                                    return {
                                        codProducto: 'SRV001',
                                        description: item.producto || 'Servicio técnico dental',
                                        descripcion: item.producto || 'Servicio técnico dental',
                                        qty,
                                        cantidad: qty,
                                        mtoValorUnitario: itemValorUnitario,
                                        mtoPrecioUnitario: qty > 0 ? Math.round((montoItem / qty) * 100) / 100 : montoItem,
                                        unitPrice: {
                                            amount: itemValorUnitario,
                                            currency: 'PEN'
                                        }
                                    };
                                })
                        }
                    };

                    const invoiceRes = await createInvoiceMutation.mutateAsync({
                        orderId: primaryOrder.id,
                        payload: invoicePayload
                    });

                    if (invoiceRes) {
                        const serie = invoiceRes.serie || (tipoCompCode === '01' ? 'F001' : 'B001');
                        const correlativo = invoiceRes.correlativo;
                        const numeroComp = invoiceRes.numero || (correlativo ? `${serie}-${String(correlativo).padStart(8, '0')}` : `${serie}-00000001`);
                        comprobanteInfo.serie = serie;
                        comprobanteInfo.numero = numeroComp;
                        comprobanteInfo.comprobanteId = invoiceRes.id || invoiceRes.invoiceId || null;
                        comprobanteInfo.pdfUrl = invoiceRes.pdf_url || invoiceRes.pdfUrl || null;
                        comprobanteInfo.hashCpe = invoiceRes.hash_cpe || null;
                    }
                } catch (invoiceErr) {
                    console.warn('[CajaGastos] Error emitiendo comprobante SUNAT consolidado:', invoiceErr);
                    toast.error(`Comprobante SUNAT: ${invoiceErr?.message || 'Error en emisión'}. Se registrará el cobro en caja.`);
                }
            }

            const metodoPago = createForm.tipo_fondo === 'caja'
                ? 'efectivo'
                : (createForm.sub_medio === 'yape_plin' ? 'yape_plin' : createForm.sub_medio === 'tarjeta' ? 'tarjeta' : 'transferencia');

            const primaryProd = selectedOrdersForPayment[0]?.producto_principal || selectedOrdersForPayment[0]?.producto || 'Servicio técnico dental';
            const descripcionConsolidada = selectedOrdersForPayment.length === 1
                ? `Cobro ${selectedOrdersForPayment[0].codigo} - ${primaryProd}`
                : `Cobro de ${selectedOrdersForPayment.length} pedidos: ${selectedOrdersForPayment.map(p => p.codigo).join(', ')}`;

            const clientName = ticketRazonSocial?.trim()
                || selectedOrdersForPayment[0]?.clinica_razon_social
                || selectedOrdersForPayment[0]?.clinica_nombre
                || 'Cliente';

            const cobroResult = await registerConsolidatedPaymentMutation.mutateAsync({
                payload: {
                    orderPayments: orderPayments.map(p => ({
                        orderId: p.orderId,
                        monto: p.monto,
                        descuento: p.descuento,
                        motivo_descuento: p.motivo_descuento
                    })),
                    totalCobrado: totalCobrar,
                    tipo_fondo: createForm.tipo_fondo,
                    metodo: metodoPago,
                    cuenta_id: createForm.cuenta_id || null,
                    fecha_pago: createForm.fecha_movimiento || localDateInputValue(),
                    referencia: createForm.sustento_nota?.trim() || null,
                    beneficiario: clientName,
                    descripcion: descripcionConsolidada,
                    comprobante: comprobanteInfo
                }
            });

            const movimientoCreado = cobroResult?.data?.movimiento || cobroResult?.movimiento;
            const defaultPrefix = ticketComprobanteTipo === 'factura'
                ? (empresaFiscal?.serie_factura || 'F001')
                : (ticketComprobanteTipo === 'boleta' ? (empresaFiscal?.serie_boleta || 'B001') : 'NV01');
            const finalTicketNumero = comprobanteInfo.numero || movimientoCreado?.sustento_numero || `${defaultPrefix}-${String(movimientoCreado?.id || Date.now().toString().slice(-6)).padStart(8, '0')}`;

            const snapshotTicket = {
                ticketNumero: finalTicketNumero,
                fecha: new Date(),
                comprobanteTipo: ticketComprobanteTipo,
                docIdentidad: ticketDocIdentidad,
                razonSocial: clientName,
                tipoFondo: createForm.tipo_fondo,
                subMedio: createForm.tipo_fondo === 'banco' ? (createForm.sub_medio || 'yape_plin') : 'efectivo',
                referencia: createForm.sustento_nota?.trim() || '',
                orders: orderPayments.map(p => ({
                    id: p.orderId,
                    codigo: p.pedCodigo,
                    paciente: p.paciente || 'Sin paciente',
                    clinica: p.clinica || 'Clínica directa',
                    producto: p.producto,
                    cantidad: p.cantidad,
                    saldoOriginal: p.saldoOriginal,
                    descuento: p.descuento,
                    montoCobrado: p.monto
                })),
                subtotal: orderPaymentSummary.subtotal,
                descuento: orderPaymentSummary.totalDescuentos,
                descuentoMotivo: globalDiscountMotivo,
                totalCobrado: totalCobrar,
                saldoRestante: orderPaymentSummary.totalSaldoRestante,
                responsable: user?.nombre || 'Administración',
                hash: generateReceiptHash(`${finalTicketNumero}-${totalCobrar}`)
            };
            setCobroExitosoTicket(snapshotTicket);
            setTicketModalOpen(true);

            const tipoLabel = ticketComprobanteTipo === 'factura' ? 'Factura' : (ticketComprobanteTipo === 'boleta' ? 'Boleta' : 'Nota');
            const toastMessage = orderPaymentSummary.hasPartial
                ? `Cobro de ${formatCurrency(totalCobrar)} registrado (${tipoLabel}). Queda saldo pendiente de ${formatCurrency(orderPaymentSummary.totalSaldoRestante)}.`
                : `Cobro de ${formatCurrency(totalCobrar)} registrado (${tipoLabel}) para ${count} pedido(s).`;

            toast.success(
                (t) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span>{toastMessage}</span>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                    toast.dismiss(t.id);
                                    setTicketModalOpen(true);
                                }}
                                style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                            >
                                <i className="bi bi-printer" style={{ marginRight: '4px' }}></i> Ver Ticket
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    toast.dismiss(t.id);
                                    handleTabChange('facturacion');
                                }}
                                style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                            >
                                <i className="bi bi-receipt" style={{ marginRight: '4px' }}></i> Emitir SUNAT
                            </button>
                        </div>
                    </div>
                ),
                { id: toastId, duration: 6000 }
            );

            setSelectedOrdersForPayment([]);
            setOrderPaymentConfigs({});
            setCustomTotalCobrar(null);
            setShowGlobalDiscount(false);
            setGlobalDiscount('');
            setGlobalDiscountMotivo('');
            setTicketDocIdentidad('');
            setTicketRazonSocial('');
            setTicketDocManuallyEdited(false);
            setTicketRazonSocialManuallyEdited(false);
            setPedidoSearch('');
            setCreateForm(createDefaultForm(defaultCategory, { tipo: 'ingreso', tipo_fondo: createForm.tipo_fondo }));
        } catch (err) {
            toast.error(err.message || 'Error al registrar el cobro de pedidos.', { id: toastId });
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        return handleRegisterOrderPayment(e);
    };

    const handleCreateGasto = async (e) => {
        e.preventDefault();
        if (!activeSession) {
            toast.error('Debes abrir la caja antes de registrar gastos.');
            setAperturaModalOpen(true);
            return;
        }
        if (isCajaTrasnochada) {
            toast.error('Tienes una caja abierta del día anterior sin cerrar. Realiza el arqueo y ciérrala antes de registrar gastos de hoy.');
            setArqueoRealEfectivo(String(resumenEnVivo.saldo_teorico_efectivo || 0));
            setCierreModalOpen(true);
            return;
        }
        if (!validateForm(gastoForm)) return;

        try {
            await createMovementMutation.mutateAsync(buildPayload(gastoForm));
            toast.success('Gasto registrado con éxito.');
            setGastoForm(createDefaultForm(defaultCategory, { tipo: 'egreso', tipo_fondo: gastoForm.tipo_fondo }));
        } catch (error) {
            toast.error(error.message || 'Error al registrar el gasto.');
        }
    };

    const liveDiferencia = useMemo(() => {
        if (!arqueoRealEfectivo || Number.isNaN(parseFloat(arqueoRealEfectivo))) return null;
        return parseFloat(arqueoRealEfectivo) - resumenEnVivo.saldo_teorico_efectivo;
    }, [arqueoRealEfectivo, resumenEnVivo.saldo_teorico_efectivo]);

    return (
        <div className="animate-fade-in caja-page-container">
            <div className="caja-header">
                <div className="caja-title-area">
                    <h1>
                        <i className="bi bi-wallet2 text-primary" aria-hidden="true"></i>
                        Caja y Facturación
                    </h1>
                </div>
                
                <div className="caja-actions">
                    {!activeCashSessionQuery.isLoading && (
                        <>
                            {isCajaTrasnochada ? (
                                <button 
                                    type="button" 
                                    className="btn btn-warning"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                                    onClick={() => {
                                        setArqueoRealEfectivo(String(resumenEnVivo.saldo_teorico_efectivo || 0));
                                        setCierreModalOpen(true);
                                    }}
                                >
                                    <i className="bi bi-lock-fill"></i> Cerrar Caja Anterior
                                </button>
                            ) : activeSession ? (
                                <>
                                    <div className="caja-status-pill">
                                        <span className="cash-status-dot pulse-green"></span>
                                        <span>Caja Abierta &bull; {activeSession.turno === 'manana' ? 'Turno Mañana' : activeSession.turno === 'tarde' ? 'Turno Tarde' : 'Día Completo'}</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                                        onClick={() => {
                                            setArqueoRealEfectivo('');
                                            setCierreModalOpen(true);
                                        }}
                                    >
                                        <i className="bi bi-calculator"></i> Arqueo y Cierre
                                    </button>
                                </>
                            ) : (
                                <button 
                                    type="button" 
                                    className="btn btn-primary"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                                    onClick={() => {
                                        setAperturaMonto('');
                                        setAperturaTurno('general');
                                        setAperturaModalOpen(true);
                                    }}
                                >
                                    <i className="bi bi-unlock-fill"></i> Abrir Caja
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Banner de alerta: Caja Trasnochada */}
            {isCajaTrasnochada && (
                <div 
                    className="alert alert-warning" 
                    role="alert" 
                    style={{ 
                        marginBottom: 'var(--space-4)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        gap: 'var(--space-3)',
                        borderLeft: '4px solid var(--color-warning, #f59e0b)',
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md, 8px)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '1.25rem', color: '#f59e0b' }}></i>
                        <div>
                            <strong>Caja de fecha anterior detectada:</strong> La sesión activa corresponde al{' '}
                            <strong>
                                {activeSession?.fecha ? (String(activeSession.fecha).slice(0, 10)) : 'día anterior'}
                            </strong>. Se recomienda realizar el arqueo y cierre de esa caja para evitar arrastrar movimientos a hoy.
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="btn btn-warning btn-sm"
                        style={{ whiteSpace: 'nowrap', fontWeight: 600 }}
                        onClick={() => {
                            setArqueoRealEfectivo(String(resumenEnVivo.saldo_teorico_efectivo || 0));
                            setCierreModalOpen(true);
                        }}
                    >
                        <i className="bi bi-lock-fill" style={{ marginRight: '6px' }}></i> Cerrar Caja Anterior
                    </button>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="section-tabs dashboard-view-switcher" role="group" aria-label="Secciones de caja" style={{ marginBottom: 'var(--space-6)' }}>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${currentTab === 'registro' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleTabChange('registro')}
                    aria-pressed={currentTab === 'registro'}
                >
                    <i className="bi bi-cash-stack" aria-hidden="true"></i> Cobros e Ingresos
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${currentTab === 'gastos' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleTabChange('gastos')}
                    aria-pressed={currentTab === 'gastos'}
                >
                    <i className="bi bi-credit-card-2-front" aria-hidden="true"></i> Gastos del Turno
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${currentTab === 'resumen' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleTabChange('resumen')}
                    aria-pressed={currentTab === 'resumen'}
                >
                    <i className="bi bi-wallet2" aria-hidden="true"></i> Resumen y Arqueo
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${currentTab === 'facturacion' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleTabChange('facturacion')}
                    aria-pressed={currentTab === 'facturacion'}
                >
                    <i className="bi bi-receipt" aria-hidden="true"></i> Facturación SUNAT
                </button>
                <button
                    type="button"
                    className={`btn section-tab dashboard-view-tab ${currentTab === 'historial' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleTabChange('historial')}
                    aria-pressed={currentTab === 'historial'}
                >
                    <i className="bi bi-clock-history" aria-hidden="true"></i> Historial de Cierres
                </button>
            </div>

            {/* TAB 1: COBROS E INGRESOS */}
            {currentTab === 'registro' && (
                <div className="register-ops-layout cobros-ops-layout">
                    {/* Panel Izquierdo: Formulario de Cobros / Ingresos */}
                    <section className="card expenses-create-card finance-entry-card">
                        <div className="expenses-panel-head finance-entry-head" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-4)' }}>
                            <div className="ingreso-icon-badge">
                                <i className="bi bi-cash-stack" aria-hidden="true"></i>
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <h2 className="card-title" style={{ margin: 0 }}>Registrar Ingreso</h2>
                                <p className="expenses-panel-sub" style={{ margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={selectedOrdersForPayment.length > 0 ? `${selectedOrdersForPayment.length} trabajo(s) en cuenta para cobro` : 'Cobro de trabajos clínicos y anticipos'}>
                                    {selectedOrdersForPayment.length > 0
                                        ? `${selectedOrdersForPayment.length} trabajo(s) en cuenta para cobro`
                                        : 'Cobro de trabajos clínicos y anticipos'}
                                </p>
                            </div>
                        </div>

                        <form className="expenses-form-card" onSubmit={handleFormSubmit}>
                            {!activeCashSessionQuery.isLoading && !activeSession && (
                                <div 
                                    className="alert alert-info" 
                                    style={{ 
                                        marginBottom: 'var(--space-4)', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        gap: '8px',
                                        padding: '10px 14px',
                                        borderRadius: 'var(--radius-md, 8px)',
                                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                        border: '1px solid rgba(59, 130, 246, 0.2)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                        <i className="bi bi-info-circle-fill" style={{ color: 'var(--color-primary, #3b82f6)' }}></i>
                                        <span>No hay una sesión de caja abierta hoy.</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="btn btn-primary btn-sm"
                                        style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                                        onClick={() => setAperturaModalOpen(true)}
                                    >
                                        <i className="bi bi-door-open" style={{ marginRight: '4px' }}></i> Abrir Caja
                                    </button>
                                </div>
                            )}

                            {!activeCashSessionQuery.isLoading && activeSession && isCajaTrasnochada && (
                                <div 
                                    className="alert alert-warning" 
                                    style={{ 
                                        marginBottom: 'var(--space-4)', 
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        gap: '10px',
                                        padding: '12px 14px',
                                        borderRadius: 'var(--radius-md, 8px)',
                                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.83rem', color: '#b45309', lineHeight: 1.4 }}>
                                        <i className="bi bi-exclamation-triangle-fill" style={{ color: '#f59e0b', fontSize: '1rem', marginTop: '1px', flexShrink: 0 }}></i>
                                        <span><strong>Caja de ayer sin cerrar:</strong> La sesión activa corresponde al <strong>{activeSession?.fecha ? String(activeSession.fecha).slice(0, 10) : 'día anterior'}</strong>. Debes arquear y cerrarla para poder operar hoy.</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="btn btn-warning btn-sm"
                                        style={{ fontSize: '0.8rem', padding: '6px 12px', width: '100%', justifyContent: 'center', fontWeight: 600 }}
                                        onClick={() => {
                                            setArqueoRealEfectivo(String(resumenEnVivo.saldo_teorico_efectivo || 0));
                                            setCierreModalOpen(true);
                                        }}
                                    >
                                        <i className="bi bi-lock-fill" style={{ marginRight: '6px' }}></i> Cerrar Caja Anterior
                                    </button>
                                </div>
                            )}

                            {/* TICKET DE COBRO */}
                            <div className="finance-ticket-content">
                                    {/* PASO 1: MEDIO DE PAGO */}
                                    <div className="form-group" style={{ marginBottom: createForm.tipo_fondo === 'banco' ? '6px' : 0 }}>
                                        <span className="form-label" style={{ fontWeight: 600 }}>Medio de pago</span>
                                        <div className="segmented-control expense-origin-toggle" role="group" aria-label="Medio de pago" style={{ display: 'flex', width: '100%' }}>
                                            <button
                                                type="button"
                                                className={`segmented-control__btn${createForm.tipo_fondo === 'caja' ? ' is-active' : ''}`}
                                                aria-pressed={createForm.tipo_fondo === 'caja'}
                                                onClick={() => setCreateForm(prev => ({ ...prev, tipo_fondo: 'caja' }))}
                                                style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', justifyContent: 'center', gap: '6px' }}
                                            >
                                                <i className="bi bi-cash-coin" aria-hidden="true"></i>
                                                Efectivo
                                            </button>
                                            <button
                                                type="button"
                                                className={`segmented-control__btn${createForm.tipo_fondo === 'banco' ? ' is-active' : ''}`}
                                                aria-pressed={createForm.tipo_fondo === 'banco'}
                                                onClick={() => setCreateForm(prev => ({ ...prev, tipo_fondo: 'banco' }))}
                                                style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', justifyContent: 'center', gap: '6px' }}
                                            >
                                                <i className="bi bi-arrow-left-right" aria-hidden="true"></i>
                                                Transferencia
                                            </button>
                                        </div>
                                    </div>

                                    {/* Sub-opciones de Transferencia en Ingresos */}
                                    {createForm.tipo_fondo === 'banco' && (
                                        <div className="form-group" style={{ marginTop: '0', marginBottom: 0 }}>
                                            <div className="finance-submethods-group" role="group" aria-label="Canal de cobro">
                                                <button
                                                    type="button"
                                                    className={`finance-submethod-btn${(createForm.sub_medio || 'yape_plin') === 'yape_plin' ? ' is-active' : ''}`}
                                                    onClick={() => setCreateForm(prev => ({ ...prev, sub_medio: 'yape_plin' }))}
                                                >
                                                    <i className="bi bi-phone"></i> Yape / Plin
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`finance-submethod-btn${createForm.sub_medio === 'tarjeta' ? ' is-active' : ''}`}
                                                    onClick={() => setCreateForm(prev => ({ ...prev, sub_medio: 'tarjeta' }))}
                                                >
                                                    <i className="bi bi-credit-card"></i> Tarjeta
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`finance-submethod-btn${createForm.sub_medio === 'interbancaria' ? ' is-active' : ''}`}
                                                    onClick={() => setCreateForm(prev => ({ ...prev, sub_medio: 'interbancaria' }))}
                                                >
                                                    <i className="bi bi-bank"></i> Interbancaria
                                                </button>
                                            </div>
                                            <div style={{ marginTop: '6px' }}>
                                                <input
                                                    type="text"
                                                    className="form-input form-input-sm"
                                                    placeholder={
                                                        (createForm.sub_medio || 'yape_plin') === 'yape_plin'
                                                            ? 'N° Celular u Operación Yape/Plin (Opcional)'
                                                            : createForm.sub_medio === 'tarjeta'
                                                                ? 'N° Operación POS / Lote (Opcional)'
                                                                : 'N° Operación Bancaria BCP/BBVA (Opcional)'
                                                    }
                                                    value={createForm.sustento_nota || ''}
                                                    onChange={(e) => setCreateForm(prev => ({ ...prev, sustento_nota: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* PASO 2: COMPROBANTE DE PAGO */}
                                    <div className="form-group expense-sustento-box" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <i className="bi bi-file-earmark-check" style={{ color: 'var(--color-primary)' }}></i>
                                            Comprobante para el Cliente (Clínica / Dr.)
                                        </label>

                                        <div className="segmented-control expense-sustento-toggle" role="group" aria-label="Tipo de comprobante" style={{ marginBottom: '10px' }}>
                                            {[
                                                { value: 'nota', label: 'Nota', icon: 'bi-dash-circle', title: 'Nota de venta o recibo de caja interno' },
                                                { value: 'boleta', label: 'Boleta', icon: 'bi-receipt', title: 'Boleta de Venta (DNI o RUC 10 de Dr./Clínica)' },
                                                { value: 'factura', label: 'Factura', icon: 'bi-file-earmark-text', title: 'Factura Electrónica (RUC de Empresa/Clínica)' },
                                            ].map((item) => {
                                                const active = ticketComprobanteTipo === item.value;
                                                return (
                                                    <button
                                                        key={item.value}
                                                        type="button"
                                                        title={item.title}
                                                        className={`segmented-control__btn${active ? ' is-active' : ''}`}
                                                        aria-pressed={active}
                                                        onClick={() => handleTicketComprobanteChange(item.value)}
                                                    >
                                                        <i className={`bi ${item.icon}`} aria-hidden="true" style={{ marginRight: '4px' }}></i>
                                                        {item.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {ticketComprobanteTipo === 'factura' && (
                                            <div className="expense-fiscal-fields" style={{ display: 'grid', gridTemplateColumns: '125px 1fr', gap: '8px' }}>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>RUC (11 dígitos)</label>
                                                    <input
                                                        type="text"
                                                        className="form-input form-input-sm"
                                                        placeholder="20XXXXXXXXX"
                                                        maxLength={11}
                                                        value={ticketDocIdentidad}
                                                        onChange={(e) => {
                                                            setTicketDocIdentidad(e.target.value);
                                                            setTicketDocManuallyEdited(true);
                                                        }}
                                                    />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Razón Social / Clínica</label>
                                                    <input
                                                        type="text"
                                                        className="form-input form-input-sm"
                                                        placeholder="Razón Social de la Clínica"
                                                        value={ticketRazonSocial}
                                                        onChange={(e) => {
                                                            setTicketRazonSocial(e.target.value);
                                                            setTicketRazonSocialManuallyEdited(true);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {ticketComprobanteTipo === 'boleta' && (
                                            <div className="expense-simple-fields" style={{ display: 'grid', gridTemplateColumns: '125px 1fr', gap: '8px' }}>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>DNI / RUC Dr.</label>
                                                    <input
                                                        type="text"
                                                        className="form-input form-input-sm"
                                                        placeholder="8 u 11 dígitos"
                                                        maxLength={15}
                                                        value={ticketDocIdentidad}
                                                        onChange={(e) => {
                                                            setTicketDocIdentidad(e.target.value);
                                                            setTicketDocManuallyEdited(true);
                                                        }}
                                                    />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Cliente (Dr. / Clínica)</label>
                                                    <input
                                                        type="text"
                                                        className="form-input form-input-sm"
                                                        placeholder="Nombre del Doctor o Consultorio"
                                                        value={ticketRazonSocial}
                                                        onChange={(e) => {
                                                            setTicketRazonSocial(e.target.value);
                                                            setTicketRazonSocialManuallyEdited(true);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {ticketComprobanteTipo === 'boleta' && (ticketDocIdentidad || '').trim().startsWith('20') && (ticketDocIdentidad || '').trim().length === 11 && (
                                            <div style={{ fontSize: '0.73rem', color: '#b45309', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', padding: '6px 10px', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                <div>
                                                    <i className="bi bi-exclamation-triangle" style={{ marginRight: '5px' }}></i>
                                                    <strong>Regla SUNAT:</strong> Empresa con RUC 20 requiere Factura para deducir gasto/crédito fiscal.
                                                </div>
                                                <button
                                                    type="button"
                                                    style={{ padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600, background: '#d97706', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                    onClick={() => handleTicketComprobanteChange('factura')}
                                                >
                                                    Cambiar a Factura
                                                </button>
                                            </div>
                                        )}

                                        {ticketComprobanteTipo === 'nota' && (
                                            <div className="expense-ninguno-fields" style={{ display: 'grid', gridTemplateColumns: '125px 1fr', gap: '8px' }}>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Doc (Opcional)</label>
                                                    <input
                                                        type="text"
                                                        className="form-input form-input-sm"
                                                        placeholder="DNI / RUC"
                                                        maxLength={15}
                                                        value={ticketDocIdentidad}
                                                        onChange={(e) => {
                                                            setTicketDocIdentidad(e.target.value);
                                                            setTicketDocManuallyEdited(true);
                                                        }}
                                                    />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Cliente (Dr. / Clínica)</label>
                                                    <input
                                                        type="text"
                                                        className="form-input form-input-sm"
                                                        placeholder="Nombre del Doctor o Consultorio"
                                                        value={ticketRazonSocial}
                                                        onChange={(e) => {
                                                            setTicketRazonSocial(e.target.value);
                                                            setTicketRazonSocialManuallyEdited(true);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* PASO 3: DETALLE DE TRABAJOS A COBRAR */}
                                    <div className="finance-ticket-jobs-wrapper">
                                        <div className="finance-ticket-detail-head">
                                            <span className="form-label" style={{ fontWeight: 600, marginBottom: 0 }}>
                                                Detalle de Trabajos ({selectedOrdersForPayment.length})
                                            </span>
                                            {selectedOrdersForPayment.length > 0 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-xs"
                                                    onClick={() => {
                                                        setSelectedOrdersForPayment([]);
                                                        setOrderPaymentConfigs({});
                                                        setShowGlobalDiscount(false);
                                                        setGlobalDiscount('');
                                                        setGlobalDiscountMotivo('');
                                                        setTicketDocIdentidad('');
                                                        setTicketRazonSocial('');
                                                        setTicketDocManuallyEdited(false);
                                                        setTicketRazonSocialManuallyEdited(false);
                                                    }}
                                                    style={{ fontSize: '0.72rem', color: 'var(--color-danger)', padding: '2px 4px' }}
                                                >
                                                    <i className="bi bi-x-circle" style={{ marginRight: '3px' }}></i> Limpiar
                                                </button>
                                            )}
                                        </div>

                                        {/* Lista de Trabajos o Placeholder con altura persistente */}
                                        {selectedOrdersForPayment.length === 0 ? (
                                            <div className="finance-ticket-empty">
                                                <i className="bi bi-receipt" aria-hidden="true"></i>
                                                <strong>Ningún trabajo seleccionado</strong>
                                                <p>Selecciona trabajos de la lista para agregarlos a este ticket.</p>
                                            </div>
                                        ) : (
                                            <div className="finance-ticket-items">
                                                {selectedOrdersForPayment.map(ped => {
                                                    const pedSaldo = parseFloat(ped?.saldo ?? ped?.saldo_pendiente ?? ped?.total ?? 0);
                                                    return (
                                                        <div key={ped.id} className="finance-ticket-job-row">
                                                            <div className="finance-ticket-job-info">
                                                                <div className="finance-ticket-job-title">
                                                                    <span className="finance-ticket-job-code">{ped.codigo}</span>
                                                                    <span className="finance-ticket-job-patient" title={ped.paciente_nombre || 'Sin paciente'}>
                                                                        {ped.paciente_nombre || 'Sin paciente'}
                                                                    </span>
                                                                </div>
                                                                <div className="finance-ticket-job-clinic">
                                                                    {ped.clinica_nombre || 'Clínica directa'}
                                                                </div>
                                                            </div>
                                                            <div className="finance-ticket-job-aside">
                                                                <span className="finance-ticket-job-amount">
                                                                    {formatCurrency(pedSaldo)}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="finance-ticket-job-remove"
                                                                    onClick={() => toggleOrderSelection(ped)}
                                                                    title="Quitar de este ticket"
                                                                    aria-label={`Quitar ${ped.codigo} de este ticket`}
                                                                >
                                                                    <i className="bi bi-x-lg"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* PASO 4: TOTAL Y LIQUIDACIÓN */}
                                    <div className="finance-ticket-total">
                                        {/* Fila Subtotal y Botón Descuento Global */}
                                        <div className="finance-ticket-subtotal-row">
                                            <span className="finance-ticket-subtotal-label">
                                                Subtotal ({selectedOrdersForPayment.length} {selectedOrdersForPayment.length === 1 ? 'trabajo' : 'trabajos'}):
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="finance-ticket-subtotal-value">
                                                    {formatCurrency(orderPaymentSummary.subtotal)}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="finance-discount-trigger-btn"
                                                    disabled={selectedOrdersForPayment.length === 0}
                                                    onClick={() => {
                                                        const next = !showGlobalDiscount;
                                                        setShowGlobalDiscount(next);
                                                        if (!next) {
                                                            setGlobalDiscount('');
                                                            setGlobalDiscountMotivo('');
                                                        }
                                                    }}
                                                    title={showGlobalDiscount ? 'Cerrar descuento' : 'Aplicar descuento general'}
                                                >
                                                    <i className={`bi ${showGlobalDiscount ? 'bi-dash-circle' : 'bi-tag-fill'}`}></i>
                                                    {orderPaymentSummary.hasDiscount
                                                        ? `-${formatCurrency(orderPaymentSummary.totalDescuentos)}`
                                                        : '+ Descuento'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Caja expandible de Descuento Global */}
                                        {showGlobalDiscount && (
                                            <div className="finance-ticket-discount-box">
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <i className="bi bi-scissors"></i> Descuento al Total
                                                    </span>
                                                    {globalDiscount && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost btn-xs"
                                                            onClick={() => {
                                                                setGlobalDiscount('');
                                                                setGlobalDiscountMotivo('');
                                                            }}
                                                            style={{ fontSize: '0.68rem', padding: '1px 4px', color: 'var(--color-danger)' }}
                                                        >
                                                            Quitar
                                                        </button>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>S/.</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            max={orderPaymentSummary.subtotal}
                                                            placeholder="0.00"
                                                            value={globalDiscount}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setGlobalDiscount(val);
                                                                if (selectedOrdersForPayment.length === 1) {
                                                                    const num = parseFloat(val || 0);
                                                                    const valid = isNaN(num) ? 0 : Math.min(Math.max(0, num), orderPaymentSummary.subtotal);
                                                                    const newNet = Math.max(0, orderPaymentSummary.subtotal - valid);
                                                                    updateOrderConfig(selectedOrdersForPayment[0].id, 'montoAbonar', newNet.toFixed(2));
                                                                }
                                                            }}
                                                            style={{ width: '65px', fontSize: '0.8125rem', border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, color: '#047857' }}
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Motivo (ej. Cortesía / Pronto pago)"
                                                        value={globalDiscountMotivo}
                                                        onChange={(e) => setGlobalDiscountMotivo(e.target.value)}
                                                        style={{ flex: 1, fontSize: '0.75rem', padding: '3px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="finance-ticket-divider"></div>

                                        {/* Fila Total Principal */}
                                        <div className="finance-ticket-main-total-row">
                                            <div>
                                                <div className="finance-ticket-main-total-label">
                                                    {orderPaymentSummary.hasPartial ? 'Abonar hoy' : 'Total a cobrar'}
                                                </div>
                                                {orderPaymentSummary.hasPartial && (
                                                    <span
                                                        className="finance-ticket-partial-badge"
                                                        title="Click para restablecer monto completo"
                                                        onClick={() => setCustomTotalCobrar(null)}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        Resta {formatCurrency(orderPaymentSummary.totalSaldoRestante)} pendiente <i className="bi bi-arrow-counterclockwise" style={{ fontSize: '0.68rem', marginLeft: '2px' }}></i>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="finance-ticket-total-display">
                                                <div className="finance-ticket-amount-wrapper">
                                                    <span className="finance-currency-symbol">S/.</span>
                                                    <input
                                                        id="ticket-payment-amount"
                                                        className="finance-ticket-amount-input"
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        max={orderPaymentSummary.totalNeto}
                                                        value={
                                                            customTotalCobrar !== null
                                                                ? customTotalCobrar
                                                                : (orderPaymentSummary.totalNeto > 0 ? orderPaymentSummary.totalNeto.toFixed(2) : '0.00')
                                                        }
                                                        onChange={(e) => {
                                                            setCustomTotalCobrar(e.target.value);
                                                        }}
                                                        title="Monto a cobrar hoy"
                                                        disabled={selectedOrdersForPayment.length === 0}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="expenses-form-footer" style={{ marginTop: 'var(--space-4)' }}>
                                    <button
                                        type="submit"
                                        className="btn btn-primary expenses-submit-btn"
                                        disabled={registerPaymentMutation.isPending || selectedOrdersForPayment.length === 0}
                                    >
                                        <i className="bi bi-check-circle" aria-hidden="true" style={{ marginRight: '6px' }}></i>
                                        {registerPaymentMutation.isPending
                                            ? 'Procesando cobro...'
                                            : (selectedOrdersForPayment.length > 0
                                                ? `Confirmar Cobro (${selectedOrdersForPayment.length} ${selectedOrdersForPayment.length === 1 ? 'pedido' : 'pedidos'} · ${formatCurrency(totalSelectedOrdersAmount)})`
                                                : 'Confirmar Cobro (S/. 0.00)')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </section>

                    {/* Panel Derecho: Pedidos Terminados / Enviados Listos para Cobro */}
                    <section className="card expenses-table-card">
                        <div className="expenses-panel-head">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
                                <div>
                                    <h2 className="card-title">Pedidos Listos para Cobro</h2>
                                    <p className="expenses-panel-sub">Trabajos terminados o enviados con saldo pendiente de pago</p>
                                </div>

                                {/* Toggle: Prioritarios (Terminados/Enviados) vs Todos */}
                                <div className="segmented-control" style={{ maxWidth: '240px' }}>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${readyOrdersFilter === 'prioritarios' ? ' is-active' : ''}`}
                                        onClick={() => setReadyOrdersFilter('prioritarios')}
                                        style={{ fontSize: '0.75rem', padding: '4px 10px', flex: '1 1 0' }}
                                    >
                                        Listos ({finishedOrShippedOrders.length})
                                    </button>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${readyOrdersFilter === 'todos' ? ' is-active' : ''}`}
                                        onClick={() => setReadyOrdersFilter('todos')}
                                        style={{ fontSize: '0.75rem', padding: '4px 10px', flex: '1 1 0' }}
                                    >
                                        Todos ({pendingOrders.length})
                                    </button>
                                </div>
                            </div>

                            {/* Search Filter for Orders */}
                            <div className="search-box" style={{ width: '100%', marginTop: '8px', position: 'relative' }}>
                                <i className="bi bi-search"></i>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Filtrar pedidos por código, paciente, doctor o clínica..."
                                    value={readyOrdersSearch}
                                    onChange={(e) => setReadyOrdersSearch(e.target.value)}
                                    style={{ fontSize: '0.8125rem', paddingRight: readyOrdersSearch ? '32px' : undefined }}
                                />
                                {readyOrdersSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setReadyOrdersSearch('')}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--color-text-secondary)',
                                            padding: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '20px',
                                            height: '20px',
                                            zIndex: 2
                                        }}
                                        title="Limpiar búsqueda"
                                    >
                                        <i className="bi bi-x-circle-fill" style={{ position: 'static', transform: 'none', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}></i>
                                    </button>
                                )}
                            </div>
                        </div>

                        {pendingOrdersQuery.isLoading ? (
                            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                                <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Cargando pedidos para cobro...</p>
                            </div>
                        ) : displayedReadyOrders.length === 0 ? (
                            <div className="empty-state" style={{ padding: '36px 16px', textAlign: 'center' }}>
                                <i className="bi bi-check2-circle" style={{ fontSize: '2.5rem', color: 'var(--color-success, #10b981)' }}></i>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginTop: '8px', margin: 0 }}>¡Todo al día!</h3>
                                <p style={{ marginTop: '4px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                    {readyOrdersFilter === 'prioritarios'
                                        ? 'No hay pedidos terminados o enviados pendientes de cobro.'
                                        : 'No hay pedidos con saldo pendiente por cobrar.'}
                                </p>
                            </div>
                        ) : (
                            <div className="caja-ready-orders-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '560px', overflowY: 'auto', padding: '4px 6px 4px 4px' }}>
                                {displayedReadyOrders.map((ped) => {
                                    const isSelected = selectedOrdersForPayment.some(p => p.id === ped.id);
                                    const saldoNumber = parseFloat(ped.saldo ?? ped.saldo_pendiente ?? ped.total ?? 0);
                                    const isTerminado = ped.estado === 'terminado';
                                    const isEnviado = ped.estado === 'enviado';

                                    return (
                                        <div
                                            key={ped.id}
                                            className={`pedidos-order-card caja-ready-order-card${isSelected ? ' is-attention' : ''}`}
                                            onClick={() => toggleOrderSelection(ped)}
                                            style={{
                                                borderColor: isSelected ? 'var(--color-success, #10b981)' : undefined,
                                                background: isSelected ? 'rgba(16, 185, 129, 0.05)' : undefined,
                                                boxShadow: isSelected ? '0 0 0 1.5px var(--color-success, #10b981)' : undefined
                                            }}
                                        >
                                            {/* Miniatura de Producto */}
                                            <span
                                                className="pedidos-order-thumb caja-ready-order-thumb"
                                                aria-hidden="true"
                                            >
                                                <OrderProductThumb product={{ id: ped.id, nombre: ped.producto_principal, image_url: ped.producto_image_url }} />
                                            </span>

                                            {/* Datos del Caso */}
                                            <span className="pedidos-order-main caja-ready-order-main">
                                                <span className="pedidos-order-top">
                                                    <strong className="pedidos-order-patient">
                                                        {ped.paciente_nombre || 'Sin paciente'}
                                                    </strong>
                                                    {isTerminado && (
                                                        <span className="badge" style={{ background: '#e6f4ea', color: '#137333', fontSize: '0.7rem', fontWeight: 600, padding: '1px 8px' }}>
                                                            <i className="bi bi-check2-circle" style={{ marginRight: '3px' }}></i> Terminado
                                                        </span>
                                                    )}
                                                    {isEnviado && (
                                                        <span className="badge" style={{ background: '#e8f0fe', color: '#1967d2', fontSize: '0.7rem', fontWeight: 600, padding: '1px 8px' }}>
                                                            <i className="bi bi-truck" style={{ marginRight: '3px' }}></i> Enviado
                                                        </span>
                                                    )}
                                                    {ped.estado_pago === 'parcial' && (
                                                        <span className="badge badge-warning" style={{ fontSize: '0.7rem', padding: '1px 8px' }}>
                                                            Abono Parcial
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="pedidos-order-meta">
                                                    <span className="pedidos-order-code">{ped.codigo}</span>
                                                    {ped.clinica_nombre ? <span>· {ped.clinica_nombre}</span> : null}
                                                    {ped.doctor_nombre ? <span>· Dr. {ped.doctor_nombre}</span> : null}
                                                </span>
                                                {ped.producto_principal && (
                                                    <span className="pedidos-order-product">
                                                        <span className="pedidos-order-product-name" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                                                            {ped.producto_principal}
                                                        </span>
                                                    </span>
                                                )}
                                                <span className="pedidos-order-dates">
                                                    <span>
                                                        <i className="bi bi-calendar3" aria-hidden="true"></i>
                                                        {formatDateShort(ped.fecha_ingreso || ped.created_at)}
                                                    </span>
                                                    <span>
                                                        <i className="bi bi-truck" aria-hidden="true"></i>
                                                        Entrega {formatDateShort(ped.fecha_entrega || ped.created_at)}
                                                    </span>
                                                </span>
                                            </span>

                                            {/* Importes y Estado */}
                                            <span className="pedidos-order-aside caja-ready-order-aside">
                                                <div className="caja-ready-order-price-group">
                                                    {saldoNumber < parseFloat(ped.total || 0) ? (
                                                        <>
                                                            <div className="caja-ready-order-total-cross">
                                                                Total: {formatCurrency(ped.total)}
                                                            </div>
                                                            <div className="caja-ready-order-saldo-label">
                                                                Saldo pendiente
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="caja-ready-order-saldo-label">
                                                            Total a cobrar
                                                        </div>
                                                    )}
                                                    <strong className="pedidos-order-total caja-ready-order-total">
                                                        {formatCurrency(saldoNumber)}
                                                    </strong>
                                                </div>
                                                {isSelected && (
                                                    <span className="badge badge-success caja-ready-order-badge">
                                                        <i className="bi bi-check2-circle"></i> Seleccionado
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                </div>
            )}

            {/* TAB 2: REGISTRO DE GASTOS */}
            {currentTab === 'gastos' && (
                <div className="register-ops-layout cobros-ops-layout">
                    {/* Panel Izquierdo: Formulario de Gasto / Egreso */}
                    <section className="card expenses-create-card finance-entry-card gasto-entry-card">
                        <div className="expenses-panel-head finance-entry-head" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-4)' }}>
                            <div className="gasto-icon-badge">
                                <i className="bi bi-wallet2" aria-hidden="true"></i>
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <h2 className="card-title" style={{ margin: 0 }}>Registrar Gasto</h2>
                                <p className="expenses-panel-sub" style={{ margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Insumos, servicios y retiros de caja">
                                    Insumos, servicios y retiros de caja
                                </p>
                            </div>
                        </div>

                        <form className="expenses-form-card" onSubmit={handleCreateGasto}>
                            {!activeCashSessionQuery.isLoading && !activeSession && (
                                <div 
                                    className="alert alert-info" 
                                    style={{ 
                                        marginBottom: 'var(--space-4)', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        gap: '8px',
                                        padding: '10px 14px',
                                        borderRadius: 'var(--radius-md, 8px)',
                                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                        border: '1px solid rgba(59, 130, 246, 0.2)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                        <i className="bi bi-info-circle-fill" style={{ color: 'var(--color-primary, #3b82f6)' }}></i>
                                        <span>No hay una sesión de caja abierta hoy.</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="btn btn-primary btn-sm"
                                        style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                                        onClick={() => setAperturaModalOpen(true)}
                                    >
                                        <i className="bi bi-door-open" style={{ marginRight: '4px' }}></i> Abrir Caja
                                    </button>
                                </div>
                            )}

                            {!activeCashSessionQuery.isLoading && activeSession && isCajaTrasnochada && (
                                <div 
                                    className="alert alert-warning" 
                                    style={{ 
                                        marginBottom: 'var(--space-4)', 
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        gap: '10px',
                                        padding: '12px 14px',
                                        borderRadius: 'var(--radius-md, 8px)',
                                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.83rem', color: '#b45309', lineHeight: 1.4 }}>
                                        <i className="bi bi-exclamation-triangle-fill" style={{ color: '#f59e0b', fontSize: '1rem', marginTop: '1px', flexShrink: 0 }}></i>
                                        <span><strong>Caja de ayer sin cerrar:</strong> La sesión activa corresponde al <strong>{activeSession?.fecha ? String(activeSession.fecha).slice(0, 10) : 'día anterior'}</strong>. Debes arquear y cerrarla para poder operar hoy.</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="btn btn-warning btn-sm"
                                        style={{ fontSize: '0.8rem', padding: '6px 12px', width: '100%', justifyContent: 'center', fontWeight: 600 }}
                                        onClick={() => {
                                            setArqueoRealEfectivo(String(resumenEnVivo.saldo_teorico_efectivo || 0));
                                            setCierreModalOpen(true);
                                        }}
                                    >
                                        <i className="bi bi-lock-fill" style={{ marginRight: '6px' }}></i> Cerrar Caja Anterior
                                    </button>
                                </div>
                            )}

                            {/* Toggle: Efectivo vs Transferencia */}
                            <div className="form-group" style={{ marginBottom: gastoForm.tipo_fondo === 'banco' ? '6px' : 0 }}>
                                <span className="form-label" style={{ fontWeight: 600 }}>Medio de pago</span>
                                <div className="segmented-control expense-origin-toggle" role="group" aria-label="Medio de pago" style={{ display: 'flex', width: '100%' }}>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${gastoForm.tipo_fondo === 'caja' ? ' is-active' : ''}`}
                                        aria-pressed={gastoForm.tipo_fondo === 'caja'}
                                        onClick={() => setGastoForm(prev => ({ ...prev, tipo_fondo: 'caja' }))}
                                        style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', justifyContent: 'center', gap: '6px' }}
                                    >
                                        <i className="bi bi-cash-coin" aria-hidden="true"></i>
                                        Efectivo
                                    </button>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${gastoForm.tipo_fondo === 'banco' ? ' is-active' : ''}`}
                                        aria-pressed={gastoForm.tipo_fondo === 'banco'}
                                        onClick={() => setGastoForm(prev => ({ ...prev, tipo_fondo: 'banco' }))}
                                        style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', justifyContent: 'center', gap: '6px' }}
                                    >
                                        <i className="bi bi-arrow-left-right" aria-hidden="true"></i>
                                        Transferencia
                                    </button>
                                </div>
                            </div>

                            {/* Sub-opciones de Transferencia en Gastos */}
                            {gastoForm.tipo_fondo === 'banco' && (
                                <div className="form-group" style={{ marginTop: '0', marginBottom: 0 }}>
                                    <div className="finance-submethods-group" role="group" aria-label="Canal de pago">
                                        <button
                                            type="button"
                                            className={`finance-submethod-btn${(gastoForm.sub_medio || 'interbancaria') === 'yape_plin' ? ' is-active' : ''}`}
                                            onClick={() => setGastoForm(prev => ({ ...prev, sub_medio: 'yape_plin' }))}
                                        >
                                            <i className="bi bi-phone"></i> Yape / Plin
                                        </button>
                                        <button
                                            type="button"
                                            className={`finance-submethod-btn${gastoForm.sub_medio === 'tarjeta' ? ' is-active' : ''}`}
                                            onClick={() => setGastoForm(prev => ({ ...prev, sub_medio: 'tarjeta' }))}
                                        >
                                            <i className="bi bi-credit-card"></i> Tarjeta
                                        </button>
                                        <button
                                            type="button"
                                            className={`finance-submethod-btn${(gastoForm.sub_medio || 'interbancaria') === 'interbancaria' ? ' is-active' : ''}`}
                                            onClick={() => setGastoForm(prev => ({ ...prev, sub_medio: 'interbancaria' }))}
                                        >
                                            <i className="bi bi-bank"></i> Interbancaria
                                        </button>
                                    </div>
                                    <div style={{ marginTop: '6px' }}>
                                        <input
                                            type="text"
                                            className="form-input form-input-sm"
                                            placeholder={
                                                (gastoForm.sub_medio || 'interbancaria') === 'yape_plin'
                                                    ? 'N° Celular u Operación Yape/Plin (Opcional)'
                                                    : gastoForm.sub_medio === 'tarjeta'
                                                        ? 'N° Operación POS / Lote (Opcional)'
                                                        : 'N° Operación Bancaria BCP/BBVA (Opcional)'
                                            }
                                            value={gastoForm.referencia || gastoForm.sustento_nota || ''}
                                            onChange={(e) => setGastoForm(prev => ({ ...prev, referencia: e.target.value, sustento_nota: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Campos del Gasto */}
                            <MovementFormFields
                                form={gastoForm}
                                setForm={setGastoForm}
                                categoryOptions={categoryOptions}
                                defaultCategory={defaultCategory}
                                mode="create"
                                hideTipoToggle
                                hideFondoToggle
                            />

                            <div className="expenses-form-footer" style={{ marginTop: 'var(--space-4)' }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary expenses-submit-btn"
                                    disabled={createMovementMutation.isPending}
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <i className="bi bi-plus-circle-fill" aria-hidden="true"></i>
                                    {createMovementMutation.isPending ? 'Registrando Gasto...' : 'Registrar Gasto'}
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* Panel Derecho: Gastos Registrados en el Turno */}
                    <section className="card expenses-table-card">
                        <div className="expenses-panel-head" style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
                                <div>
                                    <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {activeGastosScope === 'turno' ? 'Gastos del Turno' : (activeGastosScope === 'dia' ? 'Gastos de Hoy' : 'Histórico de Gastos')}
                                        <span className="badge badge-subtle" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                                            {scopedEgresos.length} {scopedEgresos.length === 1 ? 'registro' : 'registros'}
                                        </span>
                                    </h2>
                                    <p className="expenses-panel-sub">
                                        {activeGastosScope === 'turno'
                                            ? (activeSession ? `Egresos registrados en la sesión actual (${activeSession.turno ? activeSession.turno.toUpperCase() : 'ACTIVA'})` : 'Egresos del turno')
                                            : (activeGastosScope === 'dia' ? 'Todos los egresos registrados hoy' : 'Todos los egresos históricos')}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <div className="segmented-control" role="group" aria-label="Alcance de egresos">
                                        <button
                                            type="button"
                                            className={`segmented-control__btn${activeGastosScope === 'turno' ? ' is-active' : ''}`}
                                            onClick={() => setGastosScope('turno')}
                                            title="Egresos del turno activo"
                                        >
                                            Turno
                                        </button>
                                        <button
                                            type="button"
                                            className={`segmented-control__btn${activeGastosScope === 'dia' ? ' is-active' : ''}`}
                                            onClick={() => setGastosScope('dia')}
                                            title="Egresos de la fecha de hoy"
                                        >
                                            Hoy
                                        </button>
                                        <button
                                            type="button"
                                            className={`segmented-control__btn${activeGastosScope === 'todos' ? ' is-active' : ''}`}
                                            onClick={() => setGastosScope('todos')}
                                            title="Ver todos los egresos históricos"
                                        >
                                            Histórico
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KPI Banner de Egresos */}
                        {(() => {
                            const totalCash = activeGastosScope === 'turno' && activeSession
                                ? resumenEnVivo.total_egresos_efectivo
                                : scopedEgresos.filter(m => m.tipo_fondo === 'caja').reduce((acc, m) => acc + Number(m.monto || 0), 0);

                            const totalBank = activeGastosScope === 'turno' && activeSession
                                ? resumenEnVivo.total_egresos_banco
                                : scopedEgresos.filter(m => m.tipo_fondo === 'banco').reduce((acc, m) => acc + Number(m.monto || 0), 0);

                            const totalTotal = totalCash + totalBank;
                            const cashCount = scopedEgresos.filter(m => m.tipo_fondo === 'caja').length;
                            const bankCount = scopedEgresos.filter(m => m.tipo_fondo === 'banco').length;

                            return (
                                <div className="gasto-kpi-banner">
                                    <div className="gasto-kpi-main">
                                        <div className="gasto-kpi-icon">
                                            <i className="bi bi-arrow-down-right" aria-hidden="true"></i>
                                        </div>
                                        <div>
                                            <div className="gasto-kpi-label">
                                                {activeGastosScope === 'turno' ? 'Total Egresos del Turno' : (activeGastosScope === 'dia' ? 'Total Egresos de Hoy' : 'Total Egresos')}
                                            </div>
                                            <div className="gasto-kpi-amount">
                                                {formatCurrency(totalTotal)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="gasto-kpi-pills" role="group" aria-label="Filtrar por método de pago">
                                        <button
                                            type="button"
                                            className={`gasto-kpi-pill gasto-kpi-pill--cash${gastoFilterFondo === 'caja' ? ' is-active' : ''}${gastoFilterFondo === 'banco' ? ' is-dimmed' : ''}`}
                                            onClick={() => setGastoFilterFondo(prev => prev === 'caja' ? 'todos' : 'caja')}
                                            title={gastoFilterFondo === 'caja' ? 'Mostrar todos los métodos' : 'Filtrar solo egresos en efectivo'}
                                        >
                                            <i className={`bi ${gastoFilterFondo === 'caja' ? 'bi-check-circle-fill' : 'bi-cash-coin'}`} aria-hidden="true"></i>
                                            <span>Efectivo:</span>
                                            <strong>{formatCurrency(totalCash)}</strong>
                                            {scopedEgresos.length > 0 && <span className="gasto-kpi-count">({cashCount})</span>}
                                        </button>
                                        <button
                                            type="button"
                                            className={`gasto-kpi-pill gasto-kpi-pill--bank${gastoFilterFondo === 'banco' ? ' is-active' : ''}${gastoFilterFondo === 'caja' ? ' is-dimmed' : ''}`}
                                            onClick={() => setGastoFilterFondo(prev => prev === 'banco' ? 'todos' : 'banco')}
                                            title={gastoFilterFondo === 'banco' ? 'Mostrar todos los métodos' : 'Filtrar solo egresos por transferencia'}
                                        >
                                            <i className={`bi ${gastoFilterFondo === 'banco' ? 'bi-check-circle-fill' : 'bi-arrow-left-right'}`} aria-hidden="true"></i>
                                            <span>Transferencia:</span>
                                            <strong>{formatCurrency(totalBank)}</strong>
                                            {scopedEgresos.length > 0 && <span className="gasto-kpi-count">({bankCount})</span>}
                                        </button>
                                        {gastoFilterFondo !== 'todos' && (
                                            <button
                                                type="button"
                                                className="gasto-kpi-pill gasto-kpi-pill--reset"
                                                onClick={() => setGastoFilterFondo('todos')}
                                                title="Quitar filtro de método"
                                            >
                                                <i className="bi bi-x-circle-fill" aria-hidden="true"></i>
                                                <span>Ver todos ({scopedEgresos.length})</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Toolbar de Búsqueda y Lista de Egresos */}
                        {(() => {
                            const allEgresos = scopedEgresos;

                            const displayedEgresos = allEgresos.filter(m => {
                                if (gastoFilterFondo !== 'todos' && m.tipo_fondo !== gastoFilterFondo) return false;
                                if (!gastoSearch.trim()) return true;
                                const q = gastoSearch.toLowerCase().trim();
                                const ben = (m.beneficiario || '').toLowerCase();
                                const desc = (m.descripcion || '').toLowerCase();
                                const cat = (m.categoria_gasto || '').toLowerCase();
                                const doc = (m.sustento_numero || m.sustento_nota || m.sustento_serie || '').toLowerCase();
                                return ben.includes(q) || desc.includes(q) || cat.includes(q) || doc.includes(q);
                            });

                            return (
                                <>
                                    {allEgresos.length > 0 && (
                                        <div className="gasto-toolbar">
                                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {gastoFilterFondo !== 'todos' ? (
                                                    <span>
                                                        Filtrando por <strong>{gastoFilterFondo === 'caja' ? 'Efectivo' : 'Transferencia'}</strong>: {displayedEgresos.length} de {allEgresos.length}
                                                    </span>
                                                ) : (
                                                    <span>{displayedEgresos.length} {displayedEgresos.length === 1 ? 'gasto registrado' : 'gastos registrados'}</span>
                                                )}
                                            </div>

                                            <div className="gasto-search-wrapper">
                                                <i className="bi bi-search gasto-search-icon" aria-hidden="true"></i>
                                                <input
                                                    type="text"
                                                    className="form-input gasto-search-input"
                                                    placeholder="Buscar gasto..."
                                                    value={gastoSearch}
                                                    onChange={(e) => setGastoSearch(e.target.value)}
                                                    aria-label="Filtrar gastos"
                                                />
                                                {gastoSearch && (
                                                    <button
                                                        type="button"
                                                        className="gasto-search-clear"
                                                        onClick={() => setGastoSearch('')}
                                                        aria-label="Limpiar filtro"
                                                    >
                                                        <i className="bi bi-x-circle-fill"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Lista de Egresos */}
                                    {allEgresos.length === 0 ? (
                                        <div className="empty-state" style={{ padding: '36px 16px', textAlign: 'center' }}>
                                            <div style={{
                                                width: '52px',
                                                height: '52px',
                                                borderRadius: '50%',
                                                background: 'rgba(239, 68, 68, 0.08)',
                                                color: '#ef4444',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 12px',
                                                fontSize: '1.5rem'
                                            }}>
                                                <i className="bi bi-wallet2"></i>
                                            </div>
                                            <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '4px' }}>
                                                {activeGastosScope === 'turno'
                                                    ? 'Sin gastos registrados en el turno'
                                                    : (activeGastosScope === 'dia' ? 'Sin gastos registrados hoy' : 'Sin gastos registrados')}
                                            </strong>
                                            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', margin: 0 }}>
                                                Usa el formulario de la izquierda para ingresar compras, servicios o pagos menores.
                                            </p>
                                        </div>
                                    ) : displayedEgresos.length === 0 ? (
                                        <div className="empty-state" style={{ padding: '28px 16px', textAlign: 'center' }}>
                                            <i className="bi bi-search" style={{ fontSize: '1.5rem', opacity: 0.5 }}></i>
                                            <p style={{ marginTop: '8px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                                No se encontraron gastos con el filtro &ldquo;{gastoSearch}&rdquo;
                                            </p>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => { setGastoSearch(''); setGastoFilterFondo('todos'); }}
                                                style={{ marginTop: '6px' }}
                                            >
                                                Restablecer filtros
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="gasto-card-list">
                                            {displayedEgresos.map((mov) => {
                                                const catMeta = getGastoCategoryMeta(mov.categoria_gasto);
                                                const subMedioLabel = mov.sub_medio === 'yape_plin'
                                                    ? 'Yape / Plin'
                                                    : mov.sub_medio === 'tarjeta'
                                                        ? 'Tarjeta'
                                                        : (mov.sub_medio === 'interbancaria' ? 'Interbancaria' : '');
                                                const timeFormatted = formatTimeOnly(mov.created_at || mov.fecha_movimiento);
                                                const hasSeparateDesc = mov.descripcion && mov.beneficiario && mov.descripcion !== mov.beneficiario;

                                                return (
                                                    <div
                                                        key={`${mov.origen || 'mov'}-${mov.id}`}
                                                        className="gasto-card-item"
                                                    >
                                                        <div className="gasto-card-left">
                                                            <div
                                                                className={`gasto-card-category-avatar ${catMeta.cls}`}
                                                                title={prettifyLabel(mov.categoria_gasto)}
                                                            >
                                                                <i className={`bi ${catMeta.icon}`}></i>
                                                            </div>
                                                            <div className="gasto-card-info">
                                                                <div className="gasto-card-title-row">
                                                                    <span className="gasto-card-beneficiary">
                                                                        {mov.beneficiario || mov.descripcion || prettifyLabel(mov.categoria_gasto)}
                                                                    </span>
                                                                </div>
                                                                {hasSeparateDesc && (
                                                                    <div className="gasto-card-desc">
                                                                        {mov.descripcion}
                                                                    </div>
                                                                )}
                                                                <div className="gasto-card-chips">
                                                                    <span className={`gasto-chip ${mov.tipo_fondo === 'caja' ? 'gasto-chip--cash' : 'gasto-chip--bank'}`}>
                                                                        <i className={`bi ${mov.tipo_fondo === 'caja' ? 'bi-cash-coin' : 'bi-arrow-left-right'}`}></i>
                                                                        {mov.tipo_fondo === 'caja' ? 'Efectivo' : (subMedioLabel ? `Transferencia (${subMedioLabel})` : 'Transferencia')}
                                                                    </span>
                                                                    <span className="gasto-chip gasto-chip--cat">
                                                                        <i className="bi bi-tag"></i>
                                                                        {prettifyLabel(mov.categoria_gasto)}
                                                                    </span>
                                                                    {mov.sustento_tipo === 'fiscal' && (
                                                                        <span className="gasto-chip gasto-chip--fiscal">
                                                                            <i className="bi bi-file-earmark-text"></i>
                                                                            Factura {mov.sustento_serie ? `${mov.sustento_serie}-` : ''}{mov.sustento_numero || ''}
                                                                        </span>
                                                                    )}
                                                                    {mov.sustento_tipo === 'simple' && (
                                                                        <span className="gasto-chip gasto-chip--simple">
                                                                            <i className="bi bi-receipt"></i>
                                                                            Boleta {mov.sustento_nota || mov.sustento_numero || ''}
                                                                        </span>
                                                                    )}
                                                                    {mov.sustento_tipo === 'ninguno' && (
                                                                        <span className="gasto-chip gasto-chip--none">
                                                                            <i className="bi bi-dash-circle"></i>
                                                                            {mov.sustento_observacion || 'Sin sustento'}
                                                                        </span>
                                                                    )}
                                                                    {timeFormatted && (
                                                                        <span className="gasto-chip gasto-chip--time">
                                                                            <i className="bi bi-clock"></i>
                                                                            {timeFormatted}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="gasto-card-right">
                                                            <div className="gasto-card-amount">
                                                                -{formatCurrency(mov.monto)}
                                                            </div>
                                                            <div className="gasto-card-actions">
                                                                <button
                                                                    type="button"
                                                                    className="gasto-action-btn"
                                                                    onClick={() => openEditModal(mov)}
                                                                    title="Editar gasto"
                                                                >
                                                                    <i className="bi bi-pencil"></i>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="gasto-action-btn delete"
                                                                    onClick={() => setMovementToDelete(mov)}
                                                                    title="Eliminar gasto"
                                                                >
                                                                    <i className="bi bi-trash3"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </section>
                </div>
            )}

            {/* TAB 2: RESUMEN DEL DÍA Y ARQUEO */}
            {currentTab === 'resumen' && (
                <>
                    {/* Banner de KPIs de Flujo y Liquidez */}
                    <div className="card dashboard-ops-panel" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card-header dashboard-card-header dashboard-card-header--split caja-resumen-header">
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 className="card-title">Resumen Financiero y Liquidez</h3>
                                    {activeSession ? (
                                        <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                                            Turno: {activeSession.turno}
                                        </span>
                                    ) : (
                                        <span className="badge badge-outline" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                                            <i className="bi bi-lock-fill" style={{ marginRight: '4px' }}></i> Caja Cerrada
                                        </span>
                                    )}
                                </div>
                                <p className="card-subtitle">Balance consolidado en caja física y cuentas bancarias.</p>
                            </div>
                            <div className="caja-resumen-header-actions" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                        setSelectedHistorySessionForReport(null);
                                        setReportScope('dia');
                                        setReporteModalOpen(true);
                                    }}
                                    title="Ver balance y generar reporte diario de caja"
                                    style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
                                >
                                    <i className="bi bi-file-earmark-text"></i> Reporte del Día
                                </button>
                                {activeSession ? (
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => setCierreModalOpen(true)}
                                        style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
                                    >
                                        <i className="bi bi-calculator"></i> Arqueo y Cierre
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => setAperturaModalOpen(true)}
                                        style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
                                    >
                                        <i className="bi bi-unlock-fill"></i> Abrir Caja / Turno
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid dashboard-kpi-grid-liquid dashboard-staggered-grid">
                            <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--success animate-slide-up">
                                <div className="dashboard-kpi-shell">
                                    <div className="dashboard-kpi-row">
                                        <div className="kpi-icon" aria-hidden="true">
                                            <i className="bi bi-arrow-up-circle-fill"></i>
                                        </div>
                                        <div className="dashboard-kpi-heading-group">
                                            <div className="dashboard-kpi-heading">Total Ingresos</div>
                                            <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                                {formatCurrency(resumenEnVivo.total_ingresos_efectivo + resumenEnVivo.total_ingresos_banco)}
                                            </div>
                                            <div className="dashboard-kpi-note" style={{ fontSize: '0.75rem', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <span><i className="bi bi-cash-coin" style={{ marginRight: '3px', color: 'var(--color-success)' }}></i> {formatCurrency(resumenEnVivo.total_ingresos_efectivo)}</span>
                                                <span>&bull;</span>
                                                <span><i className="bi bi-arrow-left-right" style={{ marginRight: '3px', color: 'var(--color-primary)' }}></i> {formatCurrency(resumenEnVivo.total_ingresos_banco)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--danger animate-slide-up">
                                <div className="dashboard-kpi-shell">
                                    <div className="dashboard-kpi-row">
                                        <div className="kpi-icon" aria-hidden="true">
                                            <i className="bi bi-arrow-down-circle-fill"></i>
                                        </div>
                                        <div className="dashboard-kpi-heading-group">
                                            <div className="dashboard-kpi-heading">Total Egresos</div>
                                            <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                                {formatCurrency(resumenEnVivo.total_egresos_efectivo + resumenEnVivo.total_egresos_banco)}
                                            </div>
                                            <div className="dashboard-kpi-note" style={{ fontSize: '0.75rem', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <span><i className="bi bi-cash-coin" style={{ marginRight: '3px', color: 'var(--color-danger)' }}></i> {formatCurrency(resumenEnVivo.total_egresos_efectivo)}</span>
                                                <span>&bull;</span>
                                                <span><i className="bi bi-arrow-left-right" style={{ marginRight: '3px', color: 'var(--color-primary)' }}></i> {formatCurrency(resumenEnVivo.total_egresos_banco)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--cash animate-slide-up">
                                <div className="dashboard-kpi-shell">
                                    <div className="dashboard-kpi-row">
                                        <div className="kpi-icon" aria-hidden="true">
                                            <i className="bi bi-safe-fill"></i>
                                        </div>
                                        <div className="dashboard-kpi-heading-group">
                                            <div className="dashboard-kpi-heading">Efectivo en Caja</div>
                                            <div className="dashboard-kpi-main-value dashboard-kpi-currency" style={{ fontWeight: 800 }}>
                                                {formatCurrency(resumenEnVivo.saldo_teorico_efectivo)}
                                            </div>
                                            <div className="dashboard-kpi-note" style={{ fontSize: '0.75rem' }}>
                                                Fondo inicial: {formatCurrency(resumenEnVivo.monto_apertura)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--bank animate-slide-up">
                                <div className="dashboard-kpi-shell">
                                    <div className="dashboard-kpi-row">
                                        <div className="kpi-icon" aria-hidden="true">
                                            <i className="bi bi-bank2"></i>
                                        </div>
                                        <div className="dashboard-kpi-heading-group">
                                            <div className="dashboard-kpi-heading">Bancos y Digital</div>
                                            <div className="dashboard-kpi-main-value dashboard-kpi-currency" style={{ color: resumenEnVivo.balance_neto_banco >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                                                {formatCurrency(resumenEnVivo.balance_neto_banco)}
                                            </div>
                                            <div className="dashboard-kpi-note" style={{ fontSize: '0.75rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--color-success)' }}>+{formatCurrency(resumenEnVivo.total_ingresos_banco)}</span>
                                                <span>&bull;</span>
                                                <span style={{ color: 'var(--color-danger)' }}>-{formatCurrency(resumenEnVivo.total_egresos_banco)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de Movimientos Registrados a Ancho Completo */}
                    <section className="card expenses-table-card" style={{ width: '100%' }}>
                        <div className="expenses-panel-head expenses-panel-head--table">
                            <div className="expenses-panel-head--table-top">
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h2 className="card-title">
                                            {activeBitacoraScope === 'turno'
                                                ? 'Bitácora de Movimientos del Turno'
                                                : activeBitacoraScope === 'dia'
                                                    ? 'Bitácora de Movimientos del Día'
                                                    : 'Histórico de Movimientos'}
                                        </h2>
                                        <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '2px 8px', fontWeight: 600 }}>
                                            {filteredMovimientos.length} movimiento(s) {activeBitacoraScope === 'turno' ? 'en turno' : (activeBitacoraScope === 'dia' ? 'hoy' : '')}
                                        </span>
                                    </div>
                                    <p className="expenses-panel-sub">
                                        {activeBitacoraScope === 'turno'
                                            ? `Transacciones registradas en el turno activo (${activeSession?.turno ? `Turno ${activeSession.turno}` : 'Sesión actual'}).`
                                            : activeBitacoraScope === 'dia'
                                                ? `Consolidado de cobros y egresos registrados durante el día de hoy (${formatDateShort(new Date())}).`
                                                : 'Auditoría cronológica de transacciones históricas.'}
                                    </p>
                                </div>

                                {/* Selector de Alcance Temporal (Turno / Todo el Día / Histórico) - Ahora en la cabecera */}
                                <div className="segmented-control caja-bitacora-scope-control" role="group" aria-label="Alcance temporal" style={{ fontSize: '0.8125rem' }}>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${activeBitacoraScope === 'turno' ? ' is-active' : ''}`}
                                        onClick={() => setBitacoraScope('turno')}
                                        disabled={!activeSession}
                                        title={activeSession ? "Ver transacciones del turno actual" : "Caja cerrada (sin turno activo)"}
                                    >
                                        <i className="bi bi-clock-history" style={{ marginRight: '4px' }}></i>
                                        Turno Actual
                                    </button>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${activeBitacoraScope === 'dia' ? ' is-active' : ''}`}
                                        onClick={() => setBitacoraScope('dia')}
                                        title="Ver todas las transacciones del día de hoy"
                                    >
                                        <i className="bi bi-calendar-event" style={{ marginRight: '4px' }}></i>
                                        Todo el Día
                                    </button>
                                    <button
                                        type="button"
                                        className={`segmented-control__btn${activeBitacoraScope === 'todos' ? ' is-active' : ''}`}
                                        onClick={() => setBitacoraScope('todos')}
                                        title="Ver historial completo de movimientos"
                                    >
                                        <i className="bi bi-collection" style={{ marginRight: '4px' }}></i>
                                        Histórico
                                    </button>
                                </div>
                            </div>

                            <div className="expenses-table-toolbar caja-bitacora-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', width: '100%', marginTop: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                    {/* Filtro por Tipo de Flujo */}
                                    <div className="segmented-control" role="group" aria-label="Filtrar por tipo" style={{ fontSize: '0.8125rem' }}>
                                        <button
                                            type="button"
                                            className={`segmented-control__btn${tipoFilter === 'all' ? ' is-active' : ''}`}
                                            onClick={() => setTipoFilter('all')}
                                        >
                                            Todos
                                        </button>
                                        <button
                                            type="button"
                                            className={`segmented-control__btn${tipoFilter === 'ingreso' ? ' is-active' : ''}`}
                                            onClick={() => setTipoFilter('ingreso')}
                                        >
                                            <i className="bi bi-arrow-up-circle-fill" style={{ color: 'var(--color-success, #10b981)', marginRight: '4px' }}></i>
                                            Ingresos
                                        </button>
                                        <button
                                            type="button"
                                            className={`segmented-control__btn${tipoFilter === 'egreso' ? ' is-active' : ''}`}
                                            onClick={() => setTipoFilter('egreso')}
                                        >
                                            <i className="bi bi-arrow-down-circle-fill" style={{ color: 'var(--color-danger, #ef4444)', marginRight: '4px' }}></i>
                                            Egresos
                                        </button>
                                    </div>

                                    {/* Dropdown de Fondos / Canales */}
                                    <div className="dropdown" ref={fondoDropdownRef} style={{ position: 'relative' }}>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            style={{ 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                gap: '8px', 
                                                padding: '6px 12px',
                                                fontSize: '0.8125rem',
                                                borderRadius: 'var(--radius-md, 8px)',
                                                background: originFilter !== 'all' ? 'var(--color-surface-hover, #f1f5f9)' : undefined,
                                                borderColor: originFilter !== 'all' ? 'var(--color-primary, #3b82f6)' : undefined
                                            }}
                                            onClick={() => setFondoDropdownOpen((prev) => !prev)}
                                            aria-expanded={fondoDropdownOpen}
                                            aria-haspopup="true"
                                        >
                                            <i className={
                                                originFilter === 'caja' 
                                                    ? 'bi bi-cash-coin' 
                                                    : originFilter === 'banco' 
                                                        ? 'bi bi-arrow-left-right' 
                                                        : 'bi bi-funnel'
                                            } style={{ color: originFilter !== 'all' ? 'var(--color-primary, #3b82f6)' : undefined }}></i>
                                            <span>
                                                {originFilter === 'caja' 
                                                    ? 'Solo Efectivo' 
                                                    : originFilter === 'banco' 
                                                        ? 'Solo Transferencia' 
                                                        : 'Todos los fondos'}
                                            </span>
                                            <i className={`bi bi-chevron-${fondoDropdownOpen ? 'up' : 'down'}`} style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '2px' }}></i>
                                        </button>
                                        {fondoDropdownOpen && (
                                            <div
                                                className="dropdown-menu"
                                                style={{
                                                    position: 'absolute',
                                                    top: 'calc(100% + 4px)',
                                                    left: 0,
                                                    zIndex: 100,
                                                    minWidth: '180px',
                                                    background: 'var(--color-surface, #ffffff)',
                                                    border: '1px solid var(--color-border, #e2e8f0)',
                                                    borderRadius: 'var(--radius-md, 8px)',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '2px'
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    className={`dropdown-item ${originFilter === 'all' ? 'active' : ''}`}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        width: '100%',
                                                        padding: '6px 10px',
                                                        fontSize: '0.8125rem',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        background: originFilter === 'all' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                        color: originFilter === 'all' ? 'var(--color-primary, #3b82f6)' : 'inherit',
                                                        cursor: 'pointer',
                                                        textAlign: 'left'
                                                    }}
                                                    onClick={() => {
                                                        setOriginFilter('all');
                                                        setFondoDropdownOpen(false);
                                                    }}
                                                >
                                                    <i className="bi bi-collection"></i>
                                                    <span>Todos los fondos</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`dropdown-item ${originFilter === 'caja' ? 'active' : ''}`}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        width: '100%',
                                                        padding: '6px 10px',
                                                        fontSize: '0.8125rem',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        background: originFilter === 'caja' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                        color: originFilter === 'caja' ? 'var(--color-primary, #3b82f6)' : 'inherit',
                                                        cursor: 'pointer',
                                                        textAlign: 'left'
                                                    }}
                                                    onClick={() => {
                                                        setOriginFilter('caja');
                                                        setFondoDropdownOpen(false);
                                                    }}
                                                >
                                                    <i className="bi bi-cash-coin"></i>
                                                    <span>Solo Efectivo</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`dropdown-item ${originFilter === 'banco' ? 'active' : ''}`}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        width: '100%',
                                                        padding: '6px 10px',
                                                        fontSize: '0.8125rem',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        background: originFilter === 'banco' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                        color: originFilter === 'banco' ? 'var(--color-primary, #3b82f6)' : 'inherit',
                                                        cursor: 'pointer',
                                                        textAlign: 'left'
                                                    }}
                                                    onClick={() => {
                                                        setOriginFilter('banco');
                                                        setFondoDropdownOpen(false);
                                                    }}
                                                >
                                                    <i className="bi bi-arrow-left-right"></i>
                                                    <span>Solo Transferencia</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="caja-bitacora-search-wrapper" style={{ minWidth: '260px', flex: '0 1 300px' }}>
                                    <div className="search-box" style={{ width: '100%' }}>
                                        <i className="bi bi-search" aria-hidden="true"></i>
                                        <input
                                            className="form-input"
                                            placeholder="Buscar detalle, persona o voucher..."
                                            value={searchInput}
                                            onChange={(event) => setSearchInput(event.target.value)}
                                            aria-label="Buscar movimientos"
                                        />
                                    </div>
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
                                    {movimientos.length === 0 ? 'Sin movimientos registrados' : 'Sin resultados'}
                                </h3>
                                <p className="empty-state-text">
                                    {movimientos.length === 0
                                        ? 'Registra el primer movimiento desde la pestaña "Registro de Ingresos y Gastos".'
                                        : 'Prueba otro filtro o cambia los términos de búsqueda.'}
                                </p>
                            </div>
                        ) : (
                            <div className="data-table-wrapper expenses-table-wrapper">
                                <table className="data-table expenses-table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Flujo / Canal</th>
                                            <th>Detalle / Beneficiario</th>
                                            <th>Comprobante</th>
                                            <th style={{ textAlign: 'right' }}>Monto</th>
                                            <th style={{ width: 100, textAlign: 'center' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMovimientos.map((movimiento) => {
                                            const isIngreso = movimiento.tipo === 'ingreso';
                                            const isPagoPedido = movimiento.origen === 'pago_pedido';
                                            const sustentoTipo = movimiento.sustento_tipo || 'ninguno';

                                            return (
                                                <tr key={`${movimiento.origen || 'mov'}-${movimiento.id}`}>
                                                    <td>
                                                        <strong>{formatDateShort(movimiento.fecha_movimiento)}</strong>
                                                        <div style={{ fontSize: '0.725rem', color: 'var(--color-text-secondary)' }}>
                                                            {movimiento.created_at ? new Date(movimiento.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                            <span className={`badge ${isIngreso ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.725rem', padding: '2px 8px' }}>
                                                                <i className={`bi ${isIngreso ? 'bi-arrow-up-short' : 'bi-arrow-down-short'}`} style={{ marginRight: '2px' }}></i>
                                                                {isIngreso ? 'Ingreso' : 'Egreso'}
                                                            </span>
                                                            <span className={`expenses-origin-badge ${movimiento.tipo_fondo === 'caja' ? 'is-cash' : 'is-bank'}`} style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                                                                <i className={`bi ${movimiento.tipo_fondo === 'caja' ? 'bi-cash-coin' : 'bi-bank'}`} aria-hidden="true"></i>
                                                                {getOriginLabel(movimiento.tipo_fondo)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span>{movimiento.beneficiario || (isPagoPedido ? 'Cliente Directo' : 'Sin beneficiario')}</span>
                                                            {movimiento.pedido_codigo && (
                                                                <span className="badge badge-outline" style={{ fontSize: '0.7rem', padding: '1px 6px', fontWeight: 600 }}>
                                                                    {movimiento.pedido_codigo}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isPagoPedido || movimiento.paciente_nombre || movimiento.producto_nombre ? (
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                {movimiento.paciente_nombre && (
                                                                    <div>
                                                                        <i className="bi bi-person" style={{ marginRight: '3px' }}></i>
                                                                        Paciente: <strong style={{ color: 'var(--color-text)' }}>{movimiento.paciente_nombre}</strong>
                                                                    </div>
                                                                )}
                                                                {movimiento.producto_nombre && (
                                                                    <div>
                                                                        <i className="bi bi-box-seam" style={{ marginRight: '3px' }}></i>
                                                                        <span>{movimiento.producto_nombre}</span>
                                                                        {movimiento.producto_cantidad ? ` · Cant: ${movimiento.producto_cantidad}` : ''}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                                {movimiento.descripcion || 'Sin descripción'}
                                                                {movimiento.categoria_gasto && (
                                                                    <span style={{ marginLeft: '6px', fontSize: '0.75rem', opacity: 0.8 }}>
                                                                        &bull; {prettifyLabel(movimiento.categoria_gasto)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                                            {movimiento.sustento_comprobante_tipo === '01' || (movimiento.sustento_numero && String(movimiento.sustento_numero).startsWith('F')) ? (
                                                                <span className="badge badge-comprobante-factura" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Factura Electrónica SUNAT">
                                                                    <i className="bi bi-file-earmark-text"></i> Factura: {movimiento.sustento_numero || 'S/N'}
                                                                </span>
                                                            ) : movimiento.sustento_comprobante_tipo === '03' || (movimiento.sustento_numero && String(movimiento.sustento_numero).startsWith('B')) ? (
                                                                <span className="badge badge-comprobante-boleta" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Boleta de Venta Electrónica SUNAT">
                                                                    <i className="bi bi-receipt"></i> Boleta: {movimiento.sustento_numero || 'S/N'}
                                                                </span>
                                                            ) : (isPagoPedido || isIngreso || sustentoTipo === 'simple' || movimiento.sustento_comprobante_tipo === '00' || (movimiento.sustento_numero && String(movimiento.sustento_numero).startsWith('NV'))) ? (
                                                                <span className="badge badge-comprobante-nota" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={movimiento.sustento_numero || 'Nota de Venta Interna'}>
                                                                    <i className="bi bi-tag"></i> {movimiento.sustento_numero ? (String(movimiento.sustento_numero).startsWith('NV') ? `Nota: ${movimiento.sustento_numero}` : movimiento.sustento_numero) : `Nota: NV-${String(movimiento.id).padStart(6, '0')}`}
                                                                </span>
                                                            ) : (
                                                                <span className="badge badge-comprobante-sin" style={{ fontSize: '0.7rem', opacity: 0.75 }} title={movimiento.sustento_nota || 'Sin sustento'}>
                                                                    <i className="bi bi-dash-circle" style={{ marginRight: '3px' }}></i> Sin comprobante
                                                                </span>
                                                            )}
                                                            {movimiento.referencia && (
                                                                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                    <i className="bi bi-hash"></i> Ref: {movimiento.referencia}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <strong
                                                            className="expenses-amount-cell"
                                                            style={{
                                                                color: isIngreso ? 'var(--color-success, #10b981)' : 'var(--color-danger, #ef4444)',
                                                                fontWeight: 700,
                                                                fontVariantNumeric: 'tabular-nums',
                                                                fontSize: '0.95rem'
                                                            }}
                                                        >
                                                            {isIngreso ? `+${formatCurrency(movimiento.monto)}` : `-${formatCurrency(movimiento.monto)}`}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        {isPagoPedido || isIngreso ? (
                                                            <div className="expenses-action-row" style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-ghost btn-sm btn-icon expenses-action-btn"
                                                                    title="Reimprimir comprobante / ticket térmico"
                                                                    aria-label="Reimprimir comprobante"
                                                                    onClick={() => handleReprintMovement(movimiento)}
                                                                >
                                                                    <i className="bi bi-printer" aria-hidden="true"></i>
                                                                </button>
                                                                {movimiento.pedido_codigo && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-ghost btn-sm btn-icon expenses-action-btn"
                                                                        title={`Ver pedido ${movimiento.pedido_codigo}`}
                                                                        aria-label={`Ver pedido ${movimiento.pedido_codigo}`}
                                                                        onClick={() => navigate(`/pedidos?search=${encodeURIComponent(movimiento.pedido_codigo)}`)}
                                                                    >
                                                                        <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="expenses-action-row">
                                                                <button type="button" className="btn btn-ghost btn-sm btn-icon expenses-action-btn" title="Editar movimiento" aria-label="Editar movimiento" onClick={() => openEditModal(movimiento)}>
                                                                    <i className="bi bi-pencil" aria-hidden="true"></i>
                                                                </button>
                                                                <button type="button" className="btn btn-ghost btn-sm btn-icon expenses-action-btn is-danger" title="Eliminar movimiento" aria-label="Eliminar movimiento" onClick={() => setMovementToDelete(movimiento)} disabled={deleteMovementMutation.isPending}>
                                                                    <i className="bi bi-trash" aria-hidden="true"></i>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* TAB 3: FACTURACIÓN ELECTRÓNICA */}
            {currentTab === 'facturacion' && (
                <div className="card caja-facturacion-card" style={{ padding: '24px' }}>
                    <div className="caja-facturacion-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: 'var(--radius-md, 8px)',
                                background: 'rgba(37, 99, 235, 0.08)',
                                color: 'var(--color-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.35rem',
                                flexShrink: 0
                            }}>
                                <i className="bi bi-receipt-cutoff"></i>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                    Facturación Electrónica SUNAT
                                </h3>
                                <p style={{ margin: '3px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                                    Emisión de boletas y facturas electrónicas e historial con validez tributaria.
                                </p>
                            </div>
                        </div>

                        <div className="caja-facturacion-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                            <div className="search-box caja-facturacion-search" style={{ width: '270px' }}>
                                <i className="bi bi-search"></i>
                                <input
                                    className="form-input"
                                    placeholder={facturacionSubTab === 'emitidos' ? "Buscar serie, número o cliente..." : "Buscar pedido a facturar..."}
                                    value={facturacionSubTab === 'emitidos' ? facturacionSearch : facturacionOrderSearch}
                                    onChange={(e) => facturacionSubTab === 'emitidos' ? setFacturacionSearch(e.target.value) : setFacturacionOrderSearch(e.target.value)}
                                />
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setFacturacionEmitirModalOpen(true)}
                                style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                            >
                                <i className="bi bi-plus-circle-fill"></i> Emitir Comprobante
                            </button>
                        </div>
                    </div>

                    {/* Sub-tabs / Vistas de Facturación */}
                    <div className="segmented-control caja-facturacion-subtabs" role="group" aria-label="Vistas de facturación" style={{ marginBottom: '18px', maxWidth: '440px' }}>
                        <button
                            type="button"
                            className={`segmented-control__btn${facturacionSubTab === 'pendientes' ? ' is-active' : ''}`}
                            onClick={() => setFacturacionSubTab('pendientes')}
                        >
                            <i className="bi bi-receipt" style={{ marginRight: '6px' }}></i>
                            Listos para Facturar ({ordersReadyToInvoice.length})
                        </button>
                        <button
                            type="button"
                            className={`segmented-control__btn${facturacionSubTab === 'emitidos' ? ' is-active' : ''}`}
                            onClick={() => setFacturacionSubTab('emitidos')}
                        >
                            <i className="bi bi-file-earmark-check" style={{ marginRight: '6px' }}></i>
                            Comprobantes Emitidos ({facturacionQuery.data?.comprobantes?.length || 0})
                        </button>
                    </div>

                    {/* VISTA 1: COMPROBANTES EMITIDOS */}
                    {facturacionSubTab === 'emitidos' && (
                        facturacionQuery.isLoading ? (
                            <div>
                                {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}
                            </div>
                        ) : (() => {
                            const allComprobantes = facturacionQuery.data?.comprobantes || [];
                            const q = facturacionSearch.trim().toLowerCase();
                            const list = q ? allComprobantes.filter((c) => {
                                const serieCorrelativo = `${c.serie}-${c.correlativo}`.toLowerCase();
                                const clinica = (c.clinica_nombre || '').toLowerCase();
                                const paciente = (c.paciente_nombre || '').toLowerCase();
                                return serieCorrelativo.includes(q) || clinica.includes(q) || paciente.includes(q);
                            }) : allComprobantes;

                            if (list.length === 0) {
                                return (
                                    <div className="empty-state">
                                        <i className="bi bi-receipt empty-state-icon"></i>
                                        <h3 className="empty-state-title">No hay comprobantes emitidos</h3>
                                        <p className="empty-state-text">Los comprobantes emitidos a SUNAT aparecerán aquí</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="data-table-wrapper">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Fecha Emisión</th>
                                                <th>Tipo / Serie</th>
                                                <th>Receptor</th>
                                                <th style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: '115px' }}>Total</th>
                                                <th>Estado SUNAT</th>
                                                <th>Archivos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {list.map((c) => (
                                                <tr key={c.id}>
                                                    <td>{formatDateShort(c.fecha_emision || c.created_at)}</td>
                                                    <td>
                                                        <span className="badge badge-outline">
                                                            {c.tipo_comprobante === '01' ? 'Factura' : 'Boleta'}
                                                        </span>
                                                        <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                                                            {c.serie}-{c.correlativo}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                            <strong>{c.clinica_nombre || 'Cliente'}</strong>
                                                            {c.pedidos_vinculados && c.pedidos_vinculados.length > 1 && (
                                                                <span className="badge badge-secondary" style={{ fontSize: '0.7rem', padding: '1px 6px', fontWeight: 650, color: 'var(--color-primary)' }}>
                                                                    Consolidado ({c.pedidos_vinculados.length})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                            {c.pedidos_vinculados && c.pedidos_vinculados.length > 1 ? (
                                                                <span>Pedidos: {c.pedidos_vinculados.map(p => p.codigo).join(', ')}</span>
                                                            ) : (
                                                                <>
                                                                    {c.paciente_nombre ? `Pac: ${c.paciente_nombre}` : ''}
                                                                    {c.pedido_codigo ? ` | Ped: ${c.pedido_codigo}` : ''}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <strong style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCurrency(c.total_venta)}</strong>
                                                    </td>
                                                    <td>
                                                        {c.estado_sunat === 'aceptado' ? (
                                                            <span className="badge" style={{ background: '#e6f4ea', color: '#137333' }}>
                                                                <i className="bi bi-check-circle-fill" style={{ marginRight: 4 }}></i> Aceptado
                                                            </span>
                                                        ) : c.estado_sunat === 'rechazado' ? (
                                                            <span className="badge" style={{ background: '#fce8e6', color: '#c5221f' }}>
                                                                <i className="bi bi-x-circle-fill" style={{ marginRight: 4 }}></i> Rechazado
                                                            </span>
                                                        ) : c.estado_sunat === 'error' ? (
                                                            <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                                                                <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 4 }}></i> Error / En cola
                                                            </span>
                                                        ) : (
                                                            <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                                                                <i className="bi bi-clock-history" style={{ marginRight: 4 }}></i> En cola SUNAT
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                            {['error', 'generado'].includes(c.estado_sunat) && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-primary"
                                                                    onClick={() => handleSyncComprobante(c.id)}
                                                                    disabled={syncingInvoiceId === c.id}
                                                                    title="Consultar estado o reintentar envío a SUNAT"
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', padding: '3px 8px' }}
                                                                >
                                                                    <i className={`bi bi-arrow-clockwise ${syncingInvoiceId === c.id ? 'spin' : ''}`}></i>
                                                                    {syncingInvoiceId === c.id ? 'Sincronizando...' : 'Reintentar'}
                                                                </button>
                                                            )}
                                                            {c.pdf_url && (
                                                                <a href={c.pdf_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" title="Descargar PDF">
                                                                    <i className="bi bi-file-pdf" style={{ color: '#d32f2f' }}></i> PDF
                                                                </a>
                                                            )}
                                                            {c.xml_url && (
                                                                <a href={c.xml_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" title="Descargar XML">
                                                                    <i className="bi bi-file-code" style={{ color: '#1976d2' }}></i> XML
                                                                </a>
                                                            )}
                                                            {c.cdr_url && (
                                                                <a href={c.cdr_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" title="Descargar CDR">
                                                                    <i className="bi bi-file-check" style={{ color: '#388e3c' }}></i> CDR
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()
                    )}

                    {/* VISTA 2: PEDIDOS LISTOS PARA FACTURAR */}
                    {facturacionSubTab === 'pendientes' && (
                        billingOrdersQuery.isLoading ? (
                            <div>
                                {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}
                            </div>
                        ) : ordersReadyToInvoice.length === 0 ? (
                            <div className="empty-state">
                                <i className="bi bi-check2-all empty-state-icon" style={{ color: 'var(--color-success)' }}></i>
                                <h3 className="empty-state-title">Todo al día</h3>
                                <p className="empty-state-text">No hay pedidos pendientes de emisión de comprobante tributario.</p>
                            </div>
                        ) : (
                            <>
                                {selectedOrdersToInvoice.length > 0 && (
                                    <div className="facturacion-selected-bar" style={{
                                        marginBottom: '1rem',
                                        background: 'var(--color-surface)',
                                        border: '1.5px solid var(--color-primary)',
                                        borderRadius: 'var(--radius-lg)',
                                        boxShadow: '0 4px 15px -2px rgba(14, 165, 233, 0.15)',
                                        padding: '0.85rem 1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '0.75rem',
                                        animation: 'fadeIn 0.2s ease-out'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                background: 'rgba(14, 165, 233, 0.12)',
                                                color: 'var(--color-primary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 800,
                                                fontSize: '0.95rem'
                                            }}>
                                                {selectedOrdersToInvoice.length}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-text)' }}>
                                                    {selectedOrdersToInvoice.length} pedido{selectedOrdersToInvoice.length !== 1 ? 's' : ''} seleccionado{selectedOrdersToInvoice.length !== 1 ? 's' : ''} &bull; <span style={{ color: 'var(--color-primary)' }}>{activeSelectionClinicName}</span>
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                                                    Total acumulado a facturar: <strong style={{ color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalSelectedMonto)}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="facturacion-selected-bar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => setSelectedOrdersToInvoice([])}
                                            >
                                                Cancelar selección
                                            </button>

                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={() => navigate(`/caja-gastos/facturar?pedidos=${selectedOrdersToInvoice.join(',')}`)}
                                                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <i className="bi bi-receipt"></i>
                                                <span>Facturar Selección ({selectedOrdersToInvoice.length})</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="data-table-wrapper">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: 44, textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        aria-label="Seleccionar pedidos de la clínica"
                                                        checked={
                                                            selectedOrdersToInvoice.length > 0 &&
                                                            ordersReadyToInvoice.filter(p => (p.clinica_id ?? p.clinica_nombre) === (activeSelectionClinicId || (ordersReadyToInvoice[0]?.clinica_id ?? ordersReadyToInvoice[0]?.clinica_nombre))).every(p => selectedOrdersToInvoice.includes(p.id))
                                                        }
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                const targetClinic = activeSelectionClinicId || (ordersReadyToInvoice[0]?.clinica_id ?? ordersReadyToInvoice[0]?.clinica_nombre);
                                                                const ids = ordersReadyToInvoice
                                                                    .filter(p => (p.clinica_id ?? p.clinica_nombre) === targetClinic)
                                                                    .map(p => p.id);
                                                                setSelectedOrdersToInvoice(ids);
                                                            } else {
                                                                setSelectedOrdersToInvoice([]);
                                                            }
                                                        }}
                                                        title={activeSelectionClinicName ? `Seleccionar todos de ${activeSelectionClinicName}` : "Seleccionar pedidos de la clínica"}
                                                    />
                                                </th>
                                                <th>Código Pedido</th>
                                                <th>Paciente / Doctor</th>
                                                <th>Clínica</th>
                                                <th>Estado Pago</th>
                                                <th style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: '115px' }}>Total</th>
                                                <th style={{ textAlign: 'center', width: 140, whiteSpace: 'nowrap' }}>Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ordersReadyToInvoice.map((ped) => {
                                                const isSelected = selectedOrdersToInvoice.includes(ped.id);
                                                const isSameClinic = activeSelectionClinicId === null || (ped.clinica_id ?? ped.clinica_nombre) === activeSelectionClinicId;
                                                const isDisabled = !isSelected && activeSelectionClinicId !== null && !isSameClinic;

                                                return (
                                                    <tr
                                                        key={ped.id}
                                                        style={{
                                                            backgroundColor: isSelected ? 'rgba(14, 165, 233, 0.05)' : undefined,
                                                            opacity: isDisabled ? 0.6 : 1
                                                        }}
                                                    >
                                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                disabled={isDisabled}
                                                                title={isDisabled ? "Solo podés consolidar pedidos de la misma clínica/RUC" : undefined}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedOrdersToInvoice(prev => [...prev, ped.id]);
                                                                    } else {
                                                                        setSelectedOrdersToInvoice(prev => prev.filter(id => id !== ped.id));
                                                                    }
                                                                }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <strong style={{ color: 'var(--color-primary)' }}>{ped.codigo}</strong>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                                {formatDateShort(ped.fecha_ingreso || ped.created_at)}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <strong>{ped.paciente_nombre || 'Sin paciente'}</strong>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                                Dr. {ped.doctor_nombre || 'N/A'} {ped.producto_principal ? `· ${ped.producto_principal}` : ''}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span>{ped.clinica_nombre || 'Clínica directa'}</span>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${ped.estado_pago === 'cancelado' ? 'badge-success' : ped.estado_pago === 'parcial' ? 'badge-warning' : 'badge-outline'}`} style={{ fontSize: '0.75rem' }}>
                                                                {ped.estado_pago === 'cancelado' ? 'Cancelado' : ped.estado_pago === 'parcial' ? 'Pago Parcial' : 'Por Cobrar'}
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                            <strong style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCurrency(ped.total)}</strong>
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary btn-sm"
                                                                onClick={() => navigate(`/caja-gastos/facturar/${ped.id}`)}
                                                                style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                            >
                                                                <i className="bi bi-receipt"></i> Facturar
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )
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
                    ) : (() => {
                        const sessionsList = Array.isArray(cashSessionsHistoryQuery.data)
                            ? cashSessionsHistoryQuery.data
                            : (cashSessionsHistoryQuery.data?.data || []);

                        if (sessionsList.length === 0) {
                            return (
                                <div className="empty-state">
                                    <i className="bi bi-clock-history empty-state-icon"></i>
                                    <h3 className="empty-state-title">Sin cierres registrados</h3>
                                    <p className="empty-state-text">Los cierres diarios de caja aparecerán aquí.</p>
                                </div>
                            );
                        }

                        return (
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
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sessionsList.map((s) => {
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
                                                <td>
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-ghost"
                                                            title="Ver e imprimir reporte de cierre"
                                                            onClick={() => handleOpenHistorySessionReport(s)}
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 8px' }}
                                                        >
                                                            <i className="bi bi-file-earmark-text text-primary"></i> Reporte
                                                        </button>
                                                        {isAdmin && s.estado === 'cerrada' && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-ghost"
                                                                title="Reabrir caja para ajustes"
                                                                onClick={() => {
                                                                    setSelectedSessionToReopen(s);
                                                                    setReaperturaModalOpen(true);
                                                                }}
                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 8px' }}
                                                            >
                                                                <i className="bi bi-unlock" style={{ color: '#f59e0b' }}></i> Reabrir
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    );
                })()}
            </div>
            )}

            {/* Modal Editar Movimiento */}
            <Modal
                open={modalOpen}
                onClose={resetModalState}
                title="Editar movimiento"
                kicker="Caja & Gastos • Edición"
                subtitle="Actualización de datos del movimiento"
                icon="bi-pencil-square"
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
                    <MovementFormFields
                        form={editForm}
                        setForm={setEditForm}
                        categoryOptions={categoryOptions}
                        defaultCategory={defaultCategory}
                        mode="edit"
                    />
                </form>
            </Modal>

            {/* Modal Confirmar Eliminación Movimiento */}
            <Modal
                open={Boolean(movementToDelete)}
                onClose={() => setMovementToDelete(null)}
                title="Confirmar eliminación"
                kicker="Caja & Gastos • Seguridad"
                subtitle="Eliminación permanente de movimiento"
                icon="bi-trash"
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
                    ¿Estás seguro de que deseas eliminar este movimiento por <strong>{formatCurrency(movementToDelete?.monto)}</strong>?
                </p>
            </Modal>

            {/* Modal Reabrir Caja (Admin Only) */}
            <Modal
                open={reaperturaModalOpen}
                onClose={() => {
                    setReaperturaModalOpen(false);
                    setSelectedSessionToReopen(null);
                }}
                title="Reapertura de Caja Diaria"
                kicker="Caja • Auditoría y Seguridad"
                subtitle="Reapertura administrativa de sesión cerrada"
                icon="bi-unlock-fill"
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

            {/* Modal Seleccionar Pedido para Facturar */}
            <Modal
                open={facturacionEmitirModalOpen}
                onClose={() => {
                    setFacturacionEmitirModalOpen(false);
                    setFacturacionOrderSearch('');
                }}
                title="Emitir Comprobante SUNAT"
                kicker="Facturación Electrónica • Emisión"
                subtitle="Selecciona o busca el pedido para comprobante tributario"
                icon="bi-receipt"
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        Selecciona o busca el pedido que deseas facturar para abrir el formulario de emisión tributaria:
                    </p>

                    <div className="search-box" style={{ width: '100%' }}>
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar por código (NL-XXXXX), paciente o clínica..."
                            value={facturacionOrderSearch}
                            onChange={(e) => setFacturacionOrderSearch(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {billingOrdersQuery.isLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
                                <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
                                Cargando pedidos...
                            </div>
                        ) : (billingOrdersQuery.data || []).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
                                No se encontraron pedidos con ese criterio de búsqueda.
                            </div>
                        ) : (
                            (billingOrdersQuery.data || []).slice(0, 15).map(ped => (
                                <div
                                    key={ped.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-alt)',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--color-primary-rgb, 20,184,166), 0.08)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-alt)'}
                                    onClick={() => {
                                        setFacturacionEmitirModalOpen(false);
                                        navigate(`/caja-gastos/facturar/${ped.id}`);
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <strong style={{ color: 'var(--color-primary)' }}>{ped.codigo}</strong>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{ped.paciente_nombre || 'Sin paciente'}</span>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                            {ped.clinica_nombre || 'Clínica directa'} &bull; Dr. {ped.doctor_nombre || 'N/A'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{formatCurrency(ped.total)}</div>
                                            <span className={`badge ${ped.estado_pago === 'cancelado' ? 'badge-success' : 'badge-outline'}`} style={{ fontSize: '0.7rem' }}>
                                                {ped.estado_pago || 'pendiente'}
                                            </span>
                                        </div>
                                        <button type="button" className="btn btn-primary btn-sm" style={{ padding: '6px 12px' }}>
                                            Facturar &rsaquo;
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>

            {/* Modal Apertura de Caja */}
            <Modal
                open={aperturaModalOpen}
                onClose={() => setAperturaModalOpen(false)}
                title="Apertura de Caja Diaria"
                kicker="Caja • Apertura de Turno"
                subtitle="Registro de fondo inicial y sencillo para mostrador"
                icon="bi-cash-coin"
                size="sm"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setAperturaModalOpen(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleAbrirCaja}
                            disabled={openCashSessionMutation.isPending}
                        >
                            <i className="bi bi-unlock-fill" style={{ marginRight: '6px' }}></i>
                            {openCashSessionMutation.isPending ? 'Abriendo caja...' : 'Abrir Caja'}
                        </button>
                    </div>
                )}
            >
                <form onSubmit={handleAbrirCaja} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Selector Visual de Turno */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 650, fontSize: '0.84rem', marginBottom: '8px' }}>
                            Turno de Trabajo
                        </label>
                        <div className="turno-selector-grid">
                            <button
                                type="button"
                                className={`turno-card-btn ${aperturaTurno === 'general' ? 'active' : ''}`}
                                onClick={() => setAperturaTurno('general')}
                            >
                                <i className="bi bi-clock-history turno-card-icon"></i>
                                <div className="turno-card-content">
                                    <span className="turno-card-title">Día Completo</span>
                                </div>
                                {aperturaTurno === 'general' && <i className="bi bi-check-circle-fill turno-check-icon"></i>}
                            </button>

                            <button
                                type="button"
                                className={`turno-card-btn ${aperturaTurno === 'manana' ? 'active' : ''}`}
                                onClick={() => setAperturaTurno('manana')}
                            >
                                <i className="bi bi-sunrise turno-card-icon"></i>
                                <div className="turno-card-content">
                                    <span className="turno-card-title">Turno Mañana</span>
                                </div>
                                {aperturaTurno === 'manana' && <i className="bi bi-check-circle-fill turno-check-icon"></i>}
                            </button>

                            <button
                                type="button"
                                className={`turno-card-btn ${aperturaTurno === 'tarde' ? 'active' : ''}`}
                                onClick={() => setAperturaTurno('tarde')}
                            >
                                <i className="bi bi-sunset turno-card-icon"></i>
                                <div className="turno-card-content">
                                    <span className="turno-card-title">Turno Tarde</span>
                                </div>
                                {aperturaTurno === 'tarde' && <i className="bi bi-check-circle-fill turno-check-icon"></i>}
                            </button>
                        </div>
                    </div>

                    {/* Monto Inicial en Caja Hero Card */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <div className="apertura-amount-card">
                            <div className="apertura-amount-card-header">
                                <label className="apertura-amount-label">
                                    <i className="bi bi-wallet2 text-primary" aria-hidden="true"></i>
                                    <span>Fondo Inicial / Sencillo</span>
                                </label>
                                <span className="apertura-currency-pill">PEN</span>
                            </div>
                            <div className="apertura-amount-input-shell">
                                <span className="apertura-currency-symbol">S/.</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="apertura-amount-input"
                                    placeholder="0.00"
                                    value={aperturaMonto}
                                    onChange={(e) => setAperturaMonto(e.target.value)}
                                    autoFocus
                                />
                                {aperturaMonto && parseFloat(aperturaMonto) > 0 ? (
                                    <button
                                        type="button"
                                        className="apertura-amount-clear-btn"
                                        onClick={() => setAperturaMonto('')}
                                        title="Limpiar monto"
                                        aria-label="Limpiar monto"
                                    >
                                        <i className="bi bi-x-circle-fill"></i>
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {/* Montos Sugeridos / Frecuentes */}
                        <div className="apertura-quick-group">
                            <div className="apertura-quick-header">
                                <i className="bi bi-lightning-charge text-primary"></i>
                                <span>Montos sugeridos:</span>
                            </div>
                            <div className="apertura-quick-chips">
                                {['0.00', '50.00', '100.00', '150.00', '200.00'].map((amt) => {
                                    const isSelected = String(parseFloat(aperturaMonto || -1)) === String(parseFloat(amt));
                                    return (
                                        <button
                                            key={amt}
                                            type="button"
                                            className={`apertura-quick-chip ${isSelected ? 'is-active' : ''}`}
                                            onClick={() => setAperturaMonto(amt)}
                                        >
                                            S/. {amt}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Security Callout */}
                    <div className="apertura-security-callout">
                        <i className="bi bi-shield-check"></i>
                        <span>Este monto constituye el fondo fijo de mostrador para cambio y será la base para el arqueo al cierre de turno.</span>
                    </div>
                </form>
            </Modal>

            {/* Modal Arqueo y Cierre de Caja */}
            <Modal
                open={cierreModalOpen}
                onClose={() => setCierreModalOpen(false)}
                title="Arqueo y Cierre de Caja"
                kicker="Caja • Arqueo y Conciliación"
                subtitle="Cierre de turno y balance de efectivo en mostrador"
                icon="bi-lock-fill"
                size="lg"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setCierreModalOpen(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleCerrarCaja}
                            disabled={closeCashSessionMutation.isPending}
                        >
                            <i className="bi bi-lock-fill" style={{ marginRight: '6px' }}></i>
                            {closeCashSessionMutation.isPending ? 'Cerrando caja...' : 'Confirmar Arqueo y Cerrar Caja'}
                        </button>
                    </div>
                )}
            >
                <form onSubmit={handleCerrarCaja} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {activeSession && (
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                            Sesión abierta por <strong>{activeSession.abierto_por_nombre || 'Usuario'}</strong> desde las {formatDateShort(activeSession.abierto_at)} (Turno {activeSession.turno}).
                        </p>
                    )}

                    {/* Resumen de Arqueo */}
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', background: 'var(--color-bg-alt)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Fondo Apertura</div>
                            <strong style={{ fontSize: '0.9375rem' }}>{formatCurrency(resumenEnVivo.monto_apertura)}</strong>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Ingresos Efectivo</div>
                            <strong style={{ fontSize: '0.9375rem', color: 'var(--color-success)' }}>+{formatCurrency(resumenEnVivo.total_ingresos_efectivo)}</strong>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Egresos Efectivo</div>
                            <strong style={{ fontSize: '0.9375rem', color: 'var(--color-danger)' }}>-{formatCurrency(resumenEnVivo.total_egresos_efectivo)}</strong>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Saldo Teórico Esperado</div>
                            <strong style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>{formatCurrency(resumenEnVivo.saldo_teorico_efectivo)}</strong>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                                Efectivo Contado Físicamente en Caja (S/.) <span style={{ color: 'var(--color-danger)' }}>*</span>
                            </label>
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                style={{ color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 8px' }}
                                onClick={() => setShowCalculadoraBilletes(!showCalculadoraBilletes)}
                            >
                                <i className={`bi ${showCalculadoraBilletes ? 'bi-chevron-up' : 'bi-calculator'}`}></i>
                                {showCalculadoraBilletes ? 'Ocultar desglose' : 'Contar billetes y monedas (Opcional)'}
                            </button>
                        </div>
                        <div className="form-input-box has-prefix">
                            <span className="form-input-prefix" style={{ fontSize: '1.1rem', fontWeight: 800 }}>S/.</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-input"
                                style={{ fontSize: '1.2rem', fontWeight: 700 }}
                                placeholder="0.00"
                                value={arqueoRealEfectivo}
                                onChange={(e) => setArqueoRealEfectivo(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Calculadora colapsable de Billetes y Monedas */}
                    {showCalculadoraBilletes && (
                        <div className="cash-calculator-panel">
                            <div className="cash-calculator-header">
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="bi bi-cash-stack" style={{ color: 'var(--color-primary)' }}></i>
                                    <span>Desglose por denominación</span>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-xs text-muted"
                                    onClick={handleResetCalculadora}
                                    style={{ fontSize: '0.75rem' }}
                                >
                                    <i className="bi bi-arrow-counterclockwise" style={{ marginRight: '3px' }}></i> Limpiar
                                </button>
                            </div>

                            <div className="cash-denominations-columns">
                                {/* Columna Billetes */}
                                <div className="cash-denom-col">
                                    <div className="cash-denom-col-title">
                                        <i className="bi bi-wallet2" style={{ marginRight: '4px' }}></i> Billetes
                                    </div>
                                    {[
                                        { key: 'b200', label: 'S/. 200', val: 200 },
                                        { key: 'b100', label: 'S/. 100', val: 100 },
                                        { key: 'b50', label: 'S/. 50', val: 50 },
                                        { key: 'b20', label: 'S/. 20', val: 20 },
                                        { key: 'b10', label: 'S/. 10', val: 10 },
                                    ].map(item => {
                                        const qty = parseInt(billetesConteo[item.key] || 0, 10) || 0;
                                        const sub = qty * item.val;
                                        return (
                                            <div key={item.key} className="cash-denom-row">
                                                <span className="cash-denom-label">{item.label}</span>
                                                <span className="cash-denom-x">&times;</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    className="form-input form-input-sm cash-denom-input"
                                                    value={billetesConteo[item.key]}
                                                    onChange={(e) => handleBilleteChange(item.key, e.target.value)}
                                                />
                                                <span className="cash-denom-subtotal">{formatCurrency(sub)}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Columna Monedas */}
                                <div className="cash-denom-col">
                                    <div className="cash-denom-col-title">
                                        <i className="bi bi-coin" style={{ marginRight: '4px' }}></i> Monedas
                                    </div>
                                    {[
                                        { key: 'm5', label: 'S/. 5.00', val: 5 },
                                        { key: 'm2', label: 'S/. 2.00', val: 2 },
                                        { key: 'm1', label: 'S/. 1.00', val: 1 },
                                        { key: 'm05', label: 'S/. 0.50', val: 0.50 },
                                    ].map(item => {
                                        const qty = parseInt(billetesConteo[item.key] || 0, 10) || 0;
                                        const sub = qty * item.val;
                                        return (
                                            <div key={item.key} className="cash-denom-row">
                                                <span className="cash-denom-label">{item.label}</span>
                                                <span className="cash-denom-x">&times;</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    className="form-input form-input-sm cash-denom-input"
                                                    value={billetesConteo[item.key]}
                                                    onChange={(e) => handleBilleteChange(item.key, e.target.value)}
                                                />
                                                <span className="cash-denom-subtotal">{formatCurrency(sub)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

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
                                <i className={`bi ${liveDiferencia === 0 ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} style={{ color: liveDiferencia === 0 ? '#10b981' : liveDiferencia < 0 ? '#ef4444' : '#3b82f6' }}></i>
                                <strong>
                                    {liveDiferencia === 0
                                        ? 'Cuadre Perfecto'
                                        : liveDiferencia < 0
                                        ? 'Faltante de Efectivo'
                                        : 'Sobrante de Efectivo'}
                                </strong>
                            </div>
                            <strong style={{ fontSize: '1.1rem', color: liveDiferencia === 0 ? '#10b981' : liveDiferencia < 0 ? '#ef4444' : '#3b82f6' }}>
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
                </form>
            </Modal>

            {/* Modal Reporte y Balance Diario */}
            <Modal
                open={reporteModalOpen}
                onClose={() => {
                    setReporteModalOpen(false);
                    setSelectedHistorySessionForReport(null);
                    setReportScope('turno');
                }}
                title={selectedHistorySessionForReport 
                    ? `Reporte de Turno ${selectedHistorySessionForReport.turno?.toUpperCase() || ''}` 
                    : (reportScope === 'dia' ? "Reporte Diario - AFINIX LAB" : "Reporte de Turno - AFINIX LAB")}
                kicker="Caja & Finanzas • Balance"
                subtitle="Consolidado de ingresos, egresos y arqueo de sesión"
                icon="bi-file-earmark-bar-graph"
                size="2xl"
                className="caja-reporte-modal"
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={handleCopyWhatsAppReport}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <i className="bi bi-whatsapp" style={{ color: '#25D366' }}></i> Copiar para WhatsApp
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handlePrintReport(selectedHistorySessionForReport)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <i className="bi bi-printer"></i> Imprimir / Guardar PDF
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    setReporteModalOpen(false);
                                    setSelectedHistorySessionForReport(null);
                                    setReportScope('turno');
                                }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}
            >
                <div className="daily-report-document" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {(() => {
                        const s = selectedHistorySessionForReport || activeSession;
                        const isHist = Boolean(selectedHistorySessionForReport);
                        const isDiaScope = reportScope === 'dia';

                        const fondoAp = isHist ? parseFloat(s?.monto_apertura || 0) : resumenEnVivo.monto_apertura;
                        const ingEfecHist = isHist ? parseFloat(s?.total_ingresos_efectivo || 0) : resumenEnVivo.total_ingresos_efectivo;
                        const egEfecHist = isHist ? parseFloat(s?.total_egresos_efectivo || 0) : resumenEnVivo.total_egresos_efectivo;
                        const ingBancoHist = isHist ? parseFloat(s?.total_ingresos_banco || 0) : resumenEnVivo.total_ingresos_banco;
                        const egBancoHist = isHist ? parseFloat(s?.total_egresos_banco || 0) : resumenEnVivo.total_egresos_banco;
                        const saldoCajaHist = isHist ? parseFloat(s?.monto_esperado_efectivo ?? (fondoAp + ingEfecHist - egEfecHist)) : resumenEnVivo.saldo_teorico_efectivo;

                        // Totales calculados dinámicamente si se consulta el consolidado de todo el día
                        const dayIngEfec = todayMovimientosForReport.filter(m => m.tipo === 'ingreso' && m.tipo_fondo === 'caja').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
                        const dayEgEfec = todayMovimientosForReport.filter(m => m.tipo === 'egreso' && m.tipo_fondo === 'caja').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
                        const dayIngBanco = todayMovimientosForReport.filter(m => m.tipo === 'ingreso' && m.tipo_fondo === 'banco').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);
                        const dayEgBanco = todayMovimientosForReport.filter(m => m.tipo === 'egreso' && m.tipo_fondo === 'banco').reduce((acc, m) => acc + parseFloat(m.monto || 0), 0);

                        const activeIngEfec = isDiaScope ? dayIngEfec : ingEfecHist;
                        const activeEgEfec = isDiaScope ? dayEgEfec : egEfecHist;
                        const activeIngBanco = isDiaScope ? dayIngBanco : ingBancoHist;
                        const activeEgBanco = isDiaScope ? dayEgBanco : egBancoHist;
                        const activeSaldoCaja = isDiaScope ? (fondoAp + dayIngEfec - dayEgEfec) : saldoCajaHist;

                        const displayedMovs = isDiaScope ? todayMovimientosForReport : sessionMovimientosForReport;
                        const displayedIngresos = displayedMovs.filter((m) => m.tipo === 'ingreso');
                        const displayedEgresos = displayedMovs.filter((m) => m.tipo === 'egreso');

                        return (
                            <>
                                {/* Encabezado Membrete Oficial AFINIX LAB */}
                                <div className="caja-reporte-header-box">
                                    <div className="caja-reporte-brand-section">
                                        <AfinixLogo size={36} showText={true} />
                                        <div className="caja-reporte-brand-meta">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span className="badge badge-outline" style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-primary, #0284c7)', borderColor: 'rgba(2, 132, 199, 0.3)', padding: '2px 8px' }}>
                                                    AUDITORÍA OFICIAL DE CAJA
                                                </span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)', fontWeight: 600 }}>RUC: 20616033973</span>
                                            </div>
                                            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)', fontWeight: 500 }}>
                                                Control y Cuadre de Turnos · SUNAT &amp; Operaciones
                                            </p>
                                        </div>
                                    </div>

                                    <div className="caja-reporte-meta-strip">
                                        <div className="caja-reporte-meta-pill">
                                            <i className="bi bi-calendar3" style={{ color: 'var(--color-primary)' }}></i>
                                            <span>{s?.fecha ? formatDateShort(s.fecha) : formatDateShort(new Date())}</span>
                                        </div>
                                        <div className="caja-reporte-meta-pill">
                                            <i className="bi bi-clock" style={{ color: 'var(--color-primary)' }}></i>
                                            <span style={{ color: isDiaScope ? 'var(--color-primary)' : 'inherit', fontWeight: 700 }}>
                                                {isDiaScope ? 'TODO EL DÍA (CONSOLIDADO)' : (s?.turno ? `TURNO ${s.turno.toUpperCase()}` : 'GENERAL')}
                                            </span>
                                        </div>
                                        <div className="caja-reporte-meta-pill">
                                            <i className="bi bi-person-badge" style={{ color: 'var(--color-primary)' }}></i>
                                            <span><strong>{s?.cerrado_por_nombre || s?.abierto_por_nombre || user?.nombre || 'Administración'}</strong></span>
                                        </div>
                                        {isHist && (
                                            <div className="caja-reporte-meta-pill">
                                                <i className={`bi ${s?.estado === 'abierta' ? 'bi-unlock-fill' : 'bi-lock-fill'}`} style={{ color: s?.estado === 'abierta' ? 'var(--color-success)' : 'var(--color-text-secondary)' }}></i>
                                                <span className={`badge ${s?.estado === 'abierta' ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.6875rem', padding: '1px 6px' }}>
                                                    {s?.estado === 'abierta' ? 'Sesión Abierta' : 'Sesión Cerrada'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Resumen Financiero Ejecutivo (4 KPIs Clave) */}
                                <div className="grid dashboard-kpi-grid-liquid dashboard-staggered-grid caja-reporte-kpi-grid" style={{ marginBottom: '1.25rem' }}>
                                    {/* KPI 1: Fondo Apertura */}
                                    <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--cash animate-slide-up">
                                        <div className="dashboard-kpi-shell">
                                            <div className="dashboard-kpi-row">
                                                <div className="kpi-icon" aria-hidden="true" style={{ background: 'rgba(100, 116, 139, 0.12)', color: '#475569' }}>
                                                    <i className="bi bi-safe2"></i>
                                                </div>
                                                <div className="dashboard-kpi-heading-group">
                                                    <div className="dashboard-kpi-heading">Fondo Apertura</div>
                                                    <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                                        {formatCurrency(fondoAp)}
                                                    </div>
                                                    <div className="dashboard-kpi-note" style={{ fontSize: '0.75rem' }}>
                                                        Base inicial en efectivo
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* KPI 2: Total Ingresos */}
                                    <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--success animate-slide-up">
                                        <div className="dashboard-kpi-shell">
                                            <div className="dashboard-kpi-row">
                                                <div className="kpi-icon" aria-hidden="true">
                                                    <i className="bi bi-arrow-up-circle-fill"></i>
                                                </div>
                                                <div className="dashboard-kpi-heading-group">
                                                    <div className="dashboard-kpi-heading">Total Ingresos</div>
                                                    <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                                        +{formatCurrency(activeIngEfec + activeIngBanco)}
                                                    </div>
                                                    <div className="dashboard-kpi-note" style={{ fontSize: '0.75rem', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <span><i className="bi bi-cash-stack" style={{ marginRight: '3px', color: 'var(--color-success)' }}></i> {formatCurrency(activeIngEfec)}</span>
                                                        <span>&bull;</span>
                                                        <span><i className="bi bi-bank" style={{ marginRight: '3px', color: 'var(--color-primary)' }}></i> {formatCurrency(activeIngBanco)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* KPI 3: Total Egresos */}
                                    <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--danger animate-slide-up">
                                        <div className="dashboard-kpi-shell">
                                            <div className="dashboard-kpi-row">
                                                <div className="kpi-icon" aria-hidden="true">
                                                    <i className="bi bi-arrow-down-circle-fill"></i>
                                                </div>
                                                <div className="dashboard-kpi-heading-group">
                                                    <div className="dashboard-kpi-heading">Total Egresos</div>
                                                    <div className="dashboard-kpi-main-value dashboard-kpi-currency">
                                                        -{formatCurrency(activeEgEfec + activeEgBanco)}
                                                    </div>
                                                    <div className="dashboard-kpi-note" style={{ fontSize: '0.75rem', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <span><i className="bi bi-cash-stack" style={{ marginRight: '3px', color: 'var(--color-danger)' }}></i> {formatCurrency(activeEgEfec)}</span>
                                                        <span>&bull;</span>
                                                        <span><i className="bi bi-bank" style={{ marginRight: '3px', color: 'var(--color-primary)' }}></i> {formatCurrency(activeEgBanco)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* KPI 4: Efectivo en Caja */}
                                    <div className="card kpi-card dashboard-kpi-card dashboard-kpi-card--bank animate-slide-up">
                                        <div className="dashboard-kpi-shell">
                                            <div className="dashboard-kpi-row">
                                                <div className="kpi-icon" aria-hidden="true" style={{ background: 'rgba(2, 132, 199, 0.15)', color: 'var(--color-primary)' }}>
                                                    <i className="bi bi-cash-stack"></i>
                                                </div>
                                                <div className="dashboard-kpi-heading-group">
                                                    <div className="dashboard-kpi-heading">Efectivo en Caja</div>
                                                    <div className="dashboard-kpi-main-value dashboard-kpi-currency" style={{ fontWeight: 800 }}>
                                                        {formatCurrency(activeSaldoCaja)}
                                                    </div>
                                                    <div className="dashboard-kpi-note" style={{ fontSize: '0.75rem' }}>
                                                        {isHist && !isDiaScope && s?.monto_real_efectivo !== null ? (
                                                            <span>Real contado: <strong>{formatCurrency(s.monto_real_efectivo)}</strong></span>
                                                        ) : (
                                                            <span>Saldo teórico en caja</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Selector de Alcance Temporal */}
                                <div className="caja-reporte-section-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i className="bi bi-journal-text" style={{ fontSize: '1.1rem', color: 'var(--color-primary)' }}></i>
                                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
                                            Auditoría Detallada · {isDiaScope ? 'Día Completo' : (s?.turno ? `Turno ${s.turno.toUpperCase()}` : 'Turno Actual')}
                                        </h3>
                                        <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                                            {displayedMovs.length} movimientos
                                        </span>
                                    </div>
                                    <div className="caja-reporte-scope-toggle">
                                        <button
                                            type="button"
                                            className={`caja-reporte-scope-btn ${reportScope === 'turno' ? 'active' : ''}`}
                                            onClick={() => setReportScope('turno')}
                                        >
                                            <i className="bi bi-clock-history"></i> {s?.turno ? `Turno ${s.turno.toUpperCase()}` : 'Turno Actual'} ({sessionMovimientosForReport.length})
                                        </button>
                                        <button
                                            type="button"
                                            className={`caja-reporte-scope-btn ${reportScope === 'dia' ? 'active' : ''}`}
                                            onClick={() => setReportScope('dia')}
                                        >
                                            <i className="bi bi-calendar-check"></i> Todo el Día ({todayMovimientosForReport.length})
                                        </button>
                                    </div>
                                </div>

                                {displayedMovs.length === 0 ? (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '42px 20px',
                                        background: 'var(--color-bg-alt, #f8fafc)',
                                        borderRadius: '12px',
                                        border: '1px dashed var(--color-border, #cbd5e1)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px'
                                    }}>
                                        <div style={{
                                            width: '56px',
                                            height: '56px',
                                            borderRadius: '50%',
                                            background: 'var(--color-surface, #ffffff)',
                                            border: '1px solid var(--color-border, #e2e8f0)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--color-text-secondary, #64748b)',
                                            fontSize: '1.6rem',
                                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
                                        }}>
                                            <i className="bi bi-receipt-cutoff"></i>
                                        </div>
                                        <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--color-text-primary, #0f172a)', fontSize: '1rem' }}>
                                            {reportScope === 'turno' 
                                                ? 'No hay transacciones registradas en este turno aún' 
                                                : 'No hay transacciones registradas en esta fecha'}
                                        </h4>
                                        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary, #64748b)', maxWidth: '480px', lineHeight: '1.5' }}>
                                            {reportScope === 'turno' && todayMovimientosForReport.length > 0 ? (
                                                <span>
                                                    Hay <strong>{todayMovimientosForReport.length}</strong> transacciones registradas en turnos anteriores del día de hoy. Haz clic en <strong>"Todo el Día"</strong> para visualizarlas.
                                                </span>
                                            ) : (
                                                'Los cobros de trabajos y registros de egresos se listarán aquí automáticamente en tiempo real con su respectiva información tributaria y operativa.'
                                            )}
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {/* Tabla 1: Cobros de Trabajos y Pedidos */}
                                        <div className="caja-reporte-table-card">
                                            <div className="caja-reporte-table-header-bar">
                                                <div className="caja-reporte-table-title" style={{ color: 'var(--color-success)' }}>
                                                    <i className="bi bi-arrow-up-circle-fill"></i>
                                                    <span>1. Cobros de Trabajos y Pedidos ({displayedIngresos.length})</span>
                                                </div>
                                                <span className="caja-reporte-table-total-pill is-income">
                                                    Total: +{formatCurrency(activeIngEfec + activeIngBanco)}
                                                </span>
                                            </div>

                                            {displayedIngresos.length === 0 ? (
                                                <div className="caja-empty-table-banner">
                                                    <i className="bi bi-info-circle"></i>
                                                    No se registraron cobros ni ingresos en este período.
                                                </div>
                                            ) : (
                                                <div className="caja-reporte-table-wrapper">
                                                    <table className="caja-reporte-table">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: '55px' }}>Hora</th>
                                                                <th>Cliente / Clínica</th>
                                                                <th>Paciente</th>
                                                                <th style={{ width: '90px' }}>N° Pedido</th>
                                                                <th>Producto Dental</th>
                                                                <th style={{ width: '50px', textAlign: 'center' }}>Cant.</th>
                                                                <th>Comprobante</th>
                                                                <th>Medio / Fondo</th>
                                                                <th style={{ textAlign: 'right', width: '95px' }}>Monto</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {displayedIngresos.map((m) => {
                                                                const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                                                                const compLabel = m.sustento_numero || (m.sustento_serie ? `${m.sustento_serie}-${m.sustento_numero}` : (m.origen === 'pago_pedido' ? `NV-${String(m.id).padStart(6, '0')}` : 'Nota'));
                                                                const isCash = m.tipo_fondo === 'caja';
                                                                const medioLabel = isCash ? 'Efectivo en Caja' : (m.metodo_pago ? m.metodo_pago.toUpperCase() : 'Banco / Transf.');
                                                                const cantNum = Number(m.producto_cantidad || 1);
                                                                const formattedCant = Number.isInteger(cantNum) ? cantNum : cantNum.toFixed(2);

                                                                return (
                                                                    <tr key={`${m.origen || 'mov'}-${m.id}`}>
                                                                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</td>
                                                                        <td><strong>{m.beneficiario || 'Cliente Directo'}</strong></td>
                                                                        <td style={{ color: 'var(--color-text-secondary)' }}>{m.paciente_nombre || '—'}</td>
                                                                        <td>
                                                                            {m.pedido_codigo ? (
                                                                                <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>{m.pedido_codigo}</span>
                                                                            ) : '—'}
                                                                        </td>
                                                                        <td>{m.producto_nombre || m.descripcion || 'Trabajo Dental'}</td>
                                                                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{formattedCant}</td>
                                                                        <td>
                                                                            <span className="caja-badge-voucher">
                                                                                {compLabel}
                                                                            </span>
                                                                        </td>
                                                                        <td>
                                                                            <span className={`caja-badge-fund ${isCash ? 'is-cash' : 'is-bank'}`}>
                                                                                <i className={`bi ${isCash ? 'bi-cash-coin' : 'bi-bank'}`}></i>
                                                                                {medioLabel}
                                                                            </span>
                                                                        </td>
                                                                        <td className="caja-cell-amount" style={{ color: 'var(--color-success)' }}>
                                                                            +{formatCurrency(m.monto)}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        {/* Tabla 2: Egresos y Gastos Operativos */}
                                        <div className="caja-reporte-table-card">
                                            <div className="caja-reporte-table-header-bar">
                                                <div className="caja-reporte-table-title" style={{ color: 'var(--color-danger)' }}>
                                                    <i className="bi bi-arrow-down-circle-fill"></i>
                                                    <span>2. Gastos Operativos y Compras ({displayedEgresos.length})</span>
                                                </div>
                                                <span className="caja-reporte-table-total-pill is-expense">
                                                    Total: -{formatCurrency(activeEgEfec + activeEgBanco)}
                                                </span>
                                            </div>

                                            {displayedEgresos.length === 0 ? (
                                                <div className="caja-empty-table-banner">
                                                    <i className="bi bi-check2-circle" style={{ color: 'var(--color-success)' }}></i>
                                                    No se registraron gastos u operaciones de egreso en este período.
                                                </div>
                                            ) : (
                                                <div className="caja-reporte-table-wrapper">
                                                    <table className="caja-reporte-table">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: '55px' }}>Hora</th>
                                                                <th>Proveedor / Beneficiario</th>
                                                                <th>Categoría</th>
                                                                <th>Descripción / Concepto</th>
                                                                <th>Comprobante / Sustento</th>
                                                                <th>Fondo</th>
                                                                <th style={{ textAlign: 'right', width: '95px' }}>Monto</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {displayedEgresos.map((m) => {
                                                                const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                                                                const compLabel = m.sustento_numero ? `${m.sustento_tipo === 'fiscal' ? 'Doc: ' : ''}${m.sustento_numero}` : (m.sustento_tipo === 'simple' ? 'Recibo' : 'Sin comprobante');
                                                                const isCash = m.tipo_fondo === 'caja';
                                                                const fondoLabel = isCash ? 'Efectivo en Caja' : 'Cuenta Bancaria';

                                                                return (
                                                                    <tr key={`${m.origen || 'mov'}-${m.id}`}>
                                                                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</td>
                                                                        <td><strong>{m.beneficiario || '—'}</strong></td>
                                                                        <td>
                                                                            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                                                                                {prettifyLabel(m.categoria_gasto) || 'Gasto Operativo'}
                                                                            </span>
                                                                        </td>
                                                                        <td>{m.descripcion || '—'}</td>
                                                                        <td style={{ color: 'var(--color-text-secondary)' }}>{compLabel}</td>
                                                                        <td>
                                                                            <span className={`caja-badge-fund ${isCash ? 'is-cash' : 'is-bank'}`}>
                                                                                <i className={`bi ${isCash ? 'bi-cash-coin' : 'bi-bank'}`}></i>
                                                                                {fondoLabel}
                                                                            </span>
                                                                        </td>
                                                                        <td className="caja-cell-amount" style={{ color: 'var(--color-danger)' }}>
                                                                            -{formatCurrency(m.monto)}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            </Modal>

            {/* Modal Impresión de Ticket de Cobro / Comprobante */}
            <Modal
                open={ticketModalOpen}
                onClose={() => setTicketModalOpen(false)}
                title="Comprobante de Cobro en Mostrador"
                kicker="Caja Mostrador • Comprobante"
                subtitle="Ticket o documento de cobranza emitido"
                icon="bi-printer-fill"
                size={ticketPrintFormat === 'a4' ? 'xl' : (ticketPrintFormat === 'a5' ? 'lg' : 'md')}
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setTicketModalOpen(false)}
                        >
                            Cerrar
                        </button>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['boleta', 'factura'].includes(cobroExitosoTicket?.comprobanteTipo) && (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                        setTicketModalOpen(false);
                                        handleTabChange('facturacion');
                                    }}
                                >
                                    <i className="bi bi-file-earmark-text"></i> Facturar SUNAT
                                </button>
                            )}
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={handlePrintTicket}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <i className="bi bi-printer-fill"></i>
                                Imprimir {ticketPrintFormat === 'ticket80' ? 'Ticketera (80mm)' : (ticketPrintFormat === 'a4' ? 'A4' : 'A5 (Media Hoja)')}
                            </button>
                        </div>
                    </div>
                )}
            >
                {cobroExitosoTicket && ticketSheetData && (
                    <div>
                        {/* Selector de Formato de Impresión */}
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            marginBottom: '14px',
                            justifyContent: 'center',
                            flexWrap: 'wrap',
                            padding: '6px',
                            background: 'var(--color-bg-alt, #f8fafc)',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border, #e2e8f0)'
                        }}>
                            <button
                                type="button"
                                className={`btn btn-sm ${ticketPrintFormat === 'ticket80' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setTicketPrintFormat('ticket80')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <i className="bi bi-receipt"></i> Ticketera 80mm
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${ticketPrintFormat === 'a4' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setTicketPrintFormat('a4')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <i className="bi bi-file-earmark-text"></i> Hoja A4
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${ticketPrintFormat === 'a5' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setTicketPrintFormat('a5')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <i className="bi bi-file-earmark"></i> A5 / Media Hoja
                            </button>
                        </div>

                        {/* Visor de Vista Previa con Scroll */}
                        <div className="cpe-preview-viewport">
                            <div className="cpe-preview-sheet-wrapper">
                                <ComprobantePrintSheet data={ticketSheetData} format={ticketPrintFormat} />
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Portal directo en body para impresión sin páginas en blanco */}
            {cobroExitosoTicket && ticketSheetData && createPortal(
                <div id="cpe-print-root" ref={ticketPrintRootRef}>
                    <ComprobantePrintSheet data={ticketSheetData} format={ticketPrintFormat} />
                </div>,
                document.body
            )}

            {/* Portal para impresión oficial del Reporte de Cierre y Arqueo A4 */}
            {cierreReportPrintData && createPortal(
                <div id="caja-reporte-print-root">
                    <CajaCierrePrintSheet
                        session={cierreReportPrintData.session}
                        empresa={empresaFiscal}
                        movimientos={cierreReportPrintData.movimientos}
                    />
                </div>,
                document.body
            )}
        </div>
    );
};

export default CajaGastos;
