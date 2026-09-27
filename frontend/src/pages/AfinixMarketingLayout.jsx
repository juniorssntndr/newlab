import React from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import LandingThemeToggle from '../components/afinix/LandingThemeToggle.jsx';
import AfinixOpeningPopup from '../components/afinix/AfinixOpeningPopup.jsx';
import AfinixLogo from '../components/AfinixLogo.jsx';
import { useLandingTheme } from './hooks/useLandingTheme.js';
import { LandingNavbar } from './afinixLanding/AfinixLandingSections.jsx';
import { contactChannels, socialLinks } from './afinixLanding/afinixLandingContent.js';

const CLINIC_LOGIN_PATH = '/login?perfil=clinicas';

export function AfinixMarketingLayout({ children }) {
    const reduceMotion = useReducedMotion();
    const {
        theme,
        toggle,
        showSuggestion,
        acceptDarkSuggestion,
        dismissSuggestion
    } = useLandingTheme();

    return (
        <>
        <main className="afinix-page" data-theme={theme} id="afinix-marketing-root">
            <a className="skip-link" href="#contenido-principal">
                Ir al contenido
            </a>
            <LandingNavbar
                reduceMotion={Boolean(reduceMotion)}
                theme={theme}
                themeToggle={
                    <LandingThemeToggle
                        theme={theme}
                        onToggle={toggle}
                        showSuggestion={showSuggestion}
                        onAcceptSuggestion={acceptDarkSuggestion}
                        onDismissSuggestion={dismissSuggestion}
                    />
                }
            />
            <div id="contenido-principal">{children}</div>
            <footer className="afinix-footer afinix-final-cta" aria-label="Pie de página">
                <div className="afinix-footer-basic">
                    <AfinixLogo size={44} showText={true} theme={theme} />
                    <nav aria-label="Enlaces de footer" style={{ marginTop: '1rem' }}>
                        <a href="/#servicios">Servicios</a>
                        <a href="/#flujo">Flujo digital</a>
                        <a href="/#nosotros">Por qué AFINIX</a>
                        <a href="/coronas-cad-cam-arequipa">Coronas CAD/CAM</a>
                        <a href="/contacto">Contacto</a>
                        <a href="/politica-de-privacidad">Privacidad</a>
                    </nav>
                    <small style={{ marginTop: '1rem', display: 'block' }}>2026 AFINIX Dental Lab. Todos los derechos reservados.</small>
                    <div className="afinix-footer-channels">
                        {contactChannels.map((ch) => (
                            <a
                                key={ch.label}
                                href={ch.href}
                                className="afinix-footer-chan"
                                target={ch.external ? '_blank' : undefined}
                                rel={ch.external ? 'noopener noreferrer' : undefined}
                            >
                                <i className={`bi ${ch.icon}`} aria-hidden="true"></i>
                                <span>{ch.label}</span>
                            </a>
                        ))}
                        <div className="afinix-footer-socials">
                            {socialLinks.map((s) => (
                                <a
                                    key={s.label}
                                    href={s.href}
                                    className="afinix-footer-chan"
                                    target={s.external ? '_blank' : undefined}
                                    rel={s.external ? 'noopener noreferrer' : undefined}
                                    aria-label={s.label}
                                >
                                    <i className={`bi ${s.icon}`} aria-hidden="true"></i>
                                    <span>{s.label}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                    <div style={{ marginTop: '1.25rem' }}>
                        <Link className="afinix-login-link" to={CLINIC_LOGIN_PATH} aria-label="Entrar al portal">
                            <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                            <span className="afinix-login-link__label">Entrar al portal</span>
                        </Link>
                    </div>
                </div>
            </footer>
        </main>
        <AfinixOpeningPopup reduceMotion={Boolean(reduceMotion)} />
        </>
    );
}
