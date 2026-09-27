import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    getPushPublicKey,
    saveSubscription,
    removeSubscription,
    sendPushNotification
} from '../modules/notifications/pushNotificationService.js';

const router = Router();
router.use(authenticateToken);

// GET /api/notificaciones
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { no_leidas } = req.query;
        let query = 'SELECT * FROM nl_notificaciones WHERE usuario_id = $1';
        const params = [req.user.id];

        if (no_leidas === 'true') query += ' AND leida = false';
        query += ' ORDER BY created_at DESC LIMIT 50';

        const result = await pool.query(query, params);

        // Count unread
        const unread = await pool.query(
            'SELECT COUNT(*) FROM nl_notificaciones WHERE usuario_id = $1 AND leida = false',
            [req.user.id]
        );

        res.json({ items: result.rows, no_leidas: parseInt(unread.rows[0].count) });
    } catch (err) { next(err); }
});

// PATCH /api/notificaciones/:id/leer
router.patch('/:id/leer', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        await pool.query('UPDATE nl_notificaciones SET leida = true WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
        res.json({ message: 'Marcada como leída' });
    } catch (err) { next(err); }
});

// PATCH /api/notificaciones/leer-todas
router.patch('/leer-todas', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        await pool.query('UPDATE nl_notificaciones SET leida = true WHERE usuario_id = $1', [req.user.id]);
        res.json({ message: 'Todas las notificaciones marcadas como leídas' });
    } catch (err) { next(err); }
});

// GET /api/notificaciones/push-key (Obtener VAPID Public Key)
router.get('/push-key', (req, res) => {
    res.json({ publicKey: getPushPublicKey() });
});

// POST /api/notificaciones/push-subscribe
router.post('/push-subscribe', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { subscription } = req.body || {};
        const userAgent = req.headers['user-agent'] || '';

        if (!subscription) {
            return res.status(400).json({ error: 'Falta el objeto de suscripción' });
        }

        const saved = await saveSubscription({
            pool,
            userId: req.user.id,
            subscription,
            userAgent
        });

        res.json({ success: true, id: saved?.id });
    } catch (err) { next(err); }
});

// POST /api/notificaciones/push-unsubscribe
router.post('/push-unsubscribe', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { endpoint } = req.body || {};
        await removeSubscription({ pool, endpoint });
        res.json({ success: true });
    } catch (err) { next(err); }
});

// POST /api/notificaciones/push-test (Probar notificación directa)
router.post('/push-test', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        await sendPushNotification({
            pool,
            userId: req.user.id,
            payload: {
                title: '🔔 AFINIX Dental Lab',
                body: '¡Notificaciones push activadas con éxito en este dispositivo!',
                url: '/cuenta',
                tag: 'push-test'
            }
        });
        res.json({ success: true, message: 'Push de prueba despachado' });
    } catch (err) { next(err); }
});

export default router;
