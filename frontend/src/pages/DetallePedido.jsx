import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useParams, useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { formatDentalSelection } from '../utils/odontograma.js';
import { apiClient } from '../services/http/apiClient.js';
import { useOrderDetailQuery } from '../modules/orders/queries/useOrderDetailQuery.js';
import { useUpdateOrderStatusMutation } from '../modules/orders/mutations/useUpdateOrderStatusMutation.js';
import { useCreateOrderApprovalMutation } from '../modules/orders/mutations/useCreateOrderApprovalMutation.js';
import { useApproveOrderMutation } from '../modules/orders/mutations/useApproveOrderMutation.js';
import { useUpdateOrderResponsibleMutation } from '../modules/orders/mutations/useUpdateOrderResponsibleMutation.js';
import { useUpdateOrderDeliveryDateMutation } from '../modules/orders/mutations/useUpdateOrderDeliveryDateMutation.js';
import { useUploadOrderFileMutation } from '../modules/orders/mutations/useUploadOrderFileMutation.js';
import { useUpdateApprovalMeetLinkMutation } from '../modules/orders/mutations/useUpdateApprovalMeetLinkMutation.js';
import { isClientRole, isLabStaffRole } from '../utils/accessControl.js';
import {
    ORDER_STATUS_FLOW,
    getOrderStatusLabel,
    getClientNextStepMessage,
} from '../utils/orderStatusLabels.js';
import {
    ORDER_INTAKE_LABELS,
    ORDER_INTAKE_MODES,
    parseIntakeFromObservaciones,
} from '../modules/orders/wizard/orderWizardConstants.js';

const approvalStatusLabels = {
    pendiente: 'Pendiente',
    aprobado: 'Aprobado',
    ajuste_solicitado: 'Ajuste solicitado'
};

const fileTypeLabels = {
    color: 'Imagen de color',
    caso: 'Imagen del caso',
    final: 'Imagen final',
    otro: 'Otra imagen'
};

const formatFileSize = (bytes) => {
    const size = Number(bytes) || 0;
    if (!size) return '—';
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getTimelineIcon = (entry) => {
    const text = `${entry?.accion || ''} ${entry?.comentario || ''} ${entry?.detalle || ''}`.toLowerCase();
    if (text.includes('imagen') || text.includes('archivo')) return 'bi-image';
    if (text.includes('aprob')) return 'bi-check2-circle';
    if (text.includes('meet') || text.includes('calendar')) return 'bi-camera-video';
    if (entry?.estado_nuevo) return 'bi-arrow-repeat';
    return 'bi-clock-history';
};

const DetallePedido = () => {
    const { id } = useParams();
    const { getHeaders, user } = useAuth();
    const navigate = useNavigate();
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
    const [caseFileType, setCaseFileType] = useState('caso');
    const [caseFile, setCaseFile] = useState(null);
    const [caseFileModalOpen, setCaseFileModalOpen] = useState(false);
    const [meetModalOpen, setMeetModalOpen] = useState(false);
    const [meetUrl, setMeetUrl] = useState('');
    const [meetScheduledAt, setMeetScheduledAt] = useState('');
    const [responsables, setResponsables] = useState([]);
    const [responsableId, setResponsableId] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const adjustPopoverRef = useRef(null);
    const adjustButtonRef = useRef(null);
    const adjustTextareaRef = useRef(null);
    const caseFileInputRef = useRef(null);
    const { data: pedido, isLoading } = useOrderDetailQuery(id);
    const updateOrderStatusMutation = useUpdateOrderStatusMutation();
    const createOrderApprovalMutation = useCreateOrderApprovalMutation();
    const approveOrderMutation = useApproveOrderMutation();
    const updateOrderResponsibleMutation = useUpdateOrderResponsibleMutation();
    const updateOrderDeliveryDateMutation = useUpdateOrderDeliveryDateMutation();
    const uploadOrderFileMutation = useUploadOrderFileMutation();
    const updateApprovalMeetLinkMutation = useUpdateApprovalMeetLinkMutation();

    const updating =
        updateOrderStatusMutation.isPending ||
        createOrderApprovalMutation.isPending ||
        approveOrderMutation.isPending ||
        updateApprovalMeetLinkMutation.isPending;
    const savingResponsable = updateOrderResponsibleMutation.isPending;
    const savingDelivery = updateOrderDeliveryDateMutation.isPending;
    const uploadingFile = uploadOrderFileMutation.isPending;

    useEffect(() => {
        if (user?.tipo === 'admin') {
            apiClient('/usuarios', { headers: getHeaders(), query: { tipo: 'equipo' } })
                .then(data => setResponsables(data))
                .catch(() => setResponsables([]));
        }
    }, [getHeaders, user?.tipo]);

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
        try {
            await updateOrderStatusMutation.mutateAsync({
                orderId: id,
                payload: { estado: newStatus, ...options }
            });
        } catch (err) {
            alert(err.message);
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
        const payload = {
            link_exocad: exocadLink.trim(),
            comentario: approvalNote.trim()
        };
        if (pedido?.estado === 'esperando_aprobacion') {
            try {
                await createOrderApprovalMutation.mutateAsync({
                    orderId: id,
                    payload
                });
            } catch (err) {
                alert(err.message);
                return;
            }
        } else {
            await changeStatus('esperando_aprobacion', {
                ...payload
            });
        }
        setApprovalModalOpen(false);
        setExocadLink('');
        setApprovalNote('');
    };

    const submitCaseFile = async () => {
        if (!caseFile) {
            alert('Selecciona una imagen para subir');
            return;
        }
        if (!caseFile.type?.startsWith('image/')) {
            alert('Solo se permiten archivos de imagen');
            return;
        }
        if (caseFile.size > 8 * 1024 * 1024) {
            alert('La imagen no debe superar 8 MB');
            return;
        }

        const formData = new FormData();
        formData.append('image', caseFile);
        formData.append('tipo', caseFileType);

        try {
            await uploadOrderFileMutation.mutateAsync({
                orderId: id,
                payload: formData
            });
            setCaseFile(null);
            setCaseFileModalOpen(false);
            if (caseFileInputRef.current) {
                caseFileInputRef.current.value = '';
            }
        } catch (err) {
            alert(err.message);
        }
    };

    const updateApproval = async (estado, comentarioCliente = '', extraPayload = {}) => {
        if (!pedido?.aprobaciones?.length) return;
        if (estado === 'ajuste_solicitado' && !comentarioCliente.trim()) {
            alert('Escribe el motivo del ajuste');
            return false;
        }
        try {
            const currentApproval = pedido.aprobaciones[0];
            await approveOrderMutation.mutateAsync({
                orderId: id,
                approvalId: currentApproval.id,
                payload: { estado, comentario_cliente: comentarioCliente, ...extraPayload }
            });
            return true;
        } catch (err) {
            alert(err.message);
            return false;
        }
    };

    const submitAdjustmentRequest = async () => {
        const note = adjustComment.trim() || 'Cliente solicitó una reunión Meet para revisar ajustes del diseño.';
        const ok = await updateApproval('ajuste_solicitado', note, { request_meet: true });
        if (!ok) return;
        setAdjustComment('');
        setAdjustPopoverOpen(false);
    };

    const submitMeetLink = async () => {
        if (!meetUrl.trim()) {
            alert('Ingresa el link de Google Meet');
            return;
        }

        const approvalId = pedido?.aprobaciones?.[0]?.id;
        if (!approvalId) {
            alert('No hay una aprobación activa para asociar el Meet');
            return;
        }

        try {
            await updateApprovalMeetLinkMutation.mutateAsync({
                orderId: id,
                approvalId,
                payload: {
                    meet_url: meetUrl.trim(),
                    meet_scheduled_at: meetScheduledAt || null
                }
            });
            setMeetUrl('');
            setMeetScheduledAt('');
            setMeetModalOpen(false);
        } catch (err) {
            alert(err.message);
        }
    };

    const saveResponsable = async () => {
        try {
            await updateOrderResponsibleMutation.mutateAsync({
                orderId: id,
                payload: { responsable_id: responsableId || null }
            });
        } catch (err) {
            alert(err.message);
        }
    };

    const saveDeliveryDate = async () => {
        try {
            await updateOrderDeliveryDateMutation.mutateAsync({
                orderId: id,
                payload: { fecha_entrega: deliveryDate }
            });
        } catch (err) {
            alert(err.message);
        }
    };

    if (isLoading) return (
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

    const currentIdx = ORDER_STATUS_FLOW.indexOf(pedido.estado);
    const nextStatus = currentIdx < ORDER_STATUS_FLOW.length - 1 ? ORDER_STATUS_FLOW[currentIdx + 1] : null;
    const isClient = isClientRole(user);
    const isLab = isLabStaffRole(user);
    const statusLabel = (estado) => getOrderStatusLabel(estado, { forClient: isClient });
    const isApproval = pedido.estado === 'esperando_aprobacion';
    const clientNextStep = isClient ? getClientNextStepMessage(pedido) : '';
    const deliveryMeta = getDeliveryMeta();
    const itemsCount = (pedido.items || []).reduce((sum, item) => sum + (parseFloat(item.cantidad) || 0), 0);
    const itemsPiecesLabel = itemsCount === 1 ? 'pieza' : 'piezas';
    const finalTotal = pedido.total ?? 0;
    const currentApproval = (pedido.aprobaciones || [])[0];
    const approvalLink = currentApproval?.link_exocad;
    const approvalEstado = currentApproval?.estado || 'pendiente';
    const approvalMeetUrl = currentApproval?.meet_url;
    const approvalMeetStatus = currentApproval?.meet_status;
    const hasMeetRequest = approvalMeetStatus === 'requested' || approvalMeetStatus === 'scheduled' || !!approvalMeetUrl;
    const meetScheduledLabel = currentApproval?.meet_scheduled_at
        ? new Date(currentApproval.meet_scheduled_at).toLocaleString('es-PE')
        : '';
    const approvalBadgeClass = approvalEstado === 'aprobado'
        ? 'badge-approval-approved'
        : approvalEstado === 'ajuste_solicitado'
            ? 'badge-approval-adjust'
            : 'badge-approval-pending';
    const caseFiles = Array.isArray(pedido.archivos) ? pedido.archivos : [];
    const { intakeMode, notes: observationNotes } = parseIntakeFromObservaciones(pedido.observaciones);
    const intakeLabel = intakeMode ? (ORDER_INTAKE_LABELS[intakeMode] || intakeMode) : null;
    const intakeIcon = ORDER_INTAKE_MODES.find((mode) => mode.id === intakeMode)?.icon || 'bi-geo-alt';
    const rollbackOptions = ORDER_STATUS_FLOW.slice(0, Math.max(currentIdx, 0));
    const timelineSorted = [...(pedido.timeline || [])].sort((a, b) => {
        const timeA = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b?.created_at ? new Date(b.created_at).getTime() : 0;

        if (timeA !== timeB) return timeB - timeA;

        const idA = Number(a?.id) || 0;
        const idB = Number(b?.id) || 0;
        return idB - idA;
    });

    return (
        <div className="animate-fade-in pedido-detail">
            <div className="page-header pedido-detail-header">
                <div className="page-header-left">
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/pedidos')} aria-label="Volver a pedidos">
                        <i className="bi bi-arrow-left"></i>
                    </button>
                    <div>
                        <h1 className="pedido-detail-title">
                            {pedido.codigo}
                            <span className={`badge badge-dot badge-${pedido.estado}`}>{statusLabel(pedido.estado)}</span>
                        </h1>
                        <p>Pedido para {pedido.paciente_nombre}</p>
                    </div>
                </div>
                <div className="pedido-actions">
                    {isLab && nextStatus && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => (nextStatus === 'esperando_aprobacion' ? setApprovalModalOpen(true) : changeStatus(nextStatus))}
                            disabled={updating}
                        >
                            {updating
                                ? 'Actualizando...'
                                : nextStatus === 'esperando_aprobacion'
                                    ? 'Enviar a aprobación'
                                    : `Avanzar a: ${statusLabel(nextStatus)}`}
                            <i className="bi bi-arrow-right"></i>
                        </button>
                    )}
                    {isLab && ['en_diseno', 'esperando_aprobacion'].includes(pedido.estado) && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => { setForceReason(''); setForceModalOpen(true); }}
                            disabled={updating}
                        >
                            <i className="bi bi-skip-forward"></i> Forzar a Producción
                        </button>
                    )}
                    {isLab && rollbackOptions.length > 0 && (
                        <button
                            type="button"
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

            {clientNextStep && (
                <div
                    className={`pedido-client-next-step ${isApproval ? 'is-action' : ''}`}
                    role="status"
                >
                    <span className="pedidos-stat-icon" aria-hidden="true">
                        <i className={`bi ${isApproval ? 'bi-exclamation-circle' : 'bi-info-circle'}`}></i>
                    </span>
                    <div>
                        <strong>{isApproval ? 'Acción requerida' : 'Estado de tu pedido'}</strong>
                        <p>{clientNextStep}</p>
                    </div>
                </div>
            )}

            <div className="card pedido-detail-flow">
                <div className="status-timeline">
                    {ORDER_STATUS_FLOW.map((s, i) => (
                        <div key={s} className={`status-step${i === currentIdx ? ' is-current' : ''}${i < currentIdx ? ' is-done' : ''}`}>
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
                                {statusLabel(s)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="order-wizard-confirm-hero pedido-detail-hero" aria-label="Resumen del pedido">
                <div className="order-wizard-confirm-stat">
                    <div className="order-wizard-confirm-stat-copy">
                        <span className="order-wizard-confirm-label">
                            <i className="bi bi-person" aria-hidden="true"></i>
                            Paciente
                        </span>
                        <strong>{pedido.paciente_nombre}</strong>
                        {pedido.clinica_nombre ? (
                            <em className="order-wizard-confirm-meta">{pedido.clinica_nombre}</em>
                        ) : null}
                    </div>
                </div>
                <div className="order-wizard-confirm-stat order-wizard-confirm-entrega">
                    <div className="order-wizard-confirm-stat-copy">
                        <span className="order-wizard-confirm-label">
                            <i className="bi bi-truck" aria-hidden="true"></i>
                            Entrega
                        </span>
                        <strong className="order-wizard-confirm-date-value">{formatDate(pedido.fecha_entrega)}</strong>
                        {deliveryMeta ? (
                            <em className="order-wizard-confirm-meta">{deliveryMeta.label}</em>
                        ) : (
                            <em className="order-wizard-confirm-meta">Pedido {formatDate(pedido.fecha || pedido.created_at, true)}</em>
                        )}
                    </div>
                </div>
                <div className="order-wizard-confirm-stat is-total">
                    <div className="order-wizard-confirm-stat-copy">
                        <span className="order-wizard-confirm-label">
                            <i className="bi bi-cash-stack" aria-hidden="true"></i>
                            Total
                        </span>
                        <strong>S/. {parseFloat(finalTotal).toFixed(2)}</strong>
                        <em className="order-wizard-confirm-meta">{itemsCount} {itemsPiecesLabel}</em>
                    </div>
                </div>
            </div>

            <div className={`pedido-detail-layout${caseFiles.length > 0 ? ' has-case-files' : ''}`}>
                    <div className="card pedido-detail-info">
                        <div className="card-header"><h3 className="card-title">Información</h3></div>
                        <div className="pedido-detail-info-grid">
                            <div className="pedido-detail-field">
                                <span className="order-wizard-confirm-label">
                                    <i className="bi bi-person-gear" aria-hidden="true"></i>
                                    Responsable
                                </span>
                                {user?.tipo === 'admin' ? (
                                    <div className="pedido-detail-field-actions">
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
                                        <button type="button" className="btn btn-primary btn-sm btn-commit" onClick={saveResponsable} disabled={savingResponsable}>
                                            <i className="bi bi-check2"></i>
                                            {savingResponsable ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                ) : (
                                    <strong>{pedido.responsable_nombre || 'Sin asignar'}</strong>
                                )}
                            </div>
                            <div className="pedido-detail-field">
                                <span className="order-wizard-confirm-label">
                                    <i className="bi bi-calendar3" aria-hidden="true"></i>
                                    Fecha de entrega
                                </span>
                                {isLab ? (
                                    <div className="pedido-detail-field-actions">
                                        <input
                                            className="form-input form-input-sm"
                                            type="date"
                                            value={deliveryDate}
                                            onChange={e => setDeliveryDate(e.target.value)}
                                        />
                                        <button type="button" className="btn btn-primary btn-sm btn-commit" onClick={saveDeliveryDate} disabled={savingDelivery}>
                                            <i className="bi bi-check2"></i>
                                            {savingDelivery ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                ) : (
                                    <strong>{formatDate(pedido.fecha_entrega)}</strong>
                                )}
                            </div>
                            {intakeLabel ? (
                                <div className="pedido-detail-field">
                                    <span className="order-wizard-confirm-label">
                                        <i className={`bi ${intakeIcon}`} aria-hidden="true"></i>
                                        Ingreso del caso
                                    </span>
                                    <strong>{intakeLabel}</strong>
                                </div>
                            ) : null}
                        </div>
                        {observationNotes ? (
                            <div className="pedido-detail-notes">
                                <i className="bi bi-chat-left-text" aria-hidden="true"></i>
                                <span>{observationNotes}</span>
                            </div>
                        ) : null}
                    </div>

                    <div className="card pedido-detail-items">
                        <div className="card-header">
                            <h3 className="card-title">Ítems del pedido</h3>
                            <span className="badge badge-enviado">{itemsCount} {itemsPiecesLabel}</span>
                        </div>
                        <ul className="pedido-detail-item-list">
                            {(pedido.items || []).map((item, i) => {
                                const subtotal = parseFloat(item.subtotal) || (item.cantidad * parseFloat(item.precio_unitario));
                                const color = item.color_vita || item.color || null;
                                return (
                                    <li key={i} className="pedido-detail-item">
                                        <span className="pedidos-stat-icon" aria-hidden="true">
                                            <i className="bi bi-box-seam"></i>
                                        </span>
                                        <div className="pedido-detail-item-body">
                                            <div className="pedido-detail-item-top">
                                                <strong>{item.producto_nombre || `Producto #${item.producto_id}`}</strong>
                                                <span className="pedido-detail-item-subtotal">S/. {Number(subtotal || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="pedido-detail-item-chips">
                                                <span className="pedido-detail-chip is-mono">{formatDentalSelection(item)}</span>
                                                {color ? <span className="pedido-detail-chip is-vita">{color}</span> : null}
                                                {item.material ? <span className="pedido-detail-chip">{item.material}</span> : null}
                                                <span className="pedido-detail-chip">
                                                    {item.cantidad} {parseFloat(item.cantidad) === 1 ? 'pieza' : 'piezas'}
                                                </span>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="pedido-detail-items-total">
                            Total: S/. {parseFloat(finalTotal).toFixed(2)}
                        </div>
                    </div>

                    <div className="card pedido-detail-design">
                        <div className="card-header"><h3 className="card-title">Diseño 3D</h3></div>
                        <div className="approval-card">
                            {approvalLink ? (
                                <div className="approval-review">
                                    <div className="approval-review-head">
                                        <div className="approval-review-icon">
                                            <i className="bi bi-cube"></i>
                                        </div>
                                        <div className="approval-review-copy">
                                            <div className="approval-review-title">Diseño listo para revisión</div>
                                        </div>
                                        <span className={`approval-review-status ${approvalBadgeClass}`}>
                                            {approvalStatusLabels[approvalEstado] || approvalEstado.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="approval-review-main">
                                        <a
                                            href={approvalLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn btn-primary approval-review-primary"
                                            aria-label="Abrir diseño 3D en una nueva pestaña"
                                        >
                                            <i className="bi bi-box-arrow-up-right"></i> Ver diseño 3D
                                        </a>
                                        {isLab && (
                                            <button className="btn btn-secondary btn-sm approval-review-secondary" onClick={() => setApprovalModalOpen(true)}>
                                                <i className="bi bi-upload"></i> Subir nueva versión
                                            </button>
                                        )}
                                    </div>
                                    {hasMeetRequest && (
                                        <div className={`approval-meet-panel ${approvalMeetUrl ? 'is-ready' : ''}`}>
                                            <div>
                                                <strong>{approvalMeetUrl ? 'Meet listo' : 'Meet solicitado'}</strong>
                                                <span>
                                                    {approvalMeetUrl
                                                        ? (meetScheduledLabel ? `Programado: ${meetScheduledLabel}` : 'Usa el enlace para coordinar ajustes.')
                                                        : 'El laboratorio agregará el enlace.'}
                                                </span>
                                            </div>
                                            {approvalMeetUrl ? (
                                                <a href={approvalMeetUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" aria-label="Unirse a la reunión de Google Meet">
                                                    <i className="bi bi-camera-video"></i> Unirse a Meet
                                                </a>
                                            ) : isLab ? (
                                                <button className="btn btn-secondary btn-sm" onClick={() => setMeetModalOpen(true)}>
                                                    <i className="bi bi-link-45deg"></i> Agregar link
                                                </button>
                                            ) : null}
                                        </div>
                                    )}
                                    {isClient && isApproval && (
                                        <div className="approval-actions">
                                            <div className="approval-client-guide">
                                                <i className="bi bi-info-circle"></i>
                                                <span>Revisa el diseño 3D. Si está bien, apruébalo. Si necesitas cambios, pide un Meet.</span>
                                            </div>
                                            <div className="approval-actions-row">
                                                <button
                                                    className="btn btn-accent"
                                                    onClick={() => updateApproval('aprobado')}
                                                    disabled={updating}
                                                >
                                                    <i className="bi bi-check-lg"></i> {updating ? 'Guardando...' : 'Aprobar diseño'}
                                                </button>
                                                <div className="approval-popover-wrap" ref={adjustPopoverRef}>
                                                    <button
                                                        ref={adjustButtonRef}
                                                        className="btn btn-secondary"
                                                        onClick={() => setAdjustPopoverOpen(prev => !prev)}
                                                        disabled={updating || (hasMeetRequest && !approvalMeetUrl)}
                                                    >
                                                        <i className="bi bi-camera-video"></i> {hasMeetRequest && !approvalMeetUrl ? 'Meet solicitado' : 'Pedir ajuste (Meet)'}
                                                    </button>
                                                    {adjustPopoverOpen && (
                                                        <div className="approval-popover animate-fade-in" role="dialog" aria-label="Pedir Meet para ajustes">
                                                            <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Nota para el laboratorio (opcional)</label>
                                                            <textarea
                                                                ref={adjustTextareaRef}
                                                                className="form-textarea approval-textarea"
                                                                placeholder="Ej.: ajustar contacto o forma del canino"
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
                                                                    disabled={updating}
                                                                >
                                                                    {updating ? 'Enviando...' : 'Solicitar Meet'}
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
                                <div className="approval-review-empty">
                                    <div className="approval-review-empty-icon">
                                        <i className="bi bi-cube"></i>
                                    </div>
                                    <div>
                                        <h4>Diseño 3D aún no disponible</h4>
                                        <p>Pendiente de link Exocad.</p>
                                    </div>
                                    {isLab && ['pendiente', 'en_diseno', 'esperando_aprobacion'].includes(pedido.estado) && (
                                        <button className="btn btn-primary btn-sm" onClick={() => setApprovalModalOpen(true)} aria-label="Subir link interactivo de Exocad">
                                            <i className="bi bi-upload"></i> Subir link interactivo
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card pedido-detail-files">
                        <div className="card-header">
                            <h3 className="card-title">Archivos del caso</h3>
                        </div>
                        <div className="card-body">
                            {isLab && (
                            <div className="case-file-upload">
                                <select
                                    id={`case-file-type-${id}`}
                                    className="form-select"
                                    value={caseFileType}
                                    onChange={e => setCaseFileType(e.target.value)}
                                    aria-label="Tipo de imagen"
                                >
                                    {Object.entries(fileTypeLabels).map(([type, label]) => (
                                        <option key={type} value={type}>{label}</option>
                                    ))}
                                </select>
                                <label className="case-file-compact-picker" htmlFor={`case-file-input-${id}`} aria-label="Seleccionar imagen del caso">
                                    <input
                                        id={`case-file-input-${id}`}
                                        ref={caseFileInputRef}
                                        className="case-file-input"
                                        type="file"
                                        accept="image/*"
                                        onChange={e => {
                                            const selectedFile = e.target.files?.[0] || null;
                                            setCaseFile(selectedFile);
                                            if (selectedFile) {
                                                setCaseFileModalOpen(true);
                                            }
                                        }}
                                    />
                                    <span className="case-file-compact-icon">
                                        <i className="bi bi-cloud-arrow-up"></i>
                                    </span>
                                    <span>Seleccionar imagen</span>
                                    <small>PNG, JPG o WebP · máx. 8 MB</small>
                                </label>
                            </div>
                            )}
                            {caseFiles.length === 0 ? (
                                <div className="empty-state case-files-empty">
                                    <i className="bi bi-images empty-state-icon"></i>
                                    <p className="empty-state-text">Aún no hay archivos para este caso.</p>
                                </div>
                            ) : (
                                <div className="case-files-grid">
                                    {caseFiles.map(file => (
                                        <a
                                            key={file.id}
                                            className="case-file-tile"
                                            href={file.url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <img src={file.url} alt={file.nombre_original || fileTypeLabels[file.tipo] || 'Archivo del caso'} loading="lazy" />
                                            <div className="case-file-meta">
                                                <span className="case-file-type">{fileTypeLabels[file.tipo] || file.tipo || 'Archivo'}</span>
                                                <span>{formatFileSize(file.size_bytes)}</span>
                                            </div>
                                            <div className="case-file-name">{file.nombre_original || 'Imagen del caso'}</div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card pedido-detail-history">
                        <div className="card-header"><h3 className="card-title">Historial</h3></div>
                        {timelineSorted.length === 0 ? (
                            <div className="empty-state timeline-empty">
                                <p className="empty-state-text">Sin actividad registrada</p>
                            </div>
                        ) : (
                            <div className="timeline-list">
                                {timelineSorted.map((t, i) => {
                                    const accion = t.accion || (t.estado_nuevo ? `Cambio a ${statusLabel(t.estado_nuevo)}` : 'Actualización');
                                    const detalle = t.detalle || t.comentario;
                                    const isLatest = i === 0;
                                    const timelineIcon = getTimelineIcon(t);
                                    return (
                                        <div key={i} className={`timeline-entry ${isLatest ? 'is-latest' : ''}`}>
                                            <div className={`timeline-dot ${isLatest ? 'is-latest' : ''}`}>
                                                <i className={`bi ${timelineIcon}`}></i>
                                            </div>
                                            <div className="timeline-content">
                                                <div className="timeline-title-row">
                                                    <div className="timeline-title">{accion}</div>
                                                    {isLatest && <span className="timeline-latest-badge">Último cambio</span>}
                                                </div>
                                                {detalle && <div className="timeline-detail">{detalle}</div>}
                                                <div className="timeline-meta">
                                                    <i className="bi bi-calendar2-week"></i>
                                                    <span>{new Date(t.created_at).toLocaleString('es-PE')}</span>
                                                    <span aria-hidden="true">•</span>
                                                    <span>{t.usuario_nombre || 'Sistema'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
            </div>

            <Modal
                open={approvalModalOpen}
                onClose={() => setApprovalModalOpen(false)}
                title="Enviar a Aprobación"
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
                    <label className="form-label">Nota adicional (opcional)</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Agrega una indicación extra solo si es necesario"
                        value={approvalNote}
                        onChange={e => setApprovalNote(e.target.value)}
                    />
                </div>
            </Modal>

            <Modal
                open={meetModalOpen}
                onClose={() => {
                    if (updating) return;
                    setMeetModalOpen(false);
                }}
                title="Agregar link de Meet"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setMeetModalOpen(false)} disabled={updating}>Cancelar</button>
                        <button className="btn btn-primary" onClick={submitMeetLink} disabled={updating || !meetUrl.trim()}>
                            <i className="bi bi-link-45deg"></i> Guardar link
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Link de Google Meet *</label>
                    <input
                        className="form-input"
                        type="url"
                        placeholder="https://meet.google.com/abc-defg-hij"
                        value={meetUrl}
                        onChange={e => setMeetUrl(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Fecha y hora programada (opcional)</label>
                    <input
                        className="form-input"
                        type="datetime-local"
                        value={meetScheduledAt}
                        onChange={e => setMeetScheduledAt(e.target.value)}
                    />
                    <small className="form-help">Creá el Meet en Google Calendar y pegá aquí el enlace para que el cliente pueda unirse.</small>
                </div>
            </Modal>

            <Modal
                open={caseFileModalOpen}
                onClose={() => {
                    if (uploadingFile) return;
                    setCaseFileModalOpen(false);
                    setCaseFile(null);
                    if (caseFileInputRef.current) {
                        caseFileInputRef.current.value = '';
                    }
                }}
                title="Subir imagen del caso"
                footer={
                    <>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setCaseFileModalOpen(false);
                                setCaseFile(null);
                                if (caseFileInputRef.current) {
                                    caseFileInputRef.current.value = '';
                                }
                            }}
                            disabled={uploadingFile}
                        >
                            Cancelar
                        </button>
                        <button className="btn btn-primary" onClick={submitCaseFile} disabled={uploadingFile || !caseFile}>
                            <i className="bi bi-cloud-arrow-up"></i> {uploadingFile ? 'Subiendo...' : 'Subir imagen'}
                        </button>
                    </>
                }
            >
                <div className="case-file-dialog">
                    <div className="case-file-dialog-icon">
                        <i className="bi bi-image"></i>
                    </div>
                    <div className="case-file-dialog-info">
                        <span className="case-file-dialog-label">{fileTypeLabels[caseFileType]}</span>
                        <strong>{caseFile?.name || 'Imagen seleccionada'}</strong>
                        <span>{caseFile ? formatFileSize(caseFile.size) : '—'}</span>
                    </div>
                </div>
                <small className="form-help">
                    Confirmá que esta imagen corresponde a “{fileTypeLabels[caseFileType]}”. Si no, cancelá y elegí otro tipo antes de seleccionar el archivo.
                </small>
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
                            <option key={state} value={state}>{statusLabel(state)}</option>
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
                title="Forzar avance a Producción"
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
                        placeholder="Describe por qué se avanza sin aprobación"
                        value={forceReason}
                        onChange={e => setForceReason(e.target.value)}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default DetallePedido;
