import React, { lazy, Suspense } from 'react';
import { useReducedMotion } from 'framer-motion';
import '../styles/afinix-landing.css';
import JsonLd from '../components/seo/JsonLd.jsx';
import SeoHead from '../components/seo/SeoHead.jsx';
import LandingThemeToggle from '../components/afinix/LandingThemeToggle.jsx';
import AfinixOpeningPopup from '../components/afinix/AfinixOpeningPopup.jsx';
import { buildJsonLdGraph, buildOrganizationJsonLd, buildWebSiteJsonLd } from '../config/seoJsonLd.js';
import { AfinixLandingBoot } from './afinixLanding/AfinixLandingBoot.jsx';
import { HeroCarousel, LandingNavbar } from './afinixLanding/AfinixLandingSections.jsx';
import { useLandingTheme } from './hooks/useLandingTheme.js';

const AfinixLandingBelowFold = lazy(() => import('./afinixLanding/AfinixLandingBelowFold.jsx'));

const AfinixLanding = () => {
    const reduceMotion = useReducedMotion();
    const { theme, toggle } = useLandingTheme();

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
                    themeToggle={<LandingThemeToggle theme={theme} onToggle={toggle} />}
                />
                <HeroCarousel reduceMotion={Boolean(reduceMotion)} />
                <Suspense fallback={null}>
                    <AfinixLandingBelowFold reduceMotion={Boolean(reduceMotion)} theme={theme} />
                </Suspense>
            </main>
            <AfinixOpeningPopup reduceMotion={Boolean(reduceMotion)} />
        </AfinixLandingBoot>
    );
};

export default AfinixLanding;
