import webpush from 'web-push';
import { getVapidConfig } from '../../config/env.js';

let vapidConfigured = false;

export const initPushService = () => {
    if (vapidConfigured) return;
    try {
        const config = getVapidConfig();
        if (config.publicKey && config.privateKey) {
            webpush.setVapidDetails(
                config.subject,
                config.publicKey,
                config.privateKey
            );
            vapidConfigured = true;
        }
    } catch (err) {
        console.error('[WebPush] Error setting VAPID details:', err.message);
    }
};

export const getPushPublicKey = () => {
    return getVapidConfig().publicKey;
};

export const saveSubscription = async ({ pool, userId, subscription, userAgent }) => {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        throw new Error('Suscripción Web Push inválida');
    }

    const { endpoint, keys } = subscription;
    const query = `
        INSERT INTO nl_push_subscriptions (usuario_id, endpoint, p256dh, auth, user_agent, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (endpoint) DO UPDATE 
        SET usuario_id = EXCLUDED.usuario_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            user_agent = EXCLUDED.user_agent,
            updated_at = NOW()
        RETURNING id;
    `;
    const result = await pool.query(query, [
        userId,
        endpoint,
        keys.p256dh,
        keys.auth,
        userAgent || null
    ]);
    return result.rows[0];
};

export const removeSubscription = async ({ pool, endpoint }) => {
    if (!endpoint) return;
    await pool.query('DELETE FROM nl_push_subscriptions WHERE endpoint = $1', [endpoint]);
};

export const sendPushNotification = async ({ pool, userId, payload }) => {
    initPushService();
    if (!vapidConfigured) return;

    try {
        const result = await pool.query(
            'SELECT id, endpoint, p256dh, auth FROM nl_push_subscriptions WHERE usuario_id = $1',
            [userId]
        );

        if (result.rows.length === 0) return;

        const stringifiedPayload = JSON.stringify({
            title: payload.title || 'AFINIX Dental Lab',
            body: payload.body || payload.message || '',
            icon: payload.icon || '/icon-192x192.png',
            badge: payload.badge || '/icon-32x32.png',
            url: payload.url || payload.link || '/',
            data: {
                url: payload.url || payload.link || '/'
            },
            ...payload
        });

        const sendPromises = result.rows.map(async (row) => {
            const pushSubscription = {
                endpoint: row.endpoint,
                keys: {
                    p256dh: row.p256dh,
                    auth: row.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, stringifiedPayload);
            } catch (err) {
                // Si la suscripción expiró o fue desuscrita (HTTP 404 o 410 Gone), la limpiamos
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await pool.query('DELETE FROM nl_push_subscriptions WHERE id = $1', [row.id]).catch(() => {});
                } else {
                    console.error('[WebPush] Error enviando push:', err.message);
                }
            }
        });

        await Promise.allSettled(sendPromises);
    } catch (err) {
        console.error('[WebPush] Error al buscar suscripciones:', err.message);
    }
};

export const sendPushNotificationToMany = async ({ pool, userIds, payload }) => {
    if (!Array.isArray(userIds) || userIds.length === 0) return;
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    await Promise.allSettled(
        uniqueIds.map((id) => sendPushNotification({ pool, userId: id, payload }))
    );
};
