import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/productos
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { categoria_id, search, activo } = req.query;
        let query = `SELECT p.*, c.nombre as categoria_nombre, c.tipo as categoria_tipo
                 FROM nl_productos p LEFT JOIN nl_categorias_trabajo c ON p.categoria_id = c.id WHERE 1=1`;
        const params = [];

        if (categoria_id) { params.push(categoria_id); query += ` AND p.categoria_id = $${params.length}`; }
        if (search) { params.push(`%${search}%`); query += ` AND p.nombre ILIKE $${params.length}`; }
        if (activo !== undefined) { params.push(activo === 'true'); query += ` AND p.activo = $${params.length}`; }
        query += ' ORDER BY c.orden, p.nombre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/productos
router.post('/', requireRole('admin'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, descripcion, categoria_id, precio_base, material_default, tiempo_estimado_dias } = req.body;
        if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

        const result = await pool.query(
            `INSERT INTO nl_productos (nombre, descripcion, categoria_id, precio_base, material_default, tiempo_estimado_dias)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [nombre, descripcion, categoria_id, precio_base || 0, material_default, tiempo_estimado_dias || 5]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/productos/:id
router.put('/:id', requireRole('admin'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, descripcion, categoria_id, precio_base, material_default, tiempo_estimado_dias, activo } = req.body;
        const result = await pool.query(
            `UPDATE nl_productos SET nombre=$1, descripcion=$2, categoria_id=$3, precio_base=$4,
       material_default=$5, tiempo_estimado_dias=$6, activo=COALESCE($7, activo)
       WHERE id=$8 RETURNING *`,
            [nombre, descripcion, categoria_id, precio_base, material_default, tiempo_estimado_dias, activo, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

export default router;
