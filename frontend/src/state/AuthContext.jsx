import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config.js';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem('nl_token'));
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('nl_user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    // Solo bloqueamos con loading si tenemos token pero aún no tenemos datos de usuario en caché.
    const [loading, setLoading] = useState(() => {
        const hasToken = Boolean(localStorage.getItem('nl_token'));
        const hasUser = Boolean(localStorage.getItem('nl_user'));
        return hasToken && !hasUser;
    });

    // Sincronizar siempre nl_user en localStorage cuando cambie el estado de usuario
    useEffect(() => {
        if (user) {
            try {
                localStorage.setItem('nl_user', JSON.stringify(user));
            } catch {
                // Silenciosamente ignorar cuotas estrictas de almacenamiento local
            }
        } else {
            localStorage.removeItem('nl_user');
        }
    }, [user]);

    const logout = useCallback(() => {
        localStorage.removeItem('nl_token');
        localStorage.removeItem('nl_user');
        setToken(null);
        setUser(null);
    }, []);

    const fetchUser = useCallback(async () => {
        const currentToken = localStorage.getItem('nl_token');
        if (!currentToken) {
            setLoading(false);
            return;
        }
        try {
            const res = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${currentToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Merge para no borrar campos de sesión si /me viniera parcial.
                setUser((prev) => ({ ...(prev || {}), ...data }));
            } else if (res.status === 401 || res.status === 403) {
                // Únicamente si el backend rechaza explícitamente el token (expirado o revocado)
                logout();
            }
            // En caso de errores 500/502/503 del servidor, mantenemos la sesión para no desloguear al usuario
        } catch (err) {
            // Error de red temporal (conexión intermitente o servidor iniciando):
            // NO destruimos el token del usuario en localStorage
            console.warn('[Auth] No se pudo verificar la sesión con el servidor:', err);
        } finally {
            setLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, [token, fetchUser]);

    const refreshUser = useCallback(async () => {
        if (!token) return;
        await fetchUser();
    }, [token, fetchUser]);

    const login = useCallback(async (email, password) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (res.status === 429) {
            throw new Error('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
        }

        const contentType = res.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
            ? await res.json()
            : { error: await res.text() };

        if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');

        localStorage.setItem('nl_token', data.token);
        if (data.user) {
            localStorage.setItem('nl_user', JSON.stringify(data.user));
        }
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const setSession = useCallback((newToken, newUser) => {
        localStorage.setItem('nl_token', newToken);
        if (newUser) {
            localStorage.setItem('nl_user', JSON.stringify(newUser));
        } else {
            localStorage.removeItem('nl_user');
        }
        setToken(newToken);
        setUser(newUser);
    }, []);

    const getHeaders = useCallback(() => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
    }), [token]);

    const value = useMemo(
        () => ({ user, token, loading, login, logout, getHeaders, refreshUser, setUser, setSession }),
        [user, token, loading, login, logout, getHeaders, refreshUser, setSession]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
