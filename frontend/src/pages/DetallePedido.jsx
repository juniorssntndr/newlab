import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../state/AuthContext.jsx';
import { useParams, useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { formatDentalSelection, sortTeethByArchOrder, getToothRole } from '../utils/odontograma.js';
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
} from '../utils/orderStatusLabels.js';
import {
    ORDER_INTAKE_LABELS,
    ORDER_INTAKE_MODES,
    parseIntakeFromObservaciones,
} from '../modules/orders/wizard/orderWizardConstants.js';
import OrderProductThumb from '../components/orders/OrderProductThumb.jsx';
import OrderWhatsAppModal from '../components/orders/OrderWhatsAppModal.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import AnimatedCheck from '../components/icons/animated/AnimatedCheck.jsx';
import { AFINIX_LAB_ADDRESS } from '../constants/labInfo.js';
import OrderRepeatModal from '../components/orders/OrderRepeatModal.jsx';
import OrderRepeatLinks from '../components/orders/OrderRepeatLinks.jsx';
import { canRepeatOrder } from '../modules/orders/orderRepeat.js';
import '../styles/order-repeats.css';
import OrderDesignViewerModal from '../components/orders/OrderDesignViewerModal.jsx';

const STATUS_ICONS = {
    pendiente: 'bi bi-inbox',
    en_diseno: 'bi bi-pencil-square',
    esperando_aprobacion: 'bi bi-patch-check',
    en_produccion: 'bi bi-gear',
    terminado: 'bi bi-check2-circle',
    enviado: 'bi bi-truck',
};

const approvalStatusLabels = {
    pendiente: 'Pendiente',
    aprobado: 'Aprobado',
    ajuste_solicitado: 'Ajuste solicitado'
};

const fileTypeLabels = {
    stl: 'Modelo 3D',
    color: 'Foto de color',
    caso: 'Foto clínica',
    final: 'Trabajo terminado',
    doc: 'Documento / PDF',
    otro: 'Archivo adjunto'
};

const detectFileType = (file) => {
    const name = (file?.name || '').toLowerCase();
    const ext = name.split('.').pop();
    if (['stl', 'obj', 'ply', '3mf'].includes(ext)) return 'stl';
    if (['pdf'].includes(ext)) return 'doc';
    if (name.includes('color') || name.includes('toma')) return 'color';
    if (name.includes('final') || name.includes('control')) return 'final';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'caso';
    return 'otro';
};

const getFileVisual = (file) => {
    const ext = (file?.nombre_original || file?.url || '').split('.').pop().toLowerCase();
    const is3D = ['stl', 'obj', 'ply', '3mf'].includes(ext) || file?.tipo === 'stl';
    const isPdf = ['pdf'].includes(ext) || file?.tipo === 'doc';
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) || ['color', 'caso', 'final'].includes(file?.tipo);
    return { is3D, isPdf, isImage, ext };
};

const formatFileSize = (bytes) => {
    const size = Number(bytes) || 0;
    if (!size) return '—';
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getAccountPersonName = (value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    const name = String(value).trim();
    return name && !/^\d+$/.test(name) ? name : '';
};

const resolveTimelineResponsible = (detail, accounts) => String(detail || '').replace(
    /Responsable asignado:\s*(\d+)\b/g,
    (_, id) => {
        const account = accounts.find((item) => String(item.id) === id);
        const name = getAccountPersonName(account?.nombre);
        return name ? `Responsable asignado: ${name}` : 'Responsable asignado';
    }
);

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
    const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
    const [repeatModalOpen, setRepeatModalOpen] = useState(false);
    const [rollbackState, setRollbackState] = useState('');
    const [rollbackReason, setRollbackReason] = useState('');
    const [forceModalOpen, setForceModalOpen] = useState(false);
    const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
    const [forceReason, setForceReason] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const [meetModalOpen, setMeetModalOpen] = useState(false);
    const [meetUrl, setMeetUrl] = useState('');
    const [meetScheduledAt, setMeetScheduledAt] = useState('');
    const [responsables, setResponsables] = useState([]);
    const [responsableId, setResponsableId] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [editingDelivery, setEditingDelivery] = useState(false);
    const [viewerModalOpen, setViewerModalOpen] = useState(false);
    const [approvalFile, setApprovalFile] = useState(null);
    const [uploadMode, setUploadMode] = useState('file');
    const [isDraggingApproval, setIsDraggingApproval] = useState(false);
    const approvalFileInputRef = useRef(null);
    const caseFileInputRef = useRef(null);
    const stepperScrollRef = useRef(null);
    const activeStepRef = useRef(null);
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
            setResponsableId(pedido.responsable_id ? String(pedido.responsable_id) : '');
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
        const scrollToActive = () => {
            const container = stepperScrollRef.current;
            const activeEl = activeStepRef.current;
            if (!container || !activeEl) return;
            const containerWidth = container.clientWidth;
            const activeWidth = activeEl.clientWidth;
            const targetLeft = Math.round(activeEl.offsetLeft - (containerWidth - activeWidth) / 2);
            container.scrollTo({
                left: Math.max(0, targetLeft),
                behavior: 'smooth',
            });
        };

        if (pedido?.estado) {
            const rafId = requestAnimationFrame(scrollToActive);
            const timer1 = setTimeout(scrollToActive, 80);
            const timer2 = setTimeout(scrollToActive, 280);
            return () => {
                cancelAnimationFrame(rafId);
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        }
    }, [pedido?.estado, pedido?.id]);


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

    const submitApprovalDesign = async () => {
        if (uploadMode === 'file' && !approvalFile) {
            alert('Por favor selecciona o arrastra el archivo HTML exportado desde Exocad');
            return;
        }
        if (uploadMode === 'link' && !exocadLink.trim()) {
            alert('Por favor ingresa el enlace web de Exocad Viewer');
            return;
        }

        try {
            let payload;
            if (uploadMode === 'file' && approvalFile) {
                const formData = new FormData();
                formData.append('file', approvalFile);
                if (approvalNote.trim()) {
                    formData.append('comentario', approvalNote.trim());
                }
                payload = formData;
            } else {
                payload = {
                    link_exocad: exocadLink.trim(),
                    comentario: approvalNote.trim()
                };
            }

            await createOrderApprovalMutation.mutateAsync({
                orderId: id,
                payload
            });

            setApprovalModalOpen(false);
            setApprovalFile(null);
            setExocadLink('');
            setApprovalNote('');
        } catch (err) {
            alert(err.message || 'Error al enviar diseño a aprobación');
        }
    };

    const handleFilesUpload = async (filesList) => {
        if (!filesList || filesList.length === 0) return;
        setUploadingFiles(true);
        try {
            const filesArray = Array.from(filesList);
            for (const file of filesArray) {
                if (file.size > 50 * 1024 * 1024) {
                    alert(`"${file.name}" supera el límite de 50 MB.`);
                    continue;
                }
                const detectedType = detectFileType(file);
                const formData = new FormData();
                formData.append('image', file);
                formData.append('tipo', detectedType);

                await uploadOrderFileMutation.mutateAsync({
                    orderId: id,
                    payload: formData
                });
            }
        } catch (err) {
            alert(err.message || 'Error al subir archivo');
        } finally {
            setUploadingFiles(false);
            setIsDragOver(false);
            if (caseFileInputRef.current) {
                caseFileInputRef.current.value = '';
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragOver) setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer?.files?.length) {
            handleFilesUpload(e.dataTransfer.files);
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
            setEditingDelivery(false);
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
    const progressPercent = currentIdx >= 0 && ORDER_STATUS_FLOW.length > 1
        ? (currentIdx / (ORDER_STATUS_FLOW.length - 1)) * 100
        : 0;
    const isClient = isClientRole(user);
    const isLab = isLabStaffRole(user);
    const statusLabel = (estado) => getOrderStatusLabel(estado, { forClient: isClient });
    const isApproval = pedido.estado === 'esperando_aprobacion';
    const deliveryMeta = getDeliveryMeta();
    const finalTotal = pedido.total ?? 0;
    const orderItems = pedido.items || [];
    // Total del pie solo aporta cuando hay varios ítems; con uno solo el precio de línea ya basta.
    // El desglose express (base + recargo) aún no está disponible: el +25% se hornea en precio_unitario.
    const showItemsTotal = orderItems.length > 1;
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
    const currentResponsibleId = responsableId == null || responsableId === '' ? '' : String(responsableId);
    const rosterResponsible = responsables.find((responsable) => String(responsable.id) === currentResponsibleId);
    const currentResponsibleName = getAccountPersonName(pedido.responsable_nombre)
        || getAccountPersonName(rosterResponsible?.nombre);
    const namedResponsibles = responsables
        .map((responsable) => ({ responsable, nombre: getAccountPersonName(responsable.nombre) }))
        .filter(({ nombre }) => nombre);
    const hasNamedCurrentResponsible = namedResponsibles.some(({ responsable }) => String(responsable.id) === currentResponsibleId);
    const responsibleOptions = [
        { value: '', label: 'Sin asignar', icon: 'bi-person-dash' },
        ...(currentResponsibleId && !hasNamedCurrentResponsible
            ? [{
                value: currentResponsibleId,
                label: currentResponsibleName || 'Responsable asignado (nombre no disponible)',
                icon: 'bi-person'
            }]
            : []),
        ...namedResponsibles.map(({ responsable, nombre }) => ({
            value: String(responsable.id),
            label: String(responsable.id) === currentResponsibleId && currentResponsibleName ? currentResponsibleName : nombre,
            icon: 'bi-person'
        }))
    ];
    const responsibleDisplayName = currentResponsibleName
        || (currentResponsibleId ? 'Responsable asignado (nombre no disponible)' : 'Sin asignar');
    const timelineSorted = [...(pedido.timeline || [])].sort((a, b) => {
        const timeA = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b?.created_at ? new Date(b.created_at).getTime() : 0;

        if (timeA !== timeB) return timeB - timeA;

        const idA = Number(a?.id) || 0;
        const idB = Number(b?.id) || 0;
        return idB - idA;
    });
    const repeatReason = String(pedido.repeat_reason || '').trim();
    const repeatReasonAlreadyInTimeline = repeatReason && timelineSorted.some((entry) =>
        [entry?.accion, entry?.detalle, entry?.comentario]
            .some((value) => String(value || '').toLocaleLowerCase().includes(repeatReason.toLocaleLowerCase()))
    );
    const hasRepeatHistory = Boolean(pedido.repeat_kind || (pedido.relatedOrders || []).length);

    return (
        <div className="animate-fade-in pedido-detail">
            <div className="page-header pedido-detail-header">
                <button
                    type="button"
                    className="pedido-back-button"
                    onClick={() => navigate('/pedidos')}
                    title="Volver a Pedidos"
                    aria-label="Volver a pedidos"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                        focusable="false" style={{ flexShrink: 0 }}>
                        <path d="M19 12H5m7-7-7 7 7 7" />
                    </svg>
                    <span>Volver a Pedidos</span>
                </button>

                {isLab ? (
                    <div className="pedido-actions">
                        {canRepeatOrder(user, pedido) && (
                            <button type="button" className="btn btn-secondary" onClick={() => setRepeatModalOpen(true)}>
                                <i className="bi bi-arrow-repeat" aria-hidden="true" />
                                <span>Repetir trabajo</span>
                            </button>
                        )}
                        {pedido.estado !== 'enviado' && rollbackOptions.length > 0 && (
                            <button
                                type="button"
                                className="btn btn-secondary pedido-action-icon-btn"
                                onClick={() => {
                                    setRollbackState(rollbackOptions[rollbackOptions.length - 1]);
                                    setRollbackReason('');
                                    setRollbackModalOpen(true);
                                }}
                                disabled={updating}
                                title={`Retroceder estado (a: ${statusLabel(rollbackOptions[rollbackOptions.length - 1])})`}
                                aria-label="Retroceder estado"
                            >
                                <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                            </button>
                        )}

                        {['en_diseno', 'esperando_aprobacion'].includes(pedido.estado) && (
                            <button
                                type="button"
                                className="btn btn-secondary pedido-action-icon-btn"
                                onClick={() => {
                                    setForceReason('');
                                    setForceModalOpen(true);
                                }}
                                disabled={updating}
                                title="Forzar avance directo a producción"
                                aria-label="Forzar a producción"
                            >
                                <i className="bi bi-lightning-charge" aria-hidden="true"></i>
                            </button>
                        )}

                        <button
                            type="button"
                            className="btn btn-secondary pedido-action-icon-btn pedido-action-whatsapp"
                            onClick={() => setWhatsAppModalOpen(true)}
                            title="Notificar por WhatsApp a la clínica"
                            aria-label="WhatsApp"
                        >
                            <i className="bi bi-whatsapp" style={{ color: '#25D366' }} aria-hidden="true"></i>
                        </button>

                        {nextStatus && (
                            <button
                                type="button"
                                className="btn btn-primary pedido-action-primary-btn"
                                onClick={() => (nextStatus === 'esperando_aprobacion' ? setApprovalModalOpen(true) : changeStatus(nextStatus))}
                                disabled={updating}
                                title={
                                    updating
                                        ? 'Actualizando...'
                                        : nextStatus === 'esperando_aprobacion'
                                            ? 'Enviar a aprobación'
                                            : `Avanzar a: ${statusLabel(nextStatus)}`
                                }
                            >
                                <span>
                                    {updating
                                        ? 'Actualizando...'
                                        : nextStatus === 'esperando_aprobacion'
                                            ? 'Enviar a aprobación'
                                            : `Avanzar a ${statusLabel(nextStatus)}`}
                                </span>
                                <i className="bi bi-arrow-right" aria-hidden="true"></i>
                            </button>
                        )}
                    </div>
                ) : null}
            </div>

            {repeatModalOpen && canRepeatOrder(user, pedido) && <OrderRepeatModal order={pedido}
                onClose={() => setRepeatModalOpen(false)} onCreated={child => { setRepeatModalOpen(false); navigate(`/pedidos/${child.id}`); }} />}
            <div className="card pedido-detail-flow" role="region" aria-label="Seguimiento del pedido">
                <div className="pedido-stepper-header">
                    <span className="order-wizard-confirm-label">
                        <i className="bi bi-diagram-3" aria-hidden="true"></i>
                        Seguimiento del caso
                    </span>

                    {currentIdx >= 0 && (
                        <span className="pedido-stepper-step-counter" aria-label={`Paso ${currentIdx + 1} de ${ORDER_STATUS_FLOW.length}`}>
                            Paso <strong>{currentIdx + 1}</strong> de {ORDER_STATUS_FLOW.length}
                        </span>
                    )}
                </div>

                <div
                    className="pedido-stepper-scroll-container"
                    ref={stepperScrollRef}
                    role="region"
                    aria-label="Línea de etapas del trabajo"
                >
                    <div className="pedido-stepper-track-wrap">
                        <div className="pedido-stepper-rail-bg" aria-hidden="true" />
                        <motion.div
                            className="pedido-stepper-rail-fill"
                            aria-hidden="true"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        />

                        <ol className="pedido-stepper-track" role="list">
                            {ORDER_STATUS_FLOW.map((s, i) => {
                                const isDone = i < currentIdx;
                                const isCurrent = i === currentIdx;
                                const isPending = i > currentIdx;

                                return (
                                    <li
                                        key={s}
                                        ref={isCurrent ? activeStepRef : null}
                                        role="listitem"
                                        className={[
                                            'pedido-stepper-step',
                                            isDone ? 'is-done' : '',
                                            isCurrent ? 'is-current' : '',
                                            isPending ? 'is-pending' : '',
                                        ].filter(Boolean).join(' ')}
                                        aria-current={isCurrent ? 'step' : undefined}
                                    >
                                        <div className="pedido-stepper-node-wrapper">
                                            {isCurrent ? (
                                                <motion.div
                                                    className="pedido-stepper-node is-current"
                                                    animate={{
                                                        boxShadow: [
                                                            '0 0 0 0 rgba(var(--color-primary-rgb), 0.45)',
                                                            '0 0 0 9px rgba(var(--color-primary-rgb), 0)',
                                                            '0 0 0 0 rgba(var(--color-primary-rgb), 0.45)',
                                                        ],
                                                        scale: [1, 1.05, 1],
                                                    }}
                                                    transition={{
                                                        duration: 2.2,
                                                        repeat: Infinity,
                                                        ease: 'easeInOut',
                                                    }}
                                                >
                                                    <i className={`${STATUS_ICONS[s] || 'bi bi-check-circle'} pedido-stepper-icon`} aria-hidden="true"></i>
                                                </motion.div>
                                            ) : isDone ? (
                                                <div className="pedido-stepper-node is-done">
                                                    <AnimatedCheck size={16} strokeWidth={2.6} />
                                                </div>
                                            ) : (
                                                <div className="pedido-stepper-node is-pending">
                                                    <span className="pedido-stepper-node-num">{i + 1}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pedido-stepper-content">
                                            <span className="pedido-stepper-label">{statusLabel(s)}</span>
                                            {isCurrent && (
                                                <span className="pedido-stepper-tag is-current">
                                                    <span className="pedido-stepper-tag-dot" /> En curso
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
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
                        {!isClient && pedido.clinica_nombre ? (
                            <em className="order-wizard-confirm-meta">{pedido.clinica_nombre}</em>
                        ) : null}
                    </div>
                </div>
                <div className="order-wizard-confirm-stat">
                    <div className="order-wizard-confirm-stat-copy">
                        <span className="order-wizard-confirm-label">
                            <i className={`bi ${intakeIcon}`} aria-hidden="true"></i>
                            Ingreso del caso
                        </span>
                        <strong>{intakeLabel || '—'}</strong>
                        {intakeMode === 'envio' ? (
                            <em className="order-wizard-confirm-meta">
                                {pedido.laboratorio_direccion || AFINIX_LAB_ADDRESS}
                            </em>
                        ) : intakeMode === 'recoleccion' ? (
                            pedido.clinica_direccion ? (
                                <em className="order-wizard-confirm-meta">{pedido.clinica_direccion}</em>
                            ) : (
                                <em className="order-wizard-confirm-meta">Sin dirección de consultorio</em>
                            )
                        ) : null}
                    </div>
                </div>
                <div className="order-wizard-confirm-stat order-wizard-confirm-entrega">
                    <div className="order-wizard-confirm-stat-copy">
                        <span className="order-wizard-confirm-label">
                            <i className="bi bi-calendar3" aria-hidden="true"></i>
                            Entrega
                        </span>
                        {isLab && editingDelivery ? (
                            <div className="pedido-detail-field-actions">
                                <input
                                    className="form-input form-input-sm"
                                    type="date"
                                    value={deliveryDate}
                                    onChange={e => setDeliveryDate(e.target.value)}
                                    aria-label="Fecha de entrega"
                                />
                                <button type="button" className="btn btn-primary btn-sm btn-commit" onClick={saveDeliveryDate} disabled={savingDelivery || !deliveryDate}>
                                    <i className="bi bi-check2"></i>
                                    {savingDelivery ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setEditingDelivery(false)}
                                    disabled={savingDelivery}
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <div className="order-wizard-confirm-date-row">
                                <strong className="order-wizard-confirm-date-value">{formatDate(pedido.fecha_entrega)}</strong>
                                {isLab ? (
                                    <button
                                        type="button"
                                        className="order-wizard-confirm-coord-icon"
                                        onClick={() => setEditingDelivery(true)}
                                        title="Editar fecha de entrega"
                                        aria-label="Editar fecha de entrega"
                                    >
                                        <i className="bi bi-pencil-square" aria-hidden="true"></i>
                                    </button>
                                ) : null}
                            </div>
                        )}
                        {deliveryMeta ? (
                            <em className="order-wizard-confirm-meta">{deliveryMeta.label}</em>
                        ) : (
                            <em className="order-wizard-confirm-meta">Pedido {formatDate(pedido.fecha || pedido.created_at, true)}</em>
                        )}
                    </div>
                </div>
            </div>

            <div className={`pedido-detail-layout${caseFiles.length > 0 ? ' has-case-files' : ''}${isClient ? ' is-client' : ''}`}>
                    <div className="card pedido-detail-items">
                        <div className="card-header">
                            <h3 className="card-title">Datos del caso</h3>
                        </div>
                        <ul className="order-wizard-confirm-items pedido-detail-confirm-items">
                            {(pedido.items || []).map((item, i) => {
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
                                    <li key={i} className="order-wizard-confirm-item">
                                        <div className="order-wizard-confirm-item-media" aria-hidden="true">
                                            <OrderProductThumb product={product} />
                                        </div>
                                        <div className="order-wizard-confirm-item-main">
                                            <div className="pedido-detail-confirm-item-top">
                                                <div className="pedido-detail-confirm-item-heading">
                                                    <strong>{product.nombre}</strong>
                                                </div>
                                                <div className="order-wizard-confirm-clinical">
                                                    {teeth.length > 0 ? (
                                                        <div
                                                            className={[
                                                                'order-wizard-confirm-teeth',
                                                                teethDenseClass,
                                                            ].filter(Boolean).join(' ')}
                                                            data-count={teeth.length}
                                                            aria-label="Piezas seleccionadas"
                                                        >
                                                            {teeth.map((tooth) => {
                                                                const role = getToothRole(tooth, item);
                                                                const roleLabel = role === 'pilar' ? 'Pilar' : role === 'pontico' ? 'Póntico' : 'Unitaria';
                                                                return (
                                                                    <span
                                                                        key={`${i}-${tooth}`}
                                                                        className={`order-wizard-confirm-tooth is-${role}`}
                                                                        title={`Pieza ${tooth} (${roleLabel})`}
                                                                    >
                                                                        {tooth}
                                                                    </span>
                                                                );
                                                            })}
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
                                                <span className="pedido-detail-item-subtotal">S/. {Number(subtotal || 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        {showItemsTotal ? (
                            <div className="pedido-detail-items-total">
                                Total: S/. {parseFloat(finalTotal).toFixed(2)}
                            </div>
                        ) : null}
                    </div>

                    <div className="pedido-detail-side">
                    {isLab ? (
                    <div className="card pedido-detail-info" aria-label="Responsable del caso">
                        <div className="card-header">
                            <h3 className="card-title">
                                <i className="bi bi-person-gear" aria-hidden="true"></i>
                                Responsable
                            </h3>
                        </div>
                        {user?.tipo === 'admin' ? (
                            <div className="pedido-detail-field-actions">
                                <CustomSelect
                                    size="sm"
                                    value={currentResponsibleId}
                                    onChange={e => setResponsableId(e.target.value)}
                                    aria-label="Asignar responsable"
                                    placeholder="Sin asignar"
                                    options={responsibleOptions}
                                />
                                <button type="button" className="btn btn-primary btn-sm btn-commit" onClick={saveResponsable} disabled={savingResponsable}>
                                    <i className="bi bi-check2"></i>
                                    {savingResponsable ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        ) : (
                            <strong className="pedido-detail-responsable-name">
                                {responsibleDisplayName}
                            </strong>
                        )}
                        {observationNotes && !pedido.repeat_kind ? (
                            <div className="pedido-detail-notes">
                                <i className="bi bi-chat-left-text" aria-hidden="true"></i>
                                <span>{observationNotes}</span>
                            </div>
                        ) : null}
                    </div>
                    ) : observationNotes ? (
                    <div className="card pedido-detail-info">
                        <div className="card-header">
                            <h3 className="card-title">
                                <i className="bi bi-chat-left-text" aria-hidden="true"></i>
                                Nota de coordinación
                            </h3>
                        </div>
                        <div className="pedido-detail-notes" style={{ margin: 0 }}>
                            <span>{observationNotes}</span>
                        </div>
                    </div>
                    ) : null}

                    <div className="card pedido-detail-design">
                        <div className="card-header pedido-detail-design-header">
                            <div className="pedido-detail-design-header-left">
                                <h3 className="card-title">
                                    <i className="bi bi-badge-3d text-primary" aria-hidden="true"></i>
                                    <span>Diseño 3D</span>
                                </h3>
                            </div>
                            {approvalLink ? (
                                <span className={`approval-review-status ${approvalBadgeClass}`}>
                                    {approvalStatusLabels[approvalEstado] || approvalEstado.replace(/_/g, ' ')}
                                </span>
                            ) : null}
                        </div>
                        <div className="approval-card">
                            {approvalLink ? (
                                <div className="approval-review">
                                    <div className="approval-actions-single-row">
                                        <button
                                            type="button"
                                            className="btn btn-primary approval-action-main-btn"
                                            onClick={() => setViewerModalOpen(true)}
                                            aria-label="Abrir visor 3D interactivo en AFINIX Lab"
                                        >
                                            <i className="bi bi-box"></i>
                                            <span>Ver diseño 3D</span>
                                        </button>
                                        {isLab && pedido.estado !== 'enviado' && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary approval-action-icon-btn"
                                                    onClick={() => setApprovalModalOpen(true)}
                                                    title="Subir nueva versión del diseño 3D"
                                                    aria-label="Subir nueva versión"
                                                >
                                                    <i className="bi bi-arrow-repeat"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary approval-action-icon-btn"
                                                    onClick={() => setWhatsAppModalOpen(true)}
                                                    title="Notificar por WhatsApp a la clínica"
                                                    aria-label="WhatsApp"
                                                >
                                                    <i className="bi bi-whatsapp" style={{ color: '#25D366' }}></i>
                                                </button>
                                            </>
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
                                </div>
                            ) : (
                                <div className="approval-review-empty">
                                    <div className="approval-empty-copy">
                                        <i className="bi bi-box" aria-hidden="true"></i>
                                        <span>Pendiente de diseño 3D</span>
                                    </div>
                                    {isLab && ['pendiente', 'en_diseno', 'esperando_aprobacion'].includes(pedido.estado) && (
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => setApprovalModalOpen(true)}
                                            aria-label="Subir diseño 3D interactivo"
                                        >
                                            <i className="bi bi-cloud-arrow-up"></i> Subir diseño 3D
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    </div>

                    <div className="card pedido-detail-files">
                        <div className="card-header pedido-detail-files-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <h3 className="card-title">Archivos del caso</h3>
                                <span className="badge badge-secondary" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                                    {caseFiles.length}
                                </span>
                            </div>
                        </div>
                        <div className="card-body">
                            {isLab && (
                                <div
                                    className={`case-file-dropzone${isDragOver ? ' is-dragover' : ''}${uploadingFiles ? ' is-uploading' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragEnter={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => !uploadingFiles && caseFileInputRef.current?.click()}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Arrastrar o seleccionar archivos del caso"
                                >
                                    <input
                                        ref={caseFileInputRef}
                                        type="file"
                                        multiple
                                        accept=".stl,.obj,.ply,.3mf,.png,.jpg,.jpeg,.webp,.pdf,.zip"
                                        style={{ display: 'none' }}
                                        onChange={(e) => handleFilesUpload(e.target.files)}
                                    />

                                    {uploadingFiles ? (
                                        <div className="dropzone-uploading-state">
                                            <div className="spinner-border text-primary" role="status" style={{ width: '1.75rem', height: '1.75rem' }}></div>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                                                Subiendo y procesando archivo(s)...
                                            </span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="dropzone-icon-circle">
                                                <i className="bi bi-cloud-arrow-up"></i>
                                            </div>
                                            <div className="dropzone-text-group">
                                                <strong className="dropzone-primary-text">
                                                    Arrastrá modelos 3D, fotos o documentos aquí
                                                </strong>
                                                <span className="dropzone-subtext">
                                                    o haz clic para explorar en tu equipo · STL, OBJ, PLY, JPG, PNG, PDF (hasta 50 MB)
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {caseFiles.length === 0 ? (
                                !isLab && (
                                    <div className="empty-state case-files-empty">
                                        <i className="bi bi-folder2-open empty-state-icon"></i>
                                        <p className="empty-state-text">No hay archivos adjuntos en este caso.</p>
                                    </div>
                                )
                            ) : (
                                <div className="case-files-gallery">
                                    {caseFiles.map((file) => {
                                        const visual = getFileVisual(file);
                                        return (
                                            <div key={file.id} className="case-file-card">
                                                <div className="case-file-card-preview">
                                                    {visual.isImage ? (
                                                        <img
                                                            src={file.url}
                                                            alt={file.nombre_original || 'Foto clínica'}
                                                            loading="lazy"
                                                            className="case-file-img"
                                                        />
                                                    ) : visual.is3D ? (
                                                        <div className="case-file-3d-placeholder">
                                                            <i className="bi bi-box"></i>
                                                            <span>3D MESH</span>
                                                        </div>
                                                    ) : (
                                                        <div className="case-file-doc-placeholder">
                                                            <i className="bi bi-file-earmark-pdf"></i>
                                                            <span>PDF</span>
                                                        </div>
                                                    )}
                                                    <span className={`case-file-badge case-file-badge--${file.tipo || 'otro'}`}>
                                                        {fileTypeLabels[file.tipo] || visual.ext.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="case-file-card-body">
                                                    <span className="case-file-card-name" title={file.nombre_original || file.url}>
                                                        {file.nombre_original || 'Archivo del caso'}
                                                    </span>
                                                    <div className="case-file-card-footer">
                                                        <span className="case-file-card-size">
                                                            {formatFileSize(file.size_bytes)}
                                                        </span>
                                                        <div className="case-file-card-actions">
                                                            <a
                                                                href={file.url}
                                                                download={file.nombre_original || true}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="btn-icon"
                                                                title="Descargar archivo"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <i className="bi bi-download"></i>
                                                            </a>
                                                            <a
                                                                href={file.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="btn-icon"
                                                                title="Abrir en pestaña nueva"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <i className="bi bi-box-arrow-up-right"></i>
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card pedido-detail-history">
                        <div className="card-header"><h3 className="card-title">Historial</h3></div>
                        {timelineSorted.length === 0 && !hasRepeatHistory ? (
                            <div className="empty-state timeline-empty">
                                <p className="empty-state-text">Sin actividad registrada</p>
                            </div>
                        ) : (
                            <div className="timeline-list">
                                <OrderRepeatLinks
                                    order={pedido}
                                    canDownloadEvidence={user?.tipo === 'admin'}
                                    hideReason={Boolean(repeatReasonAlreadyInTimeline)}
                                />
                                {timelineSorted.map((t, i) => {
                                    const accion = resolveTimelineResponsible(t.accion || (t.estado_nuevo ? `Cambio a ${statusLabel(t.estado_nuevo)}` : 'Actualización'), responsables);
                                    const detalle = resolveTimelineResponsible(t.detalle || t.comentario, responsables);
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
                onClose={() => {
                    if (updating) return;
                    setApprovalModalOpen(false);
                }}
                title={approvalLink ? "Subir Nueva Versión del Diseño" : "Enviar a Aprobación"}
                kicker="CAD / CAM • Diseño Digital"
                subtitle="Carga el visor 3D interactivo para revisión y aprobación clínica"
                icon="bi-box"
                footer={
                    <>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setApprovalModalOpen(false)}
                            disabled={updating}
                        >
                            Cancelar
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={submitApprovalDesign}
                            disabled={updating || (uploadMode === 'file' ? !approvalFile : !exocadLink.trim())}
                        >
                            <i className="bi bi-send"></i> {updating ? 'Subiendo...' : 'Publicar Diseño 3D'}
                        </button>
                    </>
                }
            >
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <button
                        type="button"
                        className={`btn btn-sm ${uploadMode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setUploadMode('file')}
                    >
                        <i className="bi bi-filetype-html"></i> Subir Archivo HTML (Recomendado)
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm ${uploadMode === 'link' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setUploadMode('link')}
                    >
                        <i className="bi bi-link-45deg"></i> Enlace Web Externo
                    </button>
                </div>

                {uploadMode === 'file' ? (
                    <div className="form-group">
                        <label className="form-label">Archivo HTML exportado de Exocad *</label>
                        <input
                            ref={approvalFileInputRef}
                            type="file"
                            accept=".html,.htm"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setApprovalFile(e.target.files[0]);
                                }
                            }}
                        />
                        {approvalFile ? (
                            <div className="order-design-file-card">
                                <div className="order-design-file-info">
                                    <i className="bi bi-filetype-html" style={{ fontSize: '1.75rem', color: '#0284c7' }}></i>
                                    <div>
                                        <div className="order-design-file-name">{approvalFile.name}</div>
                                        <div className="order-design-file-size">{formatFileSize(approvalFile.size)}</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={() => setApprovalFile(null)}
                                    title="Quitar archivo"
                                >
                                    <i className="bi bi-trash"></i>
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`order-design-upload-dropzone ${isDraggingApproval ? 'is-active' : ''}`}
                                onClick={() => approvalFileInputRef.current?.click()}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDraggingApproval(true);
                                }}
                                onDragLeave={() => setIsDraggingApproval(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDraggingApproval(false);
                                    if (e.dataTransfer.files?.[0]) {
                                        setApprovalFile(e.dataTransfer.files[0]);
                                    }
                                }}
                            >
                                <i className="bi bi-cloud-arrow-up order-design-upload-icon"></i>
                                <div>
                                    <strong>Arrastra aquí el archivo HTML de Exocad</strong>
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        o haz clic para explorar en tu equipo (hasta 50 MB)
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="form-group">
                        <label className="form-label">Link Exocad Viewer *</label>
                        <div className="form-input-box has-lead">
                            <i className="bi bi-link-45deg form-input-lead" aria-hidden="true" />
                            <input
                                className="form-input"
                                type="url"
                                placeholder="https://viewer.exocad.com/..."
                                value={exocadLink}
                                onChange={e => setExocadLink(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="form-label">Nota o indicación clínica (opcional)</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Ej.: Se realizó alivio cervical y ajuste de grosor oclusal a 1.2mm"
                        value={approvalNote}
                        onChange={e => setApprovalNote(e.target.value)}
                    />
                </div>
            </Modal>

            <OrderDesignViewerModal
                open={viewerModalOpen}
                onClose={() => setViewerModalOpen(false)}
                order={pedido}
                approval={currentApproval}
                isClient={isClient}
                isLab={isLab}
                onApprove={async () => {
                    const ok = await updateApproval('aprobado');
                    if (ok) setViewerModalOpen(false);
                }}
                onReject={async (comment) => {
                    const ok = await updateApproval('ajuste_solicitado', comment);
                    if (ok) setViewerModalOpen(false);
                }}
                updating={updating}
                onOpenUploadModal={() => setApprovalModalOpen(true)}
            />

            <Modal
                open={meetModalOpen}
                onClose={() => {
                    if (updating) return;
                    setMeetModalOpen(false);
                }}
                title="Agregar link de Meet"
                kicker="Comunicación Clínica • Videollamada"
                subtitle="Enlace de Google Meet para sesión clínica virtual"
                icon="bi-camera-video"
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
                    <div className="form-input-box has-lead">
                        <i className="bi bi-link-45deg form-input-lead" aria-hidden="true" />
                        <input
                            className="form-input"
                            type="url"
                            placeholder="https://meet.google.com/abc-defg-hij"
                            value={meetUrl}
                            onChange={e => setMeetUrl(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Fecha y hora programada (opcional)</label>
                    <div className="form-input-box has-lead">
                        <i className="bi bi-calendar-event form-input-lead" aria-hidden="true" />
                        <input
                            className="form-input"
                            type="datetime-local"
                            value={meetScheduledAt}
                            onChange={e => setMeetScheduledAt(e.target.value)}
                        />
                    </div>
                    <small className="form-help">Creá el Meet en Google Calendar y pegá aquí el enlace para que el cliente pueda unirse.</small>
                </div>
            </Modal>



            <Modal
                open={rollbackModalOpen}
                onClose={() => setRollbackModalOpen(false)}
                title="Retroceder estado"
                kicker="Flujo Técnico • Control de Calidad"
                subtitle="Retroceder la orden técnica a una fase previa"
                icon="bi-arrow-counterclockwise"
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
                    <CustomSelect
                        value={rollbackState}
                        onChange={e => setRollbackState(e.target.value)}
                        aria-label="Estado destino"
                        options={rollbackOptions.map(state => ({
                            value: state,
                            label: statusLabel(state)
                        }))}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Motivo <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Describe el motivo del retroceso"
                        value={rollbackReason}
                        onChange={e => setRollbackReason(e.target.value)}
                        autoFocus
                    />
                </div>
            </Modal>
            <Modal
                open={forceModalOpen}
                onClose={() => setForceModalOpen(false)}
                title="Forzar avance a Producción"
                kicker="Flujo Técnico • Override de Producción"
                subtitle="Avance directo a producción bajo justificación técnica"
                icon="bi-skip-forward"
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
                    <label className="form-label">Motivo <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Describe por qué se avanza sin aprobación"
                        value={forceReason}
                        onChange={e => setForceReason(e.target.value)}
                        autoFocus
                    />
                </div>
            </Modal>

            <OrderWhatsAppModal
                isOpen={whatsAppModalOpen}
                open={whatsAppModalOpen}
                onClose={() => setWhatsAppModalOpen(false)}
                pedido={pedido}
                items={pedido?.items || []}
                approvalLink={approvalLink}
            />
        </div>
    );
};

export default DetallePedido;
