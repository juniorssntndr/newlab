import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/audit
router.get('/', requireRole('admin', 'socio'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { entidad, usuario_id, accion, desde, hasta, limit = 100 } = req.query;
        const params = [];
        let where = 'WHERE 1=1';

        if (entidad) {
            params.push(entidad);
            where += ` AND a.entidad = $${params.length}`;
        }
        if (usuario_id) {
            params.push(usuario_id);
            where += ` AND a.usuario_id = $${params.length}`;
        }
        if (accion) {
            params.push(accion);
            where += ` AND a.accion = $${params.length}`;
        }
        if (desde) {
            params.push(desde);
            where += ` AND a.created_at >= $${params.length}::timestamptz`;
        }
        if (hasta) {
            params.push(hasta);
            where += ` AND a.created_at <= $${params.length}::timestamptz`;
        }

        params.push(Math.min(parseInt(limit, 10) || 100, 500));
        const query = `
            SELECT a.*, u.nombre as usuario_nombre, u.email as usuario_email, u.tipo as usuario_tipo
            FROM nl_audit_eventos a
            LEFT JOIN nl_usuarios u ON u.id = a.usuario_id
            ${where}
            ORDER BY a.created_at DESC
            LIMIT $${params.length}
        `;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});


export default router;
