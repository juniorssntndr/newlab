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
                <button className="header-btn" onClick={onMenuClick} id="mobile-menu-btn">
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

                <div className="user-menu" ref={menuRef}>
                    <button className="user-avatar" title={user?.nombre} onClick={() => setMenuOpen(!menuOpen)}>
                        {initials}
                    </button>
                    {menuOpen && (
                        <div className="user-dropdown">
                            <div className="user-dropdown-header">
                                <div className="user-dropdown-name">{user?.nombre}</div>
                                <div className="user-dropdown-meta">{user?.email}</div>
                            </div>
                            <button className="user-dropdown-item" onClick={() => { navigate('/cuenta'); setMenuOpen(false); }}>
                                <i className="bi bi-person"></i> Mi cuenta
                            </button>
                            {user?.tipo === 'admin' && (
                                <button className="user-dropdown-item" onClick={() => { navigate('/equipo'); setMenuOpen(false); }}>
                                    <i className="bi bi-people"></i> Equipo
                                </button>
                            )}
                            <button className="user-dropdown-item danger" onClick={() => { logout(); setMenuOpen(false); }}>
                                <i className="bi bi-box-arrow-left"></i> Cerrar sesion
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
