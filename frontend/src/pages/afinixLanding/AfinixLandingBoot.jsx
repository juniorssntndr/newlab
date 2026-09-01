import React, { useEffect, useState } from 'react';
import AfinixLogo from '../../components/AfinixLogo';

const EXIT_ANIM_MS = 420;
const MIN_VISIBLE_MS = 520;

function waitForFonts() {
    if (typeof document === 'undefined' || !document.fonts?.ready) {
        return Promise.resolve();
    }
    return document.fonts.ready.catch(() => {});
}

function waitForWindowLoad() {
    if (typeof window === 'undefined') {
        return Promise.resolve();
    }
    if (document.readyState === 'complete') {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        window.addEventListener('load', resolve, { once: true });
    });
}

function doubleRaf() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
}

/** Precarga el mismo chunk que `lazy()` para que Swiper + workflow no monten durante el primer scroll. */
function waitForBelowFoldChunk() {
    return import('./AfinixLandingBelowFold.jsx');
}

/**
 * Pantalla de arranque: espera recursos críticos y el chunk inferior para que el primer scroll no compita
 * con hidratación pesada (Swiper, motion, workflow con scroll link).
 */
export function AfinixLandingBoot({ reduceMotion, theme = 'light', children }) {
    const [phase, setPhase] = useState(reduceMotion ? 'done' : 'boot');

    useEffect(() => {
        if (reduceMotion) {
            setPhase('done');
            return undefined;
        }

        let cancelled = false;
        let exitTimer;

        const run = async () => {
            const started = performance.now();
            await Promise.all([waitForFonts(), waitForWindowLoad(), waitForBelowFoldChunk()]);
            await doubleRaf();
            const elapsed = performance.now() - started;
            const pad = Math.max(0, MIN_VISIBLE_MS - elapsed);
            if (pad > 0) {
                await new Promise((r) => {
                    setTimeout(r, pad);
                });
            }
            if (cancelled) {
                return;
            }
            setPhase('exit');
            exitTimer = window.setTimeout(() => {
                if (!cancelled) {
                    setPhase('done');
                }
            }, EXIT_ANIM_MS);
        };

        run();

        return () => {
            cancelled = true;
            if (exitTimer) {
                window.clearTimeout(exitTimer);
            }
        };
    }, [reduceMotion]);

    useEffect(() => {
        if (phase === 'done') {
            return undefined;
        }
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.removeProperty('overflow');
        };
    }, [phase]);

    const showOverlay = phase !== 'done';

    return (
        <>
            <div
                className={phase === 'boot' ? 'afinix-boot-content is-booting' : 'afinix-boot-content'}
                aria-hidden={showOverlay}
            >
                {children}
            </div>
            {showOverlay ? (
                <div
                    className={`afinix-boot-overlay${phase === 'exit' ? ' afinix-boot-overlay--exit' : ''}`}
                    data-theme={theme}
                    role="status"
                    aria-live="polite"
                    aria-busy={phase === 'boot'}
                >
                    <span className="afinix-boot-sr">Cargando AFINIX Dental Lab</span>
                    <div className="afinix-boot-panel" aria-hidden="true">
                        <AfinixLogo size={48} showText={false} theme={theme} />
                        <div className="afinix-boot-bar" />
                    </div>
                </div>
            ) : null}
        </>
    );
}
