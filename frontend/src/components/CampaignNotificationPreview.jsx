import React, { useEffect, useState, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { notificationData } from '../state/notificationCampaign.js';
import { resolveImageUrl } from '../utils/resolveImageUrl.js';
import '../styles/marketing.css';

function useCountdown(targetDateStr) {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false });

    useEffect(() => {
        if (!targetDateStr) {
            // Si la campaña no define fecha específica, simula una oferta de 3 días para mantener la urgencia comercial
            const defaultTarget = new Date();
            defaultTarget.setDate(defaultTarget.getDate() + 3);
            targetDateStr = defaultTarget.toISOString().slice(0, 10);
        }

        const compute = () => {
            const datePart = targetDateStr.slice(0, 10);
            const target = new Date(`${datePart}T23:59:59`);
            const now = new Date();
            const diff = target.getTime() - now.getTime();

            if (diff <= 0) {
                return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const seconds = Math.floor((diff / 1000) % 60);

            return { days, hours, minutes, seconds, isExpired: false };
        };

        setTimeLeft(compute());
        const timer = setInterval(() => {
            setTimeLeft(compute());
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDateStr]);

    return timeLeft;
}

export default function CampaignNotificationPreview({ notification, onClose, onNavigate }) {
    const dialogRef = useRef(null);
    const titleId = useId();

    const data = notificationData(notification?.data);
    const countdown = useCountdown(data.fecha_fin);

    // Cierre con tecla Escape
    useEffect(() => {
        if (!notification) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose?.();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        dialogRef.current?.focus();

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [notification, onClose]);

    if (!notification) return null;

    const couponCode = data.codigo_descuento || null;
    const isTest = Boolean(data.prueba_campana);
    const flyerImage = resolveImageUrl(data.imagen_url) || '/images/promo-popup-bg.png';

    const handleActionClick = () => {
        const link = notification?.link || '/pedidos/nuevo';
        if (link === 'whatsapp') {
            const text = encodeURIComponent(couponCode
                ? `Hola AFINIX Dental Lab, tengo el cupón ${couponCode} y quiero aprovechar la promoción.`
                : 'Hola AFINIX Dental Lab, quiero aprovechar la promoción.');
            window.open(`https://wa.me/51910707060?text=${text}`, '_blank');
            onClose?.();
            return;
        }
        onNavigate?.(couponCode, link);
    };

    const pad = (n) => String(n).padStart(2, '0');

    const modalContent = (
        <div className="campaign-promo-backdrop" onClick={onClose}>
            <div
                className="campaign-flyer-card"
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Imagen base del flyer promocional */}
                <img
                    src={flyerImage}
                    alt="Promoción AFINIX Dental Lab"
                    className="campaign-flyer-bg-img"
                />

                {/* Botón flotante cerrar en la esquina superior derecha */}
                <button
                    type="button"
                    className="campaign-flyer-close-btn"
                    onClick={onClose}
                    aria-label="Cerrar promoción"
                    title="Cerrar"
                >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                </button>

                {/* Badge modo prueba */}
                {isTest && (
                    <div className="campaign-flyer-test-pill" role="status">
                        <i className="bi bi-flask" aria-hidden="true" />
                        <span>Vista de prueba</span>
                    </div>
                )}

                {/* Zona interactiva centrada sobre el espacio reservado del flyer */}
                <div className="campaign-flyer-interactive-zone">
                    {/* Contador regresivo en 4 tarjetas */}
                    <div className="campaign-flyer-countdown" aria-label="Tiempo restante de la oferta">
                        <div className="campaign-flyer-countdown-box">
                            <span className="campaign-flyer-countdown-num">{pad(countdown.days)}</span>
                            <span className="campaign-flyer-countdown-lbl">DÍAS</span>
                        </div>
                        <div className="campaign-flyer-countdown-box">
                            <span className="campaign-flyer-countdown-num">{pad(countdown.hours)}</span>
                            <span className="campaign-flyer-countdown-lbl">HORAS</span>
                        </div>
                        <div className="campaign-flyer-countdown-box">
                            <span className="campaign-flyer-countdown-num">{pad(countdown.minutes)}</span>
                            <span className="campaign-flyer-countdown-lbl">MINUTOS</span>
                        </div>
                        <div className="campaign-flyer-countdown-box">
                            <span className="campaign-flyer-countdown-num">{pad(countdown.seconds)}</span>
                            <span className="campaign-flyer-countdown-lbl">SEGUNDOS</span>
                        </div>
                    </div>

                    {/* Botón principal de acción */}
                    <button
                        type="button"
                        className="campaign-flyer-cta-btn"
                        onClick={handleActionClick}
                    >
                        <span>{data.texto_boton || 'QUIERO MI DESCUENTO'}</span>
                        <i className="bi bi-arrow-right" aria-hidden="true" />
                    </button>

                    {/* Enlace para descartar */}
                    <button
                        type="button"
                        className="campaign-flyer-dismiss-link"
                        onClick={onClose}
                    >
                        No, gracias
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
