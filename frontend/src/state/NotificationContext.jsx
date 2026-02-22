import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { API_URL } from '../config.js';

const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const { token, user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [panelOpen, setPanelOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    const knownIdsRef = useRef(new Set());
    const hasLoadedRef = useRef(false);
    const audioUnlockedRef = useRef(false);
    const lastToneAtRef = useRef(0);
    const toastTimeoutsRef = useRef([]);

    const clearToastTimeouts = () => {
        toastTimeoutsRef.current.forEach(clearTimeout);
        toastTimeoutsRef.current = [];
    };

    const dismissToast = useCallback((toastId) => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
    }, []);

    const playNotificationTone = useCallback(() => {
        if (!audioUnlockedRef.current) return;
        const now = Date.now();
        if (now - lastToneAtRef.current < 2500) return;
        lastToneAtRef.current = now;

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;

            const ctx = new AudioCtx();
            const gain = ctx.createGain();
            const oscA = ctx.createOscillator();
            const oscB = ctx.createOscillator();

            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);

            oscA.type = 'sine';
            oscA.frequency.setValueAtTime(880, ctx.currentTime);
            oscB.type = 'triangle';
            oscB.frequency.setValueAtTime(1320, ctx.currentTime + 0.03);

            oscA.connect(gain);
            oscB.connect(gain);
            gain.connect(ctx.destination);

            oscA.start();
            oscB.start(ctx.currentTime + 0.03);
            oscA.stop(ctx.currentTime + 0.2);
            oscB.stop(ctx.currentTime + 0.22);

            window.setTimeout(() => {
                ctx.close().catch(() => {});
            }, 260);
        } catch (e) {
            // silent
        }
    }, []);

    const pushToasts = useCallback((incoming) => {
        const fresh = incoming.slice(0, 3).map((item, idx) => ({
            id: `${item.id}-${Date.now()}-${idx}`,
            notificationId: item.id,
            title: item.titulo,
            message: item.mensaje,
            link: item.link,
            createdAt: item.created_at,
            read: item.leida
        }));

        if (fresh.length === 0) return;

        setToasts(prev => [...fresh, ...prev].slice(0, 3));

        fresh.forEach((toast) => {
            const timeoutId = window.setTimeout(() => {
                dismissToast(toast.id);
                toastTimeoutsRef.current = toastTimeoutsRef.current.filter(id => id !== timeoutId);
            }, 6000);
            toastTimeoutsRef.current.push(timeoutId);
        });
    }, [dismissToast]);

    const fetchNotifications = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/notificaciones`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                const items = Array.isArray(data.items) ? data.items : [];
                setNotifications(items);
                setUnreadCount(Number(data.no_leidas) || 0);

                if (hasLoadedRef.current) {
                    const newUnread = items.filter(n => !n.leida && !knownIdsRef.current.has(n.id));
                    if (newUnread.length > 0) {
                        pushToasts(newUnread);
                        playNotificationTone();
                    }
                }

                knownIdsRef.current = new Set(items.map(item => item.id));
                hasLoadedRef.current = true;
            }
        } catch (e) { /* silent */ }
    }, [token, playNotificationTone, pushToasts]);

    useEffect(() => {
        const unlockAudio = () => {
            audioUnlockedRef.current = true;
        };

        window.addEventListener('pointerdown', unlockAudio, { passive: true });
        window.addEventListener('keydown', unlockAudio);
        window.addEventListener('touchstart', unlockAudio, { passive: true });

        return () => {
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
    }, []);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            setToasts([]);
            knownIdsRef.current = new Set();
            hasLoadedRef.current = false;
            clearToastTimeouts();
            return;
        }

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 5000);
        const onFocus = () => { fetchNotifications(); };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') fetchNotifications();
        };

        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [user, fetchNotifications]);

    useEffect(() => () => {
        clearToastTimeouts();
    }, []);

    const markAsRead = async (id) => {
        try {
            await fetch(`${API_URL}/notificaciones/${id}/leer`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchNotifications();
        } catch (e) { /* silent */ }
    };

    const markAllRead = async () => {
        try {
            await fetch(`${API_URL}/notificaciones/leer-todas`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchNotifications();
        } catch (e) { /* silent */ }
    };

    return (
        <NotificationContext.Provider value={{
            notifications, unreadCount, panelOpen, setPanelOpen,
            toasts, dismissToast,
            markAsRead, markAllRead, fetchNotifications
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
