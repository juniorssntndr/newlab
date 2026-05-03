import React, { lazy, Suspense } from 'react';
import { useReducedMotion } from 'framer-motion';
import '../styles/affinix-landing.css';
import { AffinixLandingBoot } from './affinixLanding/AffinixLandingBoot.jsx';
import { HeroCarousel, LandingNavbar } from './affinixLanding/AffinixLandingSections.jsx';

const AffinixLandingBelowFold = lazy(() => import('./affinixLanding/AffinixLandingBelowFold.jsx'));

const AffinixLanding = () => {
    const reduceMotion = useReducedMotion();

    return (
        <AffinixLandingBoot reduceMotion={Boolean(reduceMotion)}>
            <main className="affinix-page" data-theme="dark" id="affinix-landing-root">
                <a className="skip-link" href="#inicio">
                    Ir al contenido
                </a>

                <LandingNavbar reduceMotion={reduceMotion} />
                <HeroCarousel reduceMotion={reduceMotion} />
                <Suspense fallback={null}>
                    <AffinixLandingBelowFold reduceMotion={reduceMotion} />
                </Suspense>
            </main>
        </AffinixLandingBoot>
    );
};

export default AffinixLanding;
