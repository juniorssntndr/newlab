import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../config.js';
import '../styles/public-tracking.css';

const STATUS_CONFIG = {
    pendiente: { label: 'Recepción y Registro', step: 0, tone: 'neutral' },
    en_diseno: { label: 'En Diseño CAD', step: 1, tone: 'info' },
    esperando_aprobacion: { label: 'Esperando Aprobación 3D', step: 2, tone: 'warning' },
    en_produccion: { label: 'En Producción', step: 3, tone: 'info' },
    control_calidad: { label: 'Control de Calidad', step: 4, tone: 'info' },
    terminado: { label: 'Trabajo Terminado', step: 5, tone: 'success' },
    enviado: { label: 'En Ruta de Entrega', step: 5, tone: 'success' },
    entregado: { label: 'Entregado en Clínica', step: 5, tone: 'success' },
    anulado: { label: 'Anulado', step: -1, tone: 'neutral' }
};

const STEPS = [
    { label: 'Recepción', icon: 'bi-inbox' },
    { label: 'Diseño CAD', icon: 'bi-laptop' },
    { label: 'Aprobación 3D', icon: 'bi-box' },
    { label: 'Producción', icon: 'bi-gear' },
    { label: 'Control Calidad', icon: 'bi-shield-check' },
    { label: 'Listo / Entrega', icon: 'bi-truck' }
];

export const PublicTrackingPage = () => {
    const { token } = useParams();

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [error, setError] = useState(null);

    // 3D Viewer modal state
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerUrl, setViewerUrl] = useState('');
    const [viewerLoading, setViewerLoading] = useState(false);
    const [viewerError, setViewerError] = useState('');
    const viewerFrameRef = useRef(null);

    // Adjustment drawer state
    const [adjustBoxOpen, setAdjustBoxOpen] = useState(false);
    const [adjustNote, setAdjustNote] = useState('');
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

    // Handle opening the 3D viewer
    const handleOpenViewer = async () => {
        if (!order?.approval?.has3dDesign) return;
        setViewerOpen(true);
        setViewerLoading(true);
        setViewerError('');

        // If direct external link exists, use directly
        if (order.approval.directWebLink) {
            setViewerUrl(order.approval.directWebLink);
            setViewerLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/public/tracking/${token}/visor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approvalId: order.approval.id })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'No se pudo inicializar la sesión 3D.');
            }
            setViewerUrl(data.url);
        } catch (err) {
            setViewerError(err.message || 'Error al cargar el visor 3D.');
            setViewerLoading(false);
        }
    };

    // Listen to Exocad / AFINIX Viewer postMessages
    useEffect(() => {
        if (!viewerUrl) return undefined;
        let expectedOrigin = '';
        try {
            expectedOrigin = new URL(viewerUrl).origin;
        } catch {
            expectedOrigin = '';
        }

        const handleMessage = (event) => {
            if (expectedOrigin && event.origin !== expectedOrigin) return;
            if (event.data?.type === 'afinix-viewer-ready') {
                setViewerLoading(false);
            }
            if (event.data?.type === 'afinix-viewer-error') {
                setViewerLoading(false);
                setViewerError('No se pudo renderizar el modelo 3D. Comunícate con el laboratorio.');
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [viewerUrl]);

    // Handle Approval or Adjustments
    const handleRespondApproval = async (estado) => {
        if (estado === 'ajuste_solicitado' && !adjustNote.trim()) {
            alert('Por favor ingresa las observaciones o ajustes que deseas realizar en el diseño.');
            return;
        }

        setSubmittingAction(true);
        try {
            const res = await fetch(`${API_URL}/public/tracking/${token}/aprobar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado,
                    comentario: adjustNote.trim(),
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
                    comentario_cliente: adjustNote.trim(),
                    respondido_at: new Date().toISOString()
                }
            }));

            setAdjustBoxOpen(false);
            setAdjustNote('');
            setActionSuccessMessage(
                estado === 'aprobado'
                    ? '¡Diseño 3D aprobado con éxito! El caso ya ingresó al área de producción.'
                    : 'Tus notas de ajuste fueron enviadas al equipo de diseño. Te notificaremos la nueva versión.'
            );
        } catch (err) {
            alert(err.message || 'Error al procesar la respuesta.');
        } finally {
            setSubmittingAction(false);
        }
    };

    // Calculate stepper state
    const currentStatusInfo = useMemo(() => {
        if (!order?.estado) return { label: 'Consultando', step: 0, tone: 'neutral' };
        return STATUS_CONFIG[order.estado] || { label: order.estado.replace(/_/g, ' '), step: 0, tone: 'neutral' };
    }, [order?.estado]);

    const progressPercentage = useMemo(() => {
        const step = currentStatusInfo.step;
        if (step <= 0) return 0;
        return Math.min(Math.round((step / (STEPS.length - 1)) * 100), 100);
    }, [currentStatusInfo]);

    const formattedDeliveryDate = useMemo(() => {
        if (!order?.fecha_entrega) return 'Coordinar con laboratorio';
        const d = new Date(order.fecha_entrega);
        if (Number.isNaN(d.getTime())) return order.fecha_entrega;
        return d.toLocaleDateString('es-PE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }, [order?.fecha_entrega]);

    const handleWhatsAppHelp = () => {
        const phone = '51910707060';
        const code = order?.codigo || 'Caso';
        const text = encodeURIComponent(`Hola AFINIX Dental Lab, tengo una consulta sobre el seguimiento de mi caso ${code}.`);
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    };

    if (loading) {
        return (
            <div className="public-track-page">
                <header className="public-track-header">
                    <div className="public-track-header-content">
                        <div className="public-track-brand">
                            <div className="public-track-logo-badge">
                                <i className="bi bi-shield-shaded" />
                            </div>
                            <div className="public-track-brand-text">
                                <span className="public-track-brand-title">AFINIX Dental Lab</span>
                                <span className="public-track-brand-subtitle">Seguimiento Clínico</span>
                            </div>
                        </div>
                    </div>
                </header>
                <main className="public-track-main" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                        <span className="visually-hidden">Cargando...</span>
                    </div>
                    <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Consultando estado del trabajo en laboratorio...</p>
                </main>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="public-track-page">
                <header className="public-track-header">
                    <div className="public-track-header-content">
                        <div className="public-track-brand">
                            <div className="public-track-logo-badge">
                                <i className="bi bi-shield-shaded" />
                            </div>
                            <div className="public-track-brand-text">
                                <span className="public-track-brand-title">AFINIX Dental Lab</span>
                                <span className="public-track-brand-subtitle">Seguimiento Clínico</span>
                            </div>
                        </div>
                    </div>
                </header>
                <main className="public-track-main" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '60vh' }}>
                    <i className="bi bi-exclamation-triangle" style={{ fontSize: '3rem', color: '#f59e0b', marginBottom: '1rem' }} />
                    <h3 style={{ color: '#ffffff', fontWeight: 700 }}>Enlace no disponible</h3>
                    <p style={{ color: '#94a3b8', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                        {error || 'El enlace de seguimiento ha expirado o no es válido. Puedes comunicarte directamente con el laboratorio para consultar el estado de tu caso.'}
                    </p>
                    <button type="button" className="btn-track-primary" onClick={handleWhatsAppHelp}>
                        <i className="bi bi-whatsapp" style={{ color: '#25d366' }} />
                        <span>Consultar por WhatsApp</span>
                    </button>
                </main>
            </div>
        );
    }

    const currentApproval = order.approval;
    const isApprovalPending = currentApproval?.estado === 'pendiente';
    const isApproved = currentApproval?.estado === 'aprobado';
    const isAdjustRequested = currentApproval?.estado === 'ajuste_solicitado';

    return (
        <div className="public-track-page">
            {/* Header */}
            <header className="public-track-header">
                <div className="public-track-header-content">
                    <div className="public-track-brand">
                        <div className="public-track-logo-badge">
                            <i className="bi bi-shield-shaded" />
                        </div>
                        <div className="public-track-brand-text">
                            <span className="public-track-brand-title">AFINIX Dental Lab</span>
                            <span className="public-track-brand-subtitle">Rastreo Clínico en Tiempo Real</span>
                        </div>
                    </div>
                    <button type="button" className="public-track-help-btn" onClick={handleWhatsAppHelp} title="Consultar por WhatsApp">
                        <i className="bi bi-whatsapp" />
                        <span>Soporte</span>
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="public-track-main">
                {/* Hero card */}
                <div className="public-track-hero">
                    <div className="public-track-hero-top">
                        <div className="public-track-code-wrapper">
                            <span className="public-track-code-label">Orden Técnica</span>
                            <span className="public-track-code">{order.codigo}</span>
                        </div>
                        <div className={`public-track-badge tone-${currentStatusInfo.tone}`}>
                            <i className="bi bi-circle-fill" style={{ fontSize: '0.55rem' }} />
                            <span>{currentStatusInfo.label}</span>
                        </div>
                    </div>

                    {/* Stepper visual */}
                    <div className="public-track-stepper">
                        <div className="public-track-stepper-progress">
                            <div className="public-track-stepper-bar" style={{ width: `${progressPercentage}%` }} />
                        </div>
                        {STEPS.map((st, index) => {
                            const isCompleted = currentStatusInfo.step > index;
                            const isActive = currentStatusInfo.step === index;
                            const stepClass = isCompleted ? 'completed' : isActive ? 'active' : '';

                            return (
                                <div key={st.label} className={`public-track-step ${stepClass}`}>
                                    <div className="public-track-step-circle">
                                        <i className={`bi ${isCompleted ? 'bi-check-lg' : st.icon}`} />
                                    </div>
                                    <span className="public-track-step-label">{st.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Success alert after action */}
                {actionSuccessMessage && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <i className="bi bi-check-circle-fill" style={{ fontSize: '1.25rem' }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{actionSuccessMessage}</span>
                    </div>
                )}

                {/* 3D Approval Interactive Panel */}
                {currentApproval?.has3dDesign && (
                    <section className="public-track-approval-panel">
                        <div className="public-track-approval-header">
                            <div className="public-track-approval-title">
                                <i className="bi bi-box" />
                                <span>Diseño CAD 3D Disponible</span>
                            </div>
                            <div className="public-track-approval-actions">
                                <button type="button" className="btn-track-primary" onClick={handleOpenViewer}>
                                    <i className="bi bi-eye" />
                                    <span>Inspeccionar Modelo 3D</span>
                                </button>
                                {isApprovalPending && (
                                    <>
                                        <button
                                            type="button"
                                            className="btn-track-success"
                                            onClick={() => handleRespondApproval('aprobado')}
                                            disabled={submittingAction}
                                        >
                                            <i className="bi bi-check2-circle" />
                                            <span>Aprobar Diseño</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-track-warning"
                                            onClick={() => setAdjustBoxOpen(!adjustBoxOpen)}
                                            disabled={submittingAction}
                                        >
                                            <i className="bi bi-pencil" />
                                            <span>Solicitar Ajustes</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {isApproved && (
                            <div style={{ color: '#34d399', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <i className="bi bi-check-circle" />
                                <span>Diseño aprobado por el doctor clínico. Pedido en manufactura.</span>
                            </div>
                        )}

                        {isAdjustRequested && (
                            <div style={{ color: '#fbbf24', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <i className="bi bi-clock-history" />
                                <span>Ajustes solicitados en revisión por el técnico de diseño.</span>
                            </div>
                        )}

                        {/* Adjustments note box */}
                        {adjustBoxOpen && (
                            <div className="public-track-adjust-box">
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fbbf24' }}>
                                    Detalle de Ajustes Clínicos Deseados
                                </label>
                                <textarea
                                    value={adjustNote}
                                    onChange={(e) => setAdjustNote(e.target.value)}
                                    placeholder="Indica con precisión las modificaciones requeridas (ej: liberar punto de contacto mesial, reducir altura cuspídea 0.5mm, etc.)..."
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        className="btn-track-warning"
                                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                                        onClick={() => setAdjustBoxOpen(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-track-primary"
                                        style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                                        onClick={() => handleRespondApproval('ajuste_solicitado')}
                                        disabled={submittingAction}
                                    >
                                        {submittingAction ? 'Enviando...' : 'Enviar Observaciones'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Details Grid */}
                <div className="public-track-grid">
                    {/* Patient & Clinic Card */}
                    <div className="public-track-card">
                        <div className="public-track-card-header">
                            <i className="bi bi-person-badge" />
                            <span>Datos del Caso</span>
                        </div>
                        <div className="public-track-field-list">
                            <div className="public-track-field">
                                <span className="public-track-field-label">Paciente</span>
                                <span className="public-track-field-value">{order.paciente_nombre || 'No especificado'}</span>
                            </div>
                            <div className="public-track-field">
                                <span className="public-track-field-label">Clínica / Doctor</span>
                                <span className="public-track-field-value">{order.clinica_nombre}</span>
                            </div>
                            <div className="public-track-field">
                                <span className="public-track-field-label">Fecha de Entrega</span>
                                <span className="public-track-field-value" style={{ color: '#38bdf8' }}>
                                    {formattedDeliveryDate}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Technical Dental Specs Card */}
                    <div className="public-track-card">
                        <div className="public-track-card-header">
                            <i className="bi bi-activity" />
                            <span>Especificaciones Técnicas</span>
                        </div>
                        <div className="public-track-field-list">
                            {order.items?.map((it, idx) => (
                                <div key={it.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                    <div className="public-track-field">
                                        <span className="public-track-field-label">Producto</span>
                                        <span className="public-track-field-value">{it.producto_nombre}</span>
                                    </div>
                                    {it.dientes && it.dientes.length > 0 && (
                                        <div className="public-track-field" style={{ marginTop: '0.35rem' }}>
                                            <span className="public-track-field-label">Piezas FDI</span>
                                            <div className="public-track-teeth-tags">
                                                {it.dientes.map((tooth) => (
                                                    <span key={tooth} className="public-track-tooth-tag">{tooth}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {it.color && (
                                        <div className="public-track-field" style={{ marginTop: '0.35rem' }}>
                                            <span className="public-track-field-label">Color VITA</span>
                                            <span className="public-track-field-value">{it.color}</span>
                                        </div>
                                    )}
                                    {it.material && (
                                        <div className="public-track-field" style={{ marginTop: '0.35rem' }}>
                                            <span className="public-track-field-label">Material</span>
                                            <span className="public-track-field-value">{it.material}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {order.observaciones && (
                                <div className="public-track-field" style={{ alignItems: 'flex-start' }}>
                                    <span className="public-track-field-label">Indicaciones</span>
                                    <span className="public-track-field-value" style={{ fontWeight: 400, fontSize: '0.82rem', textAlign: 'right' }}>
                                        {order.observaciones}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Progressive Profiling Callout */}
                <div className="public-track-conversion-banner">
                    <div className="public-track-conversion-content">
                        <i className="bi bi-laptop public-track-conversion-icon" />
                        <div className="public-track-conversion-text">
                            <h4>¿Desea gestionar todos sus casos en línea?</h4>
                            <p>Active su cuenta en el Portal Oficial de AFINIX Lab para ver estados históricos y facturación.</p>
                        </div>
                    </div>
                    <Link to="/registro" className="btn-track-primary" style={{ textDecoration: 'none' }}>
                        <span>Crear Cuenta en Portal</span>
                        <i className="bi bi-arrow-right" />
                    </Link>
                </div>
            </main>

            {/* 3D Viewer Fullscreen / Modal */}
            {viewerOpen && (
                <div className="public-track-modal-overlay">
                    <div className="public-track-modal-header">
                        <div className="public-track-modal-title">
                            <i className="bi bi-box" />
                            <span>Visor Dental 3D Interactivo - {order.codigo}</span>
                        </div>
                        <button type="button" className="public-track-modal-close" onClick={() => setViewerOpen(false)} title="Cerrar visor">
                            <i className="bi bi-x-lg" />
                        </button>
                    </div>
                    <div className="public-track-modal-body">
                        {viewerLoading && (
                            <div className="public-track-iframe-loader">
                                <div className="spinner-border text-info" role="status" style={{ width: '2.5rem', height: '2.5rem' }} />
                                <span>Cargando modelo anatómico 3D...</span>
                            </div>
                        )}
                        {viewerError ? (
                            <div className="public-track-iframe-loader">
                                <i className="bi bi-exclamation-circle text-danger" style={{ fontSize: '2rem' }} />
                                <span>{viewerError}</span>
                                <button type="button" className="btn-track-primary" onClick={handleOpenViewer}>
                                    Reintentar Carga
                                </button>
                            </div>
                        ) : viewerUrl ? (
                            <iframe
                                ref={viewerFrameRef}
                                src={viewerUrl}
                                title="Visor 3D Dental"
                                className="public-track-iframe"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-pointer-lock"
                                allow="fullscreen"
                                onLoad={() => {
                                    // If direct webview link, stop loader immediately
                                    if (order?.approval?.isDirectWebLink) {
                                        setViewerLoading(false);
                                    }
                                }}
                            />
                        ) : null}
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="public-track-footer">
                <span><strong>AFINIX DENTAL LAB S.A.C.</strong> • RUC 20616033973</span>
                <span>Calle Piura 316, Mariano Melgar, Arequipa.</span>
                <span>Trazabilidad y Calidad Digital Odontológica</span>
            </footer>
        </div>
    );
};

export default PublicTrackingPage;
