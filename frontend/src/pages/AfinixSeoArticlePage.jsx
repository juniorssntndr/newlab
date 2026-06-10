import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/afinix-landing.css';
import SeoHead from '../components/seo/SeoHead.jsx';
import JsonLd from '../components/seo/JsonLd.jsx';
import { absoluteUrl, defaultOgImagePath, privacyContactEmail, whatsappHref } from '../config/siteSeo.js';
import {
    buildBreadcrumbJsonLd,
    buildFaqJsonLd,
    buildJsonLdGraph,
    buildOrganizationJsonLd,
    buildServiceJsonLd,
    buildWebSiteJsonLd,
} from '../config/seoJsonLd.js';
import { AfinixMarketingLayout } from './AfinixMarketingLayout.jsx';
import { getSeoArticle } from './afinixLanding/seoArticlesData.js';

const CLINIC_LOGIN_PATH = '/login?perfil=clinicas';

/**
 * @param {{ path: string }} props
 */
export default function AfinixSeoArticlePage({ path }) {
    const article = getSeoArticle(path);

    if (!article) {
        return null;
    }

    const pageUrl = absoluteUrl(article.path);
    const ogImagePath = article.ogImagePath || defaultOgImagePath;
    const breadcrumb = buildBreadcrumbJsonLd([
        { name: 'Inicio', path: '/' },
        { name: article.title, path: article.path },
    ]);
    const org = buildOrganizationJsonLd();
    const web = buildWebSiteJsonLd();
    const serviceLd = article.serviceJsonLd ? buildServiceJsonLd(article.serviceJsonLd) : null;
    const faqLd = article.faqs?.length ? buildFaqJsonLd(article.faqs, pageUrl) : null;
    const graph = buildJsonLdGraph([org, web, breadcrumb, serviceLd, faqLd]);

    return (
        <AfinixMarketingLayout>
            <SeoHead title={article.title} description={article.description} path={article.path} ogImagePath={ogImagePath} />
            {graph ? <JsonLd id={`ld-seo-${path.replace(/^\//, '').replace(/\//g, '-') || 'page'}`} data={graph} /> : null}
            <article className="afinix-seo-article" lang="es-PE">
                <header className="afinix-section-heading afinix-seo-article__head">
                    <h1 className="afinix-services-title">{article.h1}</h1>
                </header>
                {article.lead.map((paragraph, index) => (
                    <p key={`lead-${index}`} className="afinix-seo-lead">
                        {paragraph}
                    </p>
                ))}
                {article.path === '/politica-de-privacidad' && privacyContactEmail() ? (
                    <p className="afinix-seo-lead">
                        <strong>Contacto para temas de privacidad:</strong>{' '}
                        <a href={`mailto:${privacyContactEmail()}`}>{privacyContactEmail()}</a>
                    </p>
                ) : null}
                {article.sections.map((section) => (
                    <section key={section.h2}>
                        <h2>{section.h2}</h2>
                        {section.p.map((paragraph, index) => (
                            <p key={`${section.h2}-${index}`}>{paragraph}</p>
                        ))}
                    </section>
                ))}
                {article.faqs?.length ? (
                    <section className="afinix-seo-faq" aria-label="Preguntas frecuentes">
                        <h2>Preguntas frecuentes</h2>
                        {article.faqs.map((item) => (
                            <details key={item.question}>
                                <summary>{item.question}</summary>
                                <p>{item.answer}</p>
                            </details>
                        ))}
                    </section>
                ) : null}
                <div className="afinix-seo-actions">
                    <a className="afinix-hero-btn afinix-hero-btn--primary" href={whatsappHref()} target="_blank" rel="noopener noreferrer">
                        Enviar caso por WhatsApp
                        <i className="bi bi-whatsapp" aria-hidden="true"></i>
                    </a>
                    <Link className="afinix-hero-btn afinix-hero-btn--ghost" to={CLINIC_LOGIN_PATH}>
                        Entrar al portal
                        <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                    </Link>
                    <a className="afinix-hero-btn afinix-hero-btn--ghost" href="/#servicios">
                        Ver servicios
                        <i className="bi bi-arrow-right" aria-hidden="true"></i>
                    </a>
                </div>
            </article>
        </AfinixMarketingLayout>
    );
}
