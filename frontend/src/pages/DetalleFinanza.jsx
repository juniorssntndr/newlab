import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';
import Modal from '../components/Modal.jsx';

const statusLabels = {
    por_cancelar: 'Por cancelar',
    pago_parcial: 'Pago parcial',
    cancelado: 'Cancelado'
};

const metodoToFondo = (metodo = '') => (String(metodo).toLowerCase() === 'efectivo' ? 'caja' : 'banco');

const DetalleFinanza = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getHeaders } = useAuth();
    const [finanza, setFinanza] = useState(null);
    const [comprobantes, setComprobantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [catalogos, setCatalogos] = useState({ cuentas: [] });
    const [modalOpen, setModalOpen] = useState(false);
    const [printMenuOpen, setPrintMenuOpen] = useState(false);
    const [savingPago, setSavingPago] = useState(false);
    const [emitting, setEmitting] = useState(false);
    const [anulando, setAnulando] = useState(false);
    const [anularModal, setAnularModal] = useState(null); // comp object | null
    const [anularMotivo, setAnularMotivo] = useState('');
    const [notaCreditoModal, setNotaCreditoModal] = useState(null); // comp object | null
    const [ncForm, setNcForm] = useState({ motivo: '', monto: '' });
    const [savingNC, setSavingNC] = useState(false);
    const [form, setForm] = useState({
        monto: '',
        metodo: 'transferencia',
        tipo_fondo: 'banco',
        cuenta_id: '',
        referencia: '',
        fecha_pago: new Date().toISOString().split('T')[0],
        notas: ''
    });

    const fetchFinanza = () => {
        Promise.all([
            fetch(`${API_URL}/finanzas/${id}`, { headers: getHeaders() }).then(r => r.json()),
            fetch(`${API_URL}/facturacion/${id}`, { headers: getHeaders() }).then(r => r.json()).catch(() => [])
        ])
            .then(([finanzaData, comprobantesData]) => {
                setFinanza(finanzaData);
                setComprobantes(Array.isArray(comprobantesData) ? comprobantesData : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchFinanza(); }, [id]);

    useEffect(() => {
        fetch(`${API_URL}/finanzas/catalogos`, { headers: getHeaders() })
            .then((r) => r.json())
            .then((data) => {
                const cuentas = Array.isArray(data?.cuentas) ? data.cuentas : [];
                setCatalogos({ cuentas });
            })
            .catch(() => setCatalogos({ cuentas: [] }));
    }, [getHeaders]);

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

    const submitPago = async () => {
        if (!form.monto || Number.isNaN(parseFloat(form.monto))) {
            alert('Ingresa un monto válido');
            return;
        }
        setSavingPago(true);
        try {
            const res = await fetch(`${API_URL}/finanzas/${id}/pagos`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    ...form,
                    cuenta_id: form.cuenta_id ? parseInt(form.cuenta_id, 10) : null
                })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al registrar pago');
            }
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
            fetchFinanza();
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingPago(false);
        }
    };

    const handleEmitir = async (tipoComprobante) => {
        if (!window.confirm(`¿Seguro que deseas emitir ${tipoComprobante === '01' ? 'Factura' : 'Boleta'} electrónica a la SUNAT?`)) return;
        setEmitting(true);
        try {
            const res = await fetch(`${API_URL}/facturacion/${id}/emitir`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ tipoComprobante })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al emitir comprobante');
            alert('Comprobante emitido con éxito');
            fetchFinanza();
        } catch (err) {
            alert(err.message);
        } finally {
            setEmitting(false);
        }
    };

    const handleAnularComprobante = (comp) => {
        setAnularMotivo('');
        setAnularModal(comp);
    };

    const submitAnulacion = async () => {
        if (!anularModal) return;
        if (anularMotivo.trim().length < 5) { alert('El motivo debe tener al menos 5 caracteres.'); return; }
        setAnulando(true);
        try {
            const res = await fetch(`${API_URL}/facturacion/${anularModal.id}/anular`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ motivo: anularMotivo.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al anular comprobante');
            setAnularModal(null);
            fetchFinanza();
        } catch (err) {
            alert(err.message);
        } finally {
            setAnulando(false);
        }
    };

    const handleNotaCredito = (comp) => {
        setNcForm({ motivo: '', monto: String(comp.total_venta || '') });
        setNotaCreditoModal(comp);
    };

    const submitNotaCredito = async () => {
        if (!notaCreditoModal) return;
        if (ncForm.motivo.trim().length < 5) { alert('El motivo debe tener al menos 5 caracteres.'); return; }
        if (!ncForm.monto || isNaN(parseFloat(ncForm.monto)) || parseFloat(ncForm.monto) <= 0) {
            alert('Ingresa un monto válido mayor a 0.'); return;
        }
        setSavingNC(true);
        try {
            const res = await fetch(`${API_URL}/facturacion/${notaCreditoModal.id}/nota-credito`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ motivo: ncForm.motivo.trim(), monto: parseFloat(ncForm.monto) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al emitir nota de crédito');
            setNotaCreditoModal(null);
            fetchFinanza();
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingNC(false);
        }
    };

    const handlePrintComprobante = (comp) => {
        if (comp.pdf_url) {
            window.open(comp.pdf_url, '_blank');
        } else {
            alert('El PDF del comprobante aún no está disponible.');
        }
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

        const html = `
<!doctype html><html><head><meta charset="utf-8" />
<title>Comprobante ${escapeHtml(finanza.codigo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0F172A; background: #fff; }
  .page { max-width: 190mm; margin: 0 auto; padding: 16mm 14mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 3px solid #0d9488; margin-bottom: 18px; }
  .header-brand { font-size: 22px; font-weight: 800; color: #0d9488; letter-spacing: -0.5px; }
  .header-brand span { display: block; font-size: 11px; font-weight: 400; color: #64748B; letter-spacing: 0; margin-top: 2px; }
  .header-doc { text-align: right; }
  .header-doc .doc-type { font-size: 15px; font-weight: 700; color: #0F172A; }
  .header-doc .doc-code { font-size: 12px; color: #64748B; margin-top: 2px; font-family: monospace; }
  .chip { display: inline-block; background: #f0fdf4; color: #15803d; border: 1px solid #86efac; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; margin-top: 6px; }
  .chip.por_cancelar { background: #fefce8; color: #854d0e; border-color: #fde047; }
  .chip.pago_parcial { background: #fff7ed; color: #9a3412; border-color: #fdba74; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748B; margin: 18px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #E2E8F0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 4px; }
  .info-block .ib-label { font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; }
  .info-block .ib-value { font-size: 12.5px; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  thead tr { background: #F8FAFC; border-top: 1px solid #E2E8F0; border-bottom: 2px solid #E2E8F0; }
  th { padding: 7px 10px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
  td { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; }
  tbody tr:last-child td { border-bottom: none; }
  .totals-box { margin-top: 16px; display: flex; justify-content: flex-end; }
  .totals-inner { min-width: 220px; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 12px; border-bottom: 1px solid #F1F5F9; }
  .totals-row:last-child { border-bottom: none; background: #F0FDFA; font-size: 14px; font-weight: 700; color: #0d9488; }
  .totals-row .t-label { color: #64748B; font-size: inherit; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px dashed #CBD5E1; text-align: center; font-size: 10px; color: #94A3B8; }
  @page { size: A4; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="header-brand">NewLab<span>Laboratorio Dental</span></div>
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

  <div class="footer">Documento interno — No válido como comprobante de pago tributario &nbsp;·&nbsp; NewLab Dental &nbsp;·&nbsp; ${escapeHtml(formatDate(new Date(), true))}</div>
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
        const dashes = '--------------------------------';

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

        const html = `
<!doctype html><html><head><meta charset="utf-8" />
<title>Ticket ${escapeHtml(finanza.codigo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; background: #fff; width: 80mm; margin: 0 auto; padding: 4mm 3mm 8mm; }
  .center { text-align: center; }
  .brand { font-size: 18px; font-weight: 900; letter-spacing: 1px; margin-bottom: 2px; }
  .sub { font-size: 10px; margin-bottom: 2px; }
  .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .section { font-size: 10px; font-weight: 700; text-transform: uppercase; margin: 5px 0 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  td { padding: 2px 0; vertical-align: top; }
  .row-bold { font-weight: 700; font-size: 13px; }
  .total-row { font-size: 14px; font-weight: 900; }
  .footer-note { font-size: 9.5px; text-align: center; margin-top: 8px; color: #333; }
  @page { size: 80mm auto; margin: 0; }
  @media print { body { width: 80mm; } }
</style></head><body>
<div class="center">
  <div class="brand">NEWLAB</div>
  <div class="sub">Laboratorio Dental</div>
</div>
<hr class="divider">
<div class="center">
  <div style="font-size:11px;font-weight:700">COMPROBANTE INTERNO</div>
  <div style="font-size:11px">${escapeHtml(finanza.codigo)}</div>
</div>
<hr class="divider">
<table>
  <tr><td style="font-size:10px;color:#444">PACIENTE</td><td style="text-align:right;font-size:10px;color:#444">FECHA EMI.</td></tr>
  <tr><td style="font-weight:600">${escapeHtml(finanza.paciente_nombre)}</td><td style="text-align:right">${escapeHtml(formatDate(new Date()))}</td></tr>
  <tr><td style="font-size:10px;color:#444;padding-top:4px">CLÍNICA</td></tr>
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
<div class="footer-note">¡Gracias por su confianza!</div>
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
            <div className="card">
                <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
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
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Detalle de finanzas</h1>
                    <p>Pedido {finanza.codigo} · {finanza.paciente_nombre}</p>
                </div>
                <div className="pedido-actions">
                    <button className="btn btn-ghost" onClick={() => navigate('/finanzas')}>
                        <i className="bi bi-arrow-left"></i> Volver
                    </button>
                    <div style={{ position: 'relative' }}>
                        <button className="btn btn-ghost" onClick={() => setPrintMenuOpen(p => !p)}>
                            <i className="bi bi-printer"></i> Imprimir interno <i className="bi bi-chevron-down" style={{ fontSize: '0.7rem', marginLeft: 2 }}></i>
                        </button>
                        {printMenuOpen && (
                            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '200px', overflow: 'hidden' }}>
                                <button className="btn btn-ghost" onClick={handlePrintA4}
                                    style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '0.65rem 1rem', gap: '0.6rem', borderBottom: '1px solid var(--color-border)' }}>
                                    <i className="bi bi-file-earmark-text" style={{ color: 'var(--color-primary)' }}></i>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Formato A4</div>
                                        <div style={{ fontSize: '0.73rem', color: 'var(--color-text-secondary)' }}>Impresora estándar</div>
                                    </div>
                                </button>
                                <button className="btn btn-ghost" onClick={handlePrint80mm}
                                    style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, padding: '0.65rem 1rem', gap: '0.6rem' }}>
                                    <i className="bi bi-receipt" style={{ color: 'var(--color-primary)' }}></i>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Ticketera 80mm</div>
                                        <div style={{ fontSize: '0.73rem', color: 'var(--color-text-secondary)' }}>Impresora térmica</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                    {finanza.estado_pago !== 'cancelado' && (
                        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                            <i className="bi bi-plus-lg"></i> Registrar pago
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-4" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="detail-metric">
                    <span className="detail-label">Estado de pago</span>
                    <span className="detail-value">
                        <span className={`badge badge-dot badge-${finanza.estado_pago}`}>{statusLabels[finanza.estado_pago]}</span>
                    </span>
                </div>
                <div className="detail-metric">
                    <span className="detail-label">Total</span>
                    <span className="detail-value">{formatCurrency(finanza.total)}</span>
                </div>
                <div className="detail-metric">
                    <span className="detail-label">Pagado</span>
                    <span className="detail-value">{formatCurrency(finanza.monto_pagado)}</span>
                </div>
                <div className="detail-metric">
                    <span className="detail-label">Saldo</span>
                    <span className="detail-value">{formatCurrency(finanza.saldo)}</span>
                    {saldoMeta && <span className={`date-chip is-${saldoMeta.tone}`}>{saldoMeta.label}</span>}
                </div>
                <div className="detail-metric">
                    <span className="detail-label">Pagado en caja</span>
                    <span className="detail-value">{formatCurrency(finanza.monto_pagado_caja)}</span>
                </div>
                <div className="detail-metric">
                    <span className="detail-label">Pagado en bancos</span>
                    <span className="detail-value">{formatCurrency(finanza.monto_pagado_bancos)}</span>
                </div>
            </div>

            <div className="grid grid-cols-2" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Datos del pedido</h3>
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        <div>
                            <div className="detail-label">Clínica</div>
                            <div className="detail-value">{finanza.clinica_nombre || '—'}</div>
                        </div>
                        <div>
                            <div className="detail-label">Paciente</div>
                            <div className="detail-value">{finanza.paciente_nombre}</div>
                        </div>
                        <div>
                            <div className="detail-label">Fecha de pedido</div>
                            <div className="detail-value">{formatDate(finanza.fecha || finanza.created_at)}</div>
                        </div>
                        <div>
                            <div className="detail-label">Fecha de entrega</div>
                            <div className="detail-value">{formatDate(finanza.fecha_entrega)}</div>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Resumen de pagos</h3>
                    <div className="data-table-wrapper table-scroll-dense desktop-only" style={{ border: 'none' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Método</th>
                                    <th>Fondo</th>
                                    <th>Cuenta</th>
                                    <th>Referencia</th>
                                    <th>Monto</th>
                                    <th style={{ width: '50px' }}></th>
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
                                        <td style={{ textAlign: 'center' }}>
                                            <button
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
                                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Sin pagos registrados</td>
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

            <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 0, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg-alt) 100%)' }}>
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '8px', background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="bi bi-file-earmark-check-fill" style={{ color: 'var(--color-primary)', fontSize: '1rem' }}></i>
                        </div>
                        <div>
                            <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>Comprobantes Electrónicos</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Registrados ante SUNAT</div>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                            {comprobantes.length > 0 && comprobantes[0]?.pdf_url && (
                                <a
                                    href={comprobantes[0].pdf_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-primary btn-sm"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, var(--color-primary), #0d9488)', boxShadow: '0 4px 12px rgba(20,184,166,0.3)', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: '600', textDecoration: 'none', color: '#fff', fontSize: '0.85rem' }}
                                >
                                    <i className="bi bi-file-earmark-pdf-fill"></i> Imprimir / Ver PDF
                                </a>
                            )}
                            {comprobantes.length === 0 && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => navigate(`/finanzas/${id}/facturar`)}
                                    disabled={finanza.estado_pago !== 'cancelado'}
                                    title={finanza.estado_pago !== 'cancelado' ? 'El pedido debe estar cancelado para emitir comprobantes' : ''}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, var(--color-primary), #0d9488)', boxShadow: '0 4px 12px rgba(20,184,166,0.3)', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: '600', fontSize: '0.85rem' }}
                                >
                                    <i className="bi bi-file-earmark-text"></i> Emitir Electrónico
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--color-bg-alt)', borderBottom: '2px solid var(--color-border)' }}>
                                    {['Fecha', 'Tipo', 'Serie-Corre.', 'Total', 'Estado', 'Descargas', 'Acciones'].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: h === 'Total' || h === 'Acciones' ? 'right' : 'left', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {comprobantes.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                                            <i className="bi bi-file-earmark-x" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem', opacity: 0.4 }}></i>
                                            Sin comprobantes electrónicos emitidos
                                        </td>
                                    </tr>
                                ) : comprobantes.map((comp) => {
                                    const isVoided = comp.estado_sunat === 'anulado';
                                    const isActive = comp.estado_sunat === 'aceptado' || comp.estado_sunat === 'generado';
                                    return (
                                        <tr key={comp.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: isVoided ? 0.55 : 1, transition: 'opacity 0.2s' }}>
                                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>{formatDate(comp.fecha_emision)}</td>
                                            <td style={{ padding: '0.875rem 1rem' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: '600', fontSize: '0.85rem' }}>
                                                    <i className={`bi ${comp.tipo_comprobante === '01' ? 'bi-receipt' : 'bi-file-text'}`} style={{ color: 'var(--color-primary)' }}></i>
                                                    {comp.tipo_comprobante === '01' ? 'Factura' : 'Boleta'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontWeight: '600', fontSize: '0.9rem' }}>{comp.serie}-{comp.correlativo}</td>
                                            <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: '700', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(comp.total_venta)}</td>
                                            <td style={{ padding: '0.875rem 1rem' }}>
                                                <span className={`badge badge-${isVoided ? 'cancelado' : isActive ? 'enviado' : 'pendiente'}`}>
                                                    {comp.estado_sunat}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem' }}>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {comp.pdf_url && (
                                                        <a href={comp.pdf_url} target="_blank" rel="noreferrer"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-primary)', textDecoration: 'none', background: 'rgba(20,184,166,0.06)' }}
                                                        ><i className="bi bi-filetype-pdf"></i>PDF</a>
                                                    )}
                                                    {comp.xml_url && (
                                                        <a href={comp.xml_url} target="_blank" rel="noreferrer"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
                                                        ><i className="bi bi-code-slash"></i>XML</a>
                                                    )}
                                                    {comp.cdr_url && (
                                                        <a href={comp.cdr_url} target="_blank" rel="noreferrer"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
                                                        ><i className="bi bi-shield-check"></i>CDR</a>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                                                {!isVoided && (
                                                    <button
                                                        className="btn btn-sm"
                                                        onClick={() => handleAnularComprobante(comp)}
                                                        disabled={anulando}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '7px', border: '1px solid #ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.06)', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = '#ef4444'; }}
                                                    >
                                                        <><i className="bi bi-x-circle"></i> Anular</>
                                                    </button>
                                                )}
                                                {!isVoided && (
                                                    <button
                                                        className="btn btn-sm"
                                                        onClick={() => handleNotaCredito(comp)}
                                                        disabled={savingNC}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', background: 'transparent', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', marginLeft: '4px' }}
                                                        title="Emitir Nota de Crédito referenciando este comprobante"
                                                    >
                                                        <i className="bi bi-arrow-counterclockwise"></i> N/C
                                                    </button>
                                                )}
                                                {isVoided && (
                                                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Anulado</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
            </div>

            <div className="card">
                <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Detalle de items</h3>
                <div className="data-table-wrapper table-scroll-dense desktop-only" style={{ border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Cantidad</th>
                                <th>Precio</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finanza.items?.length ? finanza.items.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.producto_nombre || '—'}</td>
                                    <td>{item.cantidad || 1}</td>
                                    <td>{formatCurrency(item.precio_unitario)}</td>
                                    <td><strong>{formatCurrency(item.subtotal)}</strong></td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Sin items registrados</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mobile-cards mobile-only">
                    {finanza.items?.length ? finanza.items.map((item) => (
                        <article className="mobile-card" key={`item-mobile-${item.id}`}>
                            <div className="mobile-card-head">
                                <div className="mobile-card-title">{item.producto_nombre || '—'}</div>
                                <span className="badge badge-enviado">{item.cantidad || 1}</span>
                            </div>
                            <div className="mobile-card-grid">
                                <div className="mobile-field">
                                    <span className="mobile-field-label">Precio</span>
                                    <span className="mobile-field-value">{formatCurrency(item.precio_unitario)}</span>
                                </div>
                                <div className="mobile-field">
                                    <span className="mobile-field-label">Subtotal</span>
                                    <span className="mobile-field-value"><strong>{formatCurrency(item.subtotal)}</strong></span>
                                </div>
                            </div>
                        </article>
                    )) : (
                        <div className="mobile-card">
                            <p className="mobile-field-value">Sin items registrados</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Registrar pago"
                footer={(
                    <>
                        <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                        <button className="btn btn-primary" onClick={submitPago} disabled={savingPago}>
                            {savingPago ? 'Guardando...' : 'Guardar pago'}
                        </button>
                    </>
                )}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="bi bi-cash-coin" style={{ color: 'var(--color-primary)' }}></i> Monto <span style={{ color: 'red' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>S/.</span>
                            <input
                                className="form-input"
                                style={{ paddingLeft: '2.5rem', fontWeight: 'bold', fontSize: '1.05rem' }}
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={form.monto}
                                onChange={(e) => setForm((prev) => ({ ...prev, monto: e.target.value }))}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="bi bi-bank" style={{ color: 'var(--color-primary)' }}></i> Método <span style={{ color: 'red' }}>*</span>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="bi bi-diagram-3" style={{ color: 'var(--color-primary)' }}></i> Destino de fondos
                        </label>
                        <input
                            className="form-input"
                            value={form.tipo_fondo === 'caja' ? 'Caja (efectivo)' : 'Banco (transferencia / yape / tarjeta)'}
                            disabled
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="bi bi-safe2" style={{ color: 'var(--color-primary)' }}></i> Cuenta
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

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="bi bi-hash" style={{ color: 'var(--color-text-tertiary)' }}></i> Referencia
                        </label>
                        <input
                            className="form-input"
                            value={form.referencia}
                            onChange={(e) => setForm((prev) => ({ ...prev, referencia: e.target.value }))}
                            placeholder="Nro. operación (opcional)"
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="bi bi-calendar-check" style={{ color: 'var(--color-primary)' }}></i> Fecha de pago
                        </label>
                        <input
                            className="form-input"
                            type="date"
                            value={form.fecha_pago || new Date().toISOString().split('T')[0]}
                            onChange={(e) => setForm((prev) => ({ ...prev, fecha_pago: e.target.value }))}
                        />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <i className="bi bi-card-text" style={{ color: 'var(--color-text-tertiary)' }}></i> Notas
                    </label>
                    <textarea
                        className="form-textarea"
                        value={form.notas}
                        onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
                        placeholder="Detalle adicional u observación sobre este pago (opcional)"
                        style={{ minHeight: '80px' }}
                    />
                </div>
            </Modal>

            {/* ── Modal: Anulación con Motivo ──────────────────────── */}
            <Modal
                isOpen={!!anularModal}
                onClose={() => setAnularModal(null)}
                title="Anular Comprobante Electrónico"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" onClick={() => setAnularModal(null)} disabled={anulando}>Cancelar</button>
                        <button
                            className="btn"
                            onClick={submitAnulacion}
                            disabled={anulando || anularMotivo.trim().length < 5}
                            style={{ background: '#ef4444', color: '#fff', border: 'none', fontWeight: '600' }}
                        >
                            {anulando
                                ? <><i className="bi bi-hourglass-split"></i> Anulando...</>
                                : <><i className="bi bi-x-circle"></i> Confirmar anulación</>
                            }
                        </button>
                    </div>
                }
            >
                <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid #fca5a5', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <i className="bi bi-exclamation-triangle-fill" style={{ color: '#ef4444', fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}></i>
                    <div style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                        <strong>Acción irreversible.</strong> Esta anulación se comunicará a SUNAT. Comprobante <strong>{anularModal?.serie}-{anularModal?.correlativo}</strong> quedará inactivo.
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">
                        <i className="bi bi-chat-left-text" style={{ color: 'var(--color-primary)' }}></i> Motivo de anulación <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                        className="form-textarea"
                        value={anularMotivo}
                        onChange={e => setAnularMotivo(e.target.value)}
                        placeholder="Ej: Error en datos del receptor, monto incorrecto..."
                        style={{ minHeight: '80px' }}
                        autoFocus
                    />
                    <div style={{ fontSize: '0.75rem', color: anularMotivo.trim().length < 5 ? '#ef4444' : 'var(--color-text-tertiary)', marginTop: '4px' }}>
                        {anularMotivo.trim().length} car. &mdash; mínimo 5
                    </div>
                </div>
            </Modal>

            {/* ── Modal: Nota de Crédito ──────────────────────────── */}
            <Modal
                isOpen={!!notaCreditoModal}
                onClose={() => setNotaCreditoModal(null)}
                title="Emitir Nota de Crédito"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" onClick={() => setNotaCreditoModal(null)} disabled={savingNC}>Cancelar</button>
                        <button
                            className="btn btn-primary"
                            onClick={submitNotaCredito}
                            disabled={savingNC || ncForm.motivo.trim().length < 5}
                        >
                            {savingNC
                                ? <><i className="bi bi-hourglass-split"></i> Emitiendo...</>
                                : <><i className="bi bi-arrow-counterclockwise"></i> Emitir N/C</>
                            }
                        </button>
                    </div>
                }
            >
                <div style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.25)', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                    Comprobante de referencia: <strong>{notaCreditoModal?.serie}-{notaCreditoModal?.correlativo}</strong> &mdash; {formatCurrency(notaCreditoModal?.total_venta)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Monto a anular (S/.) <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                            className="form-input"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={ncForm.monto}
                            onChange={e => setNcForm(p => ({ ...p, monto: e.target.value }))}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', fontSize: '0.8rem', color: 'var(--color-text-tertiary)', paddingBottom: '4px' }}>
                        <span>IGV estimado (18%)</span>
                        <span style={{ fontWeight: '700', color: 'var(--color-primary)', fontSize: '1rem' }}>
                            {ncForm.monto && !isNaN(parseFloat(ncForm.monto)) ? formatCurrency(parseFloat(ncForm.monto) / 1.18 * 0.18) : 'S/. 0.00'}
                        </span>
                    </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Motivo <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea
                        className="form-textarea"
                        value={ncForm.motivo}
                        onChange={e => setNcForm(p => ({ ...p, motivo: e.target.value }))}
                        placeholder="Ej: Descuento acordado, error en precio, servicio no completado..."
                        style={{ minHeight: '70px' }}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default DetalleFinanza;
