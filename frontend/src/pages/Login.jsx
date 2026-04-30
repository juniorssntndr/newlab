import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';

const portalHighlights = [
    'Seguimiento de pedidos en tiempo real',
    'Aprobacion de disenos 3D',
    'Historial clinico y entregas',
];

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
        <div className="login-page">
            <div className="login-shell">
                <aside className="login-story" aria-label="Beneficios del portal Affinix">
                    <Link className="login-back-link" to="/">
                        <i className="bi bi-arrow-left" aria-hidden="true"></i>
                        Volver a Affinix LAB
                    </Link>
                    <div>
                        <span className="login-kicker">Portal clinico</span>
                        <h1>Gestiona tus ordenes dentales con visibilidad de laboratorio.</h1>
                        <p>
                            Entra para revisar estados, aprobar avances digitales y coordinar entregas sin perder el hilo de cada caso.
                        </p>
                    </div>
                    <div className="login-benefits">
                        {portalHighlights.map((highlight) => (
                            <div className="login-benefit" key={highlight}>
                                <i className="bi bi-check2" aria-hidden="true"></i>
                                {highlight}
                            </div>
                        ))}
                    </div>
                    <div className="login-live-card">
                        <span>Pedido #AF-2841</span>
                        <strong>Diseno 3D listo para aprobacion</strong>
                    </div>
                </aside>

                <section className="login-card" aria-label="Inicio de sesion">
                    <div className="login-logo">
                        <div className="login-logo-icon">A</div>
                        <span className="login-logo-text">Affinix LAB</span>
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
    );
};

export default Login;
