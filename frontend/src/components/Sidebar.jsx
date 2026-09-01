import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import {
    canAccessCrm,
    canAccessFinancialModules,
    canAccessLabProduction,
    isAdminRole,
    isClientRole,
    isOperatorRole,
    isTechnicianRole,
    isVisitorRole
} from '../utils/accessControl.js';
import { useOrdersListQuery } from '../modules/orders/queries/useOrdersListQuery.js';
import AfinixLogo from './AfinixLogo.jsx';

const getAppLogoTheme = () => (
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
);

const Sidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
    const { user, logout } = useAuth();
    const isClient = isClientRole(user);
    const isVisitor = isVisitorRole(user);
    const canAccessFinance = canAccessFinancialModules(user);
    const canAccessProduction = canAccessLabProduction(user);
    const canAccessCrmModule = canAccessCrm(user);
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

    const visitorLinks = [
        { to: '/crm/resumen', icon: 'bi-speedometer2', label: 'CRM Resumen' },
        { to: '/crm/clinicas', icon: 'bi-building', label: 'Clínicas' },
        { to: '/crm/doctores', icon: 'bi-person-badge', label: 'Doctores' },
        { to: '/crm/prospectos', icon: 'bi-funnel', label: 'Prospectos' },
        { to: '/crm/visitas', icon: 'bi-calendar-check', label: 'Visitas' },
        { to: '/crm/mapa', icon: 'bi-geo-alt', label: 'Mapa' },
        { to: '/cuenta', icon: 'bi-person-circle', label: 'Cuenta' },
    ];

    const labLinks = [
        ...(isAdminRole(user) || isOperatorRole(user)
            ? [{ to: '/dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' }]
            : []),
        { to: '/pedidos', icon: 'bi-clipboard2-pulse', label: 'Cola de pedidos' },
        ...(isAdminRole(user)
            ? [{ to: '/finanzas', icon: 'bi-cash-stack', label: 'Finanzas' }]
            : []),
        ...(canAccessFinance
            ? [{ to: '/caja-gastos', icon: 'bi-wallet2', label: isAdminRole(user) ? 'Caja y Gastos' : 'Caja' }]
            : []),
        { to: '/calendario', icon: 'bi-calendar3', label: 'Calendario' },
        ...(canAccessCrmModule
            ? [
                { to: '/crm/resumen', icon: 'bi-geo-fill', label: 'CRM Territorial' },
                { to: '/crm/clinicas', icon: 'bi-building', label: 'Clínicas' },
                { to: '/crm/doctores', icon: 'bi-person-badge', label: 'Doctores' },
            ]
            : []),
        ...(canAccessProduction
            ? [
                { to: '/productos', icon: 'bi-box-seam', label: 'Catálogo' },
                { to: '/almacen', icon: 'bi-boxes', label: 'Almacén' },
            ]
            : []),
        ...(isAdminRole(user) ? [{ to: '/equipo', icon: 'bi-people', label: 'Equipo' }] : []),
        { to: '/cuenta', icon: 'bi-person-circle', label: 'Cuenta' },
    ];

    const clientLinks = [
        { to: '/catalogo', icon: 'bi-plus-circle', label: 'Pedir' },
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

    const navItems = isClient ? clientLinks : isVisitor ? visitorLinks : labLinks;

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
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}${item.badge > 0 ? ' has-badge' : ''}`}
                                onClick={onMobileClose}
                                end={item.to === '/pedidos' || item.to === '/catalogo'}
                            >
                                <i className={`bi ${item.icon}`}></i>
                                <span>{item.label}</span>
                                {item.badge > 0 ? (
                                    <span
                                        className="nav-item-badge"
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
                    <button type="button" className="sidebar-toggle" onClick={onToggle}>
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
