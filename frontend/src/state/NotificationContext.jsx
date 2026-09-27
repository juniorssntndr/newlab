import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.jsx';
import { apiClient } from '../services/http/apiClient.js';
import {
    isPushSupported,
    getPushPermission,
    subscribeToWebPush,
    unsubscribeFromWebPush,
    sendTestPush,
    registerServiceWorker
} from '../utils/webPush.js';

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
    const [pushPermission, setPushPermission] = useState(getPushPermission());
    const [isPushSubscribed, setIsPushSubscribed] = useState(false);
    const [isPushLoading, setIsPushLoading] = useState(false);
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

    useEffect(() => {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('nl_notif_sound');
        }
    }, []);

    const playSyntheticTone = useCallback(() => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const now = ctx.currentTime;

            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.0001, now);
            masterGain.gain.exponentialRampToValueAtTime(0.85, now + 0.008);
            masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
            masterGain.connect(ctx.destination);

            const oscMain = ctx.createOscillator();
            oscMain.type = 'sine';
            oscMain.frequency.setValueAtTime(1150, now);
            oscMain.frequency.exponentialRampToValueAtTime(2350, now + 0.035);
            oscMain.frequency.exponentialRampToValueAtTime(2150, now + 0.35);
            oscMain.connect(masterGain);
            oscMain.start(now);
            oscMain.stop(now + 0.38);

            window.setTimeout(() => {
                ctx.close().catch(() => {});
            }, 450);
        } catch {
            // silent
        }
    }, []);

    const playNotificationTone = useCallback(() => {
        const now = Date.now();
        if (now - lastToneAtRef.current < 600) return;
        lastToneAtRef.current = now;

        const soundUrl = '/sounds/afinix-notification.mp3?v=3';

        try {
            const audio = new Audio(soundUrl);
            audio.volume = 1.0;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch((err) => {
                    console.warn('[NotificationSound] MP3 play fallback to WAV:', err);
                    try {
                        const audioWav = new Audio('/sounds/afinix-notification.wav?v=3');
                        audioWav.volume = 1.0;
                        audioWav.play().catch(() => playSyntheticTone());
                    } catch {
                        playSyntheticTone();
                    }
                });
            }
        } catch {
            playSyntheticTone();
        }
    }, [playSyntheticTone]);

    const changeSound = useCallback(() => {
        playNotificationTone();
    }, [playNotificationTone]);

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
        enabled: Boolean(token && user),
        refetchInterval: 10 * 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true
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
            setToasts((prev) => prev.filter((t) => t.notificationId !== id));
            // Optimistic update
            queryClient.setQueryData(notificationsKeys.inbox(notificationsUserId), (old) => {
                if (!old) return old;
                return {
                    ...old,
                    unreadCount: Math.max(0, (old.unreadCount || 1) - 1),
                    items: (old.items || []).map((item) => (item.id === id ? { ...item, leida: true } : item))
                };
            });

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
            setToasts([]);
            // Optimistic update
            queryClient.setQueryData(notificationsKeys.inbox(notificationsUserId), (old) => {
                if (!old) return old;
                return {
                    ...old,
                    unreadCount: 0,
                    items: (old.items || []).map((item) => ({ ...item, leida: true }))
                };
            });

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
        if (!user || !notificationsQuery.isSuccess) return;

        if (hasLoadedRef.current) {
            const newUnread = notifications.filter((item) => !item.leida && !knownIdsRef.current.has(item.id));
            if (newUnread.length > 0) {
                pushToasts(newUnread);
                playNotificationTone();
            }
        } else {
            hasLoadedRef.current = true;
        }

        knownIdsRef.current = new Set(notifications.map((item) => item.id));
    }, [notifications, notificationsQuery.isSuccess, playNotificationTone, pushToasts, user]);

    // Comprobar si ya tiene suscripción activa en el navegador
    useEffect(() => {
        if (!user || !isPushSupported()) return;

        registerServiceWorker().then((reg) => {
            if (!reg) return;
            reg.pushManager.getSubscription().then((sub) => {
                setIsPushSubscribed(Boolean(sub));
                setPushPermission(Notification.permission);
            }).catch(() => {});
        }).catch(() => {});
    }, [user]);

    const enablePushNotifications = useCallback(async () => {
        if (!token) return { ok: false, error: 'No autenticado' };
        setIsPushLoading(true);
        try {
            await subscribeToWebPush(token);
            setIsPushSubscribed(true);
            setPushPermission('granted');
            setIsPushLoading(false);

            // Chime de audio y toast de confirmación
            playNotificationTone();
            pushToasts([{
                id: `push-ok-${Date.now()}`,
                titulo: '🔔 AFINIX Dental Lab',
                mensaje: '¡Alertas activadas con éxito en este equipo!',
                link: '/cuenta',
                created_at: new Date().toISOString(),
                leida: false
            }]);

            return { ok: true };
        } catch (err) {
            setIsPushLoading(false);
            setPushPermission(getPushPermission());
            console.error('[WebPush] Error al activar:', err);
            alert(`No se pudo activar: ${err.message}`);
            return { ok: false, error: err.message };
        }
    }, [playNotificationTone, pushToasts, token]);

    const disablePushNotifications = useCallback(async () => {
        if (!token) return;
        setIsPushLoading(true);
        try {
            await unsubscribeFromWebPush(token);
            setIsPushSubscribed(false);
            setIsPushLoading(false);
        } catch (err) {
            setIsPushLoading(false);
        }
    }, [token]);

    const testPush = useCallback(async () => {
        if (!token) return;

        // 1. Sonido inmediato de alerta
        playNotificationTone();

        // 2. Toast emergente en pantalla
        pushToasts([{
            id: `test-${Date.now()}`,
            titulo: '🔔 AFINIX Dental Lab',
            mensaje: '¡Prueba de notificación emitida con éxito!',
            link: '/cuenta',
            created_at: new Date().toISOString(),
            leida: false
        }]);

        // 3. Notificación nativa del navegador / OS directa
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification('🔔 AFINIX Dental Lab', {
                    body: '¡Notificaciones push activadas con éxito en este dispositivo!',
                    icon: '/icon-192x192.png',
                    badge: '/icon-32x32.png',
                    tag: 'afinix-test'
                });
            } catch {
                // En móviles se gestiona vía Service Worker
            }
        }

        // 4. Despacho al backend vía Web Push
        try {
            await sendTestPush(token);
        } catch (err) {
            console.error('[WebPush] Error al enviar test push al servidor:', err);
        }
    }, [playNotificationTone, pushToasts, token]);

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
            markAsRead, markAllRead, fetchNotifications,
            pushSupported: isPushSupported(),
            pushPermission,
            isPushSubscribed,
            isPushLoading,
            enablePushNotifications,
            disablePushNotifications,
            testPush,
            selectedSound: 'afinix',
            changeSound,
            playNotificationTone
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
