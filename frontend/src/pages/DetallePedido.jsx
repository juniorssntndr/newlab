import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../config.js';
import Modal from '../components/Modal.jsx';

const statusLabels = {
    pendiente: 'Pendiente', en_diseno: 'En Diseño', esperando_aprobacion: 'Esperando Aprobación',
    en_produccion: 'En Producción', terminado: 'Terminado', enviado: 'Enviado'
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
    const [approvalComment, setApprovalComment] = useState('');
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
            return;
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
            setApprovalComment('');
            fetchPedido();
        } catch (err) {
            alert(err.message);
        } finally {
            setUpdating(false);
        }
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
    const rollbackOptions = statusFlow.slice(0, Math.max(currentIdx, 0));

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/pedidos')}>
                        <i className="bi bi-arrow-left"></i>
                    </button>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
                    {statusFlow.map((s, i) => (
                        <React.Fragment key={s}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: '50%', margin: '0 auto var(--space-2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.75rem', fontWeight: 700,
                                    background: i <= currentIdx ? 'var(--color-primary)' : 'var(--color-bg-alt)',
                                    color: i <= currentIdx ? '#fff' : 'var(--color-text-secondary)',
                                    transition: 'all 0.3s ease'
                                }}>
                                    {i < currentIdx ? <i className="bi bi-check"></i> : i + 1}
                                </div>
                                <div style={{ fontSize: '0.6875rem', fontWeight: i === currentIdx ? 700 : 400, color: i === currentIdx ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                                    {statusLabels[s]}
                                </div>
                            </div>
                            {i < statusFlow.length - 1 && (
                                <div style={{
                                    flex: 0.5, height: 2, borderRadius: 1,
                                    background: i < currentIdx ? 'var(--color-primary)' : 'var(--color-border)',
                                    transition: 'all 0.3s ease'
                                }} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-3" style={{ gap: 'var(--space-6)' }}>
                {/* Left: Details */}
                <div style={{ gridColumn: 'span 2' }}>
                    {/* Summary */}
                    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card-header"><h3 className="card-title">Resumen</h3></div>
                        <div className="grid grid-cols-4">
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
                        <div className="grid grid-cols-2">
                            <div><span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Paciente</span><br /><strong>{pedido.paciente_nombre}</strong></div>
                            <div><span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Clínica</span><br /><strong>{pedido.clinica_nombre}</strong></div>
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Responsable</span><br />
                                {user?.tipo === 'admin' ? (
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                        <select
                                            className="form-select form-select-sm"
                                            value={responsableId}
                                            onChange={e => setResponsableId(e.target.value)}
                                        >
                                            <option value="">Sin asignar</option>
                                            {responsables.map(r => (
                                                <option key={r.id} value={r.id}>{r.nombre}</option>
                                            ))}
                                        </select>
                                        <button className="btn btn-ghost btn-sm" onClick={saveResponsable} disabled={savingResponsable}>
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
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                        <input
                                            className="form-input form-input-sm"
                                            type="date"
                                            value={deliveryDate}
                                            onChange={e => setDeliveryDate(e.target.value)}
                                        />
                                        <button className="btn btn-ghost btn-sm" onClick={saveDeliveryDate} disabled={savingDelivery}>
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
                        <div className="data-table-wrapper" style={{ border: 'none' }}>
                            <table className="data-table">
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
                        <div style={{ textAlign: 'right', padding: 'var(--space-4)', fontSize: '1.25rem', fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                            Total: S/. {parseFloat(finalTotal).toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Right: Approval + Timeline */}
                <div style={{ gridColumn: 'span 1' }}>
                    {(isApproval || approvalLink) && (
                        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                            <div className="card-header"><h3 className="card-title">Diseño 3D</h3></div>
                            <div className="approval-card">
                                {approvalLink ? (
                                    <div>
                                        <div className="approval-link" style={{ marginBottom: 'var(--space-3)' }}>
                                            <i className="bi bi-cube"></i>
                                            <a href={approvalLink} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                                                Ver diseño 3D
                                            </a>
                                            <span className="badge badge-enviado">{approvalEstado.replace(/_/g, ' ')}</span>
                                        </div>
                                        {isLab && (
                                            <button className="btn btn-primary btn-sm" onClick={() => setApprovalModalOpen(true)}>
                                                <i className="bi bi-upload"></i> Subir nueva version
                                            </button>
                                        )}
                                        {!isLab && isApproval && (
                                            <div className="approval-actions">
                                                <textarea
                                                    className="form-textarea approval-textarea"
                                                    placeholder="Comentarios para ajustes (si aplica)"
                                                    value={approvalComment}
                                                    onChange={e => setApprovalComment(e.target.value)}
                                                />
                                                <div className="approval-actions-row">
                                                    <button
                                                        className="btn btn-accent"
                                                        onClick={() => updateApproval('aprobado')}
                                                        disabled={updating}
                                                    >
                                                        <i className="bi bi-check-lg"></i> Aprobar diseño
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary"
                                                        onClick={() => updateApproval('ajuste_solicitado', approvalComment)}
                                                        disabled={updating}
                                                    >
                                                        <i className="bi bi-chat-left-text"></i> Solicitar ajustes
                                                    </button>
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
