import React from 'react';
import { NavLink } from 'react-router-dom';

const CRM_TABS = [
    { to: '/crm/resumen', label: 'Resumen', icon: 'bi-speedometer2' },
    { to: '/crm/clinicas', label: 'Clínicas', icon: 'bi-building' },
    { to: '/crm/doctores', label: 'Doctores', icon: 'bi-person-badge' },
    { to: '/crm/prospectos', label: 'Prospectos', icon: 'bi-funnel' },
    { to: '/crm/visitas', label: 'Visitas', icon: 'bi-calendar-check' },
    { to: '/crm/mapa', label: 'Mapa Territorial', icon: 'bi-geo-alt' },
];

export const CrmNavigation = ({ title, subtitle, actions }) => {
    return (
        <div className="crm-container" style={{ paddingBottom: 0 }}>
            <div className="crm-header">
                <div className="crm-title-area">
                    <h1>
                        <i className="bi bi-geo-fill text-primary"></i>
                        {title || 'CRM Comercial Territorial'}
                    </h1>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {actions && <div className="crm-actions">{actions}</div>}
            </div>

            <nav className="crm-nav-tabs" aria-label="Secciones del CRM">
                {CRM_TABS.map((tab) => (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        className={({ isActive }) => `crm-nav-tab ${isActive ? 'active' : ''}`}
                    >
                        <i className={`bi ${tab.icon}`}></i>
                        <span>{tab.label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
};

export default CrmNavigation;
