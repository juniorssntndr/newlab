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
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [savingPago, setSavingPago] = useState(false);
    const [form, setForm] = useState({
        monto: '',
        metodo: 'transferencia',
        referencia: '',
        fecha_pago: '',
        notas: ''
    });

    const fetchFinanza = () => {
        fetch(`${API_URL}/finanzas/${id}`, { headers: getHeaders() })
            .then((r) => r.json())
            .then((data) => { setFinanza(data); setLoading(false); })
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
            setForm({ monto: '', metodo: 'transferencia', referencia: '', fecha_pago: '', notas: '' });
            fetchFinanza();
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingPago(false);
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
                        <i className="bi bi-printer"></i> Imprimir comprobante
                    </button>
                    <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                        <i className="bi bi-plus-lg"></i> Registrar pago
                    </button>
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
                                </tr>
                            </thead>
                            <tbody>
                                {finanza.pagos?.length ? finanza.pagos.map((pago) => (
                                    <tr key={pago.id}>
                                        <td>{formatDate(pago.fecha_pago || pago.created_at)}</td>
                                        <td>{pago.metodo || '—'}</td>
                                        <td>{pago.referencia || '—'}</td>
                                        <td><strong>{formatCurrency(pago.monto)}</strong></td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Sin pagos registrados</td>
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
                <div className="form-group">
                    <label className="form-label">Monto</label>
                    <input
                        className="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.monto}
                        onChange={(e) => setForm((prev) => ({ ...prev, monto: e.target.value }))}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Método</label>
                    <select
                        className="form-select"
                        value={form.metodo}
                        onChange={(e) => setForm((prev) => ({ ...prev, metodo: e.target.value }))}
                    >
                        <option value="transferencia">Transferencia</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Referencia</label>
                    <input
                        className="form-input"
                        value={form.referencia}
                        onChange={(e) => setForm((prev) => ({ ...prev, referencia: e.target.value }))}
                        placeholder="Nro. operación (opcional)"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Fecha de pago</label>
                    <input
                        className="form-input"
                        type="date"
                        value={form.fecha_pago}
                        onChange={(e) => setForm((prev) => ({ ...prev, fecha_pago: e.target.value }))}
                    />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Notas</label>
                    <textarea
                        className="form-textarea"
                        value={form.notas}
                        onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
                        placeholder="Detalle adicional (opcional)"
                    />
                </div>
            </Modal>
        </div>
    );
};

export default DetalleFinanza;
