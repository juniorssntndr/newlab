import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AfinixLogo from '../components/AfinixLogo.jsx';
import LandingThemeToggle from '../components/afinix/LandingThemeToggle.jsx';
import SeoHead from '../components/seo/SeoHead.jsx';
import { API_URL } from '../config.js';
import { useLandingTheme } from './hooks/useLandingTheme.js';
import '../styles/login-theme.css';

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

export const RegistroCliente = () => {
    const {
        theme,
        toggle,
        showSuggestion,
        acceptDarkSuggestion,
        dismissSuggestion
    } = useLandingTheme();

    const [form, setForm] = useState({
        nombre: '',
        email: '',
        password: '',
        telefono: '',
        clinica_nombre: '',
        tipo_documento: 'RUC',
        numero_documento: '',
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = {
                nombre: form.nombre.trim(),
                email: form.email.trim(),
                password: form.password,
                telefono: form.telefono.trim(),
                clinica_nombre: form.clinica_nombre.trim(),
                ruc: form.tipo_documento === 'RUC' ? form.numero_documento.trim() : null,
                dni: form.tipo_documento === 'DNI' ? form.numero_documento.trim() : null,
                distrito: form.distrito,
                direccion: form.direccion.trim()
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
                        showSuggestion={showSuggestion}
                        onAcceptSuggestion={acceptDarkSuggestion}
                        onDismissSuggestion={dismissSuggestion}
                    />
                </div>

                <div className="login-shell" style={{ maxWidth: '960px' }}>
                    {submitted ? (
                        <div
                            className="card animate-fade-in"
                            style={{
                                width: '100%',
                                maxWidth: '580px',
                                margin: '0 auto',
                                padding: '2.5rem 2rem',
                                textAlign: 'center',
                                background: 'var(--color-surface, #ffffff)',
                                borderRadius: '1rem',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
                            }}
                        >
                            <div
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    color: '#10b981',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '2rem',
                                    marginBottom: '1.25rem'
                                }}
                            >
                                <i className="bi bi-check-circle-fill"></i>
                            </div>

                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary, #0f172a)', marginBottom: '0.75rem' }}>
                                ¡Solicitud de Registro Recibida!
                            </h2>

                            <p style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
                                Estimado/a <strong>{form.nombre}</strong>, registramos la información de <strong>{form.clinica_nombre}</strong>.
                                Por seguridad y control de calidad, nuestro equipo técnico en Arequipa revisará los datos para habilitar tu acceso al portal.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '380px', margin: '0 auto' }}>
                                <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        background: '#16a34a',
                                        borderColor: '#16a34a',
                                        padding: '0.75rem 1rem',
                                        fontWeight: 600,
                                        textDecoration: 'none'
                                    }}
                                >
                                    <i className="bi bi-whatsapp"></i> Acelerar Activación vía WhatsApp
                                </a>

                                <Link
                                    to="/login"
                                    className="btn btn-secondary"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '0.75rem 1rem'
                                    }}
                                >
                                    <i className="bi bi-box-arrow-in-right"></i> Volver a Iniciar Sesión
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="card animate-fade-in"
                            style={{
                                width: '100%',
                                padding: '2rem',
                                background: 'var(--color-surface, #ffffff)',
                                borderRadius: '1rem',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <AfinixLogo variant="iso" height={36} />
                                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.5rem 0 0.2rem 0', color: 'var(--color-text-primary, #0f172a)' }}>
                                        Registro de Consultorio Dental
                                    </h1>
                                    <p style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.875rem', margin: 0 }}>
                                        Acceso al portal clínico de AFINIX Dental Lab en Arequipa
                                    </p>
                                </div>
                                <Link
                                    to="/login"
                                    className="btn btn-ghost btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <i className="bi bi-arrow-left"></i> Ya tengo cuenta
                                </Link>
                            </div>

                            {error && (
                                <div
                                    className="login-error"
                                    role="alert"
                                    style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#fee2e2', color: '#991b1b', fontSize: '0.875rem' }}
                                >
                                    <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '6px' }}></i>
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Sección 1: Datos del Profesional */}
                                <div>
                                    <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary, #0284c7)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        1. Odontólogo Titular
                                    </h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                                Nombres y Apellidos del Doctor/a *
                                            </label>
                                            <input
                                                type="text"
                                                name="nombre"
                                                className="form-input"
                                                placeholder="Ej. Dr. Carlos Mendoza Ramos"
                                                value={form.nombre}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                                Teléfono / WhatsApp de Contacto *
                                            </label>
                                            <input
                                                type="tel"
                                                name="telefono"
                                                className="form-input"
                                                placeholder="Ej. 954 123 456"
                                                value={form.telefono}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                                Correo Electrónico (Usuario de Acceso) *
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                className="form-input"
                                                placeholder="contacto@tudominio.pe"
                                                value={form.email}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                                Contraseña Segura *
                                            </label>
                                            <input
                                                type="password"
                                                name="password"
                                                className="form-input"
                                                placeholder="Mínimo 6 caracteres"
                                                value={form.password}
                                                onChange={handleChange}
                                                required
                                                minLength={6}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border, #e2e8f0)', margin: '0.25rem 0' }} />

                                {/* Sección 2: Datos del Consultorio o Clínica */}
                                <div>
                                    <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary, #0284c7)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        2. Consultorio o Clínica Dental
                                    </h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                                Nombre Comercial / Razón Social del Consultorio *
                                            </label>
                                            <input
                                                type="text"
                                                name="clinica_nombre"
                                                className="form-input"
                                                placeholder="Ej. Clínica Dental Sonrisas Arequipa"
                                                value={form.clinica_nombre}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                                Tipo de Documento Fiscal
                                            </label>
                                            <select
                                                name="tipo_documento"
                                                className="form-input"
                                                value={form.tipo_documento}
                                                onChange={handleChange}
                                            >
                                                <option value="RUC">RUC (Empresa o Persona con Negocio)</option>
                                                <option value="DNI">DNI (Persona Natural)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                                Número de {form.tipo_documento}
                                            </label>
                                            <input
                                                type="text"
                                                name="numero_documento"
                                                className="form-input"
                                                placeholder={form.tipo_documento === 'RUC' ? 'Ej. 20601234567' : 'Ej. 45678901'}
                                                value={form.numero_documento}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                                Distrito en Arequipa
                                            </label>
                                            <select
                                                name="distrito"
                                                className="form-input"
                                                value={form.distrito}
                                                onChange={handleChange}
                                            >
                                                {AREQUIPA_DISTRITOS.map((d) => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                                Dirección del Consultorio
                                            </label>
                                            <input
                                                type="text"
                                                name="direccion"
                                                className="form-input"
                                                placeholder="Ej. Av. Cayma 402, Of. 301"
                                                value={form.direccion}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={loading}
                                        style={{ padding: '0.85rem 1.5rem', fontWeight: 700, fontSize: '0.95rem' }}
                                    >
                                        {loading ? 'Enviando solicitud...' : 'Enviar Solicitud de Registro'}
                                    </button>

                                    <p style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', margin: 0 }}>
                                        Al registrarte, tus datos serán procesados exclusivamente para fines técnicos y comerciales con AFINIX DENTAL LAB S.A.C.
                                    </p>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default RegistroCliente;
