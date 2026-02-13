import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// GET /api/clinicas
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { search, estado } = req.query;
        let query = 'SELECT * FROM nl_clinicas WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (nombre ILIKE $${params.length} OR razon_social ILIKE $${params.length} OR ruc ILIKE $${params.length})`;
        }
        if (estado) {
            params.push(estado);
            query += ` AND estado = $${params.length}`;
        }
        query += ' ORDER BY nombre ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// GET /api/clinicas/:id
router.get('/:id', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query('SELECT * FROM nl_clinicas WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// POST /api/clinicas
router.post('/', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, razon_social, ruc, dni, email, telefono, direccion, contacto_nombre } = req.body;
        if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

        const result = await pool.query(
            `INSERT INTO nl_clinicas (nombre, razon_social, ruc, dni, email, telefono, direccion, contacto_nombre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [nombre, razon_social, ruc, dni, email, telefono, direccion, contacto_nombre]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/clinicas/:id
router.put('/:id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, razon_social, ruc, dni, email, telefono, direccion, contacto_nombre, estado, lista_precios_id } = req.body;
        const result = await pool.query(
            `UPDATE nl_clinicas SET nombre=$1, razon_social=$2, ruc=$3, dni=$4, email=$5, telefono=$6,
       direccion=$7, contacto_nombre=$8, estado=COALESCE($9, estado), lista_precios_id=$10
       WHERE id=$11 RETURNING *`,
            [nombre, razon_social, ruc, dni, email, telefono, direccion, contacto_nombre, estado, lista_precios_id, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Clínica no encontrada' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// DELETE /api/clinicas/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        await pool.query('UPDATE nl_clinicas SET estado = $1 WHERE id = $2', ['inactivo', req.params.id]);
        res.json({ message: 'Clínica desactivada' });
    } catch (err) { next(err); }
});

export default router;
