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
    landingMetrics,
    partnerClinics,
    services,
    socialLinks,
    workflow,
} from './affinixLandingContent.js';

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
            className="affinix-section affinix-services affinix-services--showcase"
            id="servicios"
            {...sectionMotion(reduceMotion)}
        >
            <div className="affinix-section-heading affinix-services-heading">
                <motion.span className="affinix-services-eyebrow" {...servicesHeadingMotion(reduceMotion, 0)}>
                    Para tu equipo y tus pacientes
                </motion.span>
                <motion.h2 className="affinix-services-title" {...servicesHeadingMotion(reduceMotion, 1)}>
                    Servicios
                    <br />
                    <span className="affinix-services-title-accent">digitales</span>
                    <br />
                    que encajan en
                    {' '}tu forma de trabajar
                </motion.h2>
                <motion.p {...servicesHeadingMotion(reduceMotion, 2)}>
                    Materiales certificados, CAD/CAM 5 ejes y control por etapa: menos sorpresas entre lo que planeas en clínica y lo
                    que recibe el paciente.
                </motion.p>
            </div>
            <div
                className="affinix-services-shell"
                role="region"
                aria-label="Carrusel de servicios. Usa las flechas, paginación o desliza en móvil."
            >
                <button
                    type="button"
                    className="affinix-service-nav affinix-service-nav--prev"
                    aria-label="Servicio anterior"
                >
                    <i className="bi bi-chevron-left" aria-hidden="true"></i>
                </button>
                <div className="affinix-services-carousel" tabIndex={0}>
                    <Swiper
                        className="affinix-services-swiper"
                        modules={[A11y, Autoplay, Keyboard, Navigation, Pagination]}
                        loop={!reduceMotion}
                        rewind={false}
                        slidesPerView="auto"
                        spaceBetween={24}
                        centeredSlides={true}
                        navigation={{
                            prevEl: '.affinix-service-nav--prev',
                            nextEl: '.affinix-service-nav--next',
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
                                    className="affinix-service-card"
                                    tabIndex={0}
                                    aria-label={`${service.name}: ${service.detail}`}
                                    {...serviceCardMotion(reduceMotion, index)}
                                >
                                    <div className="affinix-service-card-media">
                                        <img
                                            src={service.image}
                                            alt={`Muestra de ${service.name}`}
                                            loading="lazy"
                                            decoding="async"
                                            draggable={false}
                                        />
                                    </div>
                                    <div className="affinix-service-card-body">
                                        <h3>{service.name}</h3>
                                        <p>{service.detail}</p>
                                        <ul className="affinix-service-tags" aria-label="Variantes y familias">
                                            {service.tags.map((tag) => (
                                                <li key={tag}>{tag}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="affinix-service-card-foot">
                                        <span className="affinix-service-foot-meta">
                                            <i className="bi bi-clock" aria-hidden="true"></i>
                                            Entrega: <strong>{service.leadTime}</strong>
                                        </span>
                                    </div>
                                </motion.article>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
                <button
                    type="button"
                    className="affinix-service-nav affinix-service-nav--next"
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
            className={`affinix-workflow-detail-card ${className}`.trim()}
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
            <div className="affinix-workflow-hud-main">
                <div className="affinix-workflow-detail-head">
                    <div className="affinix-workflow-detail-icon" aria-hidden="true">
                        <i className={`bi ${step.icon}`}></i>
                    </div>
                    <div>
                        <span className="affinix-workflow-detail-step">Paso {step.number}</span>
                        <h3>{step.title}</h3>
                    </div>
                </div>
                <p>{step.text}</p>
            </div>
            <div className="affinix-workflow-hud-status" aria-label="Estado operativo del paso activo">
                <span className="affinix-workflow-hud-label">Estado</span>
                <strong>{step.status}</strong>
                <span className="affinix-workflow-hud-scan" aria-hidden="true" />
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
            className="affinix-section affinix-workflow"
            id="flujo"
            {...workflowSectionMotion(reduceMotion)}
        >
            <div
                className={`affinix-workflow-scroll-stage${reduceMotion ? ' is-reduced-motion' : ''}`}
                ref={workflowStageRef}
            >
                <div className="affinix-workflow-sticky-shell">
                    <div className="affinix-section-heading affinix-workflow-heading">
                        <span>Flujo digital</span>
                        <h2>De tu archivo a la entrega: cada paso visible para tu equipo.</h2>
                    </div>
                    <div className="affinix-workflow-stage-panel">
                        {!isMobileWorkflow ? (
                            <div className="affinix-workflow-progress" aria-hidden="true">
                                <div className="affinix-workflow-progress-meta">
                                    <strong>Paso {activeWorkflow.number} de {String(workflow.length).padStart(2, '0')}</strong>
                                    <span>{Math.round(workflowStepProgress * 100)}% completado</span>
                                </div>
                                <div
                                    className="affinix-workflow-progress-fill"
                                    style={{
                                        transform: `scaleX(${Math.max(0.04, workflowStepProgress)})`,
                                        transition: reduceMotion ? 'none' : 'transform 0.22s linear',
                                    }}
                                />
                            </div>
                        ) : null}

                        {isMobileWorkflow ? (
                            <div className="affinix-workflow-progress" aria-hidden="true">
                                <div
                                    className="affinix-workflow-progress-fill"
                                    style={{
                                        transform: `scaleY(${Math.max(0.08, workflowStepProgress)})`,
                                        transition: reduceMotion ? 'none' : 'transform 0.22s linear',
                                    }}
                                />
                            </div>
                        ) : null}

                        <ol className="affinix-workflow-grid" aria-label="Etapas del flujo digital">
                            {workflow.map((step, index) => {
                                const stepState =
                                    index === workflowActiveStep
                                        ? 'is-active'
                                        : index < workflowActiveStep
                                            ? 'is-complete'
                                            : 'is-upcoming';

                                return (
                                    <li
                                        className={`affinix-workflow-card ${stepState}`}
                                        key={step.id}
                                        aria-current={index === workflowActiveStep ? 'step' : undefined}
                                    >
                                        {isMobileWorkflow ? (
                                            <div className="affinix-workflow-mobile-row">
                                                <button
                                                    type="button"
                                                    className="affinix-workflow-step-icon-button"
                                                    onClick={() => setMobilePopoverStep((current) => (current === index ? null : index))}
                                                    aria-expanded={mobilePopoverStep === index}
                                                    aria-controls={mobilePopoverStep === index ? `workflow-mobile-popover-${step.id}` : undefined}
                                                    aria-label={`Ver detalle del paso ${step.number}: ${step.title}`}
                                                >
                                                    <span className="affinix-workflow-step-icon" aria-hidden="true">
                                                        <i className={`bi ${step.icon}`}></i>
                                                    </span>
                                                </button>
                                                <div className="affinix-workflow-step-copy">
                                                    <span className="affinix-workflow-step-num">{step.number}</span>
                                                    <h3>{step.title}</h3>
                                                    <p>{step.status}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="affinix-workflow-step-button"
                                                onClick={() => {
                                                    setWorkflowActiveStep(index);
                                                    setWorkflowProgress(workflow.length > 1 ? index / (workflow.length - 1) : 1);
                                                }}
                                                aria-label={`Ver paso ${step.number}: ${step.title}`}
                                            >
                                                <span className="affinix-workflow-card-head">
                                                    <span className="affinix-workflow-step-num">{step.number}</span>
                                                    {index < workflowActiveStep ? (
                                                        <span className="affinix-workflow-step-check" aria-hidden="true">
                                                            <i className="bi bi-check-lg"></i>
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span className="affinix-workflow-step-icon" aria-hidden="true">
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
                                    <div className="affinix-workflow-mobile-popover-shell" id={`workflow-mobile-popover-${mobilePopoverWorkflow.id}`}>
                                        <button
                                            type="button"
                                            className="affinix-workflow-mobile-popover-close"
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
                                            className="affinix-workflow-detail-card--popover"
                                        />
                                    </div>
                                ) : null}
                            </AnimatePresence>
                        ) : null}

                        <div className="affinix-workflow-detail-shell">
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
            <MotionSection className="affinix-section affinix-about" id="nosotros" {...sectionMotion(reduceMotion)}>
                <div className="affinix-about-copy">
                    <motion.span {...servicesHeadingMotion(reduceMotion, 0)}>Para tu clínica</motion.span>
                    <motion.h2 {...servicesHeadingMotion(reduceMotion, 1)}>Tu criterio, el diseño y la pieza: todo en el mismo hilo.</motion.h2>
                    <motion.p {...servicesHeadingMotion(reduceMotion, 2)}>
                        Cuando el flujo es visible, tu agenda deja de depender de mensajes sueltos. Unes criterio clínico, revisión 3D
                        y producción CAD/CAM con responsables y tiempos claros. La precisión en boca se sostiene con trazabilidad: sin
                        ella, cada caso es una apuesta.
                    </motion.p>
                    <div className="affinix-proof-grid">
                        {aboutMetrics.map((metric, index) => (
                            <motion.article key={metric.value} {...aboutProofMotion(reduceMotion, index)}>
                                <strong>{metric.value}</strong>
                                <p>{metric.text}</p>
                            </motion.article>
                        ))}
                    </div>
                </div>
                <div className="affinix-about-gallery" aria-label="Muestras y equipamiento del laboratorio">
                    {aboutGallery.map((image, index) => (
                        <motion.div
                            key={image.src}
                            className={
                                index === 0
                                    ? 'affinix-about-gallery__item affinix-about-gallery__item--span-rows'
                                    : 'affinix-about-gallery__item'
                            }
                            {...aboutGalleryMotion(reduceMotion, index)}
                        >
                            <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
                        </motion.div>
                    ))}
                </div>
            </MotionSection>

            <section className="affinix-partners" aria-label="Clínicas partner">
                <p>Clínicas como la tuya que ya operan con trazabilidad digital</p>
                <div className="affinix-partner-marquee">
                    <div className="affinix-partner-track">
                        {[...partnerClinics, ...partnerClinics].map(([initials, name], index) => (
                            <span className="affinix-partner-logo" key={`${name}-${index}`}>
                                <strong>{initials}</strong>
                                {name}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="affinix-metrics-grid">
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

function FinalCTA({ reduceMotion }) {
    return (
        <footer className="affinix-footer affinix-final-cta">
            <motion.div className="affinix-final-cta__inner" {...sectionMotion(reduceMotion)}>
                <div className="affinix-final-cta__panel">
                    <div className="affinix-section-heading affinix-final-cta__heading">
                        <span>Da el siguiente paso</span>
                        <h2>Menos fricción entre tu criterio y la pieza terminada</h2>
                        <p>
                            Un solo canal para casos, aprobaciones y seguimiento: tu clínica gana claridad operativa y tus pacientes
                            ganan puntualidad.
                        </p>
                    </div>
                    <div className="affinix-footer-actions">
                        <Link className="affinix-primary-action" to={CLINIC_LOGIN_PATH}>
                            Solicitar acceso
                            <i className="bi bi-arrow-right" aria-hidden="true"></i>
                        </Link>
                        <a className="affinix-secondary-action" href="#servicios">
                            Ver servicios
                        </a>
                    </div>
                </div>
            </motion.div>
            <div className="affinix-footer-basic" aria-label="Footer legal y navegación">
                <strong>Affinix LAB</strong>
                <span>Laboratorio dental digital</span>
                <nav aria-label="Enlaces de footer">
                    <a href="#servicios">Servicios</a>
                    <a href="#nosotros">Para tu clínica</a>
                </nav>
                <small>2026 Affinix LAB. Todos los derechos reservados.</small>
                <div className="affinix-footer-channels">
                    {contactChannels.map((ch) => (
                        <a
                            key={ch.label}
                            href={ch.href}
                            className="affinix-footer-chan"
                            target={ch.external ? '_blank' : undefined}
                            rel={ch.external ? 'noopener noreferrer' : undefined}
                        >
                            <i className={`bi ${ch.icon}`} aria-hidden="true"></i>
                            <span>{ch.label}</span>
                        </a>
                    ))}
                    <div className="affinix-footer-socials">
                        {socialLinks.map((s) => (
                            <a
                                key={s.label}
                                href={s.href}
                                className="affinix-footer-chan"
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
export default function AffinixLandingBelowFold({ reduceMotion }) {
    return (
        <>
            <ServicesCarousel reduceMotion={reduceMotion} />
            <WorkflowTimeline reduceMotion={reduceMotion} />
            <PartnersAndMetrics reduceMotion={reduceMotion} />
            <FinalCTA reduceMotion={reduceMotion} />
        </>
    );
}
