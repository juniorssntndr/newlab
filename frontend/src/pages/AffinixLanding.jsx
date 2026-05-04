import React, { lazy, Suspense } from 'react';
import { useReducedMotion } from 'framer-motion';
import '../styles/affinix-landing.css';
import LandingThemeToggle from '../components/affinix/LandingThemeToggle.jsx';
import { AffinixLandingBoot } from './affinixLanding/AffinixLandingBoot.jsx';
import { HeroCarousel, LandingNavbar } from './affinixLanding/AffinixLandingSections.jsx';
import { useLandingTheme } from './hooks/useLandingTheme.js';

const AffinixLandingBelowFold = lazy(() => import('./affinixLanding/AffinixLandingBelowFold.jsx'));

const AffinixLanding = () => {
    const reduceMotion = useReducedMotion();
    const { theme, toggle } = useLandingTheme();

    return (
        <AffinixLandingBoot reduceMotion={Boolean(reduceMotion)} theme={theme}>
            <main className="affinix-page" data-theme={theme} id="affinix-landing-root">
                <a className="skip-link" href="#inicio">
                    Ir al contenido
                </a>

                <LandingNavbar
                    reduceMotion={reduceMotion}
                    themeToggle={<LandingThemeToggle theme={theme} onToggle={toggle} />}
                />
                <HeroCarousel reduceMotion={reduceMotion} />
                <Suspense fallback={null}>
                    <AffinixLandingBelowFold reduceMotion={reduceMotion} />
                </Suspense>
            </main>
        </AffinixLandingBoot>
    );
};

export default AffinixLanding;
