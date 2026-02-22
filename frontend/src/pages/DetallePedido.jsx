import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../config.js';
import Modal from '../components/Modal.jsx';

const statusLabels = {
    pendiente: 'Pendiente', en_diseno: 'En Diseño', esperando_aprobacion: 'Esperando Aprobación',
    en_produccion: 'En Producción', terminado: 'Terminado', enviado: 'Enviado'
};

const approvalStatusLabels = {
    pendiente: 'Pendiente',
    aprobado: 'Aprobado',
    ajuste_solicitado: 'Ajuste solicitado'
};

const statusFlow = ['pendiente', 'en_diseno', 'esperando_aprobacion', 'en_produccion', 'terminado', 'enviado'];

const DetallePedido = () => {
    const { id } = useParams();
    const { getHeaders, user } = useAuth();
    const navigate = useNavigate();
    const [pedido, setPedido] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [exocadLink, setExocadLink] = useState('');
    const [approvalNote, setApprovalNote] = useState('');
    const [adjustComment, setAdjustComment] = useState('');
    const [adjustPopoverOpen, setAdjustPopoverOpen] = useState(false);
    const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
    const [rollbackState, setRollbackState] = useState('');
    const [rollbackReason, setRollbackReason] = useState('');
    const [forceModalOpen, setForceModalOpen] = useState(false);
    const [forceReason, setForceReason] = useState('');
    const [responsables, setResponsables] = useState([]);
    const [responsableId, setResponsableId] = useState('');
    const [savingResponsable, setSavingResponsable] = useState(false);
    const [deliveryDate, setDeliveryDate] = useState('');
    const [savingDelivery, setSavingDelivery] = useState(false);
    const adjustPopoverRef = useRef(null);
    const adjustButtonRef = useRef(null);
    const adjustTextareaRef = useRef(null);

    const fetchPedido = () => {
        fetch(`${API_URL}/pedidos/${id}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setPedido(data); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchPedido(); }, [id]);

    useEffect(() => {
        if (user?.tipo === 'admin') {
            fetch(`${API_URL}/usuarios?tipo=equipo`, { headers: getHeaders() })
                .then(r => r.json())
                .then(data => setResponsables(data))
                .catch(() => setResponsables([]));
        }
    }, [user?.tipo]);

    useEffect(() => {
        if (pedido?.responsable_id !== undefined) {
            setResponsableId(pedido.responsable_id || '');
        }
    }, [pedido?.responsable_id]);

    useEffect(() => {
        if (pedido?.fecha_entrega) {
            const date = new Date(pedido.fecha_entrega);
            if (!Number.isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                setDeliveryDate(`${year}-${month}-${day}`);
            }
        } else {
            setDeliveryDate('');
        }
    }, [pedido?.fecha_entrega]);

    useEffect(() => {
        if (!adjustPopoverOpen) return;
        const handleOutsideClick = (event) => {
            if (!adjustPopoverRef.current?.contains(event.target)) {
                setAdjustPopoverOpen(false);
            }
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setAdjustPopoverOpen(false);
                adjustButtonRef.current?.focus();
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [adjustPopoverOpen]);

    useEffect(() => {
        if (adjustPopoverOpen) {
            window.setTimeout(() => {
                adjustTextareaRef.current?.focus();
            }, 0);
        }
    }, [adjustPopoverOpen]);

    const changeStatus = async (newStatus, options = {}) => {
        setUpdating(true);
        try {
            const res = await fetch(`${API_URL}/pedidos/${id}/estado`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ estado: newStatus, ...options })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al actualizar estado');
            }
            fetchPedido();
        } catch (err) {
            alert(err.message);
        } finally {
            setUpdating(false);
        }
    };

    const formatDate = (value, withTime = false) => {
        if (!value) return 'Sin definir';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        const options = withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
        return new Intl.DateTimeFormat('es-PE', options).format(date);
    };

    const getDeliveryMeta = () => {
        if (!pedido?.fecha_entrega) return null;
        if (['terminado', 'enviado'].includes(pedido.estado)) {
            return { label: 'Completado', tone: 'success' };
        }
        const delivery = new Date(pedido.fecha_entrega);
        const today = new Date();
        if (Number.isNaN(delivery.getTime())) return null;
        const startDelivery = new Date(delivery.getFullYear(), delivery.getMonth(), delivery.getDate());
        const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffMs = startDelivery - startToday;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: `Atrasado ${Math.abs(diffDays)} dias`, tone: 'danger' };
        if (diffDays === 0) return { label: 'Entrega hoy', tone: 'warning' };
        if (diffDays <= 2) return { label: `En ${diffDays} dias`, tone: 'warning' };
        return { label: `En ${diffDays} dias`, tone: 'info' };
    };

    const submitApprovalLink = async () => {
        if (!exocadLink.trim()) {
            alert('Ingresa el link de Exocad');
            return;
        }
        if (pedido?.estado === 'esperando_aprobacion') {
            setUpdating(true);
            try {
                const res = await fetch(`${API_URL}/pedidos/${id}/aprobacion`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ link_exocad: exocadLink.trim(), comentario: approvalNote.trim() })
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Error al guardar link');
                }
                fetchPedido();
            } catch (err) {
                alert(err.message);
                setUpdating(false);
                return;
            } finally {
                setUpdating(false);
            }
        } else {
            await changeStatus('esperando_aprobacion', {
                link_exocad: exocadLink.trim(),
                comentario: approvalNote.trim()
            });
        }
        setApprovalModalOpen(false);
        setExocadLink('');
        setApprovalNote('');
    };

    const updateApproval = async (estado, comentarioCliente = '') => {
        if (!pedido?.aprobaciones?.length) return;
        if (estado === 'ajuste_solicitado' && !comentarioCliente.trim()) {
            alert('Escribe el motivo del ajuste');
            return false;
        }
        setUpdating(true);
        try {
            const currentApproval = pedido.aprobaciones[0];
            const res = await fetch(`${API_URL}/pedidos/${id}/aprobacion/${currentApproval.id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ estado, comentario_cliente: comentarioCliente })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al responder aprobacion');
            }
            fetchPedido();
            return true;
        } catch (err) {
            alert(err.message);
            return false;
        } finally {
            setUpdating(false);
        }
    };

    const submitAdjustmentRequest = async () => {
        const ok = await updateApproval('ajuste_solicitado', adjustComment);
        if (!ok) return;
        setAdjustComment('');
        setAdjustPopoverOpen(false);
    };

    const saveResponsable = async () => {
        setSavingResponsable(true);
        try {
            const res = await fetch(`${API_URL}/pedidos/${id}/responsable`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ responsable_id: responsableId || null })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al asignar responsable');
            }
            fetchPedido();
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingResponsable(false);
        }
    };

    const saveDeliveryDate = async () => {
        setSavingDelivery(true);
        try {
            const res = await fetch(`${API_URL}/pedidos/${id}/fecha-entrega`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ fecha_entrega: deliveryDate })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al actualizar fecha');
            }
            fetchPedido();
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingDelivery(false);
        }
    };

    if (loading) return (
        <div>
            <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
        </div>
    );

    if (!pedido) return (
        <div className="card">
            <div className="empty-state">
                <i className="bi bi-exclamation-triangle empty-state-icon"></i>
                <h3 className="empty-state-title">Pedido no encontrado</h3>
                <button className="btn btn-primary" onClick={() => navigate('/pedidos')}>Volver a pedidos</button>
            </div>
        </div>
    );

    const currentIdx = statusFlow.indexOf(pedido.estado);
    const nextStatus = currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;
    const isLab = user?.tipo !== 'cliente';
    const isApproval = pedido.estado === 'esperando_aprobacion';
    const deliveryMeta = getDeliveryMeta();
    const itemsCount = (pedido.items || []).reduce((sum, item) => sum + (parseFloat(item.cantidad) || 0), 0);
    const itemsPiecesLabel = itemsCount === 1 ? 'pieza' : 'piezas';
    const finalTotal = pedido.subtotal ?? pedido.total ?? 0;
    const currentApproval = (pedido.aprobaciones || [])[0];
    const approvalLink = currentApproval?.link_exocad;
    const approvalEstado = currentApproval?.estado || 'pendiente';
    const approvalBadgeClass = approvalEstado === 'aprobado'
        ? 'badge-approval-approved'
        : approvalEstado === 'ajuste_solicitado'
            ? 'badge-approval-adjust'
            : 'badge-approval-pending';
    const rollbackOptions = statusFlow.slice(0, Math.max(currentIdx, 0));

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ flexWrap: 'wrap' }}>
                <div className="page-header-left">
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/pedidos')}>
                        <i className="bi bi-arrow-left"></i>
                    </button>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                            {pedido.codigo}
                            <span className={`badge badge-dot badge-${pedido.estado}`}>{statusLabels[pedido.estado]}</span>
                        </h1>
                        <p>Pedido para {pedido.paciente_nombre}</p>
                    </div>
                </div>
                <div className="pedido-actions">
                    {isLab && nextStatus && (
                        <button
                            className="btn btn-accent"
                            onClick={() => (nextStatus === 'esperando_aprobacion' ? setApprovalModalOpen(true) : changeStatus(nextStatus))}
                            disabled={updating}
                        >
                            {updating
                                ? 'Actualizando...'
                                : nextStatus === 'esperando_aprobacion'
                                    ? 'Enviar a Aprobacion'
                                    : `Avanzar a: ${statusLabels[nextStatus]}`}
                            <i className="bi bi-arrow-right"></i>
                        </button>
                    )}
                    {isLab && ['en_diseno', 'esperando_aprobacion'].includes(pedido.estado) && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => { setForceReason(''); setForceModalOpen(true); }}
                            disabled={updating}
                        >
                            <i className="bi bi-skip-forward"></i> Forzar a Produccion
                        </button>
                    )}
                    {isLab && rollbackOptions.length > 0 && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setRollbackState(rollbackOptions[rollbackOptions.length - 1]);
                                setRollbackReason('');
                                setRollbackModalOpen(true);
                            }}
                            disabled={updating}
                        >
                            <i className="bi bi-arrow-counterclockwise"></i> Retroceder
                        </button>
                    )}
                </div>
            </div>

            {/* Status timeline */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="status-timeline">
                    {statusFlow.map((s, i) => (
                        <div key={s} className="status-step">
                            <div
                                className="status-step-dot"
                                style={{
                                    background: i <= currentIdx ? 'var(--color-primary)' : 'var(--color-bg-alt)',
                                    color: i <= currentIdx ? '#fff' : 'var(--color-text-secondary)'
                                }}
                            >
                                {i < currentIdx ? <i className="bi bi-check"></i> : i + 1}
                            </div>
                            <div className="status-step-label" style={{ fontWeight: i === currentIdx ? 700 : 500, color: i === currentIdx ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                                {statusLabels[s]}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
                {/* Left: Details */}
                <div style={{ flex: '1 1 60%', minWidth: 'min(100%, 280px)', maxWidth: '100%' }}>
                    {/* Summary */}
                    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card-header"><h3 className="card-title">Resumen</h3></div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 'var(--space-4)' }}>
                            <div className="detail-metric">
                                <span className="detail-label">Fecha pedido</span>
                                <div className="detail-value">{formatDate(pedido.fecha || pedido.created_at, true)}</div>
                            </div>
                            <div className="detail-metric">
                                <span className="detail-label">Entrega</span>
                                <div className="detail-value">{formatDate(pedido.fecha_entrega)}</div>
                                {deliveryMeta && (
                                    <span className={`date-chip is-${deliveryMeta.tone}`}>
                                        <i className="bi bi-clock"></i> {deliveryMeta.label}
                                    </span>
                                )}
                            </div>
                            <div className="detail-metric">
                                <span className="detail-label">Items</span>
                                <div className="detail-value">
                                    {itemsCount} {itemsPiecesLabel}
                                </div>
                            </div>
                            <div className="detail-metric">
                                <span className="detail-label">Total</span>
                                <div className="detail-value">S/. {parseFloat(finalTotal).toFixed(2)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Patient Info */}
                    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card-header"><h3 className="card-title">Información</h3></div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: 'var(--space-4)' }}>
                            <div><span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Paciente</span><br /><strong>{pedido.paciente_nombre}</strong></div>
                            <div><span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Clínica</span><br /><strong>{pedido.clinica_nombre}</strong></div>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Responsable</span><br />
                                {user?.tipo === 'admin' ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                        <select
                                            className="form-select form-select-sm"
                                            value={responsableId}
                                            onChange={e => setResponsableId(e.target.value)}
                                            style={{ flex: '1 1 180px' }}
                                        >
                                            <option value="">Sin asignar</option>
                                            {responsables.map(r => (
                                                <option key={r.id} value={r.id}>{r.nombre}</option>
                                            ))}
                                        </select>
                                        <button className="btn btn-primary btn-sm btn-commit" onClick={saveResponsable} disabled={savingResponsable}>
                                            <i className="bi bi-check2"></i>
                                            {savingResponsable ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                ) : (
                                    <strong>{pedido.responsable_nombre || 'Sin asignar'}</strong>
                                )}
                            </div>
                            <div><span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Creado por</span><br />{pedido.creador_nombre || 'Sistema'}</div>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Fecha de entrega</span><br />
                                {user?.tipo !== 'cliente' ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                        <input
                                            className="form-input form-input-sm"
                                            type="date"
                                            value={deliveryDate}
                                            onChange={e => setDeliveryDate(e.target.value)}
                                            style={{ flex: '1 1 180px' }}
                                        />
                                        <button className="btn btn-primary btn-sm btn-commit" onClick={saveDeliveryDate} disabled={savingDelivery}>
                                            <i className="bi bi-check2"></i>
                                            {savingDelivery ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                ) : (
                                    <strong>{formatDate(pedido.fecha_entrega)}</strong>
                                )}
                            </div>
                        </div>
                        {pedido.observaciones && (
                            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                                <i className="bi bi-chat-left-text" style={{ marginRight: 8 }}></i>{pedido.observaciones}
                            </div>
                        )}
                    </div>

                    {/* Items */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Items del Pedido</h3>
                            <span className="badge badge-enviado">{itemsCount} {itemsPiecesLabel}</span>
                        </div>
                        <div className="data-table-wrapper table-scroll-dense desktop-only" style={{ border: 'none', overflowX: 'auto' }}>
                            <table className="data-table" style={{ minWidth: '600px' }}>
                                <thead><tr><th>Producto</th><th>Pieza</th><th>Color</th><th>Material</th><th>Cant.</th><th>Subtotal</th></tr></thead>
                                <tbody>
                                    {(pedido.items || []).map((item, i) => (
                                        <tr key={i}>
                                            <td><strong>{item.producto_nombre || `Producto #${item.producto_id}`}</strong></td>
                                            <td style={{ fontFamily: 'var(--font-mono)' }}>{item.pieza_dental || '—'}</td>
                                            <td>{item.color || '—'}</td>
                                            <td>{item.material || '—'}</td>
                                            <td>{item.cantidad}</td>
                                            <td><strong>S/. {(item.cantidad * parseFloat(item.precio_unitario)).toFixed(2)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mobile-cards mobile-only" style={{ marginTop: 'var(--space-3)' }}>
                            {(pedido.items || []).map((item, i) => (
                                <article className="mobile-card" key={`item-mobile-${i}`}>
                                    <div className="mobile-card-head">
                                        <div className="mobile-card-title">{item.producto_nombre || `Producto #${item.producto_id}`}</div>
                                        <span className="badge badge-enviado">{item.cantidad} {parseFloat(item.cantidad) === 1 ? 'pieza' : 'piezas'}</span>
                                    </div>
                                    <div className="mobile-card-grid">
                                        <div className="mobile-field">
                                            <span className="mobile-field-label">Pieza</span>
                                            <span className="mobile-field-value" style={{ fontFamily: 'var(--font-mono)' }}>{item.pieza_dental || '—'}</span>
                                        </div>
                                        <div className="mobile-field">
                                            <span className="mobile-field-label">Color</span>
                                            <span className="mobile-field-value">{item.color || '—'}</span>
                                        </div>
                                        <div className="mobile-field">
                                            <span className="mobile-field-label">Material</span>
                                            <span className="mobile-field-value">{item.material || '—'}</span>
                                        </div>
                                        <div className="mobile-field">
                                            <span className="mobile-field-label">Subtotal</span>
                                            <span className="mobile-field-value"><strong>S/. {(item.cantidad * parseFloat(item.precio_unitario)).toFixed(2)}</strong></span>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                        <div style={{ textAlign: 'right', padding: 'var(--space-4)', fontSize: '1.25rem', fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                            Total: S/. {parseFloat(finalTotal).toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Right: Approval + Timeline */}
                <div style={{ flex: '1 1 30%', minWidth: 'min(100%, 280px)', maxWidth: '100%' }}>
                    {(isApproval || approvalLink) && (
                        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                            <div className="card-header"><h3 className="card-title">Diseño 3D</h3></div>
                            <div className="approval-card">
                                {approvalLink ? (
                                    <div>
                                        <div className="approval-link approval-link-highlight" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                            <i className="bi bi-cube"></i>
                                            <a href={approvalLink} target="_blank" rel="noreferrer" className="btn btn-link-strong btn-sm">
                                                Ver diseño 3D
                                            </a>
                                            <span className={`badge ${approvalBadgeClass}`}>{approvalStatusLabels[approvalEstado] || approvalEstado.replace(/_/g, ' ')}</span>
                                        </div>
                                        {isLab && (
                                            <button className="btn btn-primary btn-sm" onClick={() => setApprovalModalOpen(true)}>
                                                <i className="bi bi-upload"></i> Subir nueva version
                                            </button>
                                        )}
                                        {!isLab && isApproval && (
                                            <div className="approval-actions">
                                                <div className="approval-actions-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                                    <button
                                                        className="btn btn-accent"
                                                        onClick={() => updateApproval('aprobado')}
                                                        disabled={updating}
                                                    >
                                                        <i className="bi bi-check-lg"></i> Aprobar diseño
                                                    </button>
                                                    <div className="approval-popover-wrap" ref={adjustPopoverRef}>
                                                        <button
                                                            ref={adjustButtonRef}
                                                            className="btn btn-secondary"
                                                            onClick={() => setAdjustPopoverOpen(prev => !prev)}
                                                            disabled={updating}
                                                        >
                                                            <i className="bi bi-chat-left-text"></i> Solicitar ajustes
                                                        </button>
                                                        {adjustPopoverOpen && (
                                                            <div className="approval-popover animate-fade-in" role="dialog" aria-label="Solicitar ajustes">
                                                                <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Comentarios de ajustes *</label>
                                                                <textarea
                                                                    ref={adjustTextareaRef}
                                                                    className="form-textarea approval-textarea"
                                                                    placeholder="Describe los cambios que necesitas"
                                                                    value={adjustComment}
                                                                    onChange={e => setAdjustComment(e.target.value)}
                                                                />
                                                                <div className="approval-popover-actions">
                                                                    <button
                                                                        className="btn btn-ghost btn-sm"
                                                                        onClick={() => {
                                                                            setAdjustPopoverOpen(false);
                                                                            setAdjustComment('');
                                                                        }}
                                                                        disabled={updating}
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-secondary btn-sm"
                                                                        onClick={submitAdjustmentRequest}
                                                                        disabled={updating || !adjustComment.trim()}
                                                                    >
                                                                        {updating ? 'Enviando...' : 'Enviar ajustes'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="empty-state" style={{ padding: '1.5rem' }}>
                                        <i className="bi bi-cube empty-state-icon" style={{ fontSize: '2rem' }}></i>
                                        <p className="empty-state-text">Diseño 3D aún no disponible</p>
                                        {isLab && isApproval && (
                                            <button className="btn btn-primary btn-sm" onClick={() => setApprovalModalOpen(true)}>
                                                <i className="bi bi-upload"></i> Agregar link
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="card">
                        <div className="card-header"><h3 className="card-title">Historial</h3></div>
                        {(pedido.timeline || []).length === 0 ? (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <p className="empty-state-text">Sin actividad registrada</p>
                            </div>
                        ) : (
                            <div style={{ position: 'relative', paddingLeft: 20 }}>
                                <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: 'var(--color-border)' }} />
                                {pedido.timeline.map((t, i) => {
                                    const accion = t.accion || (t.estado_nuevo ? `Cambio a ${statusLabels[t.estado_nuevo] || t.estado_nuevo}` : 'Actualizacion');
                                    const detalle = t.detalle || t.comentario;
                                    return (
                                        <div key={i} style={{ position: 'relative', paddingBottom: 'var(--space-4)', paddingLeft: 'var(--space-4)' }}>
                                            <div style={{ position: 'absolute', left: -2, top: 4, width: 12, height: 12, borderRadius: '50%', background: i === 0 ? 'var(--color-primary)' : 'var(--color-border)', border: '2px solid var(--color-bg)' }} />
                                            <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{accion}</div>
                                            {detalle && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{detalle}</div>}
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                                                {new Date(t.created_at).toLocaleString('es-PE')} • {t.usuario_nombre || 'Sistema'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal
                open={approvalModalOpen}
                onClose={() => setApprovalModalOpen(false)}
                title="Enviar a Aprobacion"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setApprovalModalOpen(false)}>Cancelar</button>
                        <button className="btn btn-primary" onClick={submitApprovalLink} disabled={updating}>
                            <i className="bi bi-send"></i> Enviar
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Link Exocad Viewer *</label>
                    <input
                        className="form-input"
                        type="url"
                        placeholder="https://viewer.exocad.com/..."
                        value={exocadLink}
                        onChange={e => setExocadLink(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Nota (opcional)</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Indicaciones para el cliente"
                        value={approvalNote}
                        onChange={e => setApprovalNote(e.target.value)}
                    />
                </div>
            </Modal>

            <Modal
                open={rollbackModalOpen}
                onClose={() => setRollbackModalOpen(false)}
                title="Retroceder estado"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setRollbackModalOpen(false)}>Cancelar</button>
                        <button
                            className="btn btn-primary"
                            onClick={async () => {
                                await changeStatus(rollbackState, { comentario: rollbackReason });
                                setRollbackModalOpen(false);
                            }}
                            disabled={updating || !rollbackReason.trim()}
                        >
                            <i className="bi bi-arrow-counterclockwise"></i> Confirmar
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Estado destino</label>
                    <select
                        className="form-select"
                        value={rollbackState}
                        onChange={e => setRollbackState(e.target.value)}
                    >
                        {rollbackOptions.map(state => (
                            <option key={state} value={state}>{statusLabels[state]}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Motivo *</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Describe el motivo del retroceso"
                        value={rollbackReason}
                        onChange={e => setRollbackReason(e.target.value)}
                    />
                </div>
            </Modal>
            <Modal
                open={forceModalOpen}
                onClose={() => setForceModalOpen(false)}
                title="Forzar avance a produccion"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setForceModalOpen(false)}>Cancelar</button>
                        <button
                            className="btn btn-accent"
                            onClick={async () => {
                                await changeStatus('en_produccion', { comentario: forceReason, forzar: true });
                                setForceModalOpen(false);
                            }}
                            disabled={updating || !forceReason.trim()}
                        >
                            <i className="bi bi-skip-forward"></i> Confirmar
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Motivo *</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Describe por que se avanza sin aprobacion"
                        value={forceReason}
                        onChange={e => setForceReason(e.target.value)}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default DetallePedido;
