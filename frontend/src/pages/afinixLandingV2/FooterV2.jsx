import React from 'react';
import { Link } from 'react-router-dom';
import AfinixLogo from '../../components/AfinixLogo.jsx';
import { whatsappHref, phoneCallHref, mapsHref } from '../../config/siteSeo.js';

export const FooterV2 = ({ theme }) => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="afinix-v2-footer">
            <div className="afinix-v2-container">
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '2.5rem',
                    marginBottom: '2.5rem'
                }}>
                    <div>
                        <div style={{ marginBottom: '1rem' }}>
                            <AfinixLogo theme={theme} size={36} showText={true} />
                        </div>
                        <p style={{ fontSize: '0.88rem', lineHeight: 1.6, maxWidth: '32ch', margin: '0 0 1rem' }}>
                            Laboratorio dental digital en Arequipa especializado en prótesis fija CAD/CAM, estética y guías quirúrgicas 3D.
                        </p>
                        <div style={{ fontSize: '0.82rem', color: 'var(--v2-muted)' }}>
                            <strong>AFINIX DENTAL LAB S.A.C.</strong><br />
                            RUC: 20616033973 • CIIU 33118
                        </div>
                    </div>

                    <div>
                        <h4 style={{ color: 'var(--v2-heading)', fontSize: '0.98rem', fontWeight: 800, margin: '0 0 1rem' }}>
                            Sede & Contacto
                        </h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.65rem', fontSize: '0.88rem' }}>
                            <li>
                                <i className="bi bi-geo-alt-fill" style={{ color: 'var(--v2-cyan)', marginRight: '0.5rem' }}></i>
                                <a href={mapsHref()} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                    Calle Piura 316, Mariano Melgar, Arequipa
                                </a>
                            </li>
                            <li>
                                <i className="bi bi-whatsapp" style={{ color: 'var(--v2-green-whatsapp)', marginRight: '0.5rem' }}></i>
                                <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                    +51 910 707 060 (WhatsApp Clínicas)
                                </a>
                            </li>
                            <li>
                                <i className="bi bi-telephone-fill" style={{ color: 'var(--v2-cyan)', marginRight: '0.5rem' }}></i>
                                <a href={phoneCallHref()} style={{ color: 'inherit', textDecoration: 'none' }}>
                                    Atención telefónica directa
                                </a>
                            </li>
                            <li>
                                <i className="bi bi-clock-fill" style={{ color: 'var(--v2-cyan)', marginRight: '0.5rem' }}></i>
                                <span>Lunes a Sábado: 8:00 am - 7:00 pm</span>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 style={{ color: 'var(--v2-heading)', fontSize: '0.98rem', fontWeight: 800, margin: '0 0 1rem' }}>
                            Acceso y Portales
                        </h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.65rem', fontSize: '0.88rem' }}>
                            <li>
                                <Link to="/login?perfil=clinicas" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}>
                                    <i className="bi bi-box-arrow-in-right" style={{ color: 'var(--v2-cyan)', marginRight: '0.5rem' }}></i>
                                    Portal para Clínicas y Odontólogos
                                </Link>
                            </li>
                            <li>
                                <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                                    <i className="bi bi-arrow-left-short" style={{ color: 'var(--v2-cyan)', marginRight: '0.5rem' }}></i>
                                    Ir a la versión interactiva (Landing 1)
                                </Link>
                            </li>
                            <li>
                                <a href="#soluciones" style={{ color: 'inherit', textDecoration: 'none' }}>
                                    Catálogo de Materiales y Tiempos
                                </a>
                            </li>
                            <li>
                                <a href="#garantia" style={{ color: 'inherit', textDecoration: 'none' }}>
                                    Términos de Garantía de Adaptación
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="afinix-v2-footer-bottom">
                    <p style={{ margin: 0 }}>
                        © {currentYear} AFINIX DENTAL LAB S.A.C. Todos los derechos reservados. Diseñado para la odontología digital moderna en Arequipa y el sur del Perú.
                    </p>
                </div>
            </div>
        </footer>
    );
};
