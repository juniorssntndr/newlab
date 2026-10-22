import React, { useState, useEffect } from 'react';

export const PwaInstallButton = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showIosTooltip, setShowIosTooltip] = useState(false);
    const [isIosDevice, setIsIosDevice] = useState(false);

    useEffect(() => {
        // 1. Detectar si ya está ejecutándose como PWA instalada
        const isRunningStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true ||
            document.referrer.includes('android-app://');

        setIsStandalone(isRunningStandalone);
        if (isRunningStandalone) return;

        // 2. Detectar si es iOS (Safari)
        const isIos = typeof navigator !== 'undefined' &&
            /iPad|iPhone|iPod/.test(navigator.userAgent) &&
            !window.MSStream;
        setIsIosDevice(isIos);

        // 3. Capturar el evento nativo de instalación en Android / Chrome
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        const handleAppInstalled = () => {
            setDeferredPrompt(null);
            setIsStandalone(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    // Si ya está instalada y abierta como app, no mostramos nada
    if (isStandalone) return null;

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            // Android / Chrome: Disparar el diálogo nativo del sistema
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        } else if (isIosDevice) {
            // iOS Safari: Mostrar guía de 2 pasos
            setShowIosTooltip((prev) => !prev);
        } else {
            // Fallback genérico para navegadores donde ya se rechazó o no disparó evento
            alert('Para instalar la app en tu celular: abre el menú de opciones (3 puntos) de tu navegador y selecciona "Instalar aplicación" o "Agregar a la pantalla principal".');
        }
    };

    return (
        <>
            <div
                style={{
                    position: 'fixed',
                    bottom: '22px',
                    right: '22px',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end'
                }}
            >
                {/* Tooltip instructivo para iPhone (iOS) */}
                {showIosTooltip && (
                    <div
                        style={{
                            marginBottom: '10px',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                            maxWidth: '250px',
                            fontSize: '0.82rem',
                            lineHeight: 1.4,
                            textAlign: 'left'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <strong style={{ color: '#38bdf8' }}>Instalar en iPhone</strong>
                            <button
                                type="button"
                                onClick={() => setShowIosTooltip(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                            >
                                ×
                            </button>
                        </div>
                        <span>
                            1. Toca el botón <strong>Compartir</strong> <i className="bi bi-box-arrow-up text-primary"></i> abajo en Safari.<br />
                            2. Selecciona <strong>"Agregar al inicio"</strong>.
                        </span>
                    </div>
                )}

                {/* Botón flotante circular */}
                <button
                    type="button"
                    onClick={handleInstallClick}
                    title="Instalar App AFINIX en tu celular"
                    aria-label="Instalar App AFINIX"
                    style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        backgroundColor: '#0284c7',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        border: '2px solid rgba(255, 255, 255, 0.25)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        boxShadow: '0 6px 18px rgba(2, 132, 199, 0.45)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.08)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <i className="bi bi-download" aria-hidden="true"></i>
                </button>
            </div>
        </>
    );
};

export default PwaInstallButton;
