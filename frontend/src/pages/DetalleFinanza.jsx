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

const DetalleFinanza = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getHeaders } = useAuth();
    const [finanza, setFinanza] = useState(null);
    const [comprobantes, setComprobantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
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
                body: JSON.stringify(form)
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al registrar pago');
            }
            setModalOpen(false);
            setForm({ monto: '', metodo: 'transferencia', referencia: '', fecha_pago: new Date().toISOString().split('T')[0], notas: '' });
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

    const handlePrint = () => {
        if (!finanza) return;
        const pagosRows = finanza.pagos?.length
            ? finanza.pagos.map((pago) => (
                `<tr>
                    <td>${escapeHtml(formatDate(pago.fecha_pago || pago.created_at))}</td>
                    <td>${escapeHtml(pago.metodo || '—')}</td>
                    <td>${escapeHtml(pago.referencia || '—')}</td>
                    <td style="text-align:right">${formatCurrency(pago.monto)}</td>
                </tr>`
            )).join('')
            : '<tr><td colspan="4" style="text-align:center;color:#64748B;padding:12px 0;">Sin pagos registrados</td></tr>';

        const itemsRows = finanza.items?.length
            ? finanza.items.map((item) => (
                `<tr>
                    <td>${escapeHtml(item.producto_nombre || '—')}</td>
                    <td>${escapeHtml(item.cantidad || 1)}</td>
                    <td style="text-align:right">${formatCurrency(item.precio_unitario)}</td>
                    <td style="text-align:right">${formatCurrency(item.subtotal)}</td>
                </tr>`
            )).join('')
            : '<tr><td colspan="4" style="text-align:center;color:#64748B;padding:12px 0;">Sin items registrados</td></tr>';

        const html = `
            <!doctype html>
            <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Comprobante ${escapeHtml(finanza.codigo)}</title>
                    <style>
                        * { box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; color: #0F172A; margin: 24px; }
                        h1 { font-size: 20px; margin: 0 0 8px; }
                        h2 { font-size: 14px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; }
                        .meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
                        .chip { background: #E2E8F0; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
                        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                        .card { border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px; }
                        .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; }
                        .value { font-size: 13px; font-weight: 600; margin-top: 4px; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th { text-align: left; background: #F1F5F9; padding: 8px; text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; color: #475569; }
                        td { padding: 8px; border-bottom: 1px solid #E2E8F0; }
                        .totals { display: flex; justify-content: flex-end; gap: 16px; margin-top: 12px; }
                        .totals div { text-align: right; }
                        .totals .label { font-size: 10px; }
                        .totals .value { font-size: 14px; }
                        @page { size: A4; margin: 18mm; }
                    </style>
                </head>
                <body>
                    <div class="meta">
                        <div>
                            <h1>Comprobante de Pago</h1>
                            <div class="label">Pedido ${escapeHtml(finanza.codigo)}</div>
                        </div>
                        <div class="chip">${escapeHtml(statusLabels[finanza.estado_pago])}</div>
                    </div>

                    <div class="grid">
                        <div class="card">
                            <div class="label">Paciente</div>
                            <div class="value">${escapeHtml(finanza.paciente_nombre)}</div>
                            <div class="label" style="margin-top:8px;">Clínica</div>
                            <div class="value">${escapeHtml(finanza.clinica_nombre || '—')}</div>
                        </div>
                        <div class="card">
                            <div class="label">Fecha de pedido</div>
                            <div class="value">${escapeHtml(formatDate(finanza.fecha || finanza.created_at))}</div>
                            <div class="label" style="margin-top:8px;">Fecha de emisión</div>
                            <div class="value">${escapeHtml(formatDate(new Date(), true))}</div>
                        </div>
                    </div>

                    <h2>Detalle de pedido</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Cantidad</th>
                                <th style="text-align:right">Precio</th>
                                <th style="text-align:right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsRows}
                        </tbody>
                    </table>

                    <h2>Pagos registrados</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Método</th>
                                <th>Referencia</th>
                                <th style="text-align:right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pagosRows}
                        </tbody>
                    </table>

                    <div class="totals">
                        <div>
                            <div class="label">Total</div>
                            <div class="value">${formatCurrency(finanza.total)}</div>
                        </div>
                        <div>
                            <div class="label">Pagado</div>
                            <div class="value">${formatCurrency(finanza.monto_pagado)}</div>
                        </div>
                        <div>
                            <div class="label">Saldo</div>
                            <div class="value">${formatCurrency(finanza.saldo)}</div>
                        </div>
                    </div>
                </body>
            </html>
        `;

        const printWindow = window.open('', 'PRINT', 'height=900,width=900');
        if (!printWindow) {
            alert('No se pudo abrir la ventana de impresión');
            return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
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
                    <button className="btn btn-ghost" onClick={handlePrint}>
                        <i className="bi bi-printer"></i> Imprimir interno
                    </button>
                    {comprobantes.length > 0 && comprobantes[0].pdf_url && (
                        <button
                            className="btn btn-primary"
                            onClick={() => handlePrintComprobante(comprobantes[0])}
                            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #0d9488))', boxShadow: '0 4px 12px rgba(20,184,166,0.35)' }}
                        >
                            <i className="bi bi-file-earmark-pdf-fill"></i> Imprimir Comprobante
                        </button>
                    )}
                    {comprobantes.length === 0 && (
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate(`/finanzas/${id}/facturar`)}
                            disabled={finanza.estado_pago !== 'cancelado'}
                            title={finanza.estado_pago !== 'cancelado' ? 'El pedido debe estar cancelado en su totalidad para emitir comprobantes a SUNAT' : ''}
                        >
                            <i className="bi bi-file-earmark-text"></i> Emitir Electrónico
                        </button>
                    )}
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

            {comprobantes.length > 0 && (
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
                            {comprobantes[0]?.pdf_url && (
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
                                {comprobantes.map((comp) => {
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
            )}

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
                            onChange={(e) => setForm((prev) => ({ ...prev, metodo: e.target.value }))}
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
