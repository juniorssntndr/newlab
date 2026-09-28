import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WheelOfFortune from '../components/WheelOfFortune.jsx';

export default function RuletaKioskoPage() {
    const navigate = useNavigate();
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at 50% 20%, #0f172a 0%, #020617 100%)',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1.5rem',
            position: 'relative',
            overflowX: 'hidden'
        }}>
            {/* Barra superior de control del Kiosco */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                        boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)'
                    }}>
                        <i className="bi bi-disc-fill"></i>
                    </div>
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.05em', color: '#ffffff' }}>
                            AFINIX <span style={{ color: '#38bdf8' }}>LAB</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            AFINIX DENTAL LAB S.A.C. · Ruleta de Beneficios
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        type="button"
                        className="btn btn-outline-light btn-sm"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.5rem 0.85rem'
                        }}
                    >
                        <i className={`bi ${isFullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`}></i>
                        {isFullscreen ? 'Salir Pantalla Completa' : 'Pantalla Completa'}
                    </button>

                    <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => navigate('/marketing')}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                            color: '#cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.5rem 0.85rem'
                        }}
                    >
                        <i className="bi bi-x-circle"></i>
                        Cerrar Modo Evento
                    </button>
                </div>
            </div>

            {/* Contenedor central con la Ruleta */}
            <div style={{
                maxWidth: '1000px',
                width: '100%',
                margin: '2rem auto',
                zIndex: 10
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <span style={{
                        display: 'inline-block',
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '20px',
                        padding: '0.3rem 1rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: '0.5rem'
                    }}>
                        ¡Gira, Gana y Construyamos Sonrisas!
                    </span>
                    <h1 style={{
                        margin: 0,
                        fontSize: '2rem',
                        fontWeight: 800,
                        background: 'linear-gradient(to right, #ffffff, #93c5fd)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        Premios y Descuentos Exclusivos en Trabajos Dentales
                    </h1>
                </div>

                <WheelOfFortune isKiosk={true} />
            </div>

            {/* Footer legal y discreto */}
            <div style={{
                textAlign: 'center',
                fontSize: '0.78rem',
                color: '#64748b',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '1rem',
                zIndex: 10
            }}>
                AFINIX DENTAL LAB S.A.C. · RUC 20616033973 · Calle Piura 316, Mariano Melgar, Arequipa · Perú
            </div>
        </div>
    );
}
