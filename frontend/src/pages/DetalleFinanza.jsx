import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import BillingConfirmModal from '../components/billing/BillingConfirmModal.jsx';
import BillingResultModal from '../components/billing/BillingResultModal.jsx';
import ComprobantePrintModal from '../components/billing/ComprobantePrintModal.jsx';
import { useFinanceDetailQuery } from '../modules/finance/queries/useFinanceDetailQuery.js';
import { useFinanceCatalogsQuery } from '../modules/finance/queries/useFinanceCatalogsQuery.js';
import { useBillingPreviewQuery } from '../modules/billing/queries/useBillingPreviewQuery.js';
import { useRegisterPaymentMutation } from '../modules/finance/mutations/useRegisterPaymentMutation.js';
import { useCreateInvoiceMutation } from '../modules/billing/mutations/useCreateInvoiceMutation.js';
import { useAnnulInvoiceMutation } from '../modules/billing/mutations/useAnnulInvoiceMutation.js';
import { useCreateCreditNoteMutation } from '../modules/billing/mutations/useCreateCreditNoteMutation.js';
import logoAfinixPrint from '../assets/branding/logo-light.png';
import isoAfinixPrint from '../assets/branding/iso-light.png';
import OrderProductThumb from '../components/orders/OrderProductThumb.jsx';
import { formatDentalSelection, sortTeethByArchOrder } from '../utils/odontograma.js';
import '../styles/detalle-finanza-ui-consistency.css';

/** URL absoluta del asset (ventana de impresión = about:blank). */
const assetAbsUrl = (assetPath) => {
    if (!assetPath) return '';
    if (/^https?:\/\//i.test(assetPath)) return assetPath;
    return `${window.location.origin}${assetPath.startsWith('/') ? '' : '/'}${assetPath}`;
};

const statusLabels = {
    por_cancelar: 'Por cancelar',
    pago_parcial: 'Pago parcial',
    cancelado: 'Cancelado'
};

const metodoToFondo = (metodo = '') => (String(metodo).toLowerCase() === 'efectivo' ? 'caja' : 'banco');

const DetalleFinanza = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);
    const [printMenuOpen, setPrintMenuOpen] = useState(false);
    const [anularModal, setAnularModal] = useState(null); // comp object | null
    const [anularMotivo, setAnularMotivo] = useState('');
    const [notaCreditoModal, setNotaCreditoModal] = useState(null); // comp object | null
    const [ncForm, setNcForm] = useState({ motivo: '', monto: '', codMotivo: '01' });
    const voidingKeyRef = useRef(null);
    const creditNoteKeyRef = useRef(null);
    const emitirKeyRef = useRef(null);
    const reenvioTargetRef = useRef(null);

    // Modales de emit rápido
    const [emitirConfirm, setEmitirConfirm] = useState({ open: false, tipoComprobante: '03' });
    const [emitirResult, setEmitirResult] = useState({ open: false, status: 'aceptado', data: {} });
    const [printModal, setPrintModal] = useState({ open: false, comprobanteId: null });
    const [reenvioConfirm, setReenvioConfirm] = useState(null);
    const [reenviandoId, setReenviandoId] = useState(null);
    const [form, setForm] = useState({
        monto: '',
        metodo: 'transferencia',
        tipo_fondo: 'banco',
        cuenta_id: '',
        referencia: '',
        fecha_pago: new Date().toISOString().split('T')[0],
        notas: ''
    });

    const financeDetailQuery = useFinanceDetailQuery(id);
    const financeCatalogsQuery = useFinanceCatalogsQuery();
    const comprobantesQuery = useBillingPreviewQuery(id);
    const registerPaymentMutation = useRegisterPaymentMutation();
    const createInvoiceMutation = useCreateInvoiceMutation();
    const annulInvoiceMutation = useAnnulInvoiceMutation();
    const createCreditNoteMutation = useCreateCreditNoteMutation();

    const finanza = financeDetailQuery.data || null;
    const comprobantes = comprobantesQuery.data || [];
    const catalogos = {
        cuentas: Array.isArray(financeCatalogsQuery.data?.cuentas) ? financeCatalogsQuery.data.cuentas : []
    };
    const loading = financeDetailQuery.isLoading;

    const formatDate = (value, withTime = false) => {
        if (!value) return 'Sin definir';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        const options = withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
        return new Intl.DateTimeFormat('es-PE', options).format(date);
    };

    const formatCurrency = (value) => {
        const number = parseFloat(value || 0);
        if (Number.isNaN(number)) return 'S/. 0.00';
        return `S/. ${number.toFixed(2)}`;
    };

    const saldoMeta = useMemo(() => {
        if (!finanza) return null;
        if (finanza.estado_pago === 'cancelado') return { label: 'Cancelado', tone: 'success' };
        if (finanza.estado_pago === 'pago_parcial') return { label: 'Pago parcial', tone: 'warning' };
        return { label: 'Por cancelar', tone: 'warning' };
    }, [finanza]);

    const cuentasFiltradas = useMemo(() => {
        const target = form.tipo_fondo === 'caja' ? 'caja' : 'banco';
        return (catalogos.cuentas || []).filter((c) => c.tipo_cuenta === target);
    }, [catalogos.cuentas, form.tipo_fondo]);

    useEffect(() => {
        if (cuentasFiltradas.length === 0) {
            setForm((prev) => ({ ...prev, cuenta_id: '' }));
            return;
        }
        const exists = cuentasFiltradas.some((c) => String(c.id) === String(form.cuenta_id));
        if (!exists) {
            setForm((prev) => ({ ...prev, cuenta_id: String(cuentasFiltradas[0].id) }));
        }
    }, [cuentasFiltradas, form.cuenta_id]);

    const openRegistrarPago = () => {
        const saldo = Number(finanza?.saldo);
        setForm((prev) => ({
            ...prev,
            monto: Number.isFinite(saldo) && saldo > 0 ? saldo.toFixed(2) : '',
            referencia: '',
            fecha_pago: new Date().toISOString().split('T')[0],
            notas: ''
        }));
        setModalOpen(true);
    };

    const submitPago = async () => {
        if (!form.monto || Number.isNaN(parseFloat(form.monto))) {
            alert('Ingresa un monto válido');
            return;
        }
        try {
            await registerPaymentMutation.mutateAsync({
                orderId: id,
                payload: {
                    ...form,
                    cuenta_id: form.cuenta_id ? parseInt(form.cuenta_id, 10) : null
                }
            });

            setModalOpen(false);
            setForm({
                monto: '',
                metodo: 'transferencia',
                tipo_fondo: 'banco',
                cuenta_id: '',
                referencia: '',
                fecha_pago: new Date().toISOString().split('T')[0],
                notas: ''
            });
        } catch (err) {
            alert(err.message);
        }
    };

    const handleEmitir = (tipoComprobante) => {
        emitirKeyRef.current ||= crypto.randomUUID();
        setEmitirConfirm({ open: true, tipoComprobante });
    };

    const handleConfirmEmitir = async () => {
        const { tipoComprobante } = emitirConfirm;
        reenvioTargetRef.current = null;
        try {
            emitirKeyRef.current ||= crypto.randomUUID();
            const result = await createInvoiceMutation.mutateAsync({
                orderId: id,
                payload: { tipoComprobante, idempotencyKey: emitirKeyRef.current }
            });
            setEmitirConfirm({ open: false, tipoComprobante });
            emitirKeyRef.current = null;
            setEmitirResult({
                open: true,
                status: 'aceptado',
                data: {
                    serie: result?.serie,
                    correlativo: result?.correlativo,
                    cdrCode: result?.cdr_code,
                    cdrDescription: result?.cdr_description,
                    hash: result?.hash,
                    pdfUrl: result?.pdf_url,
                    xmlUrl: result?.xml_url,
                    cdrUrl: result?.cdr_url,
                    comprobanteId: result?.id || null,
                    isDemoAsset: !!(result?.pdf_url && (result.pdf_url.includes('/demo/') || result.pdf_url.includes('demo.apisperu'))),
                },
            });
        } catch (err) {
            setEmitirConfirm({ open: false, tipoComprobante: emitirConfirm.tipoComprobante });
            const is422 = err.status === 422;
            const isNetworkOrServer = !err.status || err.status >= 500;
            if (!isNetworkOrServer) emitirKeyRef.current = null;
            setEmitirResult({
                open: true,
                status: is422 ? 'rechazado' : isNetworkOrServer ? 'no_confirmado' : 'rechazado',
                data: {
                    cdrCode: err.payload?.cdr_code || err.payload?.code,
                    cdrDescription: err.payload?.cdr_description || err.message,
                    message: err.message,
                    requestId: err.payload?.requestId || err.payload?.request_id,
                },
            });
        }
    };

    const handleRetryEmitir = () => {
        setEmitirResult({ open: false, status: 'aceptado', data: {} });
        if (reenvioTargetRef.current) {
            void reenviarComprobante(reenvioTargetRef.current, { askConfirm: false });
            return;
        }
        const tipoComprobante = emitirConfirm.tipoComprobante || '03';
        setEmitirConfirm({ open: true, tipoComprobante });
    };

    const handleAnularComprobante = (comp) => {
        setAnularMotivo('');
        voidingKeyRef.current = crypto.randomUUID();
        setAnularModal(comp);
    };

    const submitAnulacion = async () => {
        if (!anularModal) return;
        if (anularMotivo.trim().length < 5) { alert('El motivo debe tener al menos 5 caracteres.'); return; }
        try {
            await annulInvoiceMutation.mutateAsync({
                orderId: id,
                invoiceId: anularModal.id,
                payload: { motivo: anularMotivo.trim(), idempotencyKey: voidingKeyRef.current }
            });
            setAnularModal(null);
            alert('La comunicación de baja fue enviada. SUNAT la procesará mediante un ticket pendiente.');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleNotaCredito = (comp) => {
        creditNoteKeyRef.current = crypto.randomUUID();
        setNcForm({ motivo: '', monto: String(comp.total_venta || ''), codMotivo: '01' });
        setNotaCreditoModal(comp);
    };

    const submitNotaCredito = async () => {
        if (!notaCreditoModal) return;
        if (ncForm.motivo.trim().length < 5) { alert('El motivo debe tener al menos 5 caracteres.'); return; }
        if (!ncForm.monto || isNaN(parseFloat(ncForm.monto)) || parseFloat(ncForm.monto) <= 0) {
            alert('Ingresa un monto válido mayor a 0.'); return;
        }
        try {
            await createCreditNoteMutation.mutateAsync({
                orderId: id,
                invoiceId: notaCreditoModal.id,
                payload: {
                    motivo: ncForm.motivo.trim(), monto: parseFloat(ncForm.monto),
                    codMotivo: ncForm.codMotivo, idempotencyKey: creditNoteKeyRef.current
                }
            });
            setNotaCreditoModal(null);
        } catch (err) {
            alert(err.message);
        }
    };

    const handlePrintComprobante = (comp) => {
        setPrintModal({ open: true, comprobanteId: comp.id });
    };

    const reenviarComprobante = async (comp, { askConfirm = true } = {}) => {
        if (!comp?.idempotency_key) {
            alert('Este comprobante no tiene clave de reenvío. No se puede reintentar desde aquí.');
            return;
        }
        if (askConfirm) {
            setReenvioConfirm(comp);
            return;
        }

        reenvioTargetRef.current = comp;
        setReenviandoId(comp.id);
        try {
            const result = await createInvoiceMutation.mutateAsync({
                orderId: id,
                payload: {
                    tipoComprobante: comp.tipo_comprobante,
                    idempotencyKey: comp.idempotency_key
                }
            });
            setEmitirResult({
                open: true,
                status: 'aceptado',
                data: {
                    serie: result?.serie,
                    correlativo: result?.correlativo,
                    cdrCode: result?.cdr_code,
                    cdrDescription: result?.cdr_description,
                    hash: result?.hash,
                    pdfUrl: result?.pdf_url,
                    xmlUrl: result?.xml_url,
                    cdrUrl: result?.cdr_url,
                    comprobanteId: result?.id || comp.id,
                    isDemoAsset: !!(result?.pdf_url && (result.pdf_url.includes('/demo/') || result.pdf_url.includes('demo.apisperu'))),
                },
            });
        } catch (err) {
            const is422 = err.status === 422;
            const isNetworkOrServer = !err.status || err.status >= 500;
            setEmitirResult({
                open: true,
                status: is422 ? 'rechazado' : isNetworkOrServer ? 'no_confirmado' : 'rechazado',
                data: {
                    cdrCode: err.payload?.cdr_code || err.payload?.code,
                    cdrDescription: err.payload?.cdr_description || err.message,
                    message: err.message,
                    requestId: err.payload?.requestId || err.payload?.request_id,
                },
            });
        } finally {
            setReenviandoId(null);
        }
    };

    const handleReenviarComprobante = (comp) => {
        void reenviarComprobante(comp, { askConfirm: true });
    };

    const escapeHtml = (value) => {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const handlePrintA4 = () => {
        if (!finanza) return;
        setPrintMenuOpen(false);
        const pagosRows = finanza.pagos?.length
            ? finanza.pagos.map((pago) => (
                `<tr>
                    <td>${escapeHtml(formatDate(pago.fecha_pago || pago.created_at))}</td>
                    <td>${escapeHtml(pago.metodo || '—')}</td>
                    <td>${escapeHtml(pago.referencia || '—')}</td>
                    <td style="text-align:right;font-weight:600">${formatCurrency(pago.monto)}</td>
                </tr>`
            )).join('')
            : '<tr><td colspan="4" style="text-align:center;color:#64748B;padding:12px 0;">Sin pagos registrados</td></tr>';

        const itemsRows = finanza.items?.length
            ? finanza.items.map((item) => (
                `<tr>
                    <td>${escapeHtml(item.producto_nombre || '—')}</td>
                    <td style="text-align:center">${escapeHtml(item.cantidad || 1)}</td>
                    <td style="text-align:right">${formatCurrency(item.precio_unitario)}</td>
                    <td style="text-align:right;font-weight:600">${formatCurrency(item.subtotal)}</td>
                </tr>`
            )).join('')
            : '<tr><td colspan="4" style="text-align:center;color:#64748B;padding:12px 0;">Sin items registrados</td></tr>';

        const logoSrc = assetAbsUrl(logoAfinixPrint);
        const html = `
<!doctype html><html><head><meta charset="utf-8" />
<title>Comprobante ${escapeHtml(finanza.codigo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, Arial, sans-serif; color: #0A1B33; background: #fff; }
  .page { max-width: 190mm; margin: 0 auto; padding: 16mm 14mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 3px solid #007BFF; margin-bottom: 18px; gap: 16px; }
  .header-brand img { height: 52px; width: auto; display: block; object-fit: contain; }
  .header-doc { text-align: right; }
  .header-doc .doc-type { font-size: 14px; font-weight: 800; color: #0A1B33; letter-spacing: 0.06em; }
  .header-doc .doc-code { font-size: 12px; color: #475569; margin-top: 3px; font-family: ui-monospace, monospace; }
  .chip { display: inline-block; background: #D1FAE5; color: #047857; border: 1px solid #6EE7B7; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; margin-top: 6px; }
  .chip.por_cancelar { background: #FEF3C7; color: #92400E; border-color: #FCD34D; }
  .chip.pago_parcial { background: #FFEDD5; color: #9A3412; border-color: #FDBA74; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #475569; margin: 18px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #D1D9E6; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 4px; }
  .info-block .ib-label { font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; }
  .info-block .ib-value { font-size: 12.5px; font-weight: 600; margin-top: 2px; color: #0A1B33; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  thead tr { background: #F8FAFC; border-top: 1px solid #D1D9E6; border-bottom: 2px solid #D1D9E6; }
  th { padding: 7px 10px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
  td { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; }
  tbody tr:last-child td { border-bottom: none; }
  .totals-box { margin-top: 16px; display: flex; justify-content: flex-end; }
  .totals-inner { min-width: 220px; border: 1px solid #D1D9E6; border-radius: 10px; overflow: hidden; background: #F8FAFC; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 12px; border-bottom: 1px solid #E2E8F0; }
  .totals-row:last-child { border-bottom: none; background: rgba(0, 123, 255, 0.08); font-size: 14px; font-weight: 700; color: #007BFF; }
  .totals-row .t-label { color: #475569; font-size: inherit; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px dashed #CBD5E1; text-align: center; font-size: 10px; color: #94A3B8; }
  @page { size: A4; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="page">
  <div class="header">
    <div class="header-brand">
      <img src="${escapeHtml(logoSrc)}" alt="AFINIX Dental Lab" />
    </div>
    <div class="header-doc">
      <div class="doc-type">COMPROBANTE INTERNO</div>
      <div class="doc-code">${escapeHtml(finanza.codigo)}</div>
      <span class="chip ${finanza.estado_pago || ''}">${
        finanza.estado_pago === 'cancelado' ? 'Cancelado' :
        finanza.estado_pago === 'pago_parcial' ? 'Pago Parcial' : 'Por Cancelar'
      }</span>
    </div>
  </div>

  <div class="section-title">Datos del pedido</div>
  <div class="info-grid">
    <div class="info-block"><div class="ib-label">Paciente</div><div class="ib-value">${escapeHtml(finanza.paciente_nombre)}</div></div>
    <div class="info-block"><div class="ib-label">Clínica</div><div class="ib-value">${escapeHtml(finanza.clinica_nombre || '—')}</div></div>
    <div class="info-block"><div class="ib-label">Fecha de pedido</div><div class="ib-value">${escapeHtml(formatDate(finanza.fecha || finanza.created_at))}</div></div>
    <div class="info-block"><div class="ib-label">Fecha de emisión</div><div class="ib-value">${escapeHtml(formatDate(new Date(), true))}</div></div>
  </div>

  <div class="section-title">Detalle de items</div>
  <table><thead><tr>
    <th>Producto</th><th style="text-align:center">Cant.</th>
    <th style="text-align:right">P. Unitario</th><th style="text-align:right">Total</th>
  </tr></thead><tbody>${itemsRows}</tbody></table>

  <div class="section-title">Pagos registrados</div>
  <table><thead><tr>
    <th>Fecha</th><th>Método</th><th>Referencia</th><th style="text-align:right">Monto</th>
  </tr></thead><tbody>${pagosRows}</tbody></table>

  <div class="totals-box">
    <div class="totals-inner">
      <div class="totals-row"><span class="t-label">Subtotal (inc. IGV)</span><span>${formatCurrency(finanza.total)}</span></div>
      <div class="totals-row"><span class="t-label">Pagado</span><span>${formatCurrency(finanza.monto_pagado)}</span></div>
      <div class="totals-row"><span class="t-label">Saldo pendiente</span><span>${formatCurrency(finanza.saldo)}</span></div>
    </div>
  </div>

  <div class="footer">Documento interno — No válido como comprobante de pago tributario &nbsp;·&nbsp; AFINIX Dental Lab &nbsp;·&nbsp; ${escapeHtml(formatDate(new Date(), true))}</div>
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

        const printWindow = window.open('', 'PRINT_A4', 'height=900,width=800');
        if (!printWindow) { alert('No se pudo abrir la ventana de impresión'); return; }
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrint80mm = () => {
        if (!finanza) return;
        setPrintMenuOpen(false);

        const itemsRows = finanza.items?.length
            ? finanza.items.map((item) => (
                `<tr>
                    <td colspan="2" style="padding-bottom:2px">${escapeHtml(item.producto_nombre || '—')}</td>
                </tr>
                <tr>
                    <td style="color:#444;padding-left:4px">${escapeHtml(item.cantidad || 1)} x ${formatCurrency(item.precio_unitario)}</td>
                    <td style="text-align:right;font-weight:700">${formatCurrency(item.subtotal)}</td>
                </tr>`
            )).join('')
            : '<tr><td colspan="2" style="text-align:center">Sin items</td></tr>';

        const pagosRows = finanza.pagos?.length
            ? finanza.pagos.map((pago) => (
                `<tr>
                    <td>${escapeHtml(formatDate(pago.fecha_pago || pago.created_at))} · ${escapeHtml(pago.metodo || '—')}</td>
                    <td style="text-align:right;font-weight:600">${formatCurrency(pago.monto)}</td>
                </tr>`
            )).join('')
            : '<tr><td colspan="2" style="text-align:center">Sin pagos</td></tr>';

        const isoSrc = assetAbsUrl(isoAfinixPrint);
        const html = `
<!doctype html><html><head><meta charset="utf-8" />
<title>Ticket ${escapeHtml(finanza.codigo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, Arial, sans-serif; font-size: 12px; color: #0A1B33; background: #fff; width: 80mm; margin: 0 auto; padding: 4mm 3mm 8mm; }
  .center { text-align: center; }
  .brand-logo { height: 36px; width: auto; margin: 0 auto 4px; display: block; object-fit: contain; }
  .brand-name { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; color: #007BFF; margin-bottom: 2px; }
  .divider { border: none; border-top: 1px dashed #D1D9E6; margin: 6px 0; }
  .section { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin: 5px 0 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  td { padding: 2px 0; vertical-align: top; }
  .total-row { font-size: 14px; font-weight: 800; color: #007BFF; }
  .footer-note { font-size: 9.5px; text-align: center; margin-top: 8px; color: #64748B; }
  @page { size: 80mm auto; margin: 0; }
  @media print { body { width: 80mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="center">
  <img class="brand-logo" src="${escapeHtml(isoSrc)}" alt="AFINIX" />
  <div class="brand-name">AFINIX DENTAL LAB</div>
</div>
<hr class="divider">
<div class="center">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.06em">COMPROBANTE INTERNO</div>
  <div style="font-size:11px;color:#475569">${escapeHtml(finanza.codigo)}</div>
</div>
<hr class="divider">
<table>
  <tr><td style="font-size:10px;color:#64748B">PACIENTE</td><td style="text-align:right;font-size:10px;color:#64748B">FECHA EMI.</td></tr>
  <tr><td style="font-weight:600">${escapeHtml(finanza.paciente_nombre)}</td><td style="text-align:right">${escapeHtml(formatDate(new Date()))}</td></tr>
  <tr><td style="font-size:10px;color:#64748B;padding-top:4px">CLÍNICA</td></tr>
  <tr><td colspan="2">${escapeHtml(finanza.clinica_nombre || '—')}</td></tr>
</table>
<hr class="divider">
<div class="section">Detalle</div>
<table>${itemsRows}</table>
<hr class="divider">
<div class="section">Pagos</div>
<table>${pagosRows}</table>
<hr class="divider">
<table>
  <tr><td>Total (inc. IGV)</td><td style="text-align:right;font-weight:700">${formatCurrency(finanza.total)}</td></tr>
  <tr><td>Pagado</td><td style="text-align:right;font-weight:700">${formatCurrency(finanza.monto_pagado)}</td></tr>
  <tr class="total-row"><td>SALDO</td><td style="text-align:right">${formatCurrency(finanza.saldo)}</td></tr>
</table>
<hr class="divider">
<div class="footer-note">Documento interno — No válido tributariamente</div>
<div class="footer-note">AFINIX Dental Lab</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

        const printWindow = window.open('', 'PRINT_80MM', 'height=700,width=320');
        if (!printWindow) { alert('No se pudo abrir la ventana de impresión'); return; }
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const printTicketPago = (pago) => {
        if (!finanza || !pago) return;
        const html = `
            <!doctype html>
            <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Ticket Anticipo ${escapeHtml(finanza.codigo)}</title>
                    <style>
                        * { box-sizing: border-box; }
                        body { font-family: monospace; font-size: 12px; margin: 0; padding: 12px; width: 300px; color: #000; }
                        h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
                        h2 { font-size: 12px; margin: 4px 0 12px; text-align: center; font-weight: normal; }
                        .divider { border-top: 1px dashed #000; margin: 8px 0; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                        .centered { text-align: center; margin-top: 12px; }
                    </style>
                </head>
                <body>
                    <h1>TICKET DE ANTICIPO</h1>
                    <h2>Pedido: ${escapeHtml(finanza.codigo)}</h2>
                    <div class="divider"></div>
                    <div class="row"><span>Fecha:</span> <span>${escapeHtml(formatDate(pago.fecha_pago || pago.created_at, true))}</span></div>
                    <div class="row"><span>Cliente:</span> <span>${escapeHtml(finanza.paciente_nombre)}</span></div>
                    <div class="row"><span>Método:</span> <span>${escapeHtml(pago.metodo || '—')}</span></div>
                    <div class="row"><span>Ref:</span> <span>${escapeHtml(pago.referencia || '—')}</span></div>
                    <div class="divider"></div>
                    <div class="row"><strong>MONTO PAGADO:</strong> <strong>${formatCurrency(pago.monto)}</strong></div>
                    <div class="row"><span>Saldo Pendiente:</span> <span>${formatCurrency(finanza.saldo)}</span></div>
                    <div class="divider"></div>
                    <div class="centered">
                        <p>Documento Interno - No válido para efectos tributarios.</p>
                    </div>
                </body>
            </html>
        `;
        const printWindow = window.open('', 'PRINT', 'height=600,width=400');
        if (!printWindow) {
            alert('No se pudo abrir la ventana de impresión');
            return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    if (loading) {
        return (
            <div className="card detail-finanza-loading-card">
                <div className="skeleton detail-finanza-loading-skeleton" />
            </div>
        );
    }

    if (!finanza) {
        return (
            <div className="empty-state">
                <i className="bi bi-cash-stack empty-state-icon"></i>
                <h3 className="empty-state-title">Finanza no encontrada</h3>
                <button className="btn btn-primary" onClick={() => navigate('/finanzas')}>Volver</button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in detail-finanza-page pedido-detail">
            <div className="page-header pedido-detail-header">
                <div className="page-header-left">
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => navigate('/finanzas')}
                        aria-label="Volver a finanzas"
                    >
                        <i className="bi bi-arrow-left"></i>
                    </button>
                    <div>
                        <h1 className="pedido-detail-title">
                            {finanza.codigo}
                            <span className={`badge badge-dot badge-${finanza.estado_pago}`}>
                                {statusLabels[finanza.estado_pago]}
                            </span>
                        </h1>
                        <p>Finanzas · {finanza.paciente_nombre}</p>
                    </div>
                </div>
                <div className="pedido-actions detail-finanza-header-actions">
                    <div className="detail-finanza-print-menu">
                        <button type="button" className="btn btn-secondary" onClick={() => setPrintMenuOpen(p => !p)}>
                            <i className="bi bi-printer"></i> Imprimir interno <i className="bi bi-chevron-down detail-finanza-chevron"></i>
                        </button>
                        {printMenuOpen && (
                            <div className="detail-finanza-print-popover">
                                <button type="button" className="btn btn-ghost detail-finanza-print-option" onClick={handlePrintA4}>
                                    <i className="bi bi-file-earmark-text detail-finanza-icon-tone"></i>
                                    <div className="detail-finanza-print-option-content">
                                        <div className="detail-finanza-print-option-title">Formato A4</div>
                                        <div className="detail-finanza-print-option-subtitle">Impresora estándar</div>
                                    </div>
                                </button>
                                <button type="button" className="btn btn-ghost detail-finanza-print-option" onClick={handlePrint80mm}>
                                    <i className="bi bi-receipt detail-finanza-icon-tone"></i>
                                    <div className="detail-finanza-print-option-content">
                                        <div className="detail-finanza-print-option-title">Ticketera 80mm</div>
                                        <div className="detail-finanza-print-option-subtitle">Impresora térmica</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                    {finanza.estado_pago !== 'cancelado' && (
                        <button type="button" className="btn btn-primary" onClick={openRegistrarPago}>
                            <i className="bi bi-plus-lg"></i> Registrar pago
                        </button>
                    )}
                </div>
            </div>

            <div className="order-wizard-confirm-hero pedido-detail-hero" aria-label="Resumen financiero">
                <div className="order-wizard-confirm-stat">
                    <div className="order-wizard-confirm-stat-copy">
                        <span className="order-wizard-confirm-label">
                            <i className="bi bi-cash-stack" aria-hidden="true"></i>
                            Total
                        </span>
                        <strong>{formatCurrency(finanza.total)}</strong>
                        <em className="order-wizard-confirm-meta">
                            {finanza.clinica_nombre || 'Sin clínica'} · Pedido {formatDate(finanza.fecha || finanza.created_at)}
                        </em>
                    </div>
                </div>
                <div className="order-wizard-confirm-stat">
                    <div className="order-wizard-confirm-stat-copy">
                        <span className="order-wizard-confirm-label">
                            <i className="bi bi-wallet2" aria-hidden="true"></i>
                            Pagado
                        </span>
                        <strong>{formatCurrency(finanza.monto_pagado)}</strong>
                        <em className="order-wizard-confirm-meta">
                            Caja {formatCurrency(finanza.monto_pagado_caja)} · Bancos {formatCurrency(finanza.monto_pagado_bancos)}
                        </em>
                    </div>
                </div>
                <div className="order-wizard-confirm-stat">
                    <div className="order-wizard-confirm-stat-copy">
                        <span className="order-wizard-confirm-label">
                            <i className="bi bi-piggy-bank" aria-hidden="true"></i>
                            Saldo
                        </span>
                        <strong>{formatCurrency(finanza.saldo)}</strong>
                        {saldoMeta ? (
                            <em className="order-wizard-confirm-meta">{saldoMeta.label}</em>
                        ) : (
                            <em className="order-wizard-confirm-meta">Entrega {formatDate(finanza.fecha_entrega)}</em>
                        )}
                    </div>
                </div>
            </div>

            <div className="detail-finanza-layout">
                <div className="detail-finanza-main">
                <div className="card pedido-detail-items">
                    <div className="card-header">
                        <h3 className="card-title">
                            <i className="bi bi-box-seam" aria-hidden="true"></i>
                            Detalle de items
                        </h3>
                    </div>
                    {finanza.items?.length ? (
                        <>
                            <ul className="order-wizard-confirm-items pedido-detail-confirm-items">
                                {finanza.items.map((item, i) => {
                                    const subtotal = parseFloat(item.subtotal) || (item.cantidad * parseFloat(item.precio_unitario));
                                    const tone = String(item.color_vita || item.color || '').trim();
                                    const teeth = sortTeethByArchOrder(item.piezas_dentales || []);
                                    const isBridge = Boolean(item.es_puente && item.pieza_inicio && item.pieza_fin);
                                    const product = {
                                        id: item.producto_id,
                                        nombre: item.producto_nombre || `Producto #${item.producto_id}`,
                                        image_url: item.producto_image_url || item.image_url || '',
                                    };
                                    const teethDenseClass = teeth.length > 24
                                        ? 'is-dense-xl'
                                        : teeth.length > 16
                                            ? 'is-dense-lg'
                                            : teeth.length > 8
                                                ? 'is-dense-md'
                                                : '';
                                    return (
                                        <li key={item.id || i} className="order-wizard-confirm-item">
                                            <div className="order-wizard-confirm-item-media" aria-hidden="true">
                                                <OrderProductThumb product={product} />
                                            </div>
                                            <div className="order-wizard-confirm-item-main">
                                                <div className="pedido-detail-confirm-item-top">
                                                    <div className="pedido-detail-confirm-item-heading">
                                                        <strong>{product.nombre}</strong>
                                                    </div>
                                                    <div className="order-wizard-confirm-clinical">
                                                        {isBridge ? (
                                                            <span className="order-wizard-confirm-qty">{formatDentalSelection(item)}</span>
                                                        ) : teeth.length > 0 ? (
                                                            <div
                                                                className={[
                                                                    'order-wizard-confirm-teeth',
                                                                    teethDenseClass,
                                                                ].filter(Boolean).join(' ')}
                                                                data-count={teeth.length}
                                                                aria-label="Piezas seleccionadas"
                                                            >
                                                                {teeth.map((tooth) => (
                                                                    <span key={`${item.id || i}-${tooth}`} className="order-wizard-confirm-tooth">
                                                                        {tooth}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="order-wizard-confirm-qty">
                                                                {item.cantidad} {parseFloat(item.cantidad) === 1 ? 'pieza' : 'piezas'}
                                                            </span>
                                                        )}
                                                        {tone ? (
                                                            <span className="order-wizard-confirm-tone">Tono {tone}</span>
                                                        ) : null}
                                                    </div>
                                                    <span className="pedido-detail-item-subtotal">{formatCurrency(subtotal)}</span>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            {(finanza.items?.length || 0) > 1 ? (
                                <div className="pedido-detail-items-total">
                                    Total: {formatCurrency(finanza.total)}
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="empty-state" style={{ padding: '1.5rem 0' }}>
                            <p className="empty-state-text">Sin items registrados</p>
                        </div>
                    )}
                </div>

                <div className="card pedido-detail-history">
                    <div className="card-header">
                        <h3 className="card-title">
                            <i className="bi bi-receipt" aria-hidden="true"></i>
                            Resumen de pagos
                        </h3>
                    </div>
                    <div className="data-table-wrapper table-scroll-dense desktop-only detail-finanza-table-shell">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Método</th>
                                    <th>Fondo</th>
                                    <th>Cuenta</th>
                                    <th>Referencia</th>
                                    <th>Monto</th>
                                    <th className="detail-finanza-table-icon-col"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {finanza.pagos?.length ? finanza.pagos.map((pago) => (
                                    <tr key={pago.id}>
                                        <td>{formatDate(pago.fecha_pago || pago.created_at)}</td>
                                        <td>{pago.metodo || '—'}</td>
                                        <td>{pago.tipo_fondo === 'caja' ? 'Caja' : 'Banco'}</td>
                                        <td>{pago.cuenta_nombre || '—'}</td>
                                        <td>{pago.referencia || '—'}</td>
                                        <td><strong>{formatCurrency(pago.monto)}</strong></td>
                                        <td className="detail-finanza-table-action-cell">
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-icon btn-sm"
                                                title="Imprimir ticket"
                                                onClick={() => printTicketPago(pago)}
                                            >
                                                <i className="bi bi-printer"></i>
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="detail-finanza-empty-cell">Sin pagos registrados</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mobile-cards mobile-only">
                        {finanza.pagos?.length ? finanza.pagos.map((pago) => (
                            <article className="mobile-card" key={`pago-mobile-${pago.id}`}>
                                <div className="mobile-card-head">
                                    <div className="mobile-card-title">{formatDate(pago.fecha_pago || pago.created_at)}</div>
                                    <span className="badge badge-enviado">{pago.metodo || '—'}</span>
                                </div>
                                <div className="mobile-card-grid">
                                    <div className="mobile-field">
                                        <span className="mobile-field-label">Referencia</span>
                                        <span className="mobile-field-value">{pago.referencia || '—'}</span>
                                    </div>
                                    <div className="mobile-field">
                                        <span className="mobile-field-label">Monto</span>
                                        <span className="mobile-field-value"><strong>{formatCurrency(pago.monto)}</strong></span>
                                    </div>
                                </div>
                            </article>
                        )) : (
                            <div className="mobile-card">
                                <p className="mobile-field-value">Sin pagos registrados</p>
                            </div>
                        )}
                    </div>
                </div>
                </div>

                <aside className="pedido-detail-side">
                    <div className="card pedido-detail-info">
                        <div className="card-header">
                            <h3 className="card-title">
                                <i className="bi bi-info-circle" aria-hidden="true"></i>
                                Datos del pedido
                            </h3>
                        </div>
                        <div className="pedido-detail-info-grid detail-finanza-info-grid">
                            <div className="pedido-detail-field">
                                <span className="order-wizard-confirm-label">
                                    <i className="bi bi-building" aria-hidden="true"></i>
                                    Clínica
                                </span>
                                <strong>{finanza.clinica_nombre || '—'}</strong>
                            </div>
                            <div className="pedido-detail-field">
                                <span className="order-wizard-confirm-label">
                                    <i className="bi bi-person" aria-hidden="true"></i>
                                    Paciente
                                </span>
                                <strong>{finanza.paciente_nombre}</strong>
                            </div>
                            <div className="pedido-detail-field">
                                <span className="order-wizard-confirm-label">
                                    <i className="bi bi-calendar3" aria-hidden="true"></i>
                                    Fecha de pedido
                                </span>
                                <strong>{formatDate(finanza.fecha || finanza.created_at)}</strong>
                            </div>
                            <div className="pedido-detail-field">
                                <span className="order-wizard-confirm-label">
                                    <i className="bi bi-calendar-check" aria-hidden="true"></i>
                                    Fecha de entrega
                                </span>
                                <strong>{formatDate(finanza.fecha_entrega)}</strong>
                            </div>
                        </div>
                    </div>
                </aside>

                <div className="card detail-finanza-comprobantes-card pedido-detail-files">
                    {/* Header */}
                    <div className="detail-finanza-section-header">
                        <div className="detail-finanza-section-icon">
                            <i className="bi bi-file-earmark-check-fill detail-finanza-section-icon-mark"></i>
                        </div>
                        <div className="detail-finanza-section-copy">
                            <div className="detail-finanza-section-title">Comprobantes Electrónicos</div>
                            <div className="detail-finanza-section-subtitle">Registrados ante SUNAT</div>
                        </div>
                        <div className="detail-finanza-section-actions">
                            {comprobantes.length > 0 && comprobantes[0] && (
                                <button
                                    className="btn btn-primary btn-sm detail-finanza-action-button detail-finanza-action-button--primary"
                                    onClick={() => handlePrintComprobante(comprobantes[0])}
                                >
                                    <i className="bi bi-printer-fill"></i> Imprimir comprobante
                                </button>
                            )}
                            {comprobantes.length === 0 && (
                                <button
                                    className="btn btn-primary btn-sm detail-finanza-action-button detail-finanza-action-button--primary"
                                    onClick={() => navigate(`/finanzas/${id}/facturar`)}
                                    disabled={finanza.estado_pago !== 'cancelado'}
                                    title={finanza.estado_pago !== 'cancelado' ? 'El pedido debe estar cancelado para emitir comprobantes' : ''}
                                >
                                    <i className="bi bi-file-earmark-text"></i> Emitir Electrónico
                                </button>
                            )}
                        </div>
                    </div>

                    {comprobantes.length === 0 ? (
                        <div className="detail-finanza-comprobantes-empty" role="status">
                            <i className="bi bi-file-earmark-x detail-finanza-comprobantes-empty-icon" aria-hidden="true"></i>
                            <p className="detail-finanza-comprobantes-empty-text">Sin comprobantes electrónicos emitidos</p>
                        </div>
                    ) : (
                    <div className="detail-finanza-comprobantes-scroll">
                        <table className="detail-finanza-comprobantes-table">
                            <thead>
                                <tr>
                                    {['Fecha', 'Tipo', 'Serie-Corre.', 'Total', 'Estado', 'Descargas', 'Acciones'].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {comprobantes.map((comp) => {
                                    const isVoided = comp.estado_sunat === 'anulado';
                                    const isActive = comp.estado_sunat === 'aceptado' || comp.estado_sunat === 'generado';
                                    const isRetryable = comp.estado_sunat === 'error' || comp.estado_sunat === 'generado';
                                    const canFiscalActions = !isVoided && !isRetryable;
                                    const isDemo = !!(comp.pdf_url && (comp.pdf_url.includes('/demo/') || comp.pdf_url.includes('demo.apisperu')));
                                    const isReenviando = reenviandoId === comp.id;
                                    return (
                                        <tr key={comp.id} className={`detail-finanza-comprobante-row${isVoided ? ' is-voided' : ''}`}>
                                            <td>{formatDate(comp.fecha_emision)}</td>
                                            <td>
                                                <span className="detail-finanza-comprobante-type">
                                                    <i className={`bi ${comp.tipo_comprobante === '01' ? 'bi-receipt' : 'bi-file-text'} detail-finanza-icon-tone`}></i>
                                                    {comp.tipo_comprobante === '01' ? 'Factura' : 'Boleta'}
                                                </span>
                                            </td>
                                            <td className="detail-finanza-comprobante-code">{comp.serie}-{comp.correlativo}</td>
                                            <td className="detail-finanza-comprobante-total">{formatCurrency(comp.total_venta)}</td>
                                            <td>
                                                <span className={`badge badge-${isVoided ? 'cancelado' : isActive ? 'enviado' : 'pendiente'}`}>
                                                    {comp.estado_sunat}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="detail-finanza-pill-links">
                                                    {comp.pdf_url && !isDemo && (
                                                        <a href={comp.pdf_url} target="_blank" rel="noreferrer"
                                                            className="detail-finanza-pill-link detail-finanza-pill-link--pdf"
                                                            title="PDF del proveedor SUNAT"
                                                        ><i className="bi bi-filetype-pdf"></i>PDF</a>
                                                    )}
                                                    {comp.xml_url && !isDemo && (
                                                        <a href={comp.xml_url} target="_blank" rel="noreferrer"
                                                            className="detail-finanza-pill-link detail-finanza-pill-link--neutral"
                                                        ><i className="bi bi-code-slash"></i>XML</a>
                                                    )}
                                                    {comp.cdr_url && !isDemo && (
                                                        <a href={comp.cdr_url} target="_blank" rel="noreferrer"
                                                            className="detail-finanza-pill-link detail-finanza-pill-link--neutral"
                                                        ><i className="bi bi-shield-check"></i>CDR</a>
                                                    )}
                                                    {isDemo && (
                                                        <span
                                                            className="detail-finanza-pill-link detail-finanza-pill-link--neutral"
                                                            title="En mock no hay PDF/XML/CDR reales. Usa Imprimir."
                                                            style={{ opacity: 0.7, cursor: 'default' }}
                                                        ><i className="bi bi-info-circle"></i>Mock</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="detail-finanza-action-cell">
                                                <button
                                                    onClick={() => handlePrintComprobante(comp)}
                                                    className="btn btn-sm btn-ghost"
                                                    title="Imprimir comprobante electrónico"
                                                >
                                                    <i className="bi bi-printer"></i> Imprimir
                                                </button>
                                                {isRetryable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReenviarComprobante(comp)}
                                                        disabled={isReenviando || createInvoiceMutation.isPending}
                                                        className="btn btn-sm detail-finanza-retry-btn"
                                                        title="Reenviar este comprobante a SUNAT"
                                                    >
                                                        {isReenviando
                                                            ? <><i className="bi bi-arrow-repeat detail-finanza-spin"></i> Reenviando…</>
                                                            : <><i className="bi bi-send"></i> Reenviar</>}
                                                    </button>
                                                )}
                                                {canFiscalActions && (
                                                    <button
                                                        onClick={() => handleAnularComprobante(comp)}
                                                        disabled={annulInvoiceMutation.isPending}
                                                        className="btn btn-sm detail-finanza-danger-btn"
                                                    >
                                                        <><i className="bi bi-x-circle"></i> Anular</>
                                                    </button>
                                                )}
                                                {canFiscalActions && (
                                                    <button
                                                        onClick={() => handleNotaCredito(comp)}
                                                        disabled={createCreditNoteMutation.isPending}
                                                        className="btn btn-sm detail-finanza-outline-btn"
                                                        title="Emitir Nota de Crédito referenciando este comprobante"
                                                    >
                                                        <i className="bi bi-arrow-counterclockwise"></i> N/C
                                                    </button>
                                                )}
                                                {isVoided && (
                                                    <span className="detail-finanza-muted-italic">Anulado</span>
                                                )}
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

            {/* ── Modales de emisión rápida ──────────────────────── */}
            <BillingConfirmModal
                open={emitirConfirm.open}
                onClose={() => setEmitirConfirm(p => ({ ...p, open: false }))}
                onConfirm={handleConfirmEmitir}
                tipoComprobante={emitirConfirm.tipoComprobante}
                receptorName={finanza?.clinica_nombre || finanza?.paciente_nombre || ''}
                receptorDoc=""
                entorno="beta APISPERU"
                base={parseFloat(finanza?.total || 0) / 1.18}
                igv={parseFloat(finanza?.total || 0) - parseFloat(finanza?.total || 0) / 1.18}
                total={parseFloat(finanza?.total || 0)}
                confirming={createInvoiceMutation.isPending}
            />
            <BillingResultModal
                open={emitirResult.open}
                onClose={() => setEmitirResult({ open: false, status: 'aceptado', data: {} })}
                onRetry={emitirResult.status === 'no_confirmado' ? handleRetryEmitir : undefined}
                status={emitirResult.status}
                {...emitirResult.data}
            />
            <ComprobantePrintModal
                open={printModal.open}
                onClose={() => setPrintModal({ open: false, comprobanteId: null })}
                comprobanteId={printModal.comprobanteId}
            />

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Registrar pago"
                footer={(
                    <>
                        <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                        <button className="btn btn-primary" onClick={submitPago} disabled={registerPaymentMutation.isPending}>
                            {registerPaymentMutation.isPending ? 'Guardando...' : 'Guardar pago'}
                        </button>
                    </>
                )}
            >
                <div className="detail-finanza-form-grid detail-finanza-form-grid--2">
                    <div className="form-group detail-finanza-form-group">
                        <label className="form-label detail-finanza-form-label">
                            <i className="bi bi-cash-coin detail-finanza-form-label-icon"></i> Monto <span className="detail-finanza-required">*</span>
                        </label>
                        <div className="detail-finanza-currency-wrap">
                            <span className="detail-finanza-currency-prefix" aria-hidden="true">S/.</span>
                            <input
                                className="form-input detail-finanza-currency-input"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={form.monto}
                                onChange={(e) => setForm((prev) => ({ ...prev, monto: e.target.value }))}
                                autoFocus
                            />
                        </div>
                        {Number(finanza?.saldo) > 0 && (
                            <p className="detail-finanza-field-hint">
                                Precargado con el saldo pendiente ({formatCurrency(finanza.saldo)}). Puedes editarlo para un pago parcial.
                            </p>
                        )}
                    </div>
                    <div className="form-group detail-finanza-form-group">
                        <label className="form-label detail-finanza-form-label">
                            <i className="bi bi-bank detail-finanza-form-label-icon"></i> Método <span className="detail-finanza-required">*</span>
                        </label>
                        <select
                            className="form-select"
                            value={form.metodo}
                            onChange={(e) => {
                                const nextMetodo = e.target.value;
                                const nextFondo = metodoToFondo(nextMetodo);
                                setForm((prev) => ({ ...prev, metodo: nextMetodo, tipo_fondo: nextFondo }));
                            }}
                        >
                            <option value="transferencia">Transferencia</option>
                            <option value="efectivo">Efectivo</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="yape">Yape / Plin</option>
                        </select>
                    </div>
                </div>

                <div className="detail-finanza-form-grid detail-finanza-form-grid--2">
                    <div className="form-group detail-finanza-form-group">
                        <label className="form-label detail-finanza-form-label">
                            <i className="bi bi-diagram-3 detail-finanza-form-label-icon"></i> Destino de fondos
                        </label>
                        <input
                            className="form-input"
                            value={form.tipo_fondo === 'caja' ? 'Caja (efectivo)' : 'Banco (transferencia / yape / tarjeta)'}
                            disabled
                        />
                    </div>
                    <div className="form-group detail-finanza-form-group">
                        <label className="form-label detail-finanza-form-label">
                            <i className="bi bi-safe2 detail-finanza-form-label-icon"></i> Cuenta
                        </label>
                        <select
                            className="form-select"
                            value={form.cuenta_id}
                            onChange={(e) => setForm((prev) => ({ ...prev, cuenta_id: e.target.value }))}
                        >
                            {cuentasFiltradas.map((cuenta) => (
                                <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="detail-finanza-form-grid detail-finanza-form-grid--2">
                    <div className="form-group detail-finanza-form-group">
                        <label className="form-label detail-finanza-form-label">
                            <i className="bi bi-hash detail-finanza-form-label-icon detail-finanza-form-label-icon--muted"></i> Referencia
                        </label>
                        <input
                            className="form-input"
                            value={form.referencia}
                            onChange={(e) => setForm((prev) => ({ ...prev, referencia: e.target.value }))}
                            placeholder="Nro. operación (opcional)"
                        />
                    </div>
                    <div className="form-group detail-finanza-form-group">
                        <label className="form-label detail-finanza-form-label">
                            <i className="bi bi-calendar-check detail-finanza-form-label-icon"></i> Fecha de pago
                        </label>
                        <input
                            className="form-input"
                            type="date"
                            value={form.fecha_pago || new Date().toISOString().split('T')[0]}
                            onChange={(e) => setForm((prev) => ({ ...prev, fecha_pago: e.target.value }))}
                        />
                    </div>
                </div>

                <div className="form-group detail-finanza-form-group">
                    <label className="form-label detail-finanza-form-label">
                        <i className="bi bi-card-text detail-finanza-form-label-icon detail-finanza-form-label-icon--muted"></i> Notas
                    </label>
                    <textarea
                        value={form.notas}
                        onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
                        placeholder="Detalle adicional u observación sobre este pago (opcional)"
                        className="form-textarea detail-finanza-textarea-md"
                    />
                </div>
            </Modal>

            {/* ── Modal: Anulación con Motivo ──────────────────────── */}
            <Modal
                open={!!anularModal}
                onClose={() => setAnularModal(null)}
                title="Anular Comprobante Electrónico"
                footer={
                    <div className="detail-finanza-modal-footer">
                        <button className="btn btn-ghost" onClick={() => setAnularModal(null)} disabled={annulInvoiceMutation.isPending}>Cancelar</button>
                        <button
                            onClick={submitAnulacion}
                            disabled={annulInvoiceMutation.isPending || anularMotivo.trim().length < 5}
                            className="btn detail-finanza-danger-btn"
                        >
                            {annulInvoiceMutation.isPending
                                ? <><i className="bi bi-hourglass-split"></i> Anulando...</>
                                : <><i className="bi bi-x-circle"></i> Confirmar anulación</>
                            }
                        </button>
                    </div>
                }
            >
                <div className="detail-finanza-warning-panel detail-finanza-warning-panel--danger">
                    <i className="bi bi-exclamation-triangle-fill detail-finanza-warning-panel__icon"></i>
                    <div className="detail-finanza-warning-panel__body">
                        <strong>Solicitud fiscal.</strong> Se enviará una comunicación de baja a SUNAT. El comprobante <strong>{anularModal?.serie}-{anularModal?.correlativo}</strong> solo quedará inactivo cuando SUNAT acepte el ticket.
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label detail-finanza-form-label">
                        <i className="bi bi-chat-left-text detail-finanza-form-label-icon"></i> Motivo de anulación <span className="detail-finanza-required">*</span>
                    </label>
                    <textarea
                        value={anularMotivo}
                        onChange={e => setAnularMotivo(e.target.value)}
                        placeholder="Ej: Error en datos del receptor, monto incorrecto..."
                        className="form-textarea detail-finanza-textarea-md"
                        autoFocus
                    />
                    <div className={`detail-finanza-counter ${anularMotivo.trim().length < 5 ? 'is-invalid' : ''}`}>
                        {anularMotivo.trim().length} car. &mdash; mínimo 5
                    </div>
                </div>
            </Modal>

            {/* ── Modal: Nota de Crédito ──────────────────────────── */}
            <Modal
                open={!!notaCreditoModal}
                onClose={() => setNotaCreditoModal(null)}
                title="Emitir Nota de Crédito"
                footer={
                    <div className="detail-finanza-modal-footer">
                        <button className="btn btn-ghost" onClick={() => setNotaCreditoModal(null)} disabled={createCreditNoteMutation.isPending}>Cancelar</button>
                        <button
                            className="btn btn-primary"
                            onClick={submitNotaCredito}
                            disabled={createCreditNoteMutation.isPending || ncForm.motivo.trim().length < 5}
                        >
                            {createCreditNoteMutation.isPending
                                ? <><i className="bi bi-hourglass-split"></i> Emitiendo...</>
                                : <><i className="bi bi-arrow-counterclockwise"></i> Emitir N/C</>
                            }
                        </button>
                    </div>
                }
            >
                <div className="detail-finanza-warning-panel detail-finanza-warning-panel--info">
                    Comprobante de referencia: <strong>{notaCreditoModal?.serie}-{notaCreditoModal?.correlativo}</strong> &mdash; {formatCurrency(notaCreditoModal?.total_venta)}
                </div>
                <div className="detail-finanza-form-grid detail-finanza-form-grid--2">
                    <div className="form-group detail-finanza-form-group">
                        <label className="form-label detail-finanza-form-label">Monto a anular (S/.) <span className="detail-finanza-required">*</span></label>
                        <input
                            className="form-input"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={ncForm.monto}
                            onChange={e => setNcForm(p => ({ ...p, monto: e.target.value }))}
                        />
                    </div>
                    <div className="form-group detail-finanza-form-group">
                        <label htmlFor="credit-note-reason-code" className="form-label detail-finanza-form-label">Tipo de corrección <span className="detail-finanza-required">*</span></label>
                        <select
                            id="credit-note-reason-code"
                            className="form-select"
                            value={ncForm.codMotivo}
                            onChange={e => setNcForm(p => ({ ...p, codMotivo: e.target.value }))}
                        >
                            <option value="01">Anulación total de la operación</option>
                            <option value="07">Devolución o corrección parcial por ítem</option>
                        </select>
                    </div>
                    <div className="detail-finanza-igv-summary">
                        <span>IGV estimado (18%)</span>
                        <span className="detail-finanza-igv-value">
                            {ncForm.monto && !isNaN(parseFloat(ncForm.monto)) ? formatCurrency(parseFloat(ncForm.monto) / 1.18 * 0.18) : 'S/. 0.00'}
                        </span>
                    </div>
                </div>
                <div className="form-group detail-finanza-form-group">
                    <label className="form-label detail-finanza-form-label">Motivo <span className="detail-finanza-required">*</span></label>
                    <textarea
                        value={ncForm.motivo}
                        onChange={e => setNcForm(p => ({ ...p, motivo: e.target.value }))}
                        placeholder="Ej: Descuento acordado, error en precio, servicio no completado..."
                        className="form-textarea detail-finanza-textarea-sm"
                    />
                </div>
            </Modal>

            <ConfirmDialog
                open={!!reenvioConfirm}
                onClose={() => setReenvioConfirm(null)}
                onConfirm={() => {
                    const comp = reenvioConfirm;
                    setReenvioConfirm(null);
                    if (comp) void reenviarComprobante(comp, { askConfirm: false });
                }}
                variant="primary"
                icon="bi-arrow-repeat"
                title="Reenviar a SUNAT"
                confirmLabel="Reenviar"
                cancelLabel="Cancelar"
                message={(
                    <p>
                        ¿Reenviar <strong>{reenvioConfirm ? `${reenvioConfirm.serie}-${reenvioConfirm.correlativo}` : ''}</strong> a SUNAT?
                    </p>
                )}
            />
        </div>
    );
};

export default DetalleFinanza;
