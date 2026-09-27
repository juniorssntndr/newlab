import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { A11y, Autoplay, EffectFade, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/a11y';
import 'swiper/css/effect-fade';
import 'swiper/css/pagination';
import {
    contactChannels,
    heroSlides,
    mobileQuickLinks,
    socialLinks,
} from './afinixLandingContent.js';
import { whatsappHref } from '../../config/siteSeo.js';
import AfinixLogo from '../../components/AfinixLogo';

const CLINIC_LOGIN_PATH = '/login?perfil=clinicas';
const WHATSAPP_CHANNEL = contactChannels.find((channel) => channel.label === 'WhatsApp') ?? contactChannels[0];
const LOCATION_CHANNEL = contactChannels.find((channel) => channel.label === 'Ver ubicación');
const HEADER_ICON_LINKS = [LOCATION_CHANNEL, ...socialLinks].filter(Boolean);
const HEADER_MENU_LINKS = [
    { href: '/#servicios', label: 'Servicios' },
    { href: '/#flujo', label: 'Flujo digital' },
    { href: '/#nosotros', label: 'Por qué AFINIX' },
    { href: '/#contacto', label: 'Contacto' },
];
const HERO_EASE = [0.16, 1, 0.3, 1];
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
            initial: { opacity: 0 },
            animate: isActive ? { opacity: 1 } : { opacity: 0 },
            transition: { duration: 0.5, ease: HERO_EASE },
        };
const heroFloatCardMotion = (reduced, isActive, index, isMobile = false) =>
    reduced
        ? {}
        : isMobile
            ? {
                initial: { opacity: 0, y: 20, filter: 'blur(10px)' },
                animate: isActive
                    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                    : { opacity: 0, y: 14, filter: 'blur(8px)' },
                transition: { duration: 0.95, delay: 0.42 + index * 0.14, ease: HERO_EASE },
            }
            : {
                initial: { opacity: 0, x: 48, scale: 0.96, filter: 'blur(12px)' },
                animate: isActive
                    ? { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }
                    : { opacity: 0, x: 36, scale: 0.96, filter: 'blur(8px)' },
                transition: { duration: 0.95, delay: 0.38 + index * 0.14, ease: HERO_EASE },
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

export function LandingNavbar({ reduceMotion, themeToggle = null, theme = 'light' }) {
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

    useEffect(() => {
        if (!isMobileMenuOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobileMenuOpen]);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    return (
        <>
            <motion.div className="afinix-topbar" aria-label="Canales de contacto" {...headerEntranceMotion(reduceMotion, 0.04)}>
                <div className="afinix-topbar-inner">
                    <div className="afinix-topbar-channels">
                        {contactChannels.map((ch) => (
                            <a
                                key={ch.label}
                                href={ch.href}
                                className="afinix-topbar-chan"
                                target={ch.external ? '_blank' : undefined}
                                rel={ch.external ? 'noopener noreferrer' : undefined}
                                aria-label={ch.label}
                            >
                                <i className={`bi ${ch.icon}`} aria-hidden="true"></i>
                                <span>{ch.label}</span>
                            </a>
                        ))}
                    </div>
                    <div className="afinix-topbar-socials">
                        {socialLinks.map((s) => (
                            <a
                                key={s.label}
                                href={s.href}
                                className="afinix-topbar-chan"
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
                className={`afinix-navbar ${isMobileMenuOpen ? 'is-mobile-menu-open' : ''}`}
                aria-label="Navegación principal"
                {...headerEntranceMotion(reduceMotion, 0.12)}
            >
                <a
                    className="afinix-brand"
                    href="/#inicio"
                    aria-label="AFINIX Dental Lab, inicio"
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    onMouseDown={(event) => event.preventDefault()}
                >
                    <AfinixLogo size={54} showText={true} theme={theme} />
                </a>
                <nav className="afinix-nav-links" aria-label="Secciones de la landing">
                    <a href="/#servicios">Servicios</a>
                    <a href="/#flujo">Flujo digital</a>
                    <a href="/#nosotros">Por qué AFINIX</a>
                    <a href="/#contacto">Contacto</a>
                </nav>
                <div className="afinix-nav-actions">
                    <a
                        className="afinix-header-whatsapp"
                        href={whatsappHref()}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Escribir por WhatsApp a AFINIX Dental Lab"
                    >
                        <i className={`bi ${WHATSAPP_CHANNEL.icon}`} aria-hidden="true"></i>
                        <span>WhatsApp</span>
                    </a>
                    {LOCATION_CHANNEL ? (
                        <a
                            className="afinix-header-location"
                            href={LOCATION_CHANNEL.href}
                            target={LOCATION_CHANNEL.external ? '_blank' : undefined}
                            rel={LOCATION_CHANNEL.external ? 'noopener noreferrer' : undefined}
                            aria-label={LOCATION_CHANNEL.label}
                        >
                            <i className={`bi ${LOCATION_CHANNEL.icon}`} aria-hidden="true"></i>
                        </a>
                    ) : null}
                    <nav className="afinix-header-socials" aria-label="Ubicación y redes sociales">
                        {HEADER_ICON_LINKS.map((item) => (
                            <a
                                key={item.label}
                                href={item.href}
                                className="afinix-header-icon-link"
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
                        className="afinix-mobile-menu-toggle"
                        aria-expanded={isMobileMenuOpen}
                        aria-controls="afinix-mobile-menu"
                        aria-label={isMobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
                        onClick={() => setIsMobileMenuOpen((current) => !current)}
                    >
                        <i className={`bi ${isMobileMenuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true"></i>
                    </button>
                    {themeToggle}
                    <Link className="afinix-login-link" to={CLINIC_LOGIN_PATH} aria-label="Entrar al portal">
                        <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                        <span className="afinix-login-link__label">Entrar al portal</span>
                    </Link>
                </div>
                <nav className="afinix-mobile-quicknav" aria-label="Accesos rápidos">
                    {mobileQuickLinks.map((link) => (
                        <a key={link.href} href={link.href} onClick={closeMobileMenu}>
                            {link.label}
                        </a>
                    ))}
                </nav>
                <div
                    className={`afinix-mobile-menu-panel ${isMobileMenuOpen ? 'is-open' : ''}`}
                    id="afinix-mobile-menu"
                    aria-label="Menú móvil"
                >
                    <nav className="afinix-mobile-menu-links" aria-label="Secciones principales">
                        {HEADER_MENU_LINKS.map((link) => (
                            <a key={link.href} href={link.href} onClick={closeMobileMenu}>
                                {link.label}
                            </a>
                        ))}
                    </nav>
                    <div className="afinix-mobile-menu-utility-row">
                        <div className="afinix-mobile-menu-socials" aria-label="Redes sociales y ubicación">
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
                        {themeToggle ? <div className="afinix-mobile-menu-theme">{React.cloneElement(themeToggle, { showSuggestion: false })}</div> : null}
                    </div>
                    <Link className="afinix-mobile-menu-login" to={CLINIC_LOGIN_PATH} onClick={closeMobileMenu}>
                        <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i>
                        Entrar al portal
                    </Link>
                </div>
            </motion.header>
        </>
    );
}

export function HeroCarousel({ reduceMotion }) {
    const heroRef = useRef(null);
    const isHeroInView = useInView(heroRef, { once: false, amount: 0.25, margin: '-60px 0px -60px 0px' });
    const [activeSlide, setActiveSlide] = useState(0);
    const heroStackLayout = useMatchMedia('(max-width: 640px)');

    return (
        <section className="afinix-hero" id="inicio" ref={heroRef} aria-label="Presentación: servicios digitales para clínicas">
            <div className="afinix-hero-stage">
                <Swiper
                    className={`afinix-hero-swiper${heroStackLayout ? ' afinix-hero-swiper--stack' : ''}`}
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
                    {heroSlides.map((slide, index) => {
                        const isSlideVisible = isHeroInView && activeSlide === index;

                        return (
                            <SwiperSlide key={slide.kicker}>
                                <article className="afinix-hero-slide">
                                    <div className="afinix-hero-media" aria-hidden="true">
                                        <motion.div
                                            className="afinix-hero-bg"
                                            {...heroBackgroundMotion(reduceMotion, isSlideVisible)}
                                        >
                                            <img
                                                src={slide.image}
                                                alt=""
                                                loading={index === 0 ? 'eager' : 'lazy'}
                                                decoding="async"
                                                fetchpriority={index === 0 ? 'high' : 'low'}
                                            />
                                        </motion.div>
                                        <div className="afinix-hero-overlay"></div>
                                    </div>
                                    <div className="afinix-hero-layout">
                                        <motion.div
                                            className="afinix-hero-copy"
                                            {...heroCopyMotion(reduceMotion, isSlideVisible)}
                                        >
                                            <div className="afinix-hero-copy-text">
                                                <motion.span className="afinix-kicker" {...heroLineMotion(reduceMotion, isSlideVisible, 0.32)}>
                                                    {slide.kickerIcon ? (
                                                        <i className={`bi ${slide.kickerIcon} afinix-kicker-icon`} aria-hidden="true"></i>
                                                    ) : null}
                                                    <span className="afinix-kicker-desktop">{slide.kicker}</span>
                                                    <span className="afinix-kicker-mobile">{slide.kickerMobile || slide.kicker}</span>
                                                </motion.span>
                                                {index === 0 ? (
                                                    <motion.h1 className="afinix-hero-title" {...heroLineMotion(reduceMotion, isSlideVisible, 0.46)}>
                                                        {slide.titleBefore}
                                                        <span className="afinix-hero-accent">{slide.titleHighlight}</span>
                                                        {slide.titleAfter}
                                                    </motion.h1>
                                                ) : (
                                                    <motion.h2 className="afinix-hero-title" {...heroLineMotion(reduceMotion, isSlideVisible, 0.46)}>
                                                        {slide.titleBefore}
                                                        <span className="afinix-hero-accent">{slide.titleHighlight}</span>
                                                        {slide.titleAfter}
                                                    </motion.h2>
                                                )}
                                                <motion.p className="afinix-hero-lead" {...heroLineMotion(reduceMotion, isSlideVisible, 0.64)}>
                                                    {slide.copyMobile || slide.copy}
                                                </motion.p>
                                            </div>
                                            <div className="afinix-hero-actions">
                                                <motion.div {...heroButtonMotion(reduceMotion, isSlideVisible, 0.84)}>
                                                    <a
                                                        className="afinix-hero-btn afinix-hero-btn--primary"
                                                        href={whatsappHref()}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        {slide.ctaMain}
                                                        <i className="bi bi-arrow-right" aria-hidden="true"></i>
                                                    </a>
                                                </motion.div>
                                                <motion.div {...heroButtonMotion(reduceMotion, isSlideVisible, 0.98)}>
                                                    <a className="afinix-hero-btn afinix-hero-btn--ghost" href="/#servicios">
                                                        {slide.ctaSecondary}
                                                        <i className="bi bi-arrow-right" aria-hidden="true"></i>
                                                    </a>
                                                </motion.div>
                                            </div>
                                        </motion.div>
                                        <motion.div
                                            className="afinix-hero-visual"
                                            {...heroVisualMotion(reduceMotion, isSlideVisible)}
                                        >
                                            <div className="afinix-hero-cards">
                                                {slide.floatCards.map((card, cardIndex) => (
                                                    <motion.div
                                                        key={card.label}
                                                        className="afinix-hero-float-card"
                                                        {...heroFloatCardMotion(reduceMotion, isSlideVisible, cardIndex, heroStackLayout)}
                                                    >
                                                        <span className="afinix-hero-float-icon">
                                                            <i className={`bi ${card.icon}`} aria-hidden="true"></i>
                                                        </span>
                                                        <div className="afinix-hero-float-body">
                                                            <span className="afinix-hero-float-label">{card.label}</span>
                                                            <strong>{card.value}</strong>
                                                        </div>
                                                        <i className="bi bi-chevron-right afinix-hero-float-chevron" aria-hidden="true"></i>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </div>
                                <div className="afinix-hero-footer-bar" aria-label="Acreditaciones y propuesta de valor">
                                    <div className="afinix-hero-footer-item">
                                        <i className="bi bi-people" aria-hidden="true"></i>
                                        <div>
                                            <strong>LABORATORIO DENTAL DIGITAL</strong>
                                            <span>ALIADO DE SU CLÍNICA</span>
                                        </div>
                                    </div>
                                    <div className="afinix-hero-footer-item">
                                        <i className="bi bi-shield-check" aria-hidden="true"></i>
                                        <div>
                                            <strong>CALIDAD QUE SE NOTA</strong>
                                            <span>EN CADA SONRISA</span>
                                        </div>
                                    </div>
                                    <div className="afinix-hero-footer-item">
                                        <i className="bi bi-graph-up-arrow" aria-hidden="true"></i>
                                        <div>
                                            <strong>MÁS TIEMPO PARA LO QUE IMPORTA</strong>
                                            <span>SUS PACIENTES</span>
                                        </div>
                                    </div>
                                    <div className="afinix-hero-footer-item">
                                        <i className="bi bi-cpu" aria-hidden="true"></i>
                                        <div>
                                            <strong>PRECISIÓN QUE GENERA CONFIANZA</strong>
                                            <span>CAD/CAM PARA UN MEJOR MAÑANA</span>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        </SwiperSlide>
                    );
                })}
                </Swiper>
            </div>
        </section>
    );
}
