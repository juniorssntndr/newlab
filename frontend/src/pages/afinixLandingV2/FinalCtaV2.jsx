import React from 'react';
import { whatsappOpeningHref } from '../../config/siteSeo.js';

export const FinalCtaV2 = () => {
    return (
        <section className="afinix-v2-section afinix-v2-final-cta">
            <div className="afinix-v2-container">
                <div className="afinix-v2-cta-banner">
                    <span className="afinix-v2-kicker" style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#fff', borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                        <i className="bi bi-gift-fill" aria-hidden="true"></i>
                        Cupón de Bienvenida Exclusivo
                    </span>
                    <h2 className="afinix-v2-cta-h2">
                        Comprobá la precisión de nuestro flujo en tu próximo paciente con 50% OFF
                    </h2>
                    <p className="afinix-v2-cta-sub">
                        Envianos tu archivo STL o coordinemos el recojo de tus modelos hoy mismo. Sin contratos de exclusividad, solo la tranquilidad de probar un laboratorio que respeta tu tiempo y tu criterio clínico.
                    </p>
                    <a
                        href={whatsappOpeningHref()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="afinix-v2-btn afinix-v2-btn--whatsapp"
                        style={{ fontSize: '1.05rem', padding: '0.9rem 2.2rem' }}
                    >
                        <i className="bi bi-whatsapp" aria-hidden="true" style={{ fontSize: '1.25rem' }}></i>
                        <span>Solicitar 50% de Descuento por WhatsApp</span>
                    </a>
                </div>
            </div>
        </section>
    );
};
