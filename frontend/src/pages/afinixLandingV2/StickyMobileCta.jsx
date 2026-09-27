import React from 'react';
import { whatsappOpeningHref } from '../../config/siteSeo.js';

export const StickyMobileCta = () => {
    return (
        <aside className="afinix-v2-sticky-bar" aria-label="Contacto rápido por WhatsApp">
            <div className="afinix-v2-sticky-text">
                <strong>¿Listo para tu primer caso?</strong>
                <small>🎁 50% de descuento activo</small>
            </div>
            <a
                href={whatsappOpeningHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="afinix-v2-btn afinix-v2-btn--whatsapp"
                aria-label="Contactar a AFINIX Dental Lab por WhatsApp"
            >
                <i className="bi bi-whatsapp" aria-hidden="true"></i>
                <span>Enviar Caso</span>
            </a>
        </aside>
    );
};
