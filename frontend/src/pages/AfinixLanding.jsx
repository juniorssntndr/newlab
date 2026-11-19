import React, { lazy, Suspense, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import '../styles/afinix-landing.css';
import JsonLd from '../components/seo/JsonLd.jsx';
import SeoHead from '../components/seo/SeoHead.jsx';
import LandingThemeToggle from '../components/afinix/LandingThemeToggle.jsx';
import { buildJsonLdGraph, buildOrganizationJsonLd, buildWebSiteJsonLd } from '../config/seoJsonLd.js';
import { AfinixLandingBoot } from './afinixLanding/AfinixLandingBoot.jsx';
import { HeroCarousel, LandingNavbar } from './afinixLanding/AfinixLandingSections.jsx';
import { useLandingTheme } from './hooks/useLandingTheme.js';
import { useAuth } from '../state/AuthContext.jsx';
import { getDefaultRouteForUser } from '../utils/accessControl.js';

const AfinixLandingBelowFold = lazy(() => import('./afinixLanding/AfinixLandingBelowFold.jsx'));

const AfinixLanding = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const forceLanding = searchParams.get('landing') === 'true' || searchParams.get('web') === 'true';
    const sourcePwa = searchParams.get('source') === 'pwa';

    const reduceMotion = useReducedMotion();
    const {
        theme,
        toggle,
        showSuggestion,
        acceptDarkSuggestion,
        dismissSuggestion
    } = useLandingTheme();

    useEffect(() => {
        if (authLoading || forceLanding) return;

        const isStandalone = sourcePwa || (typeof window !== 'undefined' && (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true
        ));

        if (user) {
            // Si el usuario ya está autenticado, llevarlo directamente a su panel operativo
            navigate(getDefaultRouteForUser(user), { replace: true });
        } else if (isStandalone) {
            // Si abrió la aplicación instalada (PWA en escritorio o móvil) sin sesión activa, ir directo al login
            navigate('/login', { replace: true });
        }
    }, [user, authLoading, forceLanding, sourcePwa, navigate]);

    const isStandalone = sourcePwa || (typeof window !== 'undefined' && (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
    ));

    // Si el usuario ya está autenticado o abrió la app instalada, evitamos mostrar la landing mientras redirige
    if (!forceLanding && (user || (isStandalone && !authLoading))) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--color-bg, #0f172a)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div className="spinner-border text-primary" role="status" style={{ width: '2.5rem', height: '2.5rem' }}></div>
                    <p style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.875rem' }}>
                        {user ? 'Ingresando a tu panel...' : 'Cargando acceso...'}
                    </p>
                </div>
            </div>
        );
    }

    const homeGraph = buildJsonLdGraph([buildOrganizationJsonLd(), buildWebSiteJsonLd()]);

    return (
        <AfinixLandingBoot reduceMotion={Boolean(reduceMotion)} theme={theme}>
            <SeoHead
                title="AFINIX Dental Lab | Laboratorio dental digital en Arequipa para odontólogos y clínicas"
                description="En AFINIX Dental Lab ayudamos a odontólogos y clínicas de Arequipa a trabajar con mayor control, comunicación clara y seguimiento de sus casos. Coronas CAD/CAM, zirconia, disilicato y aprobación digital antes de producir."
                path="/"
            />
            {homeGraph ? <JsonLd id="ld-home-graph" data={homeGraph} /> : null}
            <main className="afinix-page" data-theme={theme} id="afinix-landing-root">
                <a className="skip-link" href="#inicio">
                    Ir al contenido
                </a>

                <LandingNavbar
                    reduceMotion={Boolean(reduceMotion)}
                    theme={theme}
                    themeToggle={
                        <LandingThemeToggle
                            theme={theme}
                            onToggle={toggle}
                            showSuggestion={false}
                        />
                    }
                />
                <HeroCarousel reduceMotion={Boolean(reduceMotion)} />
                <Suspense fallback={null}>
                    <AfinixLandingBelowFold reduceMotion={Boolean(reduceMotion)} theme={theme} />
                </Suspense>
            </main>
        </AfinixLandingBoot>
    );
};

export default AfinixLanding;
