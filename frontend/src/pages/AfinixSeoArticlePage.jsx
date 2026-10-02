import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/afinix-landing.css';
import '../styles/afinix-service-pages.css';
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
import { services, workflow } from './afinixLanding/afinixLandingContent.js';
import { SERVICE_PAGES } from './afinixLanding/servicePageData.js';

const CLINIC_LOGIN_PATH = '/login?perfil=clinicas';
const featuredServicesByCode = new Map(services.map((service) => [service.code, service]));

function ServicePage({ article, page }) {
    const products = (page.productCodes || []).map((code) => featuredServicesByCode.get(code)).filter(Boolean);

    return (
        <article className="afinix-service-page" lang="es-PE">
            <nav className="afinix-service-page__breadcrumbs" aria-label="Ruta de navegación">
                <Link to="/">Inicio</Link><span aria-hidden="true">/</span>
                <a href="/#servicios">Servicios</a><span aria-hidden="true">/</span>
                <span aria-current="page">{article.title}</span>
            </nav>

            <header className="afinix-service-page__hero">
                <div className="afinix-service-page__hero-copy">
                    <span className="afinix-service-page__eyebrow">{page.eyebrow}</span>
                    <h1>{article.h1}</h1>
                    <p>{page.intro}</p>
                    <div className="afinix-service-page__actions">
                        <a className="afinix-hero-btn afinix-hero-btn--primary" href={whatsappHref()} target="_blank" rel="noopener noreferrer">
                            Consultar un caso <i className="bi bi-arrow-up-right" aria-hidden="true" />
                        </a>
                        <Link className="afinix-hero-btn afinix-hero-btn--ghost" to={CLINIC_LOGIN_PATH}>
                            Entrar al portal <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                        </Link>
                    </div>
                </div>
                <figure className={`afinix-service-page__hero-media${page.heroContain ? ' afinix-service-page__hero-media--contain' : ''}`}>
                    <img src={page.heroImage} alt={page.heroAlt} loading="eager" decoding="async" fetchPriority="high" />
                    <figcaption>AFINIX Dental Lab · Arequipa</figcaption>
                </figure>
            </header>

            <div className="afinix-service-page__body">
                <section className="afinix-service-page__intro" aria-labelledby="service-process-title">
                    <div>
                        <span className="afinix-service-page__eyebrow">Nuestro enfoque</span>
                        <h2 id="service-process-title">{page.sectionTitle}</h2>
                    </div>
                    <p>{page.sectionText}</p>
                </section>

                {products.length ? (
                    <section className="afinix-service-page__catalog" aria-labelledby="service-catalog-title">
                        <div className="afinix-service-page__section-heading">
                            <span className="afinix-service-page__eyebrow">Servicios destacados</span>
                            <h2 id="service-catalog-title">Opciones relacionadas</h2>
                            <p>Referencias de la sección Servicios; producto, material, disponibilidad y cotización se confirman al revisar tu caso.</p>
                        </div>
                        <div className="afinix-service-page__product-grid">
                            {products.map((product) => (
                                <article className="afinix-service-page__product" key={product.code}>
                                    <img src={product.image} alt={`Imagen de referencia: ${product.name}`} loading="lazy" decoding="async" />
                                    <div>
                                        <h3>{product.name}</h3>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                ) : null}

                {page.workflow ? (
                    <section className="afinix-service-page__workflow" aria-labelledby="service-workflow-title">
                        <div className="afinix-service-page__section-heading">
                            <span className="afinix-service-page__eyebrow">De inicio a entrega</span>
                            <h2 id="service-workflow-title">Las etapas del pedido</h2>
                        </div>
                        <ol>
                            {workflow.map((step) => (
                                <li key={step.id}>
                                    <span>{step.number}</span>
                                    <div><h3>{step.title}</h3><p>{step.action}</p></div>
                                </li>
                            ))}
                        </ol>
                    </section>
                ) : null}

                <section className="afinix-service-page__requirements" aria-labelledby="service-requirements-title">
                    <div>
                        <span className="afinix-service-page__eyebrow">Antes de empezar</span>
                        <h2 id="service-requirements-title">Información útil para evaluar el caso</h2>
                        <p>Estos datos nos ayudan a verificar el trabajo solicitado. Te indicaremos si falta información específica.</p>
                    </div>
                    <ul>{page.inputs.map((input) => <li key={input}><i className="bi bi-check2" aria-hidden="true" />{input}</li>)}</ul>
                </section>

                <aside className="afinix-service-page__note" aria-label="Consideración para el caso">
                    <i className="bi bi-info-circle" aria-hidden="true" /><p>{page.note}</p>
                </aside>

                <section className="afinix-service-page__closing" aria-labelledby="service-closing-title">
                    <div><span className="afinix-service-page__eyebrow">Hablemos de tu caso</span><h2 id="service-closing-title">Un trabajo bien definido empieza con la información correcta.</h2></div>
                    <a className="afinix-hero-btn afinix-hero-btn--primary" href={whatsappHref()} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp <i className="bi bi-whatsapp" aria-hidden="true" /></a>
                </section>

                <nav className="afinix-service-page__related" aria-label="Páginas relacionadas">
                    <strong>También puede interesarte</strong>
                    <div>{page.related.map((relatedPath) => {
                        const related = getSeoArticle(relatedPath);
                        return related ? <Link key={relatedPath} to={relatedPath}>{related.title}<i className="bi bi-arrow-right" aria-hidden="true" /></Link> : null;
                    })}</div>
                </nav>
            </div>
        </article>
    );
}

/**
 * @param {{ path: string }} props
 */
export default function AfinixSeoArticlePage({ path }) {
    const article = getSeoArticle(path);
    const servicePage = SERVICE_PAGES[path];

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
            {servicePage ? <ServicePage article={article} page={servicePage} /> : <article className="afinix-seo-article" lang="es-PE">
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
            </article>}
        </AfinixMarketingLayout>
    );
}
