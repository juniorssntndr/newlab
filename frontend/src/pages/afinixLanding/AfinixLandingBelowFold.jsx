import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { A11y, Autoplay, Keyboard, Navigation, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/a11y';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import {
    aboutGallery,
    aboutMetrics,
    contactChannels,
    landingContactChannels,
    landingMetrics,
    partnerClinics,
    services,
    socialLinks,
    workflow,
} from './afinixLandingContent.js';
import AfinixLogo from '../../components/AfinixLogo';

const CLINIC_LOGIN_PATH = '/login?perfil=clinicas';
const MotionSection = motion.section;

const sectionMotion = (reduced, delay = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 34 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, amount: 0.18 },
            transition: { duration: 0.56, delay, ease: [0.22, 1, 0.36, 1] },
        };

/** El bloque #flujo tiene ~360vh de alto; amount global (18%) exige ~650px+ visibles y deja la sección invisible demasiado tiempo. */
const workflowSectionMotion = (reduced) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 22 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, amount: 0.03, margin: '0px 0px 180px 0px' },
            transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
        };

const servicesHeadingMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0.58, y: 22, filter: 'blur(5px)' },
            whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
            viewport: { once: true, amount: 0.34 },
            transition: { duration: 0.78, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] },
        };

const serviceCardMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 42, scale: 0.98, filter: 'blur(8px)' },
            whileInView: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
            viewport: { once: false, amount: 0.42 },
            transition: { duration: 0.72, delay: Math.min(index, 2) * 0.08, ease: [0.16, 1, 0.3, 1] },
        };

const aboutProofMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 44, scale: 0.96, filter: 'blur(8px)' },
            whileInView: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
            viewport: { once: false, amount: 0.42 },
            transition: { duration: 0.78, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] },
        };

/** Entrada tilt-in 3D con más presencia; se repite cada vez que la imagen vuelve al viewport. */
const aboutGalleryMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
            initial: {
                opacity: 0,
                y: 64,
                rotateX: 16,
                rotateY: index % 2 === 0 ? -16 : 16,
                scale: 0.88,
                filter: 'blur(10px)',
            },
            whileInView: {
                opacity: 1,
                y: 0,
                rotateX: 0,
                rotateY: 0,
                scale: 1,
                filter: 'blur(0px)',
            },
            viewport: { once: false, amount: 0.32 },
            transition: {
                duration: 1.05,
                delay: index * 0.14,
                ease: [0.16, 1, 0.3, 1],
            },
        };

function ServicesCarousel({ reduceMotion }) {
    return (
        <MotionSection
            className="afinix-section afinix-services afinix-services--showcase"
            id="servicios"
            {...sectionMotion(reduceMotion)}
        >
            <div className="afinix-section-heading afinix-services-heading">
                <motion.span className="afinix-services-eyebrow" {...servicesHeadingMotion(reduceMotion, 0)}>
                    Para tu equipo y tus pacientes
                </motion.span>
                <motion.h2 className="afinix-services-title" {...servicesHeadingMotion(reduceMotion, 1)}>
                    Control
                    <br />
                    <span className="afinix-services-title-accent">digital</span>
                    <br />
                    para tu clínica
                </motion.h2>
                <motion.p {...servicesHeadingMotion(reduceMotion, 2)}>
                    Ayudamos a odontólogos y clínicas de Arequipa a trabajar con mayor control, comunicación clara y seguimiento de sus casos.
                    Coronas CAD/CAM, zirconia, disilicato y aprobación digital antes de producir.
                </motion.p>
            </div>
            <div
                className="afinix-services-shell"
                role="region"
                aria-label="Carrusel de servicios. Usa las flechas, paginación o desliza en móvil."
            >
                <button
                    type="button"
                    className="afinix-service-nav afinix-service-nav--prev"
                    aria-label="Servicio anterior"
                >
                    <i className="bi bi-chevron-left" aria-hidden="true"></i>
                </button>
                <div className="afinix-services-carousel" tabIndex={0}>
                    <Swiper
                        className="afinix-services-swiper"
                        modules={[A11y, Autoplay, Keyboard, Navigation, Pagination]}
                        loop={!reduceMotion}
                        rewind={false}
                        slidesPerView="auto"
                        spaceBetween={24}
                        centeredSlides={true}
                        navigation={{
                            prevEl: '.afinix-service-nav--prev',
                            nextEl: '.afinix-service-nav--next',
                        }}
                        pagination={{ clickable: true }}
                        autoplay={
                            reduceMotion
                                ? false
                                : {
                                    delay: 4500,
                                    disableOnInteraction: false,
                                    pauseOnMouseEnter: true,
                                }
                        }
                        grabCursor
                        watchOverflow
                        a11y={{
                            prevSlideMessage: 'Servicio anterior',
                            nextSlideMessage: 'Servicio siguiente',
                        }}
                    >
                        {services.map((service, index) => (
                            <SwiperSlide key={service.name}>
                                <motion.article
                                    className="afinix-service-card"
                                    tabIndex={0}
                                    aria-label={`${service.name}: ${service.detail}`}
                                    {...serviceCardMotion(reduceMotion, index)}
                                >
                                    <div className="afinix-service-card-media">
                                        <img
                                            src={service.image}
                                            alt={`${service.name}: ${service.indication}`}
                                            loading="lazy"
                                            decoding="async"
                                            draggable={false}
                                        />
                                    </div>
                                    <div className="afinix-service-card-body">
                                        <h3>{service.name}</h3>
                                        <p>{service.detail}</p>
                                        <ul className="afinix-service-tags" aria-label="Variantes y familias">
                                            {service.tags.map((tag) => (
                                                <li key={tag}>{tag}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="afinix-service-card-foot">
                                        <span className="afinix-service-foot-meta" aria-label={`Entrega: ${service.leadTime}`}>
                                            <i className="bi bi-clock" aria-hidden="true"></i>
                                            <strong>{service.leadTime}</strong>
                                        </span>
                                    </div>
                                </motion.article>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
                <button
                    type="button"
                    className="afinix-service-nav afinix-service-nav--next"
                    aria-label="Servicio siguiente"
                >
                    <i className="bi bi-chevron-right" aria-hidden="true"></i>
                </button>
            </div>
        </MotionSection>
    );
}

function WorkflowDetailCard({ step, reduceMotion, className = '', mobilePopover = false }) {
    const useMobileMotion = mobilePopover && !reduceMotion;
    return (
        <motion.article
            key={step.id}
            className={`afinix-workflow-detail-card ${className}`.trim()}
            initial={
                reduceMotion
                    ? false
                    : useMobileMotion
                        ? { opacity: 0, y: 12 }
                        : { opacity: 0, y: 18, filter: 'blur(10px)' }
            }
            animate={
                reduceMotion
                    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                    : useMobileMotion
                        ? { opacity: 1, y: 0 }
                        : { opacity: 1, y: 0, filter: 'blur(0px)' }
            }
            exit={
                reduceMotion
                    ? { opacity: 1 }
                    : useMobileMotion
                        ? { opacity: 0, y: -10 }
                        : { opacity: 0, y: -16, filter: 'blur(10px)' }
            }
            transition={
                reduceMotion
                    ? { duration: 0 }
                    : useMobileMotion
                        ? { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
                        : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
            }
        >
            <div className="afinix-workflow-hud-main">
                <div className="afinix-workflow-detail-head">
                    <div className="afinix-workflow-detail-icon" aria-hidden="true">
                        <i className={`bi ${step.icon}`}></i>
                    </div>
                    <div>
                        <span className="afinix-workflow-detail-step">Paso {step.number}</span>
                        <h3>{step.title}</h3>
                    </div>
                </div>
                <p>{step.text}</p>
                {step.benefit && (
                    <div className="afinix-workflow-benefit">
                        <i className="bi bi-star-fill" aria-hidden="true"></i>
                        <span>
                            <strong>Beneficio: </strong>
                            {step.benefit}
                        </span>
                    </div>
                )}
            </div>
            <div className="afinix-workflow-hud-status" aria-label="Estado operativo del paso activo">
                <span className="afinix-workflow-hud-label">Estado</span>
                <strong>{step.status}</strong>
                <span className="afinix-workflow-hud-scan" aria-hidden="true" />
            </div>
        </motion.article>
    );
}

function WorkflowTimeline({ reduceMotion }) {
    const workflowRef = useRef(null);
    const workflowStageRef = useRef(null);
    const [workflowActiveStep, setWorkflowActiveStep] = useState(0);
    const [workflowProgress, setWorkflowProgress] = useState(0);
    const [isMobileWorkflow, setIsMobileWorkflow] = useState(false);
    const [mobilePopoverStep, setMobilePopoverStep] = useState(null);
    const { scrollYProgress } = useScroll({
        target: workflowStageRef,
        offset: ['start 0.14', 'end 0.18'],
    });

    useEffect(() => {
        const mobileQuery = window.matchMedia('(max-width: 640px)');
        const syncMobileState = () => setIsMobileWorkflow(mobileQuery.matches);

        syncMobileState();
        mobileQuery.addEventListener('change', syncMobileState);

        return () => mobileQuery.removeEventListener('change', syncMobileState);
    }, []);

    useEffect(() => {
        if (!reduceMotion && !isMobileWorkflow) {
            return undefined;
        }

        setWorkflowActiveStep(0);
        setWorkflowProgress(0);

        return undefined;
    }, [reduceMotion, isMobileWorkflow]);

    useEffect(() => {
        if (!isMobileWorkflow) {
            setMobilePopoverStep(null);
        }
    }, [isMobileWorkflow]);

    useEffect(() => {
        if (!isMobileWorkflow || mobilePopoverStep === null) {
            return undefined;
        }

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setMobilePopoverStep(null);
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isMobileWorkflow, mobilePopoverStep]);

    useMotionValueEvent(scrollYProgress, 'change', (latest) => {
        if (reduceMotion) {
            return;
        }

        if (isMobileWorkflow) {
            const mobileStart = 0.14;
            const mobileEnd = 0.84;
            const clamped = Math.min(1, Math.max(0, (latest - mobileStart) / (mobileEnd - mobileStart)));
            const step = Math.min(workflow.length - 1, Math.max(0, Math.floor(clamped * workflow.length)));
            setWorkflowProgress((current) => (Math.abs(current - clamped) < 0.001 ? current : clamped));
            setWorkflowActiveStep((current) => (current === step ? current : step));
            return;
        }

        const clamped = Math.min(1, Math.max(0, latest / 0.62));
        const step = Math.min(workflow.length - 1, Math.max(0, Math.floor(clamped * workflow.length)));
        setWorkflowProgress((current) => (Math.abs(current - clamped) < 0.001 ? current : clamped));
        setWorkflowActiveStep((current) => (current === step ? current : step));
    });

    const activeWorkflow = workflow[workflowActiveStep] ?? workflow[0];
    const workflowStepProgress = workflow.length > 1 ? workflowProgress : 1;
    const mobilePopoverWorkflow = mobilePopoverStep === null ? null : workflow[mobilePopoverStep] ?? null;

    return (
        <MotionSection
            ref={workflowRef}
            className="afinix-section afinix-workflow"
            id="flujo"
            {...workflowSectionMotion(reduceMotion)}
        >
            <div
                className={`afinix-workflow-scroll-stage${reduceMotion ? ' is-reduced-motion' : ''}`}
                ref={workflowStageRef}
            >
                <div className="afinix-workflow-sticky-shell">
                    <div className="afinix-section-heading afinix-workflow-heading">
                        <span>Flujo digital</span>
                        <h2>De tu archivo a la entrega: cada paso visible para tu equipo.</h2>
                    </div>
                    <div className="afinix-workflow-stage-panel">
                        {!isMobileWorkflow ? (
                            <div className="afinix-workflow-progress" aria-hidden="true">
                                <div className="afinix-workflow-progress-meta">
                                    <strong>Paso {activeWorkflow.number} de {String(workflow.length).padStart(2, '0')}</strong>
                                    <span>{Math.round(workflowStepProgress * 100)}% completado</span>
                                </div>
                                <div
                                    className="afinix-workflow-progress-fill"
                                    style={{
                                        transform: `scaleX(${Math.max(0.04, workflowStepProgress)})`,
                                        transition: reduceMotion ? 'none' : 'transform 0.22s linear',
                                    }}
                                />
                            </div>
                        ) : null}

                        {isMobileWorkflow ? (
                            <div className="afinix-workflow-progress" aria-hidden="true">
                                <div
                                    className="afinix-workflow-progress-fill"
                                    style={{
                                        transform: `scaleY(${Math.max(0.08, workflowStepProgress)})`,
                                        transition: reduceMotion ? 'none' : 'transform 0.22s linear',
                                    }}
                                />
                            </div>
                        ) : null}

                        <ol className="afinix-workflow-grid" aria-label="Etapas del flujo digital">
                            {workflow.map((step, index) => {
                                const stepState =
                                    index === workflowActiveStep
                                        ? 'is-active'
                                        : index < workflowActiveStep
                                            ? 'is-complete'
                                            : 'is-upcoming';

                                return (
                                    <li
                                        className={`afinix-workflow-card ${stepState}`}
                                        key={step.id}
                                        aria-current={index === workflowActiveStep ? 'step' : undefined}
                                    >
                                        {isMobileWorkflow ? (
                                            <div className="afinix-workflow-mobile-row">
                                                <button
                                                    type="button"
                                                    className="afinix-workflow-step-icon-button"
                                                    onClick={() => setMobilePopoverStep((current) => (current === index ? null : index))}
                                                    aria-expanded={mobilePopoverStep === index}
                                                    aria-controls={mobilePopoverStep === index ? `workflow-mobile-popover-${step.id}` : undefined}
                                                    aria-label={`Ver detalle del paso ${step.number}: ${step.title}`}
                                                >
                                                    <span className="afinix-workflow-step-icon" aria-hidden="true">
                                                        <i className={`bi ${step.icon}`}></i>
                                                    </span>
                                                </button>
                                                <div className="afinix-workflow-step-copy">
                                                    <span className="afinix-workflow-step-num">{step.number}</span>
                                                    <h3>{step.title}</h3>
                                                    <p>{step.status}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="afinix-workflow-step-button"
                                                onClick={() => {
                                                    setWorkflowActiveStep(index);
                                                    setWorkflowProgress(workflow.length > 1 ? index / (workflow.length - 1) : 1);
                                                }}
                                                aria-label={`Ver paso ${step.number}: ${step.title}`}
                                            >
                                                <span className="afinix-workflow-card-head">
                                                    <span className="afinix-workflow-step-num">{step.number}</span>
                                                    {index < workflowActiveStep ? (
                                                        <span className="afinix-workflow-step-check" aria-hidden="true">
                                                            <i className="bi bi-check-lg"></i>
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span className="afinix-workflow-step-icon" aria-hidden="true">
                                                    <i className={`bi ${step.icon}`}></i>
                                                </span>
                                                <h3>{step.title}</h3>
                                                <p>{step.status}</p>
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>

                        {isMobileWorkflow ? (
                            <AnimatePresence initial={false} mode="sync">
                                {mobilePopoverWorkflow ? (
                                    <div className="afinix-workflow-mobile-popover-shell" id={`workflow-mobile-popover-${mobilePopoverWorkflow.id}`}>
                                        <button
                                            type="button"
                                            className="afinix-workflow-mobile-popover-close"
                                            onClick={() => setMobilePopoverStep(null)}
                                            aria-label="Cerrar detalle del paso"
                                        >
                                            <i className="bi bi-x-lg" aria-hidden="true"></i>
                                        </button>
                                        <WorkflowDetailCard
                                            key={mobilePopoverWorkflow.id}
                                            step={mobilePopoverWorkflow}
                                            reduceMotion={reduceMotion}
                                            mobilePopover
                                            className="afinix-workflow-detail-card--popover"
                                        />
                                    </div>
                                ) : null}
                            </AnimatePresence>
                        ) : null}

                        <div className="afinix-workflow-detail-shell">
                            <AnimatePresence initial={false} mode="wait">
                                <WorkflowDetailCard
                                    key={activeWorkflow.id}
                                    step={activeWorkflow}
                                    reduceMotion={reduceMotion}
                                />
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
        </MotionSection>
    );
}

function PartnersAndMetrics({ reduceMotion }) {
    return (
        <>
            <MotionSection className="afinix-section afinix-about" id="nosotros" {...sectionMotion(reduceMotion)}>
                <div className="afinix-about-copy">
                    <motion.span {...servicesHeadingMotion(reduceMotion, 0)}>Para tu clínica</motion.span>
                    <motion.h2 {...servicesHeadingMotion(reduceMotion, 1)}>Tu criterio, el diseño y la pieza: todo en el mismo flujo.</motion.h2>
                    <motion.p {...servicesHeadingMotion(reduceMotion, 2)}>
                        Cuando el flujo es visible, tu agenda deja de depender de mensajes sueltos. Unes criterio clínico, revisión 3D
                        y producción CAD/CAM con responsables y tiempos referenciales según complejidad del caso. La precisión en boca se apoya en trazabilidad: sin
                        ella, cada caso pierde predictibilidad operativa.
                    </motion.p>
                    <div className="afinix-proof-grid">
                        {aboutMetrics.map((metric, index) => (
                            <motion.article key={metric.value} {...aboutProofMotion(reduceMotion, index)}>
                                <strong>{metric.value}</strong>
                                <p>{metric.text}</p>
                            </motion.article>
                        ))}
                    </div>
                </div>
                <div className="afinix-about-gallery" aria-label="Muestras y equipamiento del laboratorio">
                    {aboutGallery.map((image, index) => (
                        <motion.div
                            key={image.src}
                            className={
                                index === 0
                                    ? 'afinix-about-gallery__item afinix-about-gallery__item--span-rows'
                                    : 'afinix-about-gallery__item'
                            }
                            {...aboutGalleryMotion(reduceMotion, index)}
                        >
                            <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
                        </motion.div>
                    ))}
                </div>
            </MotionSection>

            <section className="afinix-partners" aria-label="Clínicas partner">
                <p>Clínicas como la tuya que ya operan con trazabilidad digital</p>
                <div className="afinix-partner-marquee">
                    <div className="afinix-partner-track">
                        {[...partnerClinics, ...partnerClinics].map(([initials, name], index) => (
                            <span className="afinix-partner-logo" key={`${name}-${index}`}>
                                <strong>{initials}</strong>
                                {name}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="afinix-metrics-grid">
                    {landingMetrics.map((metric) => (
                        <article key={metric.label}>
                            <i className={`bi ${metric.icon}`} aria-hidden="true"></i>
                            <strong>{metric.value}</strong>
                            <span>{metric.label}</span>
                        </article>
                    ))}
                </div>
            </section>
        </>
    );
}

function ContactSection({ reduceMotion }) {
    return (
        <MotionSection
            className="afinix-section afinix-contact"
            id="contacto"
            {...sectionMotion(reduceMotion)}
        >
            <div className="afinix-section-heading afinix-contact-heading">
                <span>Contacto</span>
                <h2>Habla con nuestro equipo</h2>
                <p>
                    Estamos en Arequipa para darte soporte local y directo.
                    Escríbenos, llámanos o visítanos en nuestro laboratorio.
                </p>
            </div>
            <div className="afinix-contact-grid">
                {landingContactChannels.map((channel) => (
                    <article
                        key={channel.id}
                        className={`afinix-contact-card afinix-contact-card--${channel.colorClass}`}
                    >
                        <div className="afinix-contact-card-icon" aria-hidden="true">
                            <i className={`bi ${channel.icon}`}></i>
                        </div>
                        <h3>{channel.title}</h3>
                        <p>{channel.subtitle}</p>
                        <a
                            href={channel.href}
                            className="afinix-contact-card-btn"
                            target={channel.external ? '_blank' : undefined}
                            rel={channel.external ? 'noopener noreferrer' : undefined}
                        >
                            {channel.btnText}
                            <i className="bi bi-arrow-right" aria-hidden="true"></i>
                        </a>
                    </article>
                ))}
            </div>
            <div className="afinix-contact-socials-block">
                <h3>Síguenos en nuestras redes</h3>
                <div className="afinix-contact-socials-links">
                    {socialLinks.map((social) => (
                        <a
                            key={social.label}
                            href={social.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={social.label}
                            className="afinix-contact-social-btn"
                        >
                            <i className={`bi ${social.icon}`} aria-hidden="true"></i>
                            <span>{social.label}</span>
                        </a>
                    ))}
                </div>
            </div>
        </MotionSection>
    );
}

function FinalCTA({ reduceMotion, theme = 'dark' }) {
    return (
        <footer className="afinix-footer afinix-final-cta">
            <motion.div className="afinix-final-cta__inner" {...sectionMotion(reduceMotion)}>
                <div className="afinix-final-cta__panel">
                    <div className="afinix-section-heading afinix-final-cta__heading">
                        <span>Da el siguiente paso</span>
                        <h2>Menos fricción entre tu criterio clínico y la pieza terminada</h2>
                        <p>
                            Un solo canal para casos, aprobaciones y seguimiento: tu clínica gana claridad operativa y tus pacientes
                            ganan una experiencia más ordenada.
                        </p>
                    </div>
                    <div className="afinix-footer-actions">
                        <Link className="afinix-primary-action" to={CLINIC_LOGIN_PATH}>
                            Solicitar acceso
                            <i className="bi bi-arrow-right" aria-hidden="true"></i>
                        </Link>
                        <a className="afinix-secondary-action" href="/#servicios">
                            Ver servicios
                        </a>
                    </div>
                </div>
            </motion.div>
            <div className="afinix-footer-basic" aria-label="Footer legal y navegación">
                <AfinixLogo size={44} showText={true} theme={theme} />
                <nav aria-label="Enlaces de footer" style={{ marginTop: '1rem' }}>
                    <a href="/#servicios">Servicios</a>
                    <a href="/#nosotros">Para tu clínica</a>
                    <a href="/coronas-cad-cam-arequipa">Coronas CAD/CAM</a>
                    <a href="/#contacto">Contacto</a>
                    <a href="/politica-de-privacidad">Privacidad</a>
                </nav>
                <small style={{ marginTop: '1rem', display: 'block' }}>2026 AFINIX Dental Lab. Todos los derechos reservados.</small>
                <div className="afinix-footer-channels">
                    {contactChannels.map((ch) => (
                        <a
                            key={ch.label}
                            href={ch.href}
                            className="afinix-footer-chan"
                            target={ch.external ? '_blank' : undefined}
                            rel={ch.external ? 'noopener noreferrer' : undefined}
                        >
                            <i className={`bi ${ch.icon}`} aria-hidden="true"></i>
                            <span>{ch.label}</span>
                        </a>
                    ))}
                    <div className="afinix-footer-socials">
                        {socialLinks.map((s) => (
                            <a
                                key={s.label}
                                href={s.href}
                                className="afinix-footer-chan"
                                target={s.external ? '_blank' : undefined}
                                rel={s.external ? 'noopener noreferrer' : undefined}
                                aria-label={s.label}
                            >
                                <i className={`bi ${s.icon}`} aria-hidden="true"></i>
                                <span>{s.label}</span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}

/** Bloque inferior diferido: reduce JS inicial y coste de hidratación del carrusel de servicios y del scroll-linked workflow. */
export default function AfinixLandingBelowFold({ reduceMotion, theme = 'dark' }) {
    return (
        <>
            <ServicesCarousel reduceMotion={reduceMotion} />
            <WorkflowTimeline reduceMotion={reduceMotion} />
            <PartnersAndMetrics reduceMotion={reduceMotion} />
            <ContactSection reduceMotion={reduceMotion} />
            <FinalCTA reduceMotion={reduceMotion} theme={theme} />
        </>
    );
}
