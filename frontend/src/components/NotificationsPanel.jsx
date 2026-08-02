import React, { useEffect, useRef } from 'react';
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
    const panelRef = useRef(null);

    useEffect(() => {
        const handlePointerDown = (event) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (panelRef.current?.contains(target)) return;
            if (target instanceof Element && target.closest('[data-notifications-trigger]')) return;
            setPanelOpen(false);
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setPanelOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [setPanelOpen]);

    const handleClick = (notif) => {
        if (!notif.leida) markAsRead(notif.id);
        if (notif.link) {
            navigate(notif.link);
            setPanelOpen(false);
        }
    };

    return (
        <div
            ref={panelRef}
            className="notifications-panel"
            id="notifications-panel"
            role="dialog"
            aria-modal="false"
            aria-label="Notificaciones"
        >
            <div className="notifications-header">
                <h4 className="notifications-title">
                    Notificaciones
                    {unreadCount > 0 ? (
                        <span className="badge badge-pendiente notifications-unread-badge">{unreadCount}</span>
                    ) : null}
                </h4>
                <div className="notifications-header-actions">
                    {unreadCount > 0 ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={markAllRead}>
                            Marcar todas
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => setPanelOpen(false)}
                        aria-label="Cerrar notificaciones"
                    >
                        <i className="bi bi-x-lg" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div className="notifications-body">
                {notifications.length === 0 ? (
                    <p className="notifications-empty">Sin notificaciones</p>
                ) : (
                    <ul className="notifications-list">
                        {notifications.map((n) => (
                            <li key={n.id}>
                                <button
                                    type="button"
                                    className={`notification-item${!n.leida ? ' is-unread' : ''}`}
                                    onClick={() => handleClick(n)}
                                >
                                    <span
                                        className="notification-item-bar"
                                        aria-hidden="true"
                                    />
                                    <span className="notification-item-copy">
                                        <strong>{n.titulo}</strong>
                                        {n.mensaje ? <em>{n.mensaje}</em> : null}
                                        <span>{timeAgo(n.created_at)}</span>
                                    </span>
                                    <i className="bi bi-chevron-right" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="notifications-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPanelOpen(false)}>
                    Cerrar
                </button>
            </div>
        </div>
    );
};

export default NotificationsPanel;
