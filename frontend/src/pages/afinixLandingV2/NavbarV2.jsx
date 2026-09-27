import React from 'react';
import AfinixLogo from '../../components/AfinixLogo.jsx';
import { whatsappOpeningHref } from '../../config/siteSeo.js';

export const NavbarV2 = ({ theme, onToggleTheme }) => {
    return (
        <header className="afinix-v2-nav">
            <div className="afinix-v2-container afinix-v2-nav-inner">
                <a href="#inicio" className="afinix-v2-brand" aria-label="AFINIX Dental Lab - Inicio">
                    <AfinixLogo theme={theme} size={36} showText={true} />
                </a>

                <nav className="afinix-v2-nav-actions" aria-label="Navegación principal">
                    <a href="#soluciones" className="afinix-v2-nav-link afinix-v2-nav-link--text">
                        Soluciones CAD/CAM
                    </a>
                    <a href="#flujo" className="afinix-v2-nav-link afinix-v2-nav-link--text">
                        Flujo Digital
                    </a>
                    <a href="#garantia" className="afinix-v2-nav-link afinix-v2-nav-link--text">
                        Garantía
                    </a>
                    <a href="#faq" className="afinix-v2-nav-link afinix-v2-nav-link--text">
                        FAQ
                    </a>

                    <button
                        type="button"
                        onClick={onToggleTheme}
                        className="afinix-v2-btn afinix-v2-btn--secondary"
                        aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.9rem' }}
                    >
                        <i className={`bi bi-${theme === 'dark' ? 'sun' : 'moon-stars'}`} aria-hidden="true"></i>
                    </button>

                    <a
                        href={whatsappOpeningHref()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="afinix-v2-btn afinix-v2-btn--whatsapp"
                    >
                        <i className="bi bi-whatsapp" aria-hidden="true"></i>
                        <span>50% OFF Primer Caso</span>
                    </a>
                </nav>
            </div>
        </header>
    );
};
