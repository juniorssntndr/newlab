import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.jsx';
import { apiClient } from '../services/http/apiClient.js';

const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

const notificationsKeys = {
    all: ['notifications'],
    inbox: (userId) => [...notificationsKeys.all, 'inbox', userId]
};

const fetchNotificationsRequest = async (token) => {
    try {
        const data = await apiClient('/notificaciones', {
            headers: { Authorization: `Bearer ${token}` }
        });

        return {
            items: Array.isArray(data.items) ? data.items : [],
            unreadCount: Number(data.no_leidas) || 0
        };
    } catch {
        throw new Error('Error al obtener notificaciones');
    }
};

export const NotificationProvider = ({ children }) => {
    const { token, user } = useAuth();
    const queryClient = useQueryClient();
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

    const notificationsUserId = user?.id || 'anonymous';
    const notificationsQuery = useQuery({
        queryKey: notificationsKeys.inbox(notificationsUserId),
        queryFn: () => fetchNotificationsRequest(token),
        enabled: Boolean(token && user)
    });

    const notifications = notificationsQuery.data?.items || [];
    const unreadCount = notificationsQuery.data?.unreadCount || 0;

    const fetchNotifications = useCallback(async () => {
        if (!token || !user) return;
        await queryClient.invalidateQueries({
            queryKey: notificationsKeys.inbox(notificationsUserId),
            exact: true,
            refetchType: 'active'
        });
    }, [notificationsUserId, queryClient, token, user]);

    const markAsReadMutation = useMutation({
        mutationFn: async (id) => {
            try {
                await apiClient(`/notificaciones/${id}/leer`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch {
                throw new Error('Error al marcar notificación');
            }
        },
        onSuccess: async () => {
            await fetchNotifications();
        }
    });

    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            try {
                await apiClient('/notificaciones/leer-todas', {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch {
                throw new Error('Error al marcar todas las notificaciones');
            }
        },
        onSuccess: async () => {
            await fetchNotifications();
        }
    });

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
            setToasts([]);
            knownIdsRef.current = new Set();
            hasLoadedRef.current = false;
            clearToastTimeouts();
            queryClient.removeQueries({ queryKey: notificationsKeys.all });
            return;
        }

        fetchNotifications();
    }, [fetchNotifications, queryClient, user]);

    useEffect(() => {
        if (!user) return;

        if (hasLoadedRef.current) {
            const newUnread = notifications.filter((item) => !item.leida && !knownIdsRef.current.has(item.id));
            if (newUnread.length > 0) {
                pushToasts(newUnread);
                playNotificationTone();
            }
        }

        knownIdsRef.current = new Set(notifications.map((item) => item.id));
        hasLoadedRef.current = true;
    }, [notifications, playNotificationTone, pushToasts, user]);

    useEffect(() => () => {
        clearToastTimeouts();
    }, []);

    const markAsRead = async (id) => {
        try {
            await markAsReadMutation.mutateAsync(id);
        } catch (e) {
            // silent
        }
    };

    const markAllRead = async () => {
        try {
            await markAllReadMutation.mutateAsync();
        } catch (e) {
            // silent
        }
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
