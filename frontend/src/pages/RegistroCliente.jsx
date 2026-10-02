import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AfinixLogo from '../components/AfinixLogo.jsx';
import LandingThemeToggle from '../components/afinix/LandingThemeToggle.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import SeoHead from '../components/seo/SeoHead.jsx';
import LoginWorkflowCarousel from '../components/login/LoginWorkflowCarousel.jsx';
import { API_URL } from '../config.js';
import { useLandingTheme } from './hooks/useLandingTheme.js';
import '../styles/login-theme.css';

const LOGIN_STORY_PROOFS = [
    { icon: 'bi-broadcast-pin', value: '24/7', label: 'Estado del caso disponible' },
    { icon: 'bi-bezier2', value: '3D', label: 'Aprobación antes de fabricar' },
    { icon: 'bi-archive', value: 'Historial', label: 'Archivos y entregas trazables' },
];

const AREQUIPA_DISTRITOS = [
    'Arequipa (Cercado)',
    'Yanahuara',
    'Cayma',
    'Cerro Colorado',
    'José Luis Bustamante y Rivero',
    'Mariano Melgar',
    'Paucarpata',
    'Miraflores',
    'Sachaca',
    'Alto Selva Alegre',
    'Socabaya',
    'Tiabaya',
    'Jacobo Hunter',
    'Characato',
    'Otro distrito'
];

const DISTRITO_OPTIONS = AREQUIPA_DISTRITOS.map((d) => ({
    value: d,
    label: d
}));

export const RegistroCliente = () => {
    const { theme, toggle } = useLandingTheme();

    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        nombre: '',
        email: '',
        password: '',
        telefono: '',
        clinica_nombre: '',
        distrito: 'Arequipa (Cercado)',
        direccion: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const validateStep1 = () => {
        if (!form.nombre.trim() || form.nombre.trim().length < 2) {
            setError('Por favor, ingresa los nombres y apellidos del doctor/a.');
            return false;
        }
        if (!form.telefono.trim() || form.telefono.trim().length < 6) {
            setError('Por favor, ingresa un número de teléfono o WhatsApp válido.');
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(form.email.trim())) {
            setError('Por favor, ingresa un correo electrónico válido.');
            return false;
        }
        if (!form.password || form.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return false;
        }
        setError('');
        return true;
    };

    const handleNextStep = (e) => {
        e?.preventDefault();
        if (validateStep1()) {
            setStep(2);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateStep1()) {
            setStep(1);
            return;
        }
        if (!form.clinica_nombre.trim() || form.clinica_nombre.trim().length < 2) {
            setError('Por favor, ingresa el nombre comercial o razón social de la clínica.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const payload = {
                nombre: form.nombre.trim(),
                email: form.email.trim(),
                password: form.password,
                telefono: form.telefono.trim(),
                clinica_nombre: form.clinica_nombre.trim(),
                ruc: null,
                dni: null,
                distrito: form.distrito || null,
                direccion: form.direccion.trim() || null
            };

            const res = await fetch(`${API_URL}/auth/register-client`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Ocurrió un error al registrar la cuenta');
            }

            setSubmitted(true);
        } catch (err) {
            setError(err.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const whatsappMessage = encodeURIComponent(
        `Hola AFINIX Dental Lab, acabo de registrar mi consultorio "${form.clinica_nombre}" con el Dr./Dra. ${form.nombre} (${form.telefono}). Solicito la activación de mi cuenta en el portal.`
    );
    const whatsappUrl = `https://wa.me/51958310052?text=${whatsappMessage}`;

    return (
        <>
            <SeoHead
                title="Registro de Consultorio | AFINIX Dental Lab"
                description="Crea tu cuenta de consultorio dental para gestionar pedidos, aprobar diseños 3D y consultar el catálogo de AFINIX Dental Lab en Arequipa."
                path="/registro"
                noindex
            />
            <div className="login-page" data-theme={theme}>
                <div className="login-page-topbar">
                    <LandingThemeToggle
                        theme={theme}
                        onToggle={toggle}
                    />
                </div>

                <div className="login-shell">
                    {/* Panel izquierdo idéntico a Login: Story + Carrusel interactivo */}
                    <aside className="login-story" aria-label="Beneficios del portal clínico AFINIX">
                        <div className="login-story-header">
                            <Link className="login-back-link" to="/">
                                <i className="bi bi-arrow-left" aria-hidden="true"></i>
                                Volver a AFINIX Dental Lab
                            </Link>
                            <div className="login-story-marketing">
                                <span className="login-kicker">Portal clínico AFINIX</span>
                                <h1>Control clínico sin mensajes dispersos</h1>
                                <p className="login-story-lead">
                                    Sigue pedidos, revisa diseños 3D y conserva cada entrega documentada en una sola plataforma.
                                </p>
                                <div className="login-proof-grid" aria-label="Beneficios principales del portal">
                                    {LOGIN_STORY_PROOFS.map((proof) => (
                                        <div className="login-proof-tile" key={proof.label}>
                                            <i className={`bi ${proof.icon}`} aria-hidden="true"></i>
                                            <span className="login-proof-value">{proof.value}</span>
                                            <span className="login-proof-label">{proof.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <LoginWorkflowCarousel />
                    </aside>

                    {/* Formulario en tarjeta oficial del sistema */}
                    <section className="login-card registro-card" aria-label="Formulario de registro">
                        <div className="login-logo">
                            <AfinixLogo size={68} showText={true} theme={theme} isLogin={true} />
                        </div>
                        <h2 className="login-title">Registro de Consultorio</h2>
                        <p className="login-subtitle">
                            {submitted
                                ? 'Solicitud enviada con éxito'
                                : `Paso ${step} de 2: ${step === 1 ? 'Datos de tu cuenta' : 'Datos del consultorio'}`}
                        </p>

                        {submitted ? (
                            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '1rem 0' }}>
                                <div
                                    style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '50%',
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        color: '#10b981',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '2rem',
                                        marginBottom: '1rem'
                                    }}
                                >
                                    <i className="bi bi-check-circle-fill"></i>
                                </div>

                                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--login-heading)', marginBottom: '0.5rem' }}>
                                    ¡Solicitud Recibida!
                                </h3>

                                <p style={{ color: 'var(--login-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                                    Estimado/a <strong>{form.nombre}</strong>, registramos la información de <strong>{form.clinica_nombre}</strong>.
                                    Nuestro equipo en Arequipa revisará los datos para habilitar tu acceso al portal clínico.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <a
                                        href={whatsappUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="login-btn"
                                        style={{
                                            background: '#16a34a',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            textDecoration: 'none'
                                        }}
                                    >
                                        <i className="bi bi-whatsapp"></i> Acelerar Activación vía WhatsApp
                                    </a>

                                    <Link
                                        to="/login"
                                        className="login-card-help"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <i className="bi bi-box-arrow-in-right"></i> Volver a Iniciar Sesión
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="registro-stepper" aria-label="Progreso del registro">
                                    <button
                                        type="button"
                                        className={`registro-step-pill ${step === 1 ? 'is-active' : 'is-completed'}`}
                                        onClick={() => setStep(1)}
                                    >
                                        <span className="step-num">1</span>
                                        <span className="step-text">Acceso</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`registro-step-pill ${step === 2 ? 'is-active' : ''}`}
                                        onClick={() => validateStep1() && setStep(2)}
                                    >
                                        <span className="step-num">2</span>
                                        <span className="step-text">Consultorio</span>
                                    </button>
                                </div>

                                {error && (
                                    <div className="login-error" role="alert" style={{ marginBottom: '1rem' }}>
                                        <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit}>
                                    {step === 1 && (
                                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" htmlFor="reg-nombre">
                                                    Nombres y apellidos del doctor/a *
                                                </label>
                                                <input
                                                    id="reg-nombre"
                                                    type="text"
                                                    name="nombre"
                                                    className="form-input"
                                                    placeholder="Ej. Dr. Carlos Mendoza Ramos"
                                                    value={form.nombre}
                                                    onChange={handleChange}
                                                    autoComplete="name"
                                                    required
                                                />
                                            </div>

                                            <div className="registro-form-row">
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" htmlFor="reg-telefono">
                                                        Teléfono / WhatsApp *
                                                    </label>
                                                    <input
                                                        id="reg-telefono"
                                                        type="tel"
                                                        name="telefono"
                                                        className="form-input"
                                                        placeholder="Ej. 954 123 456"
                                                        value={form.telefono}
                                                        onChange={handleChange}
                                                        autoComplete="tel"
                                                        required
                                                    />
                                                </div>

                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" htmlFor="reg-email">
                                                        Correo electrónico *
                                                    </label>
                                                    <input
                                                        id="reg-email"
                                                        type="email"
                                                        name="email"
                                                        className="form-input"
                                                        placeholder="doctor@consultorio.pe"
                                                        value={form.email}
                                                        onChange={handleChange}
                                                        autoComplete="email"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" htmlFor="reg-password">
                                                    Contraseña segura *
                                                </label>
                                                <input
                                                    id="reg-password"
                                                    type="password"
                                                    name="password"
                                                    className="form-input"
                                                    placeholder="Mínimo 6 caracteres"
                                                    value={form.password}
                                                    onChange={handleChange}
                                                    autoComplete="new-password"
                                                    required
                                                    minLength={6}
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                className="login-btn"
                                                onClick={handleNextStep}
                                                style={{ marginTop: '0.5rem' }}
                                            >
                                                Continuar →
                                            </button>

                                            <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--login-muted)' }}>¿Ya tienes cuenta en el portal? </span>
                                                <Link to="/login" style={{ color: 'var(--login-accent)', fontWeight: 700, textDecoration: 'none' }}>
                                                    Inicia sesión aquí
                                                </Link>
                                            </div>
                                        </div>
                                    )}

                                    {step === 2 && (
                                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" htmlFor="reg-clinica">
                                                    Nombre comercial o razón social del consultorio *
                                                </label>
                                                <input
                                                    id="reg-clinica"
                                                    type="text"
                                                    name="clinica_nombre"
                                                    className="form-input"
                                                    placeholder="Ej. Clínica Dental Sonrisas Arequipa"
                                                    value={form.clinica_nombre}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>

                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" htmlFor="distrito">
                                                    Distrito en Arequipa
                                                </label>
                                                <CustomSelect
                                                    id="distrito"
                                                    value={form.distrito}
                                                    onChange={(_, val) => setForm((prev) => ({ ...prev, distrito: val }))}
                                                    options={DISTRITO_OPTIONS}
                                                    searchable={true}
                                                    placeholder="Selecciona distrito"
                                                />
                                            </div>

                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" htmlFor="reg-direccion">
                                                    Dirección del consultorio (Opcional)
                                                </label>
                                                <input
                                                    id="reg-direccion"
                                                    type="text"
                                                    name="direccion"
                                                    className="form-input"
                                                    placeholder="Ej. Av. Cayma 402, Of. 301"
                                                    value={form.direccion}
                                                    onChange={handleChange}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                                <button
                                                    type="button"
                                                    className="login-card-help"
                                                    onClick={() => setStep(1)}
                                                    style={{ width: 'auto', minWidth: '85px', padding: '0.7rem 0.85rem' }}
                                                >
                                                    ← Volver
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="login-btn"
                                                    disabled={loading}
                                                    style={{ flex: 1 }}
                                                >
                                                    {loading ? 'Enviando...' : 'Finalizar Registro'}
                                                </button>
                                            </div>

                                            <p style={{ fontSize: '0.74rem', color: 'var(--login-muted)', textAlign: 'center', margin: '0.35rem 0 0', lineHeight: 1.4 }}>
                                                Al registrarte, tus datos serán procesados exclusivamente para fines técnicos y comerciales con AFINIX DENTAL LAB S.A.C.
                                            </p>
                                        </div>
                                    )}
                                </form>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
};

export default RegistroCliente;
