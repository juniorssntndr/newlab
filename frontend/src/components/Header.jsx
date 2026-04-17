import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNotifications } from '../state/NotificationContext.jsx';
import { useNavigate } from 'react-router-dom';

const Header = ({ onMenuClick }) => {
    const { user, logout } = useAuth();
    const { unreadCount, setPanelOpen, panelOpen } = useNotifications();
    const [dark, setDark] = useState(() => localStorage.getItem('nl_theme') === 'dark');
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        localStorage.setItem('nl_theme', dark ? 'dark' : 'light');
    }, [dark]);

    useEffect(() => {
        const handleClick = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const initials = (user?.nombre || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <header className="app-header">
            <div className="header-left">
                <button
                    type="button"
                    className="header-btn"
                    onClick={onMenuClick}
                    id="mobile-menu-btn"
                    aria-label="Abrir menu de navegacion"
                    aria-controls="app-sidebar"
                >
                    <i className="bi bi-list" aria-hidden="true"></i>
                </button>
            </div>
            <div className="header-right">
                <button
                    type="button"
                    className="header-btn"
                    onClick={() => setDark(!dark)}
                    title="Cambiar tema"
                    aria-label={`Cambiar a tema ${dark ? 'claro' : 'oscuro'}`}
                    aria-pressed={dark}
                >
                    <i className={`bi ${dark ? 'bi-sun' : 'bi-moon'}`} aria-hidden="true"></i>
                </button>

                <button
                    type="button"
                    className="header-btn"
                    onClick={() => setPanelOpen(!panelOpen)}
                    title="Notificaciones"
                    aria-label={unreadCount > 0 ? `Ver notificaciones, ${unreadCount} sin leer` : 'Ver notificaciones'}
                    aria-expanded={panelOpen}
                    aria-controls="notifications-panel"
                >
                    <i className="bi bi-bell" aria-hidden="true"></i>
                    {unreadCount > 0 && (
                        <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
                </button>

                <div className="user-menu" ref={menuRef}>
                    <button
                        type="button"
                        className="user-avatar"
                        title={user?.nombre}
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label={`Abrir menu de usuario de ${user?.nombre || 'usuario'}`}
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                    >
                        {initials}
                    </button>
                    {menuOpen && (
                        <div className="user-dropdown" role="menu">
                            <div className="user-dropdown-header">
                                <div className="user-dropdown-name">{user?.nombre}</div>
                                <div className="user-dropdown-meta">{user?.email}</div>
                            </div>
                            <button type="button" className="user-dropdown-item" role="menuitem" onClick={() => { navigate('/cuenta'); setMenuOpen(false); }}>
                                <i className="bi bi-person" aria-hidden="true"></i> Mi cuenta
                            </button>
                            {user?.tipo === 'admin' && (
                                <button type="button" className="user-dropdown-item" role="menuitem" onClick={() => { navigate('/equipo'); setMenuOpen(false); }}>
                                    <i className="bi bi-people" aria-hidden="true"></i> Equipo
                                </button>
                            )}
                            <button type="button" className="user-dropdown-item danger" role="menuitem" onClick={() => { logout(); setMenuOpen(false); }}>
                                <i className="bi bi-box-arrow-left" aria-hidden="true"></i> Cerrar sesion
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
