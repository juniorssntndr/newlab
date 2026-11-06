import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_URL } from '../config.js';
import { ORDER_STATUS_FLOW, getOrderStatusLabel } from '../utils/orderStatusLabels.js';
import AnimatedCheck from '../components/icons/animated/AnimatedCheck.jsx';
import AfinixLogo from '../components/AfinixLogo.jsx';
import OrderProductThumb from '../components/orders/OrderProductThumb.jsx';
import OrderDesignViewerModal from '../components/orders/OrderDesignViewerModal.jsx';
import { sortTeethByArchOrder, getToothRole } from '../utils/odontograma.js';
import { parseIntakeFromObservaciones } from '../modules/orders/wizard/orderWizardConstants.js';
import { AFINIX_LAB_ADDRESS } from '../constants/labInfo.js';
import '../styles/public-tracking.css';

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
    aprobado: 'Diseño Aprobado',
    ajuste_solicitado: 'Ajuste Solicitado'
};

export const PublicTrackingPage = () => {
    const { token } = useParams();

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [error, setError] = useState(null);

    // 3D Viewer modal state
    const [viewerModalOpen, setViewerModalOpen] = useState(false);
    const [submittingAction, setSubmittingAction] = useState(false);
    const [actionSuccessMessage, setActionSuccessMessage] = useState('');

    // Fetch order data
    useEffect(() => {
        if (!token) {
            setError('No se proporcionó ningún token de seguimiento.');
            setLoading(false);
            return;
        }

        let isCurrent = true;
        const fetchTracking = async () => {
            try {
                const res = await fetch(`${API_URL}/public/tracking/${token}`);
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'No se pudo obtener la información del pedido.');
                }
                if (isCurrent) {
                    setOrder(data.order);
                }
            } catch (err) {
                if (isCurrent) {
                    setError(err.message || 'Error al conectar con el servidor.');
                }
            } finally {
                if (isCurrent) setLoading(false);
            }
        };

        fetchTracking();
        return () => { isCurrent = false; };
    }, [token]);

    // Handle Approval or Adjustments
    const handleRespondApproval = async (estado, comentario = '') => {
        setSubmittingAction(true);
        try {
            const res = await fetch(`${API_URL}/public/tracking/${token}/aprobar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado,
                    comentario: comentario.trim(),
                    approvalId: order?.approval?.id
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'No se pudo procesar tu respuesta.');
            }

            // Update local state smoothly
            setOrder((prev) => ({
                ...prev,
                estado: estado === 'aprobado' ? 'en_produccion' : 'en_diseno',
                approval: {
                    ...prev.approval,
                    estado,
                    comentario_cliente: comentario.trim(),
                    respondido_at: new Date().toISOString()
                }
            }));

            setViewerModalOpen(false);
            setActionSuccessMessage(
                estado === 'aprobado'
                    ? '¡Diseño 3D aprobado con éxito! El caso ya ingresó al área de producción.'
                    : 'Tus observaciones fueron enviadas al equipo de diseño. Te notificaremos con la nueva versión.'
            );
        } catch (err) {
            alert(err.message || 'Error al procesar la respuesta.');
        } finally {
            setSubmittingAction(false);
        }
    };

    // Calculate stepper state matching DetallePedido.jsx
    const currentIdx = useMemo(() => {
        if (!order?.estado) return 0;
        return ORDER_STATUS_FLOW.indexOf(order.estado);
    }, [order?.estado]);

    const progressPercent = useMemo(() => {
        if (currentIdx < 0 || ORDER_STATUS_FLOW.length <= 1) return 0;
        return (currentIdx / (ORDER_STATUS_FLOW.length - 1)) * 100;
    }, [currentIdx]);

    const formattedDeliveryDate = useMemo(() => {
        if (!order?.fecha_entrega) return 'Coordinar con laboratorio';
        const d = new Date(order.fecha_entrega);
        if (Number.isNaN(d.getTime())) return order.fecha_entrega;
        return d.toLocaleDateString('es-PE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }, [order?.fecha_entrega]);

    const deliveryDaysLeft = useMemo(() => {
        if (!order?.fecha_entrega) return null;
        const target = new Date(order.fecha_entrega);
        if (Number.isNaN(target.getTime())) return null;
        const now = new Date();
        const diffMs = target.setHours(0,0,0,0) - now.setHours(0,0,0,0);
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'Fecha vencida';
        if (diffDays === 0) return 'Entrega hoy';
        if (diffDays === 1) return 'Entrega mañana';
        return `En ${diffDays} días`;
    }, [order?.fecha_entrega]);

    const intakeInfo = useMemo(() => {
        const obs = String(order?.observaciones || '');
        if (/[INGRESO:recoleccion]/i.test(obs)) {
            return {
                mode: 'recoleccion',
                label: 'Recolección en consultorio',
                icon: 'bi-geo-alt',
                detail: order?.clinica_direccion || 'Dirección de consultorio'
            };
        }
        if (/[INGRESO:envio]/i.test(obs)) {
            return {
                mode: 'envio',
                label: 'Recepción en sede laboratorio',
                icon: 'bi-building',
                detail: AFINIX_LAB_ADDRESS
            };
        }
        return {
            mode: 'digital',
            label: 'Ingreso Digital / CAD',
            icon: 'bi-cloud-arrow-up',
            detail: 'Portal Oficial AFINIX Lab'
        };
    }, [order?.observaciones, order?.clinica_direccion]);

    const coordinationNotes = useMemo(() => {
        const { notes } = parseIntakeFromObservaciones(order?.observaciones);
        return notes;
    }, [order?.observaciones]);

    const handleWhatsAppHelp = () => {
        const phone = '51910707060';
        const code = order?.codigo || 'Caso';
        const text = encodeURIComponent(`Hola AFINIX Dental Lab, tengo una consulta sobre el seguimiento de mi caso ${code}.`);
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    };

    if (loading) {
        return (
            <div className="public-track-page">
                <header className="public-track-navbar">
                    <div className="public-track-container public-track-navbar-inner">
                        <div className="public-track-brand-group">
                            <AfinixLogo size={36} showText={true} theme="light" />
                            <span className="public-track-brand-divider" aria-hidden="true" />
                            <span className="public-track-brand-sub">Rastreo Clínico en Tiempo Real</span>
                        </div>
                    </div>
                </header>
                <main className="public-track-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                    <div className="spinner-border text-primary" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
                        <span className="visually-hidden">Cargando...</span>
                    </div>
                    <p style={{ marginTop: '1rem', color: 'var(--color-text-muted, #64748b)', fontSize: '0.95rem' }}>
                        Consultando estado del trabajo en laboratorio...
                    </p>
                </main>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="public-track-page">
                <header className="public-track-navbar">
                    <div className="public-track-container public-track-navbar-inner">
                        <div className="public-track-brand-group">
                            <AfinixLogo size={36} showText={true} theme="light" />
                            <span className="public-track-brand-divider" aria-hidden="true" />
                            <span className="public-track-brand-sub">Rastreo Clínico en Tiempo Real</span>
                        </div>
                    </div>
                </header>
                <main className="public-track-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '60vh' }}>
                    <i className="bi bi-exclamation-triangle text-warning" style={{ fontSize: '3rem', marginBottom: '1rem' }} />
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>Enlace no disponible</h2>
                    <p style={{ color: 'var(--color-text-muted, #64748b)', maxWidth: '420px', margin: '0.5rem auto 1.5rem' }}>
                        {error || 'El enlace de seguimiento ha expirado o no es válido. Puedes comunicarte directamente con el laboratorio para consultar el estado de tu caso.'}
                    </p>
                    <button type="button" className="btn btn-primary" onClick={handleWhatsAppHelp}>
                        <i className="bi bi-whatsapp" style={{ marginRight: '0.5rem' }} />
                        Consultar por WhatsApp
                    </button>
                </main>
            </div>
        );
    }

    const currentApproval = order.approval;
    const hasDesignFile = Boolean(currentApproval?.has3dDesign);
    const isApprovalPending = currentApproval?.estado === 'pendiente';
    const firstItem = order.items?.[0] || null;

    const productForThumb = firstItem ? {
        id: firstItem.id,
        nombre: firstItem.producto_nombre,
        image_url: firstItem.producto_image_url || ''
    } : null;

    return (
        <div className="public-track-page">
            {/* Top Navbar */}
            <header className="public-track-navbar">
                <div className="public-track-container public-track-navbar-inner">
                    <div className="public-track-brand-group">
                        <AfinixLogo size={36} showText={true} theme="light" />
                        <span className="public-track-brand-divider" aria-hidden="true" />
                        <span className="public-track-brand-sub">Rastreo Clínico en Tiempo Real</span>
                    </div>
                    <button type="button" className="public-track-whatsapp-btn" onClick={handleWhatsAppHelp} title="Soporte por WhatsApp">
                        <i className="bi bi-whatsapp" style={{ color: '#25D366', fontSize: '1.1rem' }} />
                        <span>Soporte Laboratorio</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="public-track-container public-track-main">
                {/* Order Header / Top Bar */}
                <div className="public-track-order-topbar">
                    <div className="public-track-order-code">
                        <i className="bi bi-box-seam text-primary" />
                        <span>Orden Técnica <strong>{order.codigo}</strong></span>
                    </div>
                    <span className={`public-track-badge ${order.estado === 'esperando_aprobacion' ? 'is-warning' : order.estado === 'terminado' || order.estado === 'enviado' ? 'is-success' : 'is-primary'}`}>
                        <span className="public-track-badge-dot" />
                        {getOrderStatusLabel(order.estado)}
                    </span>
                </div>

                {/* Case Stepper Card (Exact same component styling as DetallePedido.jsx) */}
                <div className="card pedido-stepper-card public-track-card" aria-label="Seguimiento de etapas">
                    <div className="pedido-stepper-header">
                        <span className="order-wizard-confirm-label">
                            <i className="bi bi-diagram-3" aria-hidden="true" />
                            Seguimiento del caso
                        </span>
                        {currentIdx >= 0 && (
                            <span className="pedido-stepper-step-counter" aria-label={`Paso ${currentIdx + 1} de ${ORDER_STATUS_FLOW.length}`}>
                                Paso <strong>{currentIdx + 1}</strong> de {ORDER_STATUS_FLOW.length}
                            </span>
                        )}
                    </div>

                    <div className="pedido-stepper-scroll-container" role="region" aria-label="Línea de etapas del trabajo">
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
                                                                '0 0 0 0 rgba(2, 132, 199, 0.45)',
                                                                '0 0 0 9px rgba(2, 132, 199, 0)',
                                                                '0 0 0 0 rgba(2, 132, 199, 0.45)',
                                                            ],
                                                            scale: [1, 1.05, 1],
                                                        }}
                                                        transition={{
                                                            duration: 2.2,
                                                            repeat: Infinity,
                                                            ease: 'easeInOut',
                                                        }}
                                                    >
                                                        <i className={`${STATUS_ICONS[s] || 'bi bi-check-circle'} pedido-stepper-icon`} aria-hidden="true" />
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
                                                <span className="pedido-stepper-label">{getOrderStatusLabel(s)}</span>
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

                {/* Hero Stats (Paciente, Ingreso, Entrega) */}
                <div className="order-wizard-confirm-hero pedido-detail-hero public-track-hero" aria-label="Resumen del pedido">
                    {/* Paciente */}
                    <div className="order-wizard-confirm-stat pedido-detail-stat-paciente">
                        <div className="order-wizard-confirm-stat-copy">
                            <span className="order-wizard-confirm-label">
                                <i className="bi bi-person" aria-hidden="true" />
                                Paciente
                            </span>
                            <div className="order-wizard-confirm-patient-row">
                                <strong>{order.paciente_nombre}</strong>
                            </div>
                            {order.clinica_nombre && (
                                <div className="order-wizard-confirm-clinic-row">
                                    <i className="bi bi-hospital" aria-hidden="true" />
                                    <span>{order.clinica_nombre}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ingreso del caso */}
                    <div className="order-wizard-confirm-stat pedido-detail-stat-ingreso">
                        <div className="order-wizard-confirm-stat-copy">
                            <span className="order-wizard-confirm-label">
                                <i className={`bi ${intakeInfo.icon}`} aria-hidden="true" />
                                Ingreso del caso
                            </span>
                            <strong>{intakeInfo.label}</strong>
                            <em className="order-wizard-confirm-meta">{intakeInfo.detail}</em>
                        </div>
                    </div>

                    {/* Entrega */}
                    <div className="order-wizard-confirm-stat order-wizard-confirm-entrega pedido-detail-stat-entrega">
                        <div className="order-wizard-confirm-stat-copy">
                            <span className="order-wizard-confirm-label">
                                <i className="bi bi-calendar3" aria-hidden="true" />
                                Entrega Comprometida
                            </span>
                            <div className="order-wizard-confirm-date-row">
                                <strong className="order-wizard-confirm-date-value">{formattedDeliveryDate}</strong>
                            </div>
                            {deliveryDaysLeft && (
                                <em className="order-wizard-confirm-meta">{deliveryDaysLeft}</em>
                            )}
                        </div>
                    </div>
                </div>

                {/* Success Alert if approval was just confirmed */}
                {actionSuccessMessage && (
                    <div className="public-track-alert-success animate-fade-in" role="alert">
                        <i className="bi bi-check-circle-fill" />
                        <span>{actionSuccessMessage}</span>
                    </div>
                )}

                {/* Main 2-Column Grid: Left (Datos del caso), Right (Diseño 3D) */}
                <div className="public-track-grid-layout">
                    {/* Left Column: Datos del Caso */}
                    <div className="card public-track-card public-track-case-data">
                        <div className="card-header">
                            <h3 className="card-title">Datos del caso</h3>
                        </div>
                        <ul className="order-wizard-confirm-items pedido-detail-confirm-items">
                            {(order.items || []).map((item, i) => {
                                const tone = String(item.color_vita || item.color || '').trim();
                                const material = String(item.material || '').trim();
                                const teeth = sortTeethByArchOrder(item.piezas_dentales || []);
                                const teethDenseClass = teeth.length > 24
                                    ? 'is-dense-xl'
                                    : teeth.length > 16
                                        ? 'is-dense-lg'
                                        : teeth.length > 8
                                            ? 'is-dense-md'
                                            : '';
                                const product = {
                                    id: item.producto_id || item.id,
                                    nombre: item.producto_nombre || 'Producto Odontológico',
                                    image_url: item.producto_image_url || ''
                                };
                                const itemSubtotal = parseFloat(item.subtotal) || (parseFloat(item.cantidad || 1) * parseFloat(item.precio_unitario || 0));
                                const hasDiscount = Number(order.descuento_monto || 0) > 0;
                                const hasPricing = order.total != null && Number(order.total) >= 0;
                                const finalAmount = Number(order.total != null ? order.total : itemSubtotal);
                                const originalAmount = finalAmount + Number(order.descuento_monto || 0);

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
                                                    ) : item.cantidad ? (
                                                        <span className="order-wizard-confirm-qty">
                                                            {parseFloat(item.cantidad)} {parseFloat(item.cantidad) === 1 ? 'unidad' : 'unidades'}
                                                        </span>
                                                    ) : null}
                                                    {tone && (
                                                        <span className="order-wizard-confirm-tone">Tono {tone}</span>
                                                    )}
                                                    {material && (
                                                        <span className="public-track-meta-chip">
                                                            <i className="bi bi-gem" style={{ marginRight: '0.25rem', fontSize: '0.75rem' }} />
                                                            {material}
                                                        </span>
                                                    )}
                                                </div>
                                                {hasPricing && (
                                                    <div className="pedido-detail-item-pricing public-track-item-pricing">
                                                        {hasDiscount && (
                                                            <span className="pedido-detail-price-original">
                                                                S/. {originalAmount.toFixed(2)}
                                                            </span>
                                                        )}
                                                        <span className="pedido-detail-item-subtotal">
                                                            S/. {finalAmount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Right Column: Stacked Diseño 3D & Nota de coordinación */}
                    <div className="public-track-side-column">
                        <div className="card public-track-card public-track-design-card">
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 className="card-title">
                                    <i className="bi bi-badge-3d text-primary" style={{ marginRight: '0.5rem' }} aria-hidden="true" />
                                    <span>Diseño 3D</span>
                                </h3>
                                {hasDesignFile && (
                                    <span className={`approval-review-status ${currentApproval?.estado === 'aprobado' ? 'status-approved' : currentApproval?.estado === 'ajuste_solicitado' ? 'status-adjusted' : 'status-pending'}`}>
                                        {approvalStatusLabels[currentApproval?.estado] || 'Pendiente'}
                                    </span>
                                )}
                            </div>
                            <div className="card-body">
                                {hasDesignFile ? (
                                    <div className="public-track-design-actions">
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={() => setViewerModalOpen(true)}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                        >
                                            <i className="bi bi-box" />
                                            <span>Ver diseño 3D</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--color-text-muted, #64748b)' }}>
                                        <i className="bi bi-clock-history" style={{ fontSize: '1.5rem', color: '#f59e0b', display: 'block', marginBottom: '0.25rem' }} />
                                        <strong style={{ display: 'block', color: 'var(--color-text, #1e293b)', fontSize: '0.85rem' }}>
                                            Diseño 3D en preparación
                                        </strong>
                                        <span style={{ fontSize: '0.75rem', marginTop: '0.15rem', display: 'block' }}>
                                            El equipo de diseño CAD está modelando el caso.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="card public-track-card public-track-notes-card">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <i className="bi bi-chat-left-text text-primary" style={{ marginRight: '0.5rem' }} aria-hidden="true" />
                                    <span>Nota de coordinación</span>
                                </h3>
                            </div>
                            <div className="card-body">
                                <div className="pedido-detail-notes" style={{ margin: 0 }}>
                                    <span style={!coordinationNotes ? { color: 'var(--color-muted, #94a3b8)', fontStyle: 'italic' } : undefined}>
                                        {coordinationNotes || 'Sin notas ni observaciones adicionales registradas.'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Conversion Banner to AFINIX Portal */}
                <div className="public-track-conversion-banner">
                    <div className="public-track-conversion-content">
                        <i className="bi bi-laptop public-track-conversion-icon" />
                        <div className="public-track-conversion-text">
                            <h4>¿Desea gestionar todos sus casos en línea?</h4>
                            <p>Active su cuenta en el Portal Oficial de AFINIX Lab para ver estados históricos, comprobantes y pedidos.</p>
                        </div>
                    </div>
                    <Link to="/registro" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                        <span>Crear Cuenta en Portal</span>
                        <i className="bi bi-arrow-right" style={{ marginLeft: '0.5rem' }} />
                    </Link>
                </div>
            </main>

            {/* 3D Design Viewer Modal (Reused standard AFINIX 3D viewer) */}
            {hasDesignFile && (
                <OrderDesignViewerModal
                    open={viewerModalOpen}
                    onClose={() => setViewerModalOpen(false)}
                    order={order}
                    approval={currentApproval}
                    isClient={true}
                    isLab={false}
                    publicToken={token}
                    onApprove={() => handleRespondApproval('aprobado')}
                    onReject={(comment) => handleRespondApproval('ajuste_solicitado', comment)}
                    updating={submittingAction}
                />
            )}

            {/* Official Legal Footer */}
            <footer className="public-track-footer">
                <div className="public-track-container public-track-footer-inner">
                    <span><strong>AFINIX DENTAL LAB S.A.C.</strong> • RUC 20616033973</span>
                    <span>Calle Piura 316, Mariano Melgar, Arequipa.</span>
                    <span>Trazabilidad y Calidad Digital Odontológica</span>
                </div>
            </footer>
        </div>
    );
};

export default PublicTrackingPage;
