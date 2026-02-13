import React from 'react';
import { useNotifications } from '../state/NotificationContext.jsx';
import { useNavigate } from 'react-router-dom';

const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    return `Hace ${Math.floor(hrs / 24)}d`;
};

const NotificationsPanel = () => {
    const { notifications, unreadCount, setPanelOpen, markAsRead, markAllRead } = useNotifications();
    const navigate = useNavigate();

    const handleClick = (notif) => {
        if (!notif.leida) markAsRead(notif.id);
        if (notif.link) {
            navigate(notif.link);
            setPanelOpen(false);
        }
    };

    return (
        <div className="notifications-panel">
            <div className="notifications-header">
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                    Notificaciones {unreadCount > 0 && <span className="badge badge-pendiente" style={{ marginLeft: 8 }}>{unreadCount}</span>}
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {unreadCount > 0 && (
                        <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Marcar todas</button>
                    )}
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setPanelOpen(false)}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                    <div className="empty-state" style={{ padding: '3rem 1.5rem' }}>
                        <i className="bi bi-bell-slash empty-state-icon" style={{ fontSize: '2rem' }}></i>
                        <p className="empty-state-text">Sin notificaciones</p>
                    </div>
                ) : (
                    notifications.map(n => (
                        <div key={n.id} className={`notification-item ${!n.leida ? 'unread' : ''}`} onClick={() => handleClick(n)}>
                            {!n.leida && <div className="notification-dot" />}
                            <div className="notification-content">
                                <div className="notification-title-text">{n.titulo}</div>
                                {n.mensaje && <div className="notification-message">{n.mensaje}</div>}
                                <div className="notification-time">{timeAgo(n.created_at)}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default NotificationsPanel;
