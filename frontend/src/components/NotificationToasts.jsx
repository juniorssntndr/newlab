import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../state/NotificationContext.jsx';

const NotificationToasts = () => {
    const { toasts, dismissToast, markAsRead, setPanelOpen } = useNotifications();
    const navigate = useNavigate();

    const handleToastClick = async (toast) => {
        if (!toast.read && toast.notificationId) {
            await markAsRead(toast.notificationId);
        }
        dismissToast(toast.id);
        if (toast.link) {
            setPanelOpen(false);
            navigate(toast.link);
        }
    };

    if (!toasts.length) return null;

    return (
        <div className="notification-toast-stack" aria-live="polite" aria-atomic="false">
            {toasts.map((toast) => {
                const toastData = typeof toast.data === 'string' ? JSON.parse(toast.data || '{}') : (toast.data || {});
                const isMarketing = toast.tipo === 'campana_marketing' || Boolean(toastData.campana_id);
                const imageUrl = toastData.imagen_url;
                const couponCode = toastData.codigo_descuento;

                return (
                    <div
                        key={toast.id}
                        className={`notification-toast${isMarketing ? ' notification-toast--marketing' : ''}`}
                        onClick={() => handleToastClick(toast)}
                        role="button"
                        tabIndex={0}
                        style={isMarketing ? {
                            border: '1px solid var(--color-primary, #0284c7)',
                            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.18)'
                        } : undefined}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleToastClick(toast);
                            }
                        }}
                    >
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt="Campaña"
                                style={{
                                    width: '46px',
                                    height: '46px',
                                    borderRadius: '8px',
                                    objectFit: 'cover',
                                    flexShrink: 0
                                }}
                            />
                        ) : (
                            <div className="notification-toast-icon" style={isMarketing ? { background: 'var(--color-primary-light)', color: 'var(--color-primary)' } : undefined}>
                                <i className={`bi ${isMarketing ? 'bi-gift-fill' : 'bi-bell-fill'}`}></i>
                            </div>
                        )}
                        <div className="notification-toast-content">
                            <div className="notification-toast-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>{toast.title || 'Nueva notificación'}</span>
                                {isMarketing && (
                                    <span style={{
                                        fontSize: '0.68rem',
                                        background: 'var(--color-primary-light)',
                                        color: 'var(--color-primary)',
                                        padding: '0.1rem 0.35rem',
                                        borderRadius: '4px',
                                        fontWeight: 700
                                    }}>
                                        AFINIX
                                    </span>
                                )}
                            </div>
                            {toast.message && <div className="notification-toast-message">{toast.message}</div>}
                            {couponCode && (
                                <div style={{ marginTop: '0.35rem' }}>
                                    <code style={{
                                        background: 'var(--color-bg-alt, #f1f5f9)',
                                        color: 'var(--color-primary, #0284c7)',
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.05em'
                                    }}>
                                        Cupón: {couponCode}
                                    </code>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="notification-toast-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!toast.read && toast.notificationId) {
                                    markAsRead(toast.notificationId);
                                }
                                dismissToast(toast.id);
                            }}
                            aria-label="Cerrar notificación"
                        >
                            <i className="bi bi-x"></i>
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default NotificationToasts;
