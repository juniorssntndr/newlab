import { apiClient } from '../services/http/apiClient.js';

export const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export const isPushSupported = () => {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
};

export const getPushPermission = () => {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission;
};

export const registerServiceWorker = async () => {
    if (!isPushSupported()) return null;
    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });
        await navigator.serviceWorker.ready;
        return registration;
    } catch (err) {
        console.warn('[WebPush] Error al registrar Service Worker:', err);
        return null;
    }
};

export const subscribeToWebPush = async (token) => {
    if (!isPushSupported()) {
        throw new Error('Las notificaciones push no son compatibles con este navegador.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Permiso de notificaciones denegado por el usuario.');
    }

    const registration = await registerServiceWorker();
    if (!registration) {
        throw new Error('No se pudo inicializar el Service Worker.');
    }

    // 1. Obtener clave pública VAPID
    const { publicKey } = await apiClient('/notificaciones/push-key', {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!publicKey) {
        throw new Error('No se pudo obtener la clave VAPID del servidor.');
    }

    // 2. Suscribir a PushManager
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    let subscription = await registration.pushManager.getSubscription();

    // Si ya existía suscripción previa en el navegador, renovar con la clave actual
    if (subscription) {
        try {
            await subscription.unsubscribe();
        } catch {
            // silent
        }
    }

    subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
    });

    // 3. Enviar al backend (apiClient ya serializa body a JSON)
    await apiClient('/notificaciones/push-subscribe', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: {
            subscription: subscription.toJSON()
        }
    });

    return subscription;
};

export const unsubscribeFromWebPush = async (token) => {
    if (!isPushSupported()) return;
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                const endpoint = subscription.endpoint;
                await subscription.unsubscribe();
                await apiClient('/notificaciones/push-unsubscribe', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: { endpoint }
                });
            }
        }
    } catch (err) {
        console.warn('[WebPush] Error al desuscribir push:', err);
    }
};

export const sendTestPush = async (token) => {
    return apiClient('/notificaciones/push-test', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
};
