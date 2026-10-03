import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../state/AuthContext.jsx';
import {
    canAccessModule,
    isClientRole
} from '../utils/accessControl.js';
import { useOrdersListQuery } from '../modules/orders/queries/useOrdersListQuery.js';
import { apiClient } from '../services/http/apiClient.js';
import AfinixLogo from './AfinixLogo.jsx';

const getAppLogoTheme = () => (
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
);

const Sidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
    const location = useLocation();
    const { user, token, logout } = useAuth();
    const isClient = isClientRole(user);
    const [logoTheme, setLogoTheme] = useState(getAppLogoTheme);

    useEffect(() => {
        const syncLogoTheme = () => setLogoTheme(getAppLogoTheme());
        syncLogoTheme();
        const observer = new MutationObserver(syncLogoTheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });
        return () => observer.disconnect();
    }, []);

    const pendingApprovalQuery = useOrdersListQuery({
        filters: { estado: 'esperando_aprobacion' },
        enabled: isClient,
    });
    const pendingApprovalCount = isClient && Array.isArray(pendingApprovalQuery.data)
        ? pendingApprovalQuery.data.length
        : 0;

    const staffPendingOrdersQuery = useOrdersListQuery({
        filters: { estado: 'pendiente' },
        enabled: !isClient && canAccessModule(user, 'pedidos'),
    });
    const pendingOrdersCount = !isClient && Array.isArray(staffPendingOrdersQuery.data)
        ? staffPendingOrdersQuery.data.length
        : 0;

    const pendingUsersQuery = useQuery({
        queryKey: ['usuarios', 'pendientes_count'],
        queryFn: async () => {
            try {
                const data = await apiClient('/usuarios/pendientes-count', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                return Number(data?.count) || 0;
            } catch {
                return 0;
            }
        },
        enabled: !isClient && Boolean(token && canAccessModule(user, 'usuarios')),
        refetchInterval: 30000,
    });
    const pendingUsersCount = pendingUsersQuery.data || 0;

    const staffLinks = [
        ...(canAccessModule(user, 'dashboard')
            ? [{ to: '/dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' }]
            : []),
        ...(canAccessModule(user, 'pedidos')
            ? [{
                to: '/pedidos',
                icon: 'bi-clipboard2-pulse',
                label: 'Gestión de pedidos',
                badge: pendingOrdersCount,
                badgeLabel: pendingOrdersCount === 1 ? '1 nuevo pedido' : `${pendingOrdersCount} nuevos pedidos`
            }]
            : []),
        ...(canAccessModule(user, 'caja')
            ? [{ to: '/caja-gastos', icon: 'bi-wallet2', label: 'Caja y Facturación' }]
            : []),
        ...(canAccessModule(user, 'cobros')
            ? [{ to: '/finanzas', icon: 'bi-cash-stack', label: 'Gestión de Cobros' }]
            : []),
        ...(canAccessModule(user, 'calendario')
            ? [{ to: '/calendario', icon: 'bi-calendar3', label: 'Calendario' }]
            : []),
        ...(canAccessModule(user, 'crm')
            ? [
                {
                    to: '/crm/resumen',
                    icon: 'bi-person-lines-fill',
                    label: 'Gestión de Clientes',
                    isActive: (loc) => loc.pathname.startsWith('/crm'),
                },
            ]
            : []),
        ...(canAccessModule(user, 'marketing')
            ? [
                {
                    to: '/marketing',
                    icon: 'bi-megaphone',
                    label: 'Marketing',
                    isActive: (loc) => loc.pathname.startsWith('/marketing'),
                },
            ]
            : []),
        ...(canAccessModule(user, 'catalogo')
            ? [{ to: '/productos', icon: 'bi-box-seam', label: 'Catálogo' }]
            : []),
        ...(canAccessModule(user, 'almacen')
            ? [{ to: '/almacen', icon: 'bi-boxes', label: 'Almacén' }]
            : []),
        ...(canAccessModule(user, 'usuarios')
            ? [{
                to: '/equipo',
                icon: 'bi-people',
                label: 'Usuarios',
                badge: pendingUsersCount,
                badgeLabel: pendingUsersCount === 1
                    ? '1 solicitud de cliente pendiente'
                    : `${pendingUsersCount} solicitudes de cliente pendientes`,
            }]
            : []),
        { to: '/cuenta', icon: 'bi-person-circle', label: 'Cuenta' },
    ];

    const clientLinks = [
        { to: '/pedidos/nuevo', icon: 'bi-plus-circle', label: 'Pedir' },
        {
            to: '/pedidos',
            icon: 'bi-clipboard2-pulse',
            label: 'Mis pedidos',
            badge: pendingApprovalCount,
            badgeLabel: pendingApprovalCount === 1
                ? '1 pedido por aprobar'
                : `${pendingApprovalCount} pedidos por aprobar`,
        },
        { to: '/mi-calendario', icon: 'bi-calendar3', label: 'Calendario' },
        { to: '/cuenta', icon: 'bi-person-circle', label: 'Cuenta' },
    ];

    const navItems = isClient ? clientLinks : staffLinks;

    return (
        <>
            {mobileOpen && <div className="sidebar-overlay" onClick={onMobileClose} />}
            <aside id="app-sidebar" className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-brand">
                    <AfinixLogo showText={!collapsed} size={collapsed ? 32 : 36} theme={logoTheme} />
                </div>

                <nav className="sidebar-nav" aria-label="Navegación principal">
                    <div className="nav-section nav-section--flat">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) => {
                                    const active = item.isActive ? item.isActive(location) : isActive;
                                    return `nav-item ${active ? 'active' : ''}${item.badge > 0 ? ' has-badge' : ''}`;
                                }}
                                onClick={onMobileClose}
                                end={item.to === '/pedidos' || item.to === '/pedidos/nuevo' || item.to === '/catalogo'}
                            >
                                <i className={`bi ${item.icon}`}></i>
                                <span className="nav-item-label">{item.label}</span>
                                {item.badge > 0 ? (
                                    <span
                                        className={`nav-item-badge ${item.badge < 10 ? 'is-circle' : ''}`}
                                        aria-label={item.badgeLabel || `${item.badge} pendientes`}
                                    >
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                ) : null}
                                <div className="nav-tooltip">{item.label}</div>
                            </NavLink>
                        ))}
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <button type="button" className="sidebar-toggle desktop-only" onClick={onToggle}>
                        <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
                        <span>Colapsar</span>
                        <div className="nav-tooltip">{collapsed ? 'Expandir' : 'Colapsar'}</div>
                    </button>
                    <button
                        type="button"
                        className="sidebar-toggle"
                        onClick={logout}
                        style={{ marginTop: '0.5rem', color: '#EF4444' }}
                    >
                        <i className="bi bi-box-arrow-left"></i>
                        <span>Cerrar sesion</span>
                        <div className="nav-tooltip">Cerrar sesion</div>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
