import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { A11y, Autoplay, EffectFade, Keyboard, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/a11y';
import 'swiper/css/effect-fade';
import 'swiper/css/pagination';
import '../styles/affinix-landing.css';
import LandingThemeToggle from '../components/affinix/LandingThemeToggle.jsx';
import { useLandingTheme } from './hooks/useLandingTheme.js';

const IMG = '/images/affinix-landing';

const heroSlides = [
    {
        kicker: 'CAD/CAM de alta precision',
        title: 'Control digital en cada restauracion, desde el primer archivo.',
        copy: 'Validamos tu STL, producimos con trazabilidad y entregas previsibles para tu clinica.',
        metric: '48-72 h',
        metricLabel: 'entrega referencial',
        image: `${IMG}/hero-precision.jpg`,
        alt: 'Fresado CAD CAM de restauraciones dentales en bloque ceramico',
    },
    {
        kicker: 'Produccion visible',
        title: 'Tu clinica sabe en que etapa esta cada pedido, sin dudas.',
        copy: 'Portal con estado, historial y aprobaciones: menos mensajes, mas claridad operativa.',
        metric: '24/7',
        metricLabel: 'seguimiento online',
        image: `${IMG}/hero-production.jpg`,
        alt: 'Fresadora dental trabajando con refrigeracion y piezas en produccion',
    },
    {
        kicker: 'Diseno 3D y aprobacion',
        title: 'Aprueba en linea y evita retrabajos antes de fresar.',
        copy: 'Diseno 3D, revision clinica y laboratorio alineados en un solo flujo digital.',
        metric: '5 ejes',
        metricLabel: 'equipamiento CAD/CAM',
        image: `${IMG}/hero-equipment.jpg`,
        alt: 'Equipo de fresado de cinco ejes para estructuras dentales',
    },
];

const services = [
    {
        name: 'Zirconia monolitica',
        code: 'ZIR-MONO',
        detail: 'Resistencia para posteriores, anatomia calibrada y acabado natural.',
        leadTime: '48-72 h',
        price: 'Desde cotizacion por caso',
        material: 'Zirconia multicapa',
        indication: 'Coronas y puentes posteriores',
        image: `${IMG}/service-zirconia-real.jpg`,
    },
    {
        name: 'Disilicato / e.max',
        code: 'E.MAX-CAD',
        detail: 'Estetica translucida para anteriores con planificacion digital.',
        leadTime: '72 h',
        price: 'Desde evaluacion estetica',
        material: 'Disilicato de litio',
        indication: 'Carillas, incrustaciones y coronas',
        image: `${IMG}/service-cad-real.jpg`,
    },
    {
        name: 'Guias quirurgicas',
        code: 'SURG-GUIDE',
        detail: 'Planificacion desde CBCT/STL para cirugias implantologicas mas predecibles.',
        leadTime: '3-5 dias',
        price: 'A consultar',
        material: 'Resina biocompatible',
        indication: 'Implantes guiados',
        image: `${IMG}/service-provisional-real.jpg`,
    },
    {
        name: 'Protesis hibridas',
        code: 'HYB-CAM',
        detail: 'Estructuras para rehabilitaciones extensas con control de ajuste pasivo.',
        leadTime: '5-7 dias',
        price: 'Segun estructura',
        material: 'PMMA, CoCr o zirconia',
        indication: 'Rehabilitacion sobre implantes',
        image: `${IMG}/service-hybrid-real.jpg`,
    },
    {
        name: 'Coronas y puentes',
        code: 'CROWN-BRIDGE',
        detail: 'Produccion seriada con control marginal y comunicacion por caso.',
        leadTime: '48-96 h',
        price: 'Desde tarifa de laboratorio',
        material: 'Zirconia, PMMA, metal ceramica',
        indication: 'Casos unitarios y multiples',
        image: `${IMG}/service-implant-real.jpg`,
    },
    {
        name: 'Diseno digital 3D',
        code: 'CAD-REVIEW',
        detail: 'Revision de anatomia, oclusion, contactos y aprobacion previa a produccion.',
        leadTime: '24-48 h',
        price: 'A consultar',
        material: 'Archivo STL / CAD',
        indication: 'Planificacion y aprobacion online',
        image: `${IMG}/equipment-milling.jpg`,
    },
];

const workflow = [
    ['01', 'Recepcion STL/CBCT', 'Validamos archivos, indicaciones y prioridades antes de iniciar.'],
    ['02', 'Diseno 3D', 'Modelamos anatomia, contactos y eje de insercion para aprobacion.'],
    ['03', 'Aprobacion online', 'La clinica revisa avances y evita llamadas innecesarias.'],
    ['04', 'Produccion CAD/CAM', 'Fresado, acabado, control de calidad y registro de etapa.'],
    ['05', 'Entrega trazable', 'Coordinacion de despacho con historial del pedido disponible.'],
];

const portalBenefits = [
    'Ver estado de pedidos en tiempo real',
    'Revisar y aprobar disenos 3D',
    'Consultar historial de casos y entregas',
    'Coordinar observaciones con el laboratorio',
];

const partnerClinics = [
    ['CP', 'Clinica Prisma'],
    ['DN', 'Dental Norte'],
    ['IS', 'Implant Studio'],
    ['OP', 'Oral Prime'],
    ['SV', 'Sonrisa Viva'],
    ['CA', 'Centro Aligner'],
];

const sectionMotion = (reduced, delay = 0) =>
    reduced
        ? {}
        : {
              initial: { opacity: 0, y: 34 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, amount: 0.18 },
              transition: { duration: 0.56, delay, ease: [0.22, 1, 0.36, 1] },
          };

const itemMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
              initial: { opacity: 0, y: 24 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, amount: 0.22 },
              transition: { duration: 0.45, delay: index * 0.045, ease: [0.22, 1, 0.36, 1] },
          };

/** Re-animates when cards re-enter the viewport (scroll back, drag carousel, loop). */
const serviceCardMotion = (reduced, index = 0) =>
    reduced
        ? {}
        : {
              initial: { opacity: 0, y: 22 },
              whileInView: { opacity: 1, y: 0 },
              viewport: {
                  once: false,
                  amount: 0.12,
                  /* Wider root so slides re-fire when they re-enter after horizontal drag/loop */
                  margin: '48px 100px 72px 100px',
              },
              transition: { duration: 0.42, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] },
          };

const AffinixLanding = () => {
    const workflowRef = useRef(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const [workflowActiveStep, setWorkflowActiveStep] = useState(0);
    const { theme, toggle } = useLandingTheme();
    const reduceMotion = useReducedMotion();
    const Sec = motion.section;

    const { scrollYProgress } = useScroll({
        target: workflowRef,
        offset: ['start 0.82', 'end 0.28'],
    });

    useMotionValueEvent(scrollYProgress, 'change', (latest) => {
        const step = Math.min(4, Math.max(0, Math.floor(latest * 5)));
        setWorkflowActiveStep(step);
    });

    const servicesLoopEnabled = !reduceMotion && services.length >= 3;

    return (
        <main className="affinix-page" data-theme={theme} id="affinix-landing-root">
            <a className="skip-link" href="#inicio">
                Ir al contenido
            </a>
            <header className="affinix-navbar" aria-label="Navegacion principal">
                <a className="affinix-brand" href="#inicio" aria-label="Affinix LAB inicio">
                    <span className="affinix-brand-mark">A</span>
                    <span>
                        <strong>Affinix LAB</strong>
                        <small>Laboratorio dental digital</small>
                    </span>
                </a>
                <nav className="affinix-nav-links">
                    <a href="#servicios">Servicios</a>
                    <a href="#nosotros">Nosotros</a>
                    <a href="#flujo">Flujo digital</a>
                    <a href="#portal">Portal</a>
                </nav>
                <div className="affinix-nav-actions">
                    <LandingThemeToggle theme={theme} onToggle={toggle} />
                    <Link className="affinix-login-link" to="/login?perfil=clinicas">
                        <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                        Entrar
                    </Link>
                </div>
            </header>

            <section className="affinix-hero" id="inicio" aria-label="Presentacion de Affinix LAB">
                <Swiper
                    className="affinix-hero-swiper"
                    modules={[A11y, Autoplay, EffectFade, Pagination]}
                    effect="fade"
                    fadeEffect={{ crossFade: true }}
                    autoHeight={false}
                    pagination={{ clickable: true }}
                    loop={!reduceMotion}
                    speed={reduceMotion ? 0 : 720}
                    autoplay={
                        reduceMotion
                            ? false
                            : {
                                  delay: 5200,
                                  disableOnInteraction: false,
                                  pauseOnMouseEnter: true,
                              }
                    }
                    a11y={{
                        prevSlideMessage: 'Slide anterior',
                        nextSlideMessage: 'Slide siguiente',
                        paginationBulletMessage: 'Ir al slide {{index}}',
                    }}
                    onSlideChange={(swiper) => setActiveSlide(swiper.realIndex)}
                >
                    {heroSlides.map((slide, index) => (
                        <SwiperSlide key={slide.title}>
                            <article className="affinix-hero-slide">
                                <div className="affinix-hero-bg" aria-hidden="true">
                                    <img
                                        src={slide.image}
                                        alt=""
                                        loading={index === 0 ? 'eager' : 'lazy'}
                                        decoding="async"
                                    />
                                </div>
                                <div className="affinix-hero-overlay"></div>
                                <motion.div
                                    className="affinix-hero-copy"
                                    initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                                    animate={activeSlide === index ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
                                    transition={{ duration: reduceMotion ? 0 : 0.52, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    <div className="affinix-hero-copy-text">
                                        <span className="affinix-kicker">{slide.kicker}</span>
                                        <h1>{slide.title}</h1>
                                        <p className="affinix-hero-lead">{slide.copy}</p>
                                    </div>
                                    <div className="affinix-hero-actions">
                                        <a className="affinix-primary-action" href="#servicios">
                                            Ver servicios
                                            <i className="bi bi-arrow-down-right" aria-hidden="true"></i>
                                        </a>
                                        <Link className="affinix-secondary-action" to="/login?perfil=clinicas">
                                            Seguimiento de pedidos
                                        </Link>
                                    </div>
                                </motion.div>
                                <motion.aside
                                    className="affinix-hero-metric"
                                    aria-label={`${slide.metric}, ${slide.metricLabel}`}
                                    initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
                                    animate={activeSlide === index ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
                                    transition={{ duration: reduceMotion ? 0 : 0.45, delay: 0.14 }}
                                >
                                    <strong>{slide.metric}</strong>
                                    <span>{slide.metricLabel}</span>
                                </motion.aside>
                            </article>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </section>

            <Sec className="affinix-section affinix-services" id="servicios" {...sectionMotion(reduceMotion)}>
                <div className="affinix-section-heading">
                    <span>Catalogo interactivo</span>
                    <h2>Servicios digitales con trazabilidad clinica real.</h2>
                    <p>
                        Desliza horizontalmente o usa el carrusel con teclado (foco en la zona). Cada tarjeta muestra tiempo,
                        precio referencial y uso clinico al pasar el cursor, enfocar con teclado o verla en movil.
                    </p>
                </div>
                <div
                    className="affinix-services-carousel"
                    role="region"
                    aria-label="Catalogo horizontal de servicios. Desliza o usa flechas del teclado cuando el carrusel tiene foco."
                    tabIndex={0}
                >
                    <Swiper
                        className="affinix-services-swiper"
                        modules={[A11y, Autoplay, Keyboard]}
                        loop={servicesLoopEnabled}
                        slidesPerView="auto"
                        spaceBetween={16}
                        autoplay={
                            reduceMotion
                                ? false
                                : {
                                      delay: 2800,
                                      disableOnInteraction: false,
                                      pauseOnMouseEnter: true,
                                  }
                        }
                        grabCursor
                        watchOverflow
                        keyboard={{ enabled: true, onlyInViewport: true }}
                        a11y={{
                            prevSlideMessage: 'Servicio anterior',
                            nextSlideMessage: 'Servicio siguiente',
                        }}
                    >
                        {services.map((service, index) => (
                            <SwiperSlide key={service.name}>
                                <motion.article className="affinix-service-card" tabIndex={0} {...serviceCardMotion(reduceMotion, index)}>
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
                                        <div className="affinix-service-topline">
                                            <span>{service.code}</span>
                                            <i className="bi bi-stars" aria-hidden="true"></i>
                                        </div>
                                        <h3>{service.name}</h3>
                                        <p>{service.detail}</p>
                                    </div>
                                    <div className="affinix-service-popover">
                                        <div>
                                            <span>Entrega</span>
                                            <strong>{service.leadTime}</strong>
                                        </div>
                                        <div>
                                            <span>Precio</span>
                                            <strong>{service.price}</strong>
                                        </div>
                                        <div>
                                            <span>Material</span>
                                            <strong>{service.material}</strong>
                                        </div>
                                        <small>{service.indication}</small>
                                    </div>
                                </motion.article>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
            </Sec>

            <Sec className="affinix-section affinix-about" id="nosotros" {...sectionMotion(reduceMotion)}>
                <div className="affinix-about-copy">
                    <span>Nosotros</span>
                    <h2>Laboratorio digital con control total.</h2>
                    <p>
                        Affinix LAB conecta criterio clinico, diseno digital y equipamiento CAD/CAM para que cada caso avance
                        con responsables, tiempos y evidencias visibles. La tecnologia importa, pero la arquitectura del proceso
                        importa MAS: sin trazabilidad, la precision se vuelve suerte.
                    </p>
                    <div className="affinix-proof-grid">
                        <article>
                            <strong>5 ejes</strong>
                            <p>Fresado para geometria compleja y estructuras extensas.</p>
                        </article>
                        <article>
                            <strong>STL + CBCT</strong>
                            <p>Recepcion digital y validacion antes de producir.</p>
                        </article>
                        <article>
                            <strong>QC</strong>
                            <p>Control de ajuste, anatomia y contacto por etapa.</p>
                        </article>
                    </div>
                </div>
                <div className="affinix-about-gallery" aria-label="Muestras y equipamiento del laboratorio">
                    <img src={`${IMG}/service-hybrid-real.jpg`} alt="Protesis hibrida dental sobre modelo" loading="lazy" />
                    <img src={`${IMG}/service-zirconia-real.jpg`} alt="Coronas dentales terminadas" loading="lazy" />
                    <img src={`${IMG}/equipment-milling.jpg`} alt="Equipo de fresado dental en funcionamiento" loading="lazy" />
                </div>
            </Sec>

            <Sec ref={workflowRef} className="affinix-section affinix-workflow" id="flujo" {...sectionMotion(reduceMotion)}>
                <div className="affinix-section-heading">
                    <span>Flujo digital</span>
                    <h2>Del archivo clinico a la entrega, cada paso queda visible.</h2>
                    <p className="affinix-workflow-progress-label" aria-live="polite">
                        Avance del pedido al recorrer esta seccion: paso {(workflowActiveStep + 1).toString().padStart(2, '0')} de 05.
                    </p>
                </div>
                <div className="affinix-workflow-progress" aria-hidden="true">
                    <div
                        className="affinix-workflow-progress-fill"
                        style={{
                            transform: `scaleX(${(workflowActiveStep + 1) / 5})`,
                            transition: reduceMotion ? 'none' : 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                    />
                </div>
                <div className="affinix-workflow-grid">
                    {workflow.map(([number, title, text], index) => {
                        const stepState =
                            index === workflowActiveStep
                                ? 'is-active'
                                : index < workflowActiveStep
                                  ? 'is-complete'
                                  : 'is-upcoming';
                        return (
                            <motion.article
                                className={`affinix-workflow-card ${stepState}`}
                                key={title}
                                {...itemMotion(reduceMotion, index)}
                            >
                                <div className="affinix-workflow-card-head">
                                    <span className="affinix-workflow-step-num">{number}</span>
                                    {index < workflowActiveStep ? (
                                        <span className="affinix-workflow-step-check" aria-hidden="true">
                                            <i className="bi bi-check-lg"></i>
                                        </span>
                                    ) : null}
                                </div>
                                <h3>{title}</h3>
                                <p>{text}</p>
                            </motion.article>
                        );
                    })}
                </div>
            </Sec>

            <Sec className="affinix-section affinix-portal" id="portal" {...sectionMotion(reduceMotion)}>
                <div className="affinix-portal-panel">
                    <div className="affinix-portal-copy">
                        <span>Portal para clinicas</span>
                        <h2>Portal clinico para controlar ordenes.</h2>
                        <p>
                            Los odontologos pueden seguir pedidos, revisar avances y aprobar disenos 3D desde un entorno
                            conectado al laboratorio.
                        </p>
                        <ul>
                            {portalBenefits.map((benefit) => (
                                <li key={benefit}>
                                    <i className="bi bi-check2" aria-hidden="true"></i>
                                    {benefit}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="affinix-login-preview" aria-label="Vista previa del acceso al portal">
                        <div className="affinix-login-preview-top">
                            <span>A</span>
                            <strong>Affinix Portal</strong>
                        </div>
                        <div className="affinix-status-row">
                            <span>Pedido #AF-2841</span>
                            <strong>Diseno 3D listo</strong>
                        </div>
                        <div className="affinix-status-row">
                            <span>Zirconia posterior</span>
                            <strong>En control QC</strong>
                        </div>
                        <Link className="affinix-primary-action" to="/login?perfil=clinicas">
                            Entrar al portal
                            <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                        </Link>
                    </div>
                </div>
            </Sec>

            <section className="affinix-partners" aria-label="Clinicas partner">
                <p>Clinicas que ya trabajan con Affinix LAB</p>
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
            </section>

            <footer className="affinix-footer">
                <motion.div className="affinix-footer-content" {...sectionMotion(reduceMotion)}>
                    <span>Agenda tu flujo digital</span>
                    <h2>Convierte cada pedido en un proceso visible y medible.</h2>
                    <div className="affinix-footer-actions">
                        <a className="affinix-primary-action" href="#servicios">
                            Ver catalogo
                        </a>
                        <Link className="affinix-secondary-action" to="/login?perfil=clinicas">
                            Seguimiento de pedidos
                        </Link>
                    </div>
                </motion.div>
            </footer>
        </main>
    );
};

export default AffinixLanding;
