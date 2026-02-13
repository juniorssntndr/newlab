import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/categorias
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query('SELECT * FROM nl_categorias_trabajo WHERE activo = true ORDER BY orden, nombre');
        res.json(result.rows);
    } catch (err) { next(err); }
});

export default router;
