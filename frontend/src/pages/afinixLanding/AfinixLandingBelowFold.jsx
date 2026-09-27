import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { A11y, Autoplay, Keyboard, Navigation, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/a11y';
import 'swiper/css/autoplay';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import {
    aboutGallery,
    contactChannels,
    landingContactChannels,
    landingMetrics,
    partnerClinics,
    services,
    socialLinks,
    workflow,
} from './afinixLandingContent.js';
import AfinixLogo from '../../components/AfinixLogo';
import WorkflowDetailCard from '../../components/workflow/WorkflowDetailCard.jsx';
import {
    WORKFLOW_FINAL_DURATION_MS,
    WORKFLOW_STEP_DURATION_MS,
} from './workflowConstants.js';

const CLINIC_LOGIN_PATH = '/login?perfil=clinicas';
const WHATSAPP_CHANNEL = contactChannels.find((channel) => channel.label === 'WhatsApp') ?? contactChannels[0];
const MotionSection = motion.section;
const workWithUsHighlights = [
    {
        icon: 'bi-clock-history',
        title: 'Entregas en fecha garantizada',
        shortTitle: 'Entregas en fecha',
        desc: 'Tiempos predecibles para no reprogramar jamás a tu paciente.',
    },
    {
        icon: 'bi-bullseye',
        title: 'Ajuste marginal de alta precisión',
        shortTitle: 'Precisión CAD/CAM',
        desc: 'Tecnología CAD/CAM que elimina desgastes oclusales en sillón.',
    },
    {
        icon: 'bi-chat-dots-fill',
        title: 'Comunicación directa y técnica',
        shortTitle: 'Contacto directo',
        desc: 'Coordinación ágil con el protesista para indicaciones y aprobación 3D.',
    },
    {
        icon: 'bi-phone-flip',
        title: 'Trazabilidad y seguimiento en vivo',
        shortTitle: 'Trazabilidad en vivo',
        desc: 'Consulta el estado de cada orden en tiempo real desde cualquier dispositivo.',
    },
];

const clinicProofCaptions = [
    'Planificación digital antes de producir',
    'Materiales y terminaciones controladas',
    'Producción CAD/CAM en el laboratorio',
];

const sectionMotion = (reduced, delay = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 24 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: false, amount: 0.12 },
            transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] },
        };

/** El bloque #flujo tiene ~360vh de alto; se define un margen de histéresis seguro para evitar parpadeos en los límites. */
const workflowSectionMotion = (reduced) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 16 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: false, amount: 0.05 },
            transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
        };
const servicesHeadingGroupMotion = (reduced) =>
    reduced
        ? {}
        : {
            initial: 'hidden',
            whileInView: 'visible',
            viewport: { once: false, amount: 0.15 },
            variants: {
                hidden: {},
                visible: {
                    transition: {
                        staggerChildren: 0.08,
                    },
                },
            },
        };

const servicesHeadingItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.52, ease: [0.16, 1, 0.3, 1] },
    },
};

const servicesCatalogHintMotion = (reduced) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 16 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: false, amount: 0.15 },
            transition: { duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] },
        };

const servicesHeadingMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 22 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: false, amount: 0.15 },
            transition: { duration: 0.55, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] },
        };

const serviceCardMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 24, scale: 0.98 },
            whileInView: { opacity: 1, y: 0, scale: 1 },
            viewport: { once: false, amount: 0.12 },
            transition: { duration: 0.48, delay: (index % 3) * 0.05, ease: [0.16, 1, 0.3, 1] },
        };

const aboutProofMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 18, scale: 0.98 },
            whileInView: { opacity: 1, y: 0, scale: 1 },
            viewport: { once: false, amount: 0.12 },
            transition: { duration: 0.48, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] },
        };

/** Entrada suave para galería con margen seguro anti-parpadeo. */
const aboutGalleryMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
            initial: {
                opacity: 0,
                y: 24,
                scale: 0.96,
            },
            whileInView: {
                opacity: 1,
                y: 0,
                scale: 1,
            },
            viewport: { once: false, amount: 0.15 },
            transition: {
                duration: 0.55,
                delay: index * 0.08,
                ease: [0.16, 1, 0.3, 1],
            },
        };

const workflowStepCardMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 16, scale: 0.97 },
            whileInView: { opacity: 1, y: 0, scale: 1 },
            viewport: { once: false, amount: 0.12 },
            transition: { duration: 0.42, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] },
        };

const workflowViewerMotion = (reduced) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 18, scale: 0.98 },
            whileInView: { opacity: 1, y: 0, scale: 1 },
            viewport: { once: false, amount: 0.12 },
            transition: { duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] },
        };

const contactHeadingMotion = (reduced) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 18 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: false, amount: 0.15 },
            transition: { duration: 0.48, ease: [0.16, 1, 0.3, 1] },
        };

const contactCardMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 22, scale: 0.98 },
            whileInView: { opacity: 1, y: 0, scale: 1 },
            viewport: { once: false, amount: 0.12 },
            transition: { duration: 0.48, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] },
        };

const contactSocialsMotion = (reduced) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 16 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: false, amount: 0.12 },
            transition: { duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] },
        };

function ServicesCarousel({ reduceMotion }) {
    const [catalogServices, setCatalogServices] = useState(services);

    useEffect(() => {
        let isMounted = true;
        fetch('/api/consultas/catalogo-landing')
            .then((res) => res.json())
            .then((data) => {
                if (isMounted && data?.ok && Array.isArray(data.data) && data.data.length > 0) {
                    setCatalogServices(data.data);
                }
            })
            .catch(() => {
                // Silently keep static fallback
            });
        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <MotionSection
            className="afinix-section afinix-services afinix-services--showcase"
            id="servicios"
            {...sectionMotion(reduceMotion)}
        >
            <motion.div
                className="afinix-section-heading afinix-services-heading"
                {...servicesHeadingGroupMotion(reduceMotion)}
            >
                <motion.span
                    className="afinix-services-eyebrow"
                    variants={reduceMotion ? undefined : servicesHeadingItemVariants}
                >
                    <i className="bi bi-grid-fill afinix-kicker-icon" aria-hidden="true"></i>
                    Catálogo de servicios
                </motion.span>
                <motion.h2
                    className="afinix-services-title"
                    variants={reduceMotion ? undefined : servicesHeadingItemVariants}
                >
                    Soluciones para cada{' '}
                    <span className="afinix-services-title-accent">tipo de caso.</span>
                </motion.h2>
                <motion.p variants={reduceMotion ? undefined : servicesHeadingItemVariants} className="afinix-services-intro">
                    <span className="afinix-services-intro-desktop">
                        Desde restauraciones unitarias hasta rehabilitaciones complejas, prótesis removibles, soluciones sobre implantes y flujos completamente digitales.
                    </span>
                    <span className="afinix-services-intro-mobile">
                        Restauraciones, prótesis y soluciones sobre implantes con flujo 100% digital.
                    </span>
                </motion.p>
                <motion.div
                    className="afinix-services-capabilities"
                    variants={reduceMotion ? undefined : servicesHeadingItemVariants}
                    aria-label="Capacidades y materiales del laboratorio"
                >
                    <div className="afinix-service-cap-item">
                        <i className="bi bi-stack" aria-hidden="true"></i>
                        <div>
                            <strong>14+ SERVICIOS</strong>
                            <span>Restauraciones, prótesis y soluciones digitales</span>
                        </div>
                    </div>
                    <div className="afinix-service-cap-item">
                        <i className="bi bi-gem" aria-hidden="true"></i>
                        <div>
                            <strong>MÚLTIPLES MATERIALES</strong>
                            <span>Zirconia · Disilicato · PMMA · PEEK · Titanio · Resinas</span>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
            <div
                className="afinix-services-shell"
                id="catalogo-servicios"
                role="region"
                aria-label="Carrusel de servicios. Usa las flechas, paginación o desliza en móvil."
            >
                <motion.div
                    className="afinix-services-catalog-head"
                    {...servicesCatalogHintMotion(reduceMotion)}
                >
                    <span className="afinix-services-catalog-hint">
                        <i className="bi bi-compass" aria-hidden="true"></i> Descubre los servicios que tenemos para ti
                    </span>
                </motion.div>
                <button
                    type="button"
                    className="afinix-service-nav afinix-service-nav--prev"
                    aria-label="Servicio anterior"
                >
                    <i className="bi bi-chevron-left" aria-hidden="true"></i>
                </button>
                <motion.div
                    className="afinix-services-carousel"
                    tabIndex={0}
                    initial={reduceMotion ? false : { opacity: 0, y: 30 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.12 }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                >
                    <Swiper
                        className="afinix-services-swiper"
                        modules={[A11y, Autoplay, Keyboard, Navigation, Pagination]}
                        loop={true}
                        rewind={false}
                        autoplay={
                            reduceMotion
                                ? false
                                : {
                                      delay: 3500,
                                      disableOnInteraction: false,
                                      pauseOnMouseEnter: true,
                                  }
                        }
                        slidesPerView="auto"
                        spaceBetween={14}
                        centeredSlides={true}
                        breakpoints={{
                            768: {
                                centeredSlides: false,
                                spaceBetween: 24,
                            },
                        }}
                        navigation={{
                            prevEl: '.afinix-service-nav--prev',
                            nextEl: '.afinix-service-nav--next',
                        }}
                        pagination={{
                            clickable: true,
                        }}
                        grabCursor
                        watchOverflow
                        a11y={{
                            prevSlideMessage: 'Servicio anterior',
                            nextSlideMessage: 'Servicio siguiente',
                        }}
                    >
                        {catalogServices.map((service, index) => (
                            <SwiperSlide key={service.name || service.id}>
                                <motion.article
                                    className="afinix-service-card"
                                    tabIndex={0}
                                    aria-label={`${service.name}: ${service.detail}`}
                                    {...serviceCardMotion(reduceMotion, index)}
                                >
                                    <div className="afinix-service-card-media">
                                        <img
                                            src={service.image}
                                            alt={`${service.name}: ${service.material || 'Restauración digital'}`}
                                            loading="lazy"
                                            decoding="async"
                                            draggable={false}
                                        />
                                    </div>
                                    <div className="afinix-service-card-body">
                                        <h3 title={service.name}>{service.name}</h3>
                                        <p>{service.detail}</p>
                                        {service.material && (
                                            <div className="afinix-service-pill-wrapper">
                                                <span className="afinix-service-material-pill" title={`Material: ${service.material}`}>
                                                    <i className="bi bi-shield-check" aria-hidden="true"></i>
                                                    <span>{service.material}</span>
                                                </span>
                                            </div>
                                        )}
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
                </motion.div>
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

function WorkflowTimeline({ reduceMotion }) {
    const workflowRef = useRef(null);
    const [workflowActiveStep, setWorkflowActiveStep] = useState(0);
    const [isMobileWorkflow, setIsMobileWorkflow] = useState(false);
    const [isHoverPaused, setIsHoverPaused] = useState(false);
    const [isFocusPaused, setIsFocusPaused] = useState(false);
    const isWorkflowInView = useInView(workflowRef, { amount: 0.12 });

    useEffect(() => {
        const mobileQuery = window.matchMedia('(max-width: 640px)');
        const syncMobileState = () => setIsMobileWorkflow(mobileQuery.matches);

        syncMobileState();
        mobileQuery.addEventListener('change', syncMobileState);

        return () => mobileQuery.removeEventListener('change', syncMobileState);
    }, []);

    useEffect(() => {
        if (reduceMotion || !isWorkflowInView || isHoverPaused || isFocusPaused) {
            return undefined;
        }

        const isFinalStep = workflowActiveStep === workflow.length - 1;
        const timeoutId = window.setTimeout(
            () => setWorkflowActiveStep((current) => (current + 1) % workflow.length),
            isFinalStep ? WORKFLOW_FINAL_DURATION_MS : WORKFLOW_STEP_DURATION_MS,
        );

        return () => window.clearTimeout(timeoutId);
    }, [isFocusPaused, isHoverPaused, isWorkflowInView, reduceMotion, workflowActiveStep]);

    const activeWorkflow = workflow[workflowActiveStep] ?? workflow[0];
    const workflowStepProgress = workflow.length > 1
        ? workflowActiveStep / (workflow.length - 1)
        : 1;

    const handleStepClick = (index) => {
        setWorkflowActiveStep(index);
    };

    const touchStartX = useRef(null);
    const touchStartY = useRef(null);

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        setIsHoverPaused(true);
    };

    const handleTouchEnd = (e) => {
        setIsHoverPaused(false);
        if (touchStartX.current == null || touchStartY.current == null) return;
        const diffX = e.changedTouches[0].clientX - touchStartX.current;
        const diffY = e.changedTouches[0].clientY - touchStartY.current;

        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
            if (diffX < 0 && workflowActiveStep < workflow.length - 1) {
                handleStepClick(workflowActiveStep + 1);
            } else if (diffX > 0 && workflowActiveStep > 0) {
                handleStepClick(workflowActiveStep - 1);
            }
        }
        touchStartX.current = null;
        touchStartY.current = null;
    };

    const handleFocusCapture = () => setIsFocusPaused(true);
    const handleBlurCapture = (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsFocusPaused(false);
        }
    };

    return (
        <MotionSection
            ref={workflowRef}
            className="afinix-section afinix-workflow"
            id="flujo"
            onMouseEnter={() => setIsHoverPaused(true)}
            onMouseLeave={() => setIsHoverPaused(false)}
            onFocusCapture={handleFocusCapture}
            onBlurCapture={handleBlurCapture}
            {...workflowSectionMotion(reduceMotion)}
        >
            <div className="afinix-workflow-scroll-stage">
                <div className="afinix-workflow-sticky-shell">
                    <div className="afinix-workflow-header-grid">
                        <div className="afinix-section-heading afinix-workflow-heading">
                            <motion.span className="afinix-workflow-eyebrow" {...servicesHeadingMotion(reduceMotion, 0)}>
                                <i className="bi bi-bezier2 afinix-kicker-icon" aria-hidden="true"></i>
                                Flujo digital
                            </motion.span>
                            <motion.h2 className="afinix-workflow-title" {...servicesHeadingMotion(reduceMotion, 1)}>
                                Control total de su caso. <span className="afinix-workflow-title-accent">De la recepción a la entrega.</span>
                            </motion.h2>
                        </div>
                    </div>
                    <div className="afinix-workflow-stage-panel">
                        {!isMobileWorkflow ? (
                            <>
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

                                <ol className="afinix-workflow-grid" aria-label="Etapas del flujo digital">
                                    {workflow.map((step, index) => {
                                        const stepState =
                                            index === workflowActiveStep
                                                ? 'is-active'
                                                : index < workflowActiveStep
                                                    ? 'is-complete'
                                                    : 'is-upcoming';

                                        return (
                                            <motion.li
                                                className={`afinix-workflow-card ${stepState}`}
                                                key={step.id}
                                                aria-current={index === workflowActiveStep ? 'step' : undefined}
                                                {...workflowStepCardMotion(reduceMotion, index)}
                                            >
                                                <button
                                                    type="button"
                                                    className="afinix-workflow-step-button"
                                                    onClick={() => handleStepClick(index)}
                                                    aria-label={`Ver paso ${step.number}: ${step.title}`}
                                                >
                                                    <span className="afinix-workflow-card-head">
                                                        <span className="afinix-workflow-step-num">{step.number}</span>
                                                    </span>
                                                    <span className="afinix-workflow-step-icon" aria-hidden="true">
                                                        <i className={`bi ${step.icon}`}></i>
                                                    </span>
                                                    <h3>{step.title}</h3>
                                                </button>
                                            </motion.li>
                                        );
                                    })}
                                </ol>

                                <motion.div
                                    className="afinix-workflow-detail-shell"
                                    {...workflowViewerMotion(reduceMotion)}
                                >
                                    <AnimatePresence initial={false} mode="wait">
                                        <WorkflowDetailCard
                                            key={activeWorkflow.id}
                                            step={activeWorkflow}
                                            reduceMotion={reduceMotion}
                                        />
                                    </AnimatePresence>
                                </motion.div>
                            </>
                        ) : (
                            <div
                                className="afinix-workflow-mobile-container"
                                onTouchStart={handleTouchStart}
                                onTouchEnd={handleTouchEnd}
                            >
                                {/* Sliding Step Rail con orbe central animado */}
                                <div className="afinix-workflow-mobile-rail-viewport">
                                    <div className="afinix-workflow-mobile-rail-track-wrap">
                                        <motion.div
                                            className="afinix-workflow-mobile-rail-track"
                                            animate={{
                                                x: -(workflowActiveStep * 110 + 55)
                                            }}
                                            transition={{ type: "spring", stiffness: 320, damping: 28 }}
                                        >
                                            {/* Línea conectora base y línea de avance rellena */}
                                            <div
                                                className="afinix-workflow-mobile-rail-line-base"
                                                style={{
                                                    left: '55px',
                                                    width: `${(workflow.length - 1) * 110}px`
                                                }}
                                            />
                                            <motion.div
                                                className="afinix-workflow-mobile-rail-line-fill"
                                                style={{ left: '55px' }}
                                                animate={{
                                                    width: `${workflowActiveStep * 110}px`
                                                }}
                                                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                                            />

                                            {workflow.map((step, idx) => {
                                                const isActive = idx === workflowActiveStep;
                                                const isPassed = idx < workflowActiveStep;
                                                return (
                                                    <button
                                                        key={step.id}
                                                        type="button"
                                                        className={`afinix-workflow-mobile-node ${isActive ? 'is-active' : isPassed ? 'is-passed' : 'is-upcoming'}`}
                                                        onClick={() => handleStepClick(idx)}
                                                        aria-label={`Paso ${step.number}: ${step.title}`}
                                                    >
                                                        <span className="afinix-workflow-mobile-node-num">{step.number}</span>
                                                        <motion.div
                                                            className="afinix-workflow-mobile-node-orb"
                                                            animate={{
                                                                scale: isActive ? 1.16 : 0.8,
                                                            }}
                                                            transition={{ type: "spring", stiffness: 340, damping: 25 }}
                                                        >
                                                            <i className={`bi ${step.icon}`}></i>
                                                        </motion.div>
                                                        <span className="afinix-workflow-mobile-node-title">{step.title}</span>
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    </div>
                                </div>

                                {/* Tarjeta compacta (30% menor) con swipe y dots de progreso */}
                                <div className="afinix-workflow-mobile-card-wrapper">
                                    <AnimatePresence initial={false} mode="wait">
                                        <motion.article
                                            key={activeWorkflow.id}
                                            className="afinix-workflow-mobile-step-card"
                                            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: -8 }}
                                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                        >
                                            <div className="afinix-workflow-mobile-step-media">
                                                <img
                                                    src={activeWorkflow.image}
                                                    alt={activeWorkflow.imageAlt}
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                                <div className="afinix-workflow-mobile-step-badge">
                                                    <span>Etapa {activeWorkflow.number} de {String(workflow.length).padStart(2, '0')}</span>
                                                </div>
                                            </div>
                                            <div className="afinix-workflow-mobile-step-body">
                                                <div className="afinix-workflow-mobile-step-header">
                                                    <span className="afinix-workflow-mobile-step-icon">
                                                        <i className={`bi ${activeWorkflow.icon}`} aria-hidden="true"></i>
                                                    </span>
                                                    <div>
                                                        <span className="afinix-workflow-mobile-step-eyebrow">
                                                            {activeWorkflow.tags?.[0] || 'FLUJO DIGITAL'}
                                                        </span>
                                                        <h3 className="afinix-workflow-mobile-step-title">{activeWorkflow.title}</h3>
                                                    </div>
                                                </div>
                                                <p className="afinix-workflow-mobile-step-action">{activeWorkflow.action || activeWorkflow.text}</p>
                                                {activeWorkflow.chips && activeWorkflow.chips.length > 0 && (
                                                    <div className="afinix-workflow-mobile-step-chips">
                                                        {activeWorkflow.chips.map((chip) => (
                                                            <span key={chip} className="afinix-workflow-mobile-step-chip">
                                                                <i className="bi bi-check2" aria-hidden="true"></i>
                                                                {chip}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="afinix-workflow-mobile-step-dots" role="tablist" aria-label="Selector de etapas">
                                                    {workflow.map((_, dotIdx) => (
                                                        <button
                                                            key={dotIdx}
                                                            type="button"
                                                            className={`afinix-workflow-mobile-dot ${workflowActiveStep === dotIdx ? 'is-active' : ''}`}
                                                            onClick={() => handleStepClick(dotIdx)}
                                                            aria-label={`Ir al paso ${dotIdx + 1}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.article>
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MotionSection>
    );
}

function WorkWithUsSection({ reduceMotion }) {
    const videoRef = useRef(null);
    const [hasAudioStarted, setHasAudioStarted] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isPlaying, setIsPlaying] = useState(true);

    const handleActivateAudio = () => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = 0;
        videoRef.current.muted = false;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    setHasAudioStarted(true);
                    setIsMuted(false);
                    setIsPlaying(true);
                })
                .catch((err) => {
                    console.warn('Playback with audio prevented:', err);
                });
        }
    };

    const handleToggleMute = (e) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        const nextMuted = !videoRef.current.muted;
        videoRef.current.muted = nextMuted;
        setIsMuted(nextMuted);
    };

    const handleTogglePlay = (e) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    return (
        <MotionSection className="afinix-section afinix-about" id="trabaja-con-nosotros" {...sectionMotion(reduceMotion)}>
            <div className="afinix-about-copy">
                <motion.span {...servicesHeadingMotion(reduceMotion, 0)}>
                    <i className="bi bi-play-circle-fill afinix-kicker-icon" aria-hidden="true"></i>
                    Trabaja con nosotros
                </motion.span>
                <motion.h2 {...servicesHeadingMotion(reduceMotion, 1)}>
                    Cero retrasos. Cero retoques. <span className="afinix-section-title-accent">Respaldo técnico real.</span>
                </motion.h2>
                <motion.p {...servicesHeadingMotion(reduceMotion, 2)}>
                    Su tiempo en sillón vale. Transformamos la incertidumbre de laboratorio en previsibilidad operativa, comunicación directa y trazabilidad digital de cada caso.
                </motion.p>
                <div className="afinix-about-checklist-viewport">
                    <ul className="afinix-about-checklist" aria-label="Beneficios de trabajar con AFINIX Dental Lab">
                        {[...workWithUsHighlights, ...workWithUsHighlights].map((item, index) => (
                            <motion.li
                                key={`${item.title}-${index}`}
                                className={`afinix-about-checkitem ${index >= workWithUsHighlights.length ? 'afinix-about-checkitem--clone' : ''}`}
                                {...(index < workWithUsHighlights.length ? aboutProofMotion(reduceMotion, index) : {})}
                            >
                                <div className="afinix-about-check-icon">
                                    <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                                </div>
                                <div className="afinix-about-check-content">
                                    <strong>
                                        <span className="afinix-highlight-title--desktop">{item.title}</span>
                                        <span className="afinix-highlight-title--mobile">{item.shortTitle || item.title}</span>
                                    </strong>
                                    <p>{item.desc}</p>
                                </div>
                            </motion.li>
                        ))}
                    </ul>
                </div>
                <div className="afinix-about-actions afinix-about-actions--desktop">
                    <a
                        href={WHATSAPP_CHANNEL.href}
                        className="afinix-about-btn-primary"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <i className="bi bi-whatsapp" aria-hidden="true"></i>
                        <span>Enviar primer caso por WhatsApp</span>
                    </a>
                    <Link to={CLINIC_LOGIN_PATH} className="afinix-about-btn-secondary">
                        <span>Ingresar al portal</span>
                        <i className="bi bi-arrow-right" aria-hidden="true"></i>
                    </Link>
                </div>
            </div>
            <div className="afinix-about-video-wrap" aria-label="Video oficial de AFINIX Dental Lab">
                <div
                    className={`afinix-about-video-frame ${!hasAudioStarted ? 'is-preview-mode' : 'is-audio-active'}`}
                    onClick={hasAudioStarted ? handleTogglePlay : undefined}
                >
                    <video
                        ref={videoRef}
                        className="afinix-about-video"
                        src="/videos/afinix-lab-web.mp4"
                        autoPlay
                        loop
                        muted={isMuted}
                        playsInline
                        preload="metadata"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />

                    {!hasAudioStarted && (
                        <div
                            className="afinix-video-unmute-overlay"
                            onClick={handleActivateAudio}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleActivateAudio();
                                }
                            }}
                            aria-label="Reproducir video con sonido"
                        >
                            <div className="afinix-video-sound-ripple-wrap">
                                <span className="afinix-video-sound-ripple r1" aria-hidden="true"></span>
                                <span className="afinix-video-sound-ripple r2" aria-hidden="true"></span>
                                <div className="afinix-video-sound-btn">
                                    <i className="bi bi-play-fill" aria-hidden="true"></i>
                                </div>
                            </div>
                        </div>
                    )}

                    {hasAudioStarted && (
                        <div className="afinix-video-active-hud">
                            <button
                                type="button"
                                className="afinix-video-hud-btn"
                                onClick={handleTogglePlay}
                                aria-label={isPlaying ? 'Pausar video' : 'Reproducir video'}
                            >
                                <i className={`bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'}`} aria-hidden="true"></i>
                            </button>
                            <button
                                type="button"
                                className="afinix-video-hud-btn"
                                onClick={handleToggleMute}
                                aria-label={isMuted ? 'Activar sonido' : 'Silenciar video'}
                            >
                                <i className={`bi ${isMuted ? 'bi-volume-mute-fill' : 'bi-volume-up-fill'}`} aria-hidden="true"></i>
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="afinix-about-actions afinix-about-actions--mobile">
                <a
                    href={WHATSAPP_CHANNEL.href}
                    className="afinix-about-btn-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <i className="bi bi-whatsapp" aria-hidden="true"></i>
                    <span>Enviar caso</span>
                </a>
                <Link to={CLINIC_LOGIN_PATH} className="afinix-about-btn-secondary">
                    <span>Portal Clínicas</span>
                    <i className="bi bi-arrow-right" aria-hidden="true"></i>
                </Link>
            </div>
        </MotionSection>
    );
}

function PartnersMarquee() {
    return (
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
    );
}

function ContactSection({ reduceMotion }) {
    return (
        <MotionSection
            className="afinix-section afinix-contact"
            id="contacto"
            {...sectionMotion(reduceMotion)}
        >
            <motion.div className="afinix-section-heading afinix-contact-heading" {...contactHeadingMotion(reduceMotion)}>
                <span className="afinix-contact-kicker">
                    <i className="bi bi-chat-dots afinix-kicker-icon" aria-hidden="true"></i>
                    Contáctanos
                </span>
                <h2>
                    <span className="afinix-contact-title-lead">Hablemos de</span>{' '}
                    <span className="afinix-contact-title-accent">su próximo caso.</span>
                </h2>
            </motion.div>
            <div className="afinix-contact-grid">
                {landingContactChannels.map((channel, index) => (
                    <motion.article
                        key={channel.id}
                        className={`afinix-contact-card afinix-contact-card--${channel.colorClass}`}
                        {...contactCardMotion(reduceMotion, index)}
                    >
                        <div className="afinix-contact-card-icon" aria-hidden="true">
                            <i className={`bi ${channel.icon}`}></i>
                        </div>
                        <div className="afinix-contact-card-info">
                            <h3>{channel.title}</h3>
                            <p>{channel.subtitle}</p>
                        </div>
                        <a
                            href={channel.href}
                            className="afinix-contact-card-btn"
                            target={channel.external ? '_blank' : undefined}
                            rel={channel.external ? 'noopener noreferrer' : undefined}
                            aria-label={`${channel.btnText} - ${channel.title}`}
                        >
                            <span className="afinix-contact-card-btn-text">{channel.btnText}</span>
                            <i className="bi bi-chevron-right" aria-hidden="true"></i>
                        </a>
                    </motion.article>
                ))}
            </div>
            <motion.div className="afinix-contact-socials-block" {...contactSocialsMotion(reduceMotion)}>
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
            </motion.div>
        </MotionSection>
    );
}

function FinalCTA({ reduceMotion, theme = 'light' }) {
    return (
        <footer className="afinix-footer afinix-final-cta">
            <motion.div className="afinix-final-cta__inner" {...sectionMotion(reduceMotion)}>
                <div className="afinix-final-cta__panel">
                    <div className="afinix-section-heading afinix-final-cta__heading">
                        <span className="afinix-final-cta-kicker">
                            <i className="bi bi-shield-check afinix-kicker-icon" aria-hidden="true"></i>
                            Portal de Clínicas
                        </span>
                        <h2>
                            <span className="afinix-final-cta-lead">Eleve la precisión de su clínica.</span>{' '}
                            <span className="afinix-final-cta-accent">Sin sorpresas en boca.</span>
                        </h2>
                        <p>
                            Active su cuenta en el portal y empiece a gestionar órdenes con trazabilidad en tiempo real, tiempos exactos y soporte técnico garantizado.
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
                    <a href="/#trabaja-con-nosotros">Trabaja con nosotros</a>
                    <a href="/#flujo">Flujo digital</a>
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
export default function AfinixLandingBelowFold({ reduceMotion, theme = 'light' }) {
    return (
        <>
            <ServicesCarousel reduceMotion={reduceMotion} />
            <WorkWithUsSection reduceMotion={reduceMotion} />
            <WorkflowTimeline reduceMotion={reduceMotion} />
            {/* Ocultado temporalmente: métricas y clínicas partner en fase de apertura */}
            {/* <PartnersMarquee /> */}
            <ContactSection reduceMotion={reduceMotion} />
            <FinalCTA reduceMotion={reduceMotion} theme={theme} />
        </>
    );
}
