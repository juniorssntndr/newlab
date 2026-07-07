import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import AfinixLogo from '../components/AfinixLogo.jsx';
import SeoHead from '../components/seo/SeoHead.jsx';
import LoginWorkflowCarousel from '../components/login/LoginWorkflowCarousel.jsx';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const showDemoCredentials = import.meta.env.DEV;

    const perfilHint = useMemo(() => {
        const p = (searchParams.get('perfil') || '').toLowerCase();
        if (p === 'clinicas' || p === 'cliente') {
            return 'Acceso para clinicas y doctores: seguimiento de pedidos, disenos 3D y catalogo.';
        }
        if (p === 'laboratorio' || p === 'lab' || p === 'admin') {
            return 'Acceso para el equipo del laboratorio: panel operativo y administracion.';
        }
        return null;
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(email, password);
            navigate(user.tipo === 'cliente' ? '/pedidos' : '/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fillDemo = (demoEmail, demoPass) => {
        setEmail(demoEmail);
        setPassword(demoPass);
        setError('');
    };

    return (
        <>
            <SeoHead
                title="Portal clínico y laboratorio"
                description="Acceso al portal AFINIX Dental Lab: seguimiento de pedidos, aprobación de diseños 3D y catálogo. Página de inicio de sesión."
                path="/login"
                noindex
            />
            <div className="login-page">
            <div className="login-shell">
                <aside className="login-story" aria-label="Beneficios del portal AFINIX Dental Lab">
                    <Link className="login-back-link" to="/">
                        <i className="bi bi-arrow-left" aria-hidden="true"></i>
                        Volver a AFINIX Dental Lab
                    </Link>
                    <div className="login-story-intro">
                        <span className="login-kicker">Flujo digital</span>
                        <h1>Así avanza tu caso en AFINIX</h1>
                        <p>
                            Desde que envías el caso hasta la entrega: revisa cada etapa y entra al portal para
                            seguimiento, aprobación 3D y trazabilidad clínica.
                        </p>
                    </div>
                    <LoginWorkflowCarousel />
                </aside>

                <section className="login-card" aria-label="Inicio de sesión">
                    <div className="login-logo">
                        <AfinixLogo size={68} showText={true} theme="dark" isLogin={true} />
                    </div>
                    <h2 className="login-title">Acceso al sistema</h2>
                    <p className="login-subtitle">
                        {perfilHint || 'Ingresa a tu plataforma dental digital'}
                    </p>

                    {error && (
                        <div className="login-error" role="alert">
                            <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="login-email">Correo electronico</label>
                            <input
                                id="login-email"
                                type="email"
                                className="form-input"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="login-password">Contrasena</label>
                            <input
                                id="login-password"
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                        </div>
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'Ingresando...' : 'Iniciar sesion'}
                        </button>
                    </form>

                    {showDemoCredentials && (
                        <div className="login-demo">
                            <p className="login-demo-title">Credenciales de demostracion</p>
                            <div className="demo-credentials">
                                <button type="button" className="demo-cred" onClick={() => fillDemo('admin@newlab.pe', 'admin123')}>
                                    <span className="demo-cred-role">Admin</span>
                                    <span className="demo-cred-email">admin@newlab.pe</span>
                                </button>
                                <button type="button" className="demo-cred" onClick={() => fillDemo('tecnico@newlab.pe', 'tecnico123')}>
                                    <span className="demo-cred-role">Tecnico</span>
                                    <span className="demo-cred-email">tecnico@newlab.pe</span>
                                </button>
                                <button type="button" className="demo-cred" onClick={() => fillDemo('roberto@sonrisas.pe', 'cliente123')}>
                                    <span className="demo-cred-role">Cliente</span>
                                    <span className="demo-cred-email">roberto@sonrisas.pe</span>
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
        </>
    );
};

export default Login;
