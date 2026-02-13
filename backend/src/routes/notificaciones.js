import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

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

export default router;
