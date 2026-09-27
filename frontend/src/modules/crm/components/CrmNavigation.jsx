import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const CRM_TABS = [
    { to: '/crm/resumen', label: 'Resumen', icon: 'bi-speedometer2' },
    { to: '/crm/clinicas', label: 'Clínicas', icon: 'bi-building' },
    { to: '/crm/doctores', label: 'Doctores', icon: 'bi-person-badge' },
    { to: '/crm/prospectos', label: 'Prospectos', icon: 'bi-funnel' },
    { to: '/crm/visitas', label: 'Visitas', icon: 'bi-calendar-check' },
    { to: '/crm/mapa', label: 'Mapa Territorial', icon: 'bi-geo-alt' },
];

export const CrmNavigation = ({ title, subtitle, actions }) => {
    const location = useLocation();
    const navRef = useRef(null);

    useEffect(() => {
        if (!navRef.current) return;
        const activeLink = navRef.current.querySelector('.dashboard-view-tab.btn-primary');
        if (activeLink) {
            activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [location.pathname]);

    return (
        <div className="crm-nav-wrapper">
            <div className="page-header crm-page-header" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="page-header-left">
                    <h1>
                        <i className="bi bi-person-lines-fill text-primary" aria-hidden="true"></i>
                        {title || 'Gestión de Clientes'}
                    </h1>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {actions && <div className="page-header-right crm-page-header-actions">{actions}</div>}
            </div>

            <div
                ref={navRef}
                className="section-tabs dashboard-view-switcher crm-section-tabs"
                role="navigation"
                aria-label="Secciones de Gestión de Clientes"
                style={{ marginBottom: 'var(--space-5)' }}
            >
                {CRM_TABS.map((tab) => (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        className={({ isActive }) =>
                            `btn section-tab dashboard-view-tab ${isActive ? 'btn-primary' : 'btn-ghost'}`
                        }
                    >
                        <i className={`bi ${tab.icon}`} aria-hidden="true"></i>
                        <span>{tab.label}</span>
                    </NavLink>
                ))}
            </div>
        </div>
    );
};

export default CrmNavigation;
