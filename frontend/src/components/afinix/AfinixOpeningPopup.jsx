import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { whatsappOpeningHref } from '../../config/siteSeo.js';

const AUTO_CLOSE_MS = 10000;
const OPENING_BANNER_SRC = '/images/afinix-landing/opening-announcement-popup.png';
const OPENING_BANNER_ALT =
    'Llegamos a Arequipa. Aperturamos operaciones en aproximadamente 45 días. Toca para preinscribirte por WhatsApp.';

export default function AfinixOpeningPopup({ reduceMotion = false }) {
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(true);
    const closeRef = useRef(() => {});

    closeRef.current = () => setOpen(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return undefined;

        const timer = window.setTimeout(() => {
            closeRef.current();
        }, AUTO_CLOSE_MS);

        return () => window.clearTimeout(timer);
    }, [open]);

    useEffect(() => {
        if (!open || !mounted) return undefined;

        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeRef.current();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.removeProperty('overflow');
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, mounted]);

    if (!mounted || !open) return null;

    const handleClose = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
    };

    return createPortal(
        <div className="afinix-opening-popup" role="presentation">
            <button
                type="button"
                className="afinix-opening-popup__backdrop"
                onClick={handleClose}
                aria-label="Cerrar aviso de apertura"
            />
            <div
                className="afinix-opening-popup__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="afinix-opening-popup-title"
            >
                <button
                    type="button"
                    className="afinix-opening-popup__close"
                    onClick={handleClose}
                    aria-label="Cerrar aviso de apertura"
                >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
                <a
                    id="afinix-opening-popup-title"
                    className="afinix-opening-popup__link"
                    href={whatsappOpeningHref()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                >
                    <img
                        className="afinix-opening-popup__image"
                        src={OPENING_BANNER_SRC}
                        alt={OPENING_BANNER_ALT}
                        width={1080}
                        height={1920}
                        decoding="async"
                    />
                    <span className="afinix-opening-popup__cta">
                        <i className="bi bi-whatsapp" aria-hidden="true" />
                        Solicita información por WhatsApp
                    </span>
                </a>
                <div
                    className={`afinix-opening-popup__progress${reduceMotion ? ' afinix-opening-popup__progress--static' : ''}`}
                    aria-hidden="true"
                />
            </div>
        </div>,
        document.body,
    );
}
