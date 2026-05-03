import React, { useEffect, useState } from 'react';

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
    return import('./AffinixLandingBelowFold.jsx');
}

/**
 * Pantalla de arranque: espera recursos críticos y el chunk inferior para que el primer scroll no compita
 * con hidratación pesada (Swiper, motion, workflow con scroll link).
 */
export function AffinixLandingBoot({ reduceMotion, children }) {
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
            document.body.style.overflow = prev;
        };
    }, [phase]);

    const showOverlay = phase !== 'done';

    return (
        <>
            <div
                className={phase === 'boot' ? 'affinix-boot-content is-booting' : 'affinix-boot-content'}
                aria-hidden={showOverlay}
            >
                {children}
            </div>
            {showOverlay ? (
                <div
                    className={`affinix-boot-overlay${phase === 'exit' ? ' affinix-boot-overlay--exit' : ''}`}
                    role="status"
                    aria-live="polite"
                    aria-busy={phase === 'boot'}
                >
                    <span className="affinix-boot-sr">Cargando Affinix LAB</span>
                    <div className="affinix-boot-panel" aria-hidden="true">
                        <div className="affinix-boot-mark">A</div>
                        <div className="affinix-boot-bar" />
                    </div>
                </div>
            ) : null}
        </>
    );
}
