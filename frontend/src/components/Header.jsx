import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNotifications } from '../state/NotificationContext.jsx';

const Header = ({ onMenuClick }) => {
    const { user } = useAuth();
    const { unreadCount, setPanelOpen, panelOpen } = useNotifications();
    const [dark, setDark] = useState(() => localStorage.getItem('nl_theme') === 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        localStorage.setItem('nl_theme', dark ? 'dark' : 'light');
    }, [dark]);

    const initials = (user?.nombre || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <header className="app-header">
            <div className="header-left">
                <button className="header-btn" onClick={onMenuClick} style={{ display: 'none' }}
                    id="mobile-menu-btn">
                    <i className="bi bi-list"></i>
                </button>
            </div>
            <div className="header-right">
                <button className="header-btn" onClick={() => setDark(!dark)} title="Cambiar tema">
                    <i className={`bi ${dark ? 'bi-sun' : 'bi-moon'}`}></i>
                </button>

                <button className="header-btn" onClick={() => setPanelOpen(!panelOpen)} title="Notificaciones">
                    <i className="bi bi-bell"></i>
                    {unreadCount > 0 && (
                        <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
                </button>

                <div className="user-avatar" title={user?.nombre}>
                    {initials}
                </div>
            </div>
        </header>
    );
};

export default Header;
