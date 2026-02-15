import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/inventory - List all materials
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query('SELECT * FROM nl_materiales WHERE activo = true ORDER BY nombre');
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/inventory - Create material
router.post('/', requireRole('admin'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, stock_actual, stock_minimo, unidad } = req.body;

        if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

        const result = await pool.query(
            `INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [nombre, stock_actual || 0, stock_minimo || 5, unidad || 'unid']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/inventory/:id - Update material
router.put('/:id', requireRole('admin'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, stock_actual, stock_minimo, unidad, activo } = req.body;
        const result = await pool.query(
            `UPDATE nl_materiales SET 
                nombre = COALESCE($1, nombre),
                stock_actual = COALESCE($2, stock_actual),
                stock_minimo = COALESCE($3, stock_minimo),
                unidad = COALESCE($4, unidad),
                activo = COALESCE($5, activo)
             WHERE id = $6 RETURNING *`,
            [nombre, stock_actual, stock_minimo, unidad, activo, req.params.id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Material no encontrado' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

export default router;
