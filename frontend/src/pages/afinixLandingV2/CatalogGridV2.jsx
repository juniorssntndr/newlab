import React, { useEffect, useState } from 'react';
import { services as fallbackServices } from '../afinixLanding/afinixLandingContent.js';

export const CatalogGridV2 = () => {
    const [products, setProducts] = useState(fallbackServices);

    useEffect(() => {
        let isMounted = true;
        fetch('/api/consultas/catalogo-landing')
            .then((r) => r.json())
            .then((res) => {
                if (isMounted && res?.ok && Array.isArray(res.data) && res.data.length > 0) {
                    setProducts(res.data);
                }
            })
            .catch(() => {});
        return () => { isMounted = false; };
    }, []);

    return (
        <section className="afinix-v2-section afinix-v2-catalog" id="soluciones">
            <div className="afinix-v2-container">
                <div className="afinix-v2-section-head">
                    <span className="afinix-v2-kicker">
                        <i className="bi bi-cpu-fill" aria-hidden="true"></i>
                        Catálogo de Soluciones Digitales
                    </span>
                    <h2 className="afinix-v2-section-title">
                        Tecnología CAD/CAM y Materiales de Alta Precisión
                    </h2>
                    <p className="afinix-v2-section-sub">
                        Rango completo de prótesis fijas, restauraciones estéticas y guías quirúrgicas 3D fabricadas con fresadoras industriales y resinas biocompatibles clase IIa.
                    </p>
                </div>

                <div className="afinix-v2-catalog-grid">
                    {products.map((item, idx) => {
                        const quoteMessage = encodeURIComponent(
                            `Hola AFINIX Dental Lab, quisiera consultar y cotizar el servicio de ${item.name}.`
                        );
                        const waUrl = `https://wa.me/51910707060?text=${quoteMessage}`;

                        return (
                            <article className="afinix-v2-prod-card" key={item.name || item.id}>
                                <div className="afinix-v2-prod-media">
                                    <img
                                        src={item.image}
                                        alt={`${item.name} - AFINIX Dental Lab`}
                                        loading="lazy"
                                        decoding="async"
                                        width="1024"
                                        height="576"
                                    />
                                    <span className="afinix-v2-prod-index">
                                        {String(idx + 1).padStart(2, '0')}
                                    </span>
                                </div>

                                <div className="afinix-v2-prod-body">
                                    <h3 className="afinix-v2-prod-title">{item.name}</h3>
                                    <p className="afinix-v2-prod-desc">{item.detail}</p>

                                    {item.material && (
                                        <span className="afinix-v2-prod-pill">
                                            <i className="bi bi-shield-check" aria-hidden="true"></i>
                                            <span>{item.material}</span>
                                        </span>
                                    )}
                                </div>

                                <div className="afinix-v2-prod-foot">
                                    <span className="afinix-v2-prod-time" aria-label={`Entrega en ${item.leadTime}`}>
                                        <i className="bi bi-clock-history" aria-hidden="true"></i>
                                        <span>{item.leadTime}</span>
                                    </span>
                                    <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="afinix-v2-prod-cta"
                                        aria-label={`Cotizar ${item.name} por WhatsApp`}
                                    >
                                        <span>Cotizar</span>
                                        <i className="bi bi-arrow-right" aria-hidden="true"></i>
                                    </a>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
