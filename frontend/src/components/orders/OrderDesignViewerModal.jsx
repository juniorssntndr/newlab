import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createOrderViewerSession } from '../../modules/orders/api/ordersApi.js';
import '../../styles/order-design-viewer.css';

const QUICK_TAGS = [
    'Ajuste oclusal',
    'Punto de contacto mesial',
    'Punto de contacto distal',
    'Perfil de emergencia',
    'Grosor mínimo',
    'Anatomía cúspide'
];

export const OrderDesignViewerModal = ({
    open,
    onClose,
    order,
    approval,
    isClient,
    isLab,
    onApprove,
    onReject,
    updating,
    onOpenUploadModal
}) => {
    const [iframeLoading, setIframeLoading] = useState(true);
    const [viewerUrl, setViewerUrl] = useState('');
    const [viewerError, setViewerError] = useState('');
    const [viewerAttempt, setViewerAttempt] = useState(0);
    const [adjustDrawerOpen, setAdjustDrawerOpen] = useState(false);
    const [adjustComment, setAdjustComment] = useState('');
    const textareaRef = useRef(null);
    const viewerFrameRef = useRef(null);

    const approvalId = approval?.id;

    useEffect(() => {
        if (!open) {
            setAdjustDrawerOpen(false);
            setAdjustComment('');
            setIframeLoading(true);
            setViewerUrl('');
            setViewerError('');
            return;
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (adjustDrawerOpen) {
                    setAdjustDrawerOpen(false);
                } else {
                    onClose?.();
                }
            }
        };

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, adjustDrawerOpen, onClose]);

    useEffect(() => {
        if (!open || !order?.id || !approvalId) return undefined;
        let active = true;
        setIframeLoading(true);
        setViewerError('');
        setViewerUrl('');
        createOrderViewerSession({ orderId: order.id, approvalId })
            .then((result) => { if (active) setViewerUrl(result.url); })
            .catch((error) => { if (active) { setIframeLoading(false); setViewerError(error.message || 'No se pudo iniciar el visor seguro.'); } });
        return () => { active = false; };
    }, [open, order?.id, approvalId, viewerAttempt]);

    useEffect(() => {
        if (!iframeLoading || !viewerUrl) return undefined;
        const timer = window.setTimeout(() => {
            setIframeLoading(false);
            setViewerError('El modelo tardó demasiado en iniciar. Verifica el archivo HTML de Exocad e intenta nuevamente.');
        }, 20000);
        return () => window.clearTimeout(timer);
    }, [iframeLoading, viewerUrl]);

    useEffect(() => {
        if (!viewerUrl) return undefined;
        const expectedOrigin = new URL(viewerUrl).origin;
        const onViewerMessage = (event) => {
            if (event.origin !== expectedOrigin || event.source !== viewerFrameRef.current?.contentWindow) return;
            if (event.data?.type === 'afinix-viewer-ready' && event.data.detail === 'webgl') {
                setIframeLoading(false);
                setViewerError('');
            }
            if (event.data?.type === 'afinix-viewer-error') {
                setIframeLoading(false);
                setViewerError('No se pudo iniciar WebGL para este diseño. Verifica el archivo HTML de Exocad e intenta nuevamente.');
            }
        };
        window.addEventListener('message', onViewerMessage);
        return () => window.removeEventListener('message', onViewerMessage);
    }, [viewerUrl]);

    useEffect(() => {
        if (adjustDrawerOpen) {
            window.setTimeout(() => {
                textareaRef.current?.focus();
            }, 50);
        }
    }, [adjustDrawerOpen]);

    if (!open) return null;

    const handleAddChip = (text) => {
        setAdjustComment((prev) => {
            const trimmed = prev.trim();
            if (!trimmed) return text;
            return `${trimmed}, ${text.toLowerCase()}`;
        });
        textareaRef.current?.focus();
    };

    const handleConfirmAdjust = () => {
        const comment = adjustComment.trim();
        if (!comment) return;
        onReject?.(comment);
        setAdjustDrawerOpen(false);
    };

    const isPendingApproval = isClient && order?.estado === 'esperando_aprobacion' && approval?.estado !== 'aprobado';

    const modalContent = (
        <div className="order-design-viewer-backdrop" onClick={onClose}>
            <div
                className="order-design-viewer-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Visor 3D de Diseño Dental"
            >
                {/* Header */}
                <header className="order-design-viewer-header">
                    <div className="order-design-viewer-title-group">
                        <div className="order-design-viewer-badge-3d" aria-hidden="true">
                            <i className="bi bi-box"></i>
                        </div>
                        <div className="order-design-viewer-meta">
                            <div className="order-design-viewer-headline">
                                <span className="order-design-viewer-title-text" title={order?.codigo || 'Pedido'}>
                                    {order?.codigo || 'Pedido'}
                                </span>
                                {order?.paciente_nombre && (
                                    <>
                                        <span className="order-design-viewer-title-separator" aria-hidden="true">•</span>
                                        <span className="order-design-viewer-title-text" title={order.paciente_nombre}>
                                            {order.paciente_nombre}
                                        </span>
                                    </>
                                )}
                            <span className="order-design-viewer-version">Diseño 3D</span>
                            </div>
                            <div className="order-design-viewer-sub">
                                {order?.producto_nombre || 'Estructura CAD/CAM'} • AFINIX Dental Lab
                            </div>
                        </div>
                    </div>

                    <div className="order-design-viewer-header-actions">
                        {viewerUrl ? <a
                            href={viewerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="order-design-viewer-icon-btn"
                            title="Abrir en pestaña externa completa"
                            aria-label="Abrir en pestaña nueva"
                        >
                            <i className="bi bi-box-arrow-up-right"></i>
                            <span className="order-design-viewer-header-label">Pestaña nueva</span>
                        </a> : null}

                        {isLab && onOpenUploadModal && (
                            <button
                                type="button"
                                className="order-design-viewer-icon-btn"
                                onClick={() => {
                                    onClose?.();
                                    onOpenUploadModal?.();
                                }}
                                title="Subir nueva versión del diseño"
                                aria-label="Subir nueva versión del diseño"
                            >
                                <i className="bi bi-arrow-repeat"></i>
                                <span className="order-design-viewer-header-label">Nueva versión</span>
                            </button>
                        )}

                        <button
                            type="button"
                            className="order-design-viewer-icon-btn order-design-viewer-close-btn"
                            onClick={onClose}
                            title="Cerrar visor"
                            aria-label="Cerrar visor"
                        >
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                </header>

                {/* Main 3D Canvas / Iframe */}
                <div className="order-design-viewer-canvas-wrap">
                    {iframeLoading && (
                        <div className="order-design-viewer-loading">
                            <div className="order-design-viewer-spinner" aria-hidden="true"></div>
                            <span>Cargando modelo 3D interactivo...</span>
                        </div>
                    )}
                    {viewerError ? (
                        <div className="order-design-viewer-loading" role="alert">
                            <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
                            <span>{viewerError}</span>
                            <button type="button" className="order-design-viewer-icon-btn" onClick={() => setViewerAttempt((attempt) => attempt + 1)}>Reintentar</button>
                        </div>
                    ) : null}
                    {viewerUrl ? <iframe
                        ref={viewerFrameRef}
                        key={viewerUrl}
                        src={viewerUrl}
                        title="Visor Dental 3D"
                        className="order-design-viewer-iframe"
                        onLoad={() => { /* HTTP load is not model readiness; wait for the verified viewer handshake. */ }}
                        onError={() => { setIframeLoading(false); setViewerError('No se pudo cargar el visor seguro.'); }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-pointer-lock"
                        allow="fullscreen"
                    /> : null}

                    {/* In-Modal Adjust Drawer */}
                    {adjustDrawerOpen && (
                        <div className="order-design-viewer-adjust-drawer animate-fade-in" role="region" aria-label="Solicitar ajustes">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <strong style={{ color: '#f8fafc', fontSize: '0.875rem' }}>
                                    <i className="bi bi-chat-dots" style={{ color: '#f59e0b', marginRight: '0.5rem' }}></i>
                                    Solicitar ajustes al laboratorio
                                </strong>
                                <button
                                    type="button"
                                    onClick={() => setAdjustDrawerOpen(false)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                >
                                    <i className="bi bi-x"></i>
                                </button>
                            </div>

                            <div className="order-design-viewer-adjust-chips">
                                {QUICK_TAGS.map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        className="order-design-viewer-chip"
                                        onClick={() => handleAddChip(tag)}
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                ref={textareaRef}
                                className="order-design-viewer-textarea"
                                rows={3}
                                placeholder="Escribe aquí los cambios específicos que necesitas en la anatomía, margen u oclusión..."
                                value={adjustComment}
                                onChange={(e) => setAdjustComment(e.target.value)}
                            />

                            <div className="order-design-viewer-adjust-actions">
                                <button
                                    type="button"
                                    className="order-design-viewer-icon-btn"
                                    onClick={() => setAdjustDrawerOpen(false)}
                                    disabled={updating}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="order-design-viewer-btn-adjust"
                                    style={{ background: '#d97706', color: '#ffffff', border: 'none' }}
                                    onClick={handleConfirmAdjust}
                                    disabled={updating || !adjustComment.trim()}
                                >
                                    {updating ? 'Enviando...' : 'Enviar solicitud'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Decision Bar */}
                <footer className="order-design-viewer-bottom-bar">
                    {!isClient && (
                        <div className="order-design-viewer-instructions">
                            <i className="bi bi-hand-index-thumb"></i>
                            <span>Visualización de control de calidad CAD/CAM para técnicos y administración.</span>
                        </div>
                    )}

                    <div className="order-design-viewer-decision-btns">
                        {isPendingApproval ? (
                            <>
                                <button
                                    type="button"
                                    className="order-design-viewer-btn-adjust"
                                    onClick={() => setAdjustDrawerOpen((prev) => !prev)}
                                    disabled={updating}
                                >
                                    <i className="bi bi-chat-left-text"></i>
                                    <span>Solicitar ajuste</span>
                                </button>

                                <button
                                    type="button"
                                    className="order-design-viewer-btn-approve"
                                    onClick={() => onApprove?.()}
                                    disabled={updating}
                                >
                                    <i className="bi bi-check-circle-fill"></i>
                                    <span>{updating ? 'Aprobando...' : 'Aprobar diseño'}</span>
                                </button>
                            </>
                        ) : approval?.estado === 'aprobado' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 600, fontSize: '0.875rem' }}>
                                <i className="bi bi-patch-check-fill"></i>
                                Diseño Aprobado por el Cliente
                            </span>
                        ) : approval?.estado === 'ajuste_solicitado' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: 600, fontSize: '0.875rem' }}>
                                <i className="bi bi-exclamation-triangle-fill"></i>
                                Ajustes solicitados por el doctor
                            </span>
                        ) : (
                            <button
                                type="button"
                                className="order-design-viewer-icon-btn"
                                onClick={onClose}
                            >
                                Cerrar visor
                            </button>
                        )}
                    </div>
                </footer>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default OrderDesignViewerModal;
