import React from 'react';
import { whatsappOpeningHref } from '../../config/siteSeo.js';

export const TrustGuaranteeV2 = () => {
    return (
        <section className="afinix-v2-section afinix-v2-trust" id="garantia">
            <div className="afinix-v2-container">
                <div className="afinix-v2-trust-box">
                    <div className="afinix-v2-trust-info">
                        <span className="afinix-v2-kicker">
                            <i className="bi bi-patch-check-fill" aria-hidden="true"></i>
                            Seguridad clínica y legal
                        </span>
                        <h2 className="afinix-v2-trust-h2">
                            Laboratorio formalmente constituido con garantía total de adaptación
                        </h2>
                        <p className="afinix-v2-trust-p">
                            Detrás de cada restauración hay un paciente que confía en vos y una empresa sólida que respalda tu trabajo. En AFINIX Dental Lab te brindamos la seguridad de operar con una entidad legalmente registrada, procesos trazables y garantía de reposición sin costo si un caso requiere repetición.
                        </p>

                        <div className="afinix-v2-legal-pill-grid">
                            <div className="afinix-v2-legal-item">
                                <small>Razón Social Oficial</small>
                                <strong>AFINIX DENTAL LAB S.A.C.</strong>
                            </div>
                            <div className="afinix-v2-legal-item">
                                <small>RUC Activo y Habido</small>
                                <strong>20616033973</strong>
                            </div>
                            <div className="afinix-v2-legal-item">
                                <small>Sede Principal</small>
                                <strong>Calle Piura 316, Mariano Melgar</strong>
                            </div>
                            <div className="afinix-v2-legal-item">
                                <small>Actividad SUNAT</small>
                                <strong>CIIU 33118 (Eq. Médico y Quirúrgico)</strong>
                            </div>
                        </div>
                    </div>

                    <div className="afinix-v2-trust-cta-card">
                        <div style={{
                            background: 'rgba(0, 102, 255, 0.08)',
                            border: '1px solid var(--v2-border)',
                            borderRadius: 'var(--v2-radius-md)',
                            padding: '1.75rem',
                            textAlign: 'center'
                        }}>
                            <i className="bi bi-award-fill" style={{ fontSize: '3rem', color: 'var(--v2-cyan)', display: 'block', marginBottom: '0.75rem' }}></i>
                            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--v2-heading)' }}>
                                Garantía de Ajuste Cero Riesgo
                            </h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--v2-muted)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
                                Si cualquier pieza aprobada presenta desajuste marginal u oclusal clínicamente comprobable, la repetimos inmediatamente con prioridad máxima y sin costo alguno.
                            </p>
                            <a
                                href={whatsappOpeningHref()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="afinix-v2-btn afinix-v2-btn--primary"
                                style={{ width: '100%' }}
                            >
                                <i className="bi bi-whatsapp" aria-hidden="true"></i>
                                <span>Coordinar con un especialista</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
