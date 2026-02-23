import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const showDemoCredentials = import.meta.env.DEV;

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
            <div className="login-card">
                <div className="login-logo">
                    <div className="login-logo-icon">N</div>
                    <span className="login-logo-text">NewLab</span>
                </div>
                <h2 className="login-title">Bienvenido</h2>
                <p className="login-subtitle">Ingresa a tu plataforma dental digital</p>

                {error && (
                    <div className="login-error">
                        <i className="bi bi-exclamation-circle"></i>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Correo electrónico</label>
                        <input type="email" className="form-input" placeholder="tu@email.com"
                            value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Contraseña</label>
                        <input type="password" className="form-input" placeholder="••••••••"
                            value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                    </button>
                </form>

                {showDemoCredentials && (
                    <div className="login-demo">
                        <p className="login-demo-title">Credenciales de demostración</p>
                        <div className="demo-credentials">
                            <div className="demo-cred" onClick={() => fillDemo('admin@newlab.pe', 'admin123')}>
                                <span className="demo-cred-role">👑 Admin</span>
                                <span className="demo-cred-email">admin@newlab.pe</span>
                            </div>
                            <div className="demo-cred" onClick={() => fillDemo('tecnico@newlab.pe', 'tecnico123')}>
                                <span className="demo-cred-role">🔧 Técnico</span>
                                <span className="demo-cred-email">tecnico@newlab.pe</span>
                            </div>
                            <div className="demo-cred" onClick={() => fillDemo('roberto@sonrisas.pe', 'cliente123')}>
                                <span className="demo-cred-role">🦷 Cliente</span>
                                <span className="demo-cred-email">roberto@sonrisas.pe</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;
