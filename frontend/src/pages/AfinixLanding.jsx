import React, { lazy, Suspense } from 'react';
import { useReducedMotion } from 'framer-motion';
import '../styles/afinix-landing.css';
import LandingThemeToggle from '../components/afinix/LandingThemeToggle.jsx';
import { AfinixLandingBoot } from './afinixLanding/AfinixLandingBoot.jsx';
import { HeroCarousel, LandingNavbar } from './afinixLanding/AfinixLandingSections.jsx';
import { useLandingTheme } from './hooks/useLandingTheme.js';

const AfinixLandingBelowFold = lazy(() => import('./afinixLanding/AfinixLandingBelowFold.jsx'));

const AfinixLanding = () => {
    const reduceMotion = useReducedMotion();
    const { theme, toggle } = useLandingTheme();

    return (
        <AfinixLandingBoot reduceMotion={Boolean(reduceMotion)} theme={theme}>
            <main className="afinix-page" data-theme={theme} id="afinix-landing-root">
                <a className="skip-link" href="#inicio">
                    Ir al contenido
                </a>

                <LandingNavbar
                    reduceMotion={reduceMotion}
                    theme={theme}
                    themeToggle={<LandingThemeToggle theme={theme} onToggle={toggle} />}
                />
                <HeroCarousel reduceMotion={reduceMotion} />
                <Suspense fallback={null}>
                    <AfinixLandingBelowFold reduceMotion={reduceMotion} theme={theme} />
                </Suspense>
            </main>
        </AfinixLandingBoot>
    );
};

export default AfinixLanding;
