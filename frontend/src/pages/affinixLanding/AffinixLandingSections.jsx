import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { A11y, Autoplay, EffectFade, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/a11y';
import 'swiper/css/effect-fade';
import 'swiper/css/pagination';
import {
    contactChannels,
    heroSlides,
    heroTrackingSteps,
    mobileQuickLinks,
    socialLinks,
} from './affinixLandingContent.js';

const CLINIC_LOGIN_PATH = '/login?perfil=clinicas';
const WHATSAPP_CHANNEL = contactChannels.find((channel) => channel.label === 'WhatsApp') ?? contactChannels[0];
const LOCATION_CHANNEL = contactChannels.find((channel) => channel.label === 'Ver ubicación');
const HEADER_ICON_LINKS = [LOCATION_CHANNEL, ...socialLinks].filter(Boolean);
const HEADER_MENU_LINKS = [
    { href: '#servicios', label: 'Servicios' },
    { href: '#nosotros', label: 'Para tu clínica' },
    { href: '#flujo', label: 'Flujo digital' },
];
const HERO_EASE = [0.16, 1, 0.3, 1];
const TRACKING_CHECK_SETTLE_MS = 140;
const TRACKING_CHECK_STAGGER_MS = 620;
const heroBackgroundMotion = (reduced, isActive) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, scale: 1.08, filter: 'blur(14px)' },
            animate: isActive
                ? { opacity: 1, scale: 1.03, filter: 'blur(0px)' }
                : { opacity: 0, scale: 1.08, filter: 'blur(12px)' },
            transition: { duration: 1.25, ease: HERO_EASE },
        };
const heroCopyMotion = (reduced, isActive) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, x: -28, y: 34, filter: 'blur(12px)' },
            animate: isActive
                ? { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }
                : { opacity: 0, x: -18, y: 24, filter: 'blur(10px)' },
            transition: { duration: 0.98, delay: 0.18, ease: HERO_EASE },
        };
const heroVisualMotion = (reduced, isActive) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, x: 72, filter: 'blur(16px)' },
            animate: isActive
                ? { opacity: 1, x: 0, filter: 'blur(0px)' }
                : { opacity: 0, x: 52, filter: 'blur(12px)' },
            transition: { duration: 1.05, delay: 0.22, ease: HERO_EASE },
        };
const heroFloatCardMotion = (reduced, isActive, index) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, x: 104, scale: 0.94, filter: 'blur(18px)' },
            animate: isActive
                ? { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }
                : { opacity: 0, x: 72, scale: 0.96, filter: 'blur(14px)' },
            transition: { duration: 0.98, delay: 0.34 + index * 0.16, ease: HERO_EASE },
        };
const headerEntranceMotion = (reduced, delay = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: -22, filter: 'blur(12px)' },
            animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
            transition: { duration: 0.9, delay, ease: HERO_EASE },
        };
const heroLineMotion = (reduced, isActive, delay = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, x: -22, y: 18, filter: 'blur(10px)' },
            animate: isActive
                ? { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }
                : { opacity: 0, x: -14, y: 12, filter: 'blur(8px)' },
            transition: { duration: 0.82, delay, ease: HERO_EASE },
        };
const heroButtonMotion = (reduced, isActive, delay = 0) =>
    reduced
        ? {}
        : {
            initial: { opacity: 0, y: 22, scale: 0.96, filter: 'blur(8px)' },
            animate: isActive
                ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
                : { opacity: 0, y: 16, scale: 0.98, filter: 'blur(6px)' },
            transition: { duration: 0.76, delay, ease: HERO_EASE },
        };

function useMatchMedia(query) {
    const [matches, setMatches] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
    );
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mq = window.matchMedia(query);
        const handler = () => setMatches(mq.matches);
        handler();
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [query]);
    return matches;
}

export function LandingNavbar({ reduceMotion, themeToggle = null }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const closeMenuOnDesktop = () => {
            if (window.innerWidth > 860) {
                setIsMobileMenuOpen(false);
            }
        };

        const closeMenuOnEscape = (event) => {
            if (event.key === 'Escape') {
                setIsMobileMenuOpen(false);
            }
        };

        window.addEventListener('resize', closeMenuOnDesktop);
        window.addEventListener('keydown', closeMenuOnEscape);

        return () => {
            window.removeEventListener('resize', closeMenuOnDesktop);
            window.removeEventListener('keydown', closeMenuOnEscape);
        };
    }, []);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    return (
        <>
            <motion.div className="affinix-topbar" aria-label="Canales de contacto" {...headerEntranceMotion(reduceMotion, 0.04)}>
                <div className="affinix-topbar-inner">
                    <div className="affinix-topbar-channels">
                        {contactChannels.map((ch) => (
                            <a
                                key={ch.label}
                                href={ch.href}
                                className="affinix-topbar-chan"
                                target={ch.external ? '_blank' : undefined}
                                rel={ch.external ? 'noopener noreferrer' : undefined}
                                aria-label={ch.label}
                            >
                                <i className={`bi ${ch.icon}`} aria-hidden="true"></i>
                                <span>{ch.label}</span>
                            </a>
                        ))}
                    </div>
                    <div className="affinix-topbar-socials">
                        {socialLinks.map((s) => (
                            <a
                                key={s.label}
                                href={s.href}
                                className="affinix-topbar-chan"
                                target={s.external ? '_blank' : undefined}
                                rel={s.external ? 'noopener noreferrer' : undefined}
                                aria-label={s.label}
                            >
                                <i className={`bi ${s.icon}`} aria-hidden="true"></i>
                            </a>
                        ))}
                    </div>
                </div>
            </motion.div>
            <motion.header
                className={`affinix-navbar ${isMobileMenuOpen ? 'is-mobile-menu-open' : ''}`}
                aria-label="Navegación principal"
                {...headerEntranceMotion(reduceMotion, 0.12)}
            >
                <a className="affinix-brand" href="#inicio" aria-label="Affinix LAB, inicio (landing para clínicas)">
                    <span className="affinix-brand-mark">A</span>
                    <span>
                        <strong>Affinix LAB</strong>
                        <small>Laboratorio dental digital</small>
                    </span>
                </a>
                <nav className="affinix-nav-links" aria-label="Secciones de la landing">
                    <a href="#servicios">Servicios</a>
                    <a href="#nosotros">Para tu clínica</a>
                    <a href="#flujo">Flujo digital</a>
                </nav>
                <div className="affinix-nav-actions">
                    <a
                        className="affinix-header-whatsapp"
                        href={WHATSAPP_CHANNEL.href}
                        target={WHATSAPP_CHANNEL.external ? '_blank' : undefined}
                        rel={WHATSAPP_CHANNEL.external ? 'noopener noreferrer' : undefined}
                        aria-label="Consultar por WhatsApp sobre casos para clínicas"
                    >
                        <i className={`bi ${WHATSAPP_CHANNEL.icon}`} aria-hidden="true"></i>
                        <span>Más info</span>
                    </a>
                    {LOCATION_CHANNEL ? (
                        <a
                            className="affinix-header-location"
                            href={LOCATION_CHANNEL.href}
                            target={LOCATION_CHANNEL.external ? '_blank' : undefined}
                            rel={LOCATION_CHANNEL.external ? 'noopener noreferrer' : undefined}
                            aria-label={LOCATION_CHANNEL.label}
                        >
                            <i className={`bi ${LOCATION_CHANNEL.icon}`} aria-hidden="true"></i>
                        </a>
                    ) : null}
                    <nav className="affinix-header-socials" aria-label="Ubicación y redes sociales">
                        {HEADER_ICON_LINKS.map((item) => (
                            <a
                                key={item.label}
                                href={item.href}
                                className="affinix-header-icon-link"
                                target={item.external ? '_blank' : undefined}
                                rel={item.external ? 'noopener noreferrer' : undefined}
                                aria-label={item.label}
                            >
                                <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                            </a>
                        ))}
                    </nav>
                    <button
                        type="button"
                        className="affinix-mobile-menu-toggle"
                        aria-expanded={isMobileMenuOpen}
                        aria-controls="affinix-mobile-menu"
                        aria-label={isMobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
                        onClick={() => setIsMobileMenuOpen((current) => !current)}
                    >
                        <i className={`bi ${isMobileMenuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true"></i>
                    </button>
                    {themeToggle}
                    <Link className="affinix-login-link" to={CLINIC_LOGIN_PATH}>
                        <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                        Entrar al portal
                    </Link>
                </div>
                <nav className="affinix-mobile-quicknav" aria-label="Accesos rápidos">
                    {mobileQuickLinks.map((link) => (
                        <a key={link.href} href={link.href} onClick={closeMobileMenu}>
                            {link.label}
                        </a>
                    ))}
                </nav>
                <div
                    className={`affinix-mobile-menu-panel ${isMobileMenuOpen ? 'is-open' : ''}`}
                    id="affinix-mobile-menu"
                    aria-label="Menú móvil"
                >
                    <nav className="affinix-mobile-menu-links" aria-label="Secciones principales">
                        {HEADER_MENU_LINKS.map((link) => (
                            <a key={link.href} href={link.href} onClick={closeMobileMenu}>
                                {link.label}
                            </a>
                        ))}
                    </nav>
                    <div className="affinix-mobile-menu-utility-row">
                        <div className="affinix-mobile-menu-socials" aria-label="Redes sociales y ubicación">
                            {HEADER_ICON_LINKS.map((item) => (
                                <a
                                    key={item.label}
                                    href={item.href}
                                    target={item.external ? '_blank' : undefined}
                                    rel={item.external ? 'noopener noreferrer' : undefined}
                                    aria-label={item.label}
                                    onClick={closeMobileMenu}
                                >
                                    <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                                </a>
                            ))}
                        </div>
                        {themeToggle ? <div className="affinix-mobile-menu-theme">{React.cloneElement(themeToggle)}</div> : null}
                    </div>
                    <Link className="affinix-mobile-menu-login" to={CLINIC_LOGIN_PATH} onClick={closeMobileMenu}>
                        <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                        Entrar al portal
                    </Link>
                </div>
            </motion.header>
        </>
    );
}

function HeroTrackingWidget({ reduceMotion, className = '' }) {
    const [completedStep, setCompletedStep] = useState(reduceMotion ? heroTrackingSteps.length - 1 : -1);
    const [trackingReady, setTrackingReady] = useState(reduceMotion);

    useEffect(() => {
        if (reduceMotion) {
            setCompletedStep(heroTrackingSteps.length - 1);
            setTrackingReady(true);
            return undefined;
        }

        setCompletedStep(-1);
        setTrackingReady(false);
        return undefined;
    }, [reduceMotion]);

    useEffect(() => {
        if (reduceMotion || !trackingReady) {
            return undefined;
        }

        const timers = heroTrackingSteps.map((_, index) =>
            window.setTimeout(() => {
                setCompletedStep(index);
            }, TRACKING_CHECK_SETTLE_MS + index * TRACKING_CHECK_STAGGER_MS),
        );

        return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, [reduceMotion, trackingReady]);

    return (
        <motion.aside
            className={`affinix-hero-tracking ${className}`.trim()}
            aria-label="Seguimiento de caso sin retrasos"
            {...(reduceMotion
                ? {}
                : {
                    initial: { opacity: 0, y: 30, scale: 0.96, filter: 'blur(14px)' },
                    animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
                    transition: { duration: 0.9, delay: 0.9, ease: HERO_EASE },
                    onAnimationComplete: () => setTrackingReady(true),
                })}
        >
            <div className="affinix-hero-tracking-head">
                <span className="affinix-hero-tracking-dot" aria-hidden="true"></span>
                <strong>Seguimiento en vivo</strong>
            </div>
            <ol className="affinix-hero-tracking-steps" aria-live="polite">
                {heroTrackingSteps.map((step, index) => {
                    const stepState = index <= completedStep ? 'is-done' : index === completedStep + 1 ? 'is-active' : 'is-pending';
                    return (
                        <li
                            key={step.id}
                            className={`affinix-hero-tracking-step ${stepState}`}
                            data-state={stepState.replace('is-', '')}
                        >
                            <span className="affinix-hero-tracking-icon" aria-hidden="true">
                                {stepState === 'is-done' ? (
                                    <i className="bi bi-check-lg"></i>
                                ) : stepState === 'is-active' ? (
                                    <span className="affinix-hero-tracking-pulse"></span>
                                ) : null}
                            </span>
                            <span className="affinix-hero-tracking-label">{step.label}</span>
                        </li>
                    );
                })}
            </ol>
            <div className="affinix-hero-tracking-actions">
                <p className="affinix-hero-tracking-alert" aria-label="Aviso: todo sin retrasos">
                    <i className="bi bi-bell" aria-hidden="true"></i>
                    Todo sin retrasos
                </p>
                <Link className="affinix-hero-tracking-portal" to={CLINIC_LOGIN_PATH}>
                    Ir al portal
                    <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                </Link>
            </div>
        </motion.aside>
    );
}

export function HeroCarousel({ reduceMotion }) {
    const [activeSlide, setActiveSlide] = useState(0);
    const heroStackLayout = useMatchMedia('(max-width: 640px)');

    return (
        <section className="affinix-hero" id="inicio" aria-label="Presentación: servicios digitales para clínicas">
            <div className="affinix-hero-stage">
                <Swiper
                    className={`affinix-hero-swiper${heroStackLayout ? ' affinix-hero-swiper--stack' : ''}`}
                    modules={[A11y, Autoplay, EffectFade, Pagination]}
                    effect="fade"
                    fadeEffect={{ crossFade: true }}
                    autoHeight={heroStackLayout}
                    pagination={{ clickable: true }}
                    loop={false}
                    rewind={!reduceMotion}
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
                        <SwiperSlide key={slide.kicker}>
                            <article className="affinix-hero-slide">
                                <motion.div
                                    className="affinix-hero-bg"
                                    aria-hidden="true"
                                    {...heroBackgroundMotion(reduceMotion, activeSlide === index)}
                                >
                                    <img
                                        src={slide.image}
                                        alt=""
                                        loading={index === 0 ? 'eager' : 'lazy'}
                                        decoding="async"
                                        fetchpriority={index === 0 ? 'high' : 'low'}
                                    />
                                </motion.div>
                                <div className="affinix-hero-overlay"></div>
                                <div className="affinix-hero-layout">
                                    <motion.div
                                        className="affinix-hero-copy"
                                        {...heroCopyMotion(reduceMotion, activeSlide === index)}
                                    >
                                        <div className="affinix-hero-copy-text">
                                            <motion.span className="affinix-kicker" {...heroLineMotion(reduceMotion, activeSlide === index, 0.32)}>
                                                {slide.kicker}
                                            </motion.span>
                                            {index === 0 ? (
                                                <motion.h1 className="affinix-hero-title" {...heroLineMotion(reduceMotion, activeSlide === index, 0.46)}>
                                                    {slide.titleBefore}
                                                    <span className="affinix-hero-accent">{slide.titleHighlight}</span>
                                                    {slide.titleAfter}
                                                </motion.h1>
                                            ) : (
                                                <motion.h2 className="affinix-hero-title" {...heroLineMotion(reduceMotion, activeSlide === index, 0.46)}>
                                                    {slide.titleBefore}
                                                    <span className="affinix-hero-accent">{slide.titleHighlight}</span>
                                                    {slide.titleAfter}
                                                </motion.h2>
                                            )}
                                            <motion.p className="affinix-hero-lead" {...heroLineMotion(reduceMotion, activeSlide === index, 0.64)}>
                                                {slide.copy}
                                            </motion.p>
                                        </div>
                                        <div className="affinix-hero-actions">
                                            <motion.div {...heroButtonMotion(reduceMotion, activeSlide === index, 0.84)}>
                                                <Link className="affinix-hero-btn affinix-hero-btn--primary" to={CLINIC_LOGIN_PATH}>
                                                    Enviar caso
                                                    <i className="bi bi-arrow-right" aria-hidden="true"></i>
                                                </Link>
                                            </motion.div>
                                            <motion.div {...heroButtonMotion(reduceMotion, activeSlide === index, 0.98)}>
                                                <a className="affinix-hero-btn affinix-hero-btn--ghost" href="#servicios">
                                                    Ver servicios
                                                    <i className="bi bi-arrow-right" aria-hidden="true"></i>
                                                </a>
                                            </motion.div>
                                        </div>
                                    </motion.div>
                                    <motion.div
                                        className="affinix-hero-visual"
                                        aria-hidden="true"
                                        {...heroVisualMotion(reduceMotion, activeSlide === index)}
                                    >
                                        <svg className="affinix-hero-lines" viewBox="0 0 320 420" preserveAspectRatio="none" aria-hidden="true">
                                            <path
                                                className="affinix-hero-line-path"
                                                d="M 12 72 L 140 96 L 220 52"
                                                fill="none"
                                            />
                                            <path
                                                className="affinix-hero-line-path"
                                                d="M 8 210 L 155 198 L 248 175"
                                                fill="none"
                                            />
                                            <path
                                                className="affinix-hero-line-path"
                                                d="M 18 348 L 148 312 L 235 290"
                                                fill="none"
                                            />
                                        </svg>
                                        <div className="affinix-hero-cards">
                                            {slide.floatCards.map((card, cardIndex) => (
                                                <motion.div
                                                    key={card.label}
                                                    className="affinix-hero-float-card"
                                                    {...heroFloatCardMotion(reduceMotion, activeSlide === index, cardIndex)}
                                                >
                                                    <span className="affinix-hero-float-icon">
                                                        <i className={`bi ${card.icon}`} aria-hidden="true"></i>
                                                    </span>
                                                    <div className="affinix-hero-float-body">
                                                        <span className="affinix-hero-float-label">{card.label}</span>
                                                        <strong>{card.value}</strong>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                </div>
                                <HeroTrackingWidget reduceMotion={reduceMotion} className="affinix-hero-tracking--mobile" />
                            </article>
                        </SwiperSlide>
                    ))}
                </Swiper>
                <HeroTrackingWidget reduceMotion={reduceMotion} className="affinix-hero-tracking--desktop" />
            </div>
        </section>
    );
}
