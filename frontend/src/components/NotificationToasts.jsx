import React, { useState } from 'react';
import CampaignNotificationPreview from './CampaignNotificationPreview.jsx';
import { notificationData } from '../state/notificationCampaign.js';
import { resolveImageUrl } from '../utils/resolveImageUrl.js';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../state/NotificationContext.jsx';

const NotificationToasts = () => {
    const { toasts, notifications, dismissToast, markAsRead, setPanelOpen } = useNotifications();
    const navigate = useNavigate();
    const [campaign, setCampaign] = useState(null);

    // Auto-apertura inteligente (hasta 3 veces por cliente si no ha canjeado el beneficio)
    React.useEffect(() => {
        if (campaign) return;
        const unreadCampaign = (notifications || []).find(
            (n) => ['campana_marketing', 'prueba_campana'].includes(n.tipo)
        );
        if (unreadCampaign) {
            const notifId = unreadCampaign.id || unreadCampaign.notificationId;
            const sessionSeenKey = `afinix_session_seen_${notifId}`;
            const totalDismissKey = `afinix_dismiss_count_${notifId}`;
            const claimedKey = `afinix_claimed_campaign_${notifId}`;

            // Si ya lo canjeó o ya se mostró en esta sesión específica, no abrir automáticamente
            if (sessionStorage.getItem(sessionSeenKey) || localStorage.getItem(claimedKey)) {
                return;
            }

            // Permitir mostrar hasta 3 sesiones distintas si solo le dio a cerrar
            const dismissCount = parseInt(localStorage.getItem(totalDismissKey) || '0', 10);
            if (dismissCount < 3) {
                sessionStorage.setItem(sessionSeenKey, '1');
                setCampaign(unreadCampaign);
            }
        }
    }, [notifications, campaign]);

    const handleCloseCampaign = () => {
        if (campaign) {
            const notifId = campaign.id || campaign.notificationId;
            const sessionSeenKey = `afinix_session_seen_${notifId}`;
            const totalDismissKey = `afinix_dismiss_count_${notifId}`;
            sessionStorage.setItem(sessionSeenKey, '1');
            const currentCount = parseInt(localStorage.getItem(totalDismissKey) || '0', 10);
            localStorage.setItem(totalDismissKey, String(currentCount + 1));
        }
        setCampaign(null);
    };

    const navigateCampaign = async (couponCode, customLink) => {
        const targetLink = customLink || campaign?.link || '/pedidos/nuevo';
        const notifId = campaign?.id || campaign?.notificationId;
        if (notifId) {
            sessionStorage.setItem(`afinix_session_seen_${notifId}`, '1');
            // Marcar como canjeado para que no vuelva a molestar en pop-up automático
            localStorage.setItem(`afinix_claimed_campaign_${notifId}`, '1');
            try {
                await markAsRead(notifId);
            } catch {
                // silent
            }
        }
        setCampaign(null);
        navigate(targetLink, { state: couponCode ? { cupon: couponCode } : {} });
    };

    const handleToastClick = async (toast) => {
        if (!toast.read && toast.notificationId) {
            await markAsRead(toast.notificationId);
        }
        dismissToast(toast.id);
        if (['campana_marketing', 'prueba_campana'].includes(toast.tipo)) {
            setCampaign(toast);
            return;
        }
        if (toast.link) {
            setPanelOpen(false);
            navigate(toast.link);
        }
    };

    if (!toasts.length && !campaign) return null;

    return (
        <div className="notification-toast-stack" aria-live="polite" aria-atomic="false">
            <CampaignNotificationPreview notification={campaign} onClose={handleCloseCampaign} onNavigate={navigateCampaign} />
            {toasts.map((toast) => {
                const toastData = notificationData(toast.data);
                const isMarketing = toast.tipo === 'campana_marketing' || Boolean(toastData.campana_id);
                const imageUrl = resolveImageUrl(toastData.imagen_url);
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
                                    objectFit: 'contain',
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
