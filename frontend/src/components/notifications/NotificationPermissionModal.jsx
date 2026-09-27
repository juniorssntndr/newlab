import React, { useState, useEffect } from 'react';
import { useNotifications } from '../../state/NotificationContext.jsx';
import { useAuth } from '../../state/AuthContext.jsx';
import Modal from '../Modal.jsx';

const DISMISSED_KEY = 'afinix_push_prompt_dismissed';

export const NotificationPermissionModal = () => {
    const { user } = useAuth();
    const {
        pushSupported,
        pushPermission,
        isPushSubscribed,
        enablePushNotifications
    } = useNotifications();

    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Solo para usuarios autenticados
        if (!user) return;

        // Comprobar soporte del navegador y permiso actual
        if (!pushSupported) return;
        if (pushPermission !== 'default' || isPushSubscribed) return;

        // Si ya fue descartado o aceptado previamente en este navegador
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed) return;

        // Mostrar suavemente con un retraso natural de 1.8 segundos tras entrar
        const timer = window.setTimeout(() => {
            setIsOpen(true);
        }, 1800);

        return () => window.clearTimeout(timer);
    }, [user, pushSupported, pushPermission, isPushSubscribed]);

    const handleAccept = async () => {
        setIsSubmitting(true);
        try {
            await enablePushNotifications();
            localStorage.setItem(DISMISSED_KEY, 'granted');
        } catch {
            // Error manejado en context
        } finally {
            setIsSubmitting(false);
            setIsOpen(false);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, 'dismissed');
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <Modal
            open={isOpen}
            onClose={handleDismiss}
            title="Seguimiento de pedidos"
            size="md"
            className="notif-permission-modal"
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleDismiss}
                        disabled={isSubmitting}
                    >
                        Ahora no
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAccept}
                        disabled={isSubmitting}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <i className="bi bi-bell-fill" aria-hidden="true" />
                        {isSubmitting ? 'Activando...' : 'Activar notificaciones'}
                    </button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.5rem 0' }}>
                <div
                    style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(14, 165, 233, 0.2))',
                        color: 'var(--color-primary, #2563EB)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.85rem',
                        marginBottom: '1rem',
                        boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.15)'
                    }}
                >
                    <i className="bi bi-bell-fill" aria-hidden="true" />
                </div>

                <h4 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                    Mantente al tanto del estado de tus pedidos
                </h4>

                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0, maxWidth: '380px' }}>
                    Recibe avisos inmediatos en este equipo cuando tu diseño 3D esté listo para aprobación, cuando un trabajo ingrese a producción o cuando esté en ruta de entrega.
                </p>

                <div
                    style={{
                        marginTop: '1.25rem',
                        padding: '0.75rem 1rem',
                        background: 'var(--color-surface-subtle, rgba(0, 0, 0, 0.03))',
                        borderRadius: 'var(--radius-md, 8px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        width: '100%',
                        textAlign: 'left',
                        fontSize: '0.82rem',
                        color: 'var(--color-text-secondary)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="bi bi-check-circle-fill text-primary" style={{ fontSize: '0.85rem' }} />
                        <span>Avisos de aprobación 3D en tiempo real</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="bi bi-check-circle-fill text-primary" style={{ fontSize: '0.85rem' }} />
                        <span>Actualizaciones de producción y despacho</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="bi bi-shield-check text-primary" style={{ fontSize: '0.85rem' }} />
                        <span>Puedes configurarlas o apagarlas cuando gustes</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default NotificationPermissionModal;
