import React from 'react';
import { whatsappOpeningHref } from '../../config/siteSeo.js';

export const HeroV2 = () => {
    return (
        <section className="afinix-v2-section afinix-v2-hero" id="inicio">
            <div className="afinix-v2-container">
                <div className="afinix-v2-hero-grid">
                    <div className="afinix-v2-hero-content">
                        <div className="afinix-v2-hero-badge">
                            <i className="bi bi-gift-fill" aria-hidden="true"></i>
                            <span>50% OFF de Bienvenida en tu Primer Caso</span>
                        </div>

                        <h1 className="afinix-v2-hero-h1">
                            Laboratorio Dental Digital en Arequipa: <span className="highlight">Prótesis listas para cementar</span> sin retoques en sillón.
                        </h1>

                        <p className="afinix-v2-hero-desc">
                            Ayudamos a odontólogos y clínicas a trabajar con máxima previsibilidad: aprobación digital de diseño 3D en tu celular antes de fresar, materiales certificados y entregas trazables desde 48 horas.
                        </p>

                        <div className="afinix-v2-hero-actions">
                            <a
                                href={whatsappOpeningHref()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="afinix-v2-btn afinix-v2-btn--whatsapp"
                            >
                                <i className="bi bi-whatsapp" aria-hidden="true"></i>
                                <span>Enviar caso con 50% de descuento</span>
                            </a>
                            <a href="#soluciones" className="afinix-v2-btn afinix-v2-btn--secondary">
                                <span>Ver soluciones y tiempos</span>
                                <i className="bi bi-arrow-down-short" aria-hidden="true"></i>
                            </a>
                        </div>

                        <div className="afinix-v2-hero-trust-row">
                            <div className="afinix-v2-trust-item">
                                <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                                <span>Aprobación 3D online</span>
                            </div>
                            <div className="afinix-v2-trust-item">
                                <i className="bi bi-clock-history" aria-hidden="true"></i>
                                <span>Entregas desde 48h</span>
                            </div>
                            <div className="afinix-v2-trust-item">
                                <i className="bi bi-geo-alt-fill" aria-hidden="true"></i>
                                <span>Arequipa con entrega a clínica</span>
                            </div>
                        </div>
                    </div>

                    <div className="afinix-v2-hero-visual">
                        <div className="afinix-v2-hero-card">
                            <div className="afinix-v2-hero-img-wrap">
                                <img
                                    src="/images/afinix-landing/hero-production.jpg"
                                    alt="Laboratorio dental digital AFINIX en Arequipa, fresado y ajuste CAD/CAM"
                                    loading="eager"
                                    decoding="async"
                                    width="1024"
                                    height="576"
                                />
                            </div>
                            <div className="afinix-v2-hero-features">
                                <div className="afinix-v2-feature-mini">
                                    <strong>99.2% de Adaptación</strong>
                                    <span>Cero desgastes innecesarios en sillón dental.</span>
                                </div>
                                <div className="afinix-v2-feature-mini">
                                    <strong>Diseño Exocad Previo</strong>
                                    <span>Revisás oclusión y morfología antes de fresar.</span>
                                </div>
                                <div className="afinix-v2-feature-mini">
                                    <strong>Zirconia y Disilicato</strong>
                                    <span>Materiales biocompatibles de alto estándar estético.</span>
                                </div>
                                <div className="afinix-v2-feature-mini">
                                    <strong>Garantía de Reposición</strong>
                                    <span>Ajuste perfecto garantizado o repetimos sin costo.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
