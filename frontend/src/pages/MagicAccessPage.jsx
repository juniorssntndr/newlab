import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';

export const MagicAccessPage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { setSession } = useAuth();

    const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setErrorMessage('No se proporcionó ningún token de acceso.');
            return;
        }

        let isMounted = true;

        const authenticateMagicLink = async () => {
            try {
                const res = await fetch(`${API_URL}/auth/magic-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'El enlace de acceso ha expirado o no es válido.');
                }

                if (!isMounted) return;

                // Establecer sesión de 30 días
                setSession(data.token, data.user);
                setStatus('success');

                const targetRedirect = data.redirect || '/pedidos';

                // Redirigir de inmediato al pedido
                setTimeout(() => {
                    navigate(targetRedirect, { replace: true });
                }, 500);
            } catch (err) {
                if (!isMounted) return;
                setStatus('error');
                setErrorMessage(err.message || 'Error al validar el enlace de acceso.');
            }
        };

        authenticateMagicLink();

        return () => {
            isMounted = false;
        };
    }, [token, navigate, setSession]);

    const handleWhatsAppHelp = () => {
        const phone = String(import.meta.env.VITE_WHATSAPP_E164 || '51910707060').replace(/\D/g, '');
        const text = encodeURIComponent('Hola AFINIX Dental Lab, tuve un inconveniente con el enlace de acceso a mi pedido. ¿Podrían ayudarme?');
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                backgroundColor: '#050c18',
                color: '#ffffff',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '440px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '2.5rem 2rem',
                    textAlign: 'center',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(10px)'
                }}
            >
                <div style={{ marginBottom: '1.5rem' }}>
                    <div
                        style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '14px',
                            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.4)'
                        }}
                    >
                        <i className="bi bi-shield-check" style={{ fontSize: '1.75rem', color: '#ffffff' }}></i>
                    </div>
                </div>

                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#ffffff' }}>
                    AFINIX Dental Lab
                </h2>

                {status === 'loading' && (
                    <>
                        <p style={{ fontSize: '0.92rem', color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 1.5rem' }}>
                            Iniciando sesión segura en tu cuenta...
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
                            <div
                                className="spinner"
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    border: '3px solid rgba(255, 255, 255, 0.15)',
                                    borderTopColor: '#38bdf8',
                                    borderRadius: '50%',
                                    animation: 'spin 0.8s linear infinite'
                                }}
                            ></div>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.45)' }}>
                            Te estamos redirigiendo directamente a tu orden
                        </span>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div style={{ margin: '1.5rem 0', color: '#4ade80', fontSize: '2.5rem' }}>
                            <i className="bi bi-check-circle-fill"></i>
                        </div>
                        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 0.5rem' }}>
                            ¡Acceso verificado!
                        </p>
                        <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                            Entrando al seguimiento de tu trabajo...
                        </span>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div style={{ margin: '1.25rem 0', color: '#f87171', fontSize: '2.5rem' }}>
                            <i className="bi bi-exclamation-triangle-fill"></i>
                        </div>
                        <p style={{ fontSize: '0.98rem', fontWeight: 600, color: '#fca5a5', margin: '0 0 0.75rem' }}>
                            Enlace no disponible
                        </p>
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
                            {errorMessage}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button
                                type="button"
                                className="btn btn-success"
                                onClick={handleWhatsAppHelp}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.65rem 1rem',
                                    borderRadius: '8px',
                                    backgroundColor: '#25D366',
                                    borderColor: '#25D366',
                                    color: '#ffffff',
                                    fontWeight: 600,
                                    fontSize: '0.9rem'
                                }}
                            >
                                <i className="bi bi-whatsapp"></i>
                                <span>Solicitar nuevo enlace por WhatsApp</span>
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => navigate('/login')}
                                style={{
                                    padding: '0.65rem 1rem',
                                    borderRadius: '8px',
                                    fontSize: '0.88rem'
                                }}
                            >
                                Ir al inicio de sesión tradicional
                            </button>
                        </div>
                    </>
                )}
            </div>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default MagicAccessPage;
