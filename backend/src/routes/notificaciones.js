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

// Campaign eligibility comes from the current campaign, not the copied notice
// payload. Use this exact predicate for both inbox rows and the unread counter.
// Self-tests and every ordinary notification keep their existing behavior.
export const visibleNotificationPredicate = `(
    n.tipo IS DISTINCT FROM 'campana_marketing' OR EXISTS (
        SELECT 1 FROM nl_campanas_marketing c
        WHERE c.id::text = n.data->>'campana_id'
          AND c.activo = TRUE AND c.mostrar_toast_in_app = TRUE
          AND COALESCE((to_jsonb(c)->>'fecha_fin')::timestamptz, 'infinity'::timestamptz) >= NOW()
    )
)`;

// GET /api/notificaciones
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { no_leidas } = req.query;
        // One statement gives inbox and badge the same authoritative snapshot,
        // even when an administrator pauses a campaign during polling.
        const result = await pool.query(`WITH visible AS MATERIALIZED (
            SELECT n.* FROM nl_notificaciones n WHERE n.usuario_id = $1 AND ${visibleNotificationPredicate}
        ), listed AS (
            SELECT * FROM visible ${no_leidas === 'true' ? 'WHERE leida = FALSE' : ''}
            ORDER BY created_at DESC LIMIT 50
        ) SELECT
            COALESCE((SELECT jsonb_agg(to_jsonb(listed) ORDER BY listed.created_at DESC) FROM listed), '[]'::jsonb) AS items,
            (SELECT COUNT(*)::int FROM visible WHERE leida = FALSE) AS no_leidas`, [req.user.id]);

        const inbox = result.rows[0];
        res.json({ items: inbox.items, no_leidas: Number(inbox.no_leidas) });
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
