import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';

const Sidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const isClient = user?.tipo === 'cliente';

    const labLinks = [
        {
            section: 'Principal', items: [
                { to: '/dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' },
                { to: '/pedidos', icon: 'bi-clipboard2-pulse', label: 'Pedidos' },
                { to: '/calendario', icon: 'bi-calendar3', label: 'Calendario' },
            ]
        },
        {
            section: 'Gestión', items: [
                { to: '/clinicas', icon: 'bi-building', label: 'Clientes / CRM' },
                { to: '/productos', icon: 'bi-box-seam', label: 'Productos' },
                { to: '/almacen', icon: 'bi-boxes', label: 'Almacén' },
                ...(user?.tipo === 'admin' ? [{ to: '/equipo', icon: 'bi-people', label: 'Equipo' }] : [])
            ]
        },
    ];

    const clientLinks = [
        {
            section: 'Mi Portal', items: [
                { to: '/pedidos', icon: 'bi-clipboard2-pulse', label: 'Mis Pedidos' },
                { to: '/pedidos/nuevo', icon: 'bi-plus-circle', label: 'Nuevo Pedido' },
            ]
        },
    ];

    const navSections = isClient ? clientLinks : labLinks;

    return (
        <>
            {mobileOpen && <div className="sidebar-overlay" onClick={onMobileClose} style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99
            }} />}
            <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-brand">
                    <div className="brand-logo">N</div>
                    <div className="brand-text">
                        <span className="brand-name">NewLab</span>
                        <span className="brand-subtitle">Lab Dental</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navSections.map((section, idx) => (
                        <div className="nav-section" key={idx}>
                            <div className="nav-section-title">{section.section}</div>
                            {section.items.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    onClick={onMobileClose}
                                    end={item.to === '/pedidos'}
                                >
                                    <i className={`bi ${item.icon}`}></i>
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button className="sidebar-toggle" onClick={onToggle}>
                        <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
                        {!collapsed && <span>Colapsar</span>}
                    </button>
                    <button
                        className="sidebar-toggle"
                        onClick={logout}
                        style={{ marginTop: '0.5rem', color: '#EF4444' }}
                    >
                        <i className="bi bi-box-arrow-left"></i>
                        {!collapsed && <span>Cerrar sesion</span>}
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
