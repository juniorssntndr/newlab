import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config.js';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('nl_token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('nl_token');
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
            } else {
                localStorage.removeItem('nl_token');
                setToken(null);
                setUser(null);
            }
        } catch {
            localStorage.removeItem('nl_token');
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

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
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const getHeaders = useCallback(() => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
    }), [token]);

    const value = useMemo(
        () => ({ user, token, loading, login, logout, getHeaders, refreshUser, setUser }),
        [user, token, loading, login, logout, getHeaders, refreshUser]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
