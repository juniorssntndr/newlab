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
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="notification-toast"
                    onClick={() => handleToastClick(toast)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleToastClick(toast);
                        }
                    }}
                >
                    <div className="notification-toast-icon">
                        <i className="bi bi-bell-fill"></i>
                    </div>
                    <div className="notification-toast-content">
                        <div className="notification-toast-title">{toast.title || 'Nueva notificación'}</div>
                        {toast.message && <div className="notification-toast-message">{toast.message}</div>}
                    </div>
                    <button
                        type="button"
                        className="notification-toast-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            dismissToast(toast.id);
                        }}
                    >
                        <i className="bi bi-x"></i>
                    </button>
                </div>
            ))}
        </div>
    );
};

export default NotificationToasts;
