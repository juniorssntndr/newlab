import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const toNullableString = (value) => {
    if (value === undefined || value === null) return null;
    const v = String(value).trim();
    return v ? v : null;
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return fallback;
};

// GET /api/inventory - List all materials
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { flujo, categoria, estado } = req.query;
        const params = [];
        let query = 'SELECT * FROM nl_materiales WHERE 1=1';

        const normalizedEstado = String(estado || 'activos').trim().toLowerCase();
        if (normalizedEstado === 'inactivos') {
            query += ' AND activo = false';
        } else if (normalizedEstado !== 'todos') {
            query += ' AND activo = true';
        }

        if (flujo) {
            params.push(flujo);
            query += ` AND flujo = $${params.length}`;
        }
        if (categoria) {
            params.push(categoria);
            query += ` AND categoria = $${params.length}`;
        }

        query += ' ORDER BY nombre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/inventory - Create material
router.post('/', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, stock_actual, stock_minimo, unidad, flujo, categoria, color, alerta_bajo_stock, notas } = req.body;

        const nombreValue = toNullableString(nombre);
        if (!nombreValue) return res.status(400).json({ error: 'Nombre es requerido' });

        const result = await pool.query(
            `INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, flujo, categoria, color, alerta_bajo_stock, notas)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                nombreValue,
                toNumber(stock_actual, 0),
                toNumber(stock_minimo, 5),
                toNullableString(unidad) || 'unidad',
                toNullableString(flujo) || 'digital',
                toNullableString(categoria) || 'consumible',
                toNullableString(color),
                toBoolean(alerta_bajo_stock, true),
                toNullableString(notas)
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/inventory/:id - Update material
router.put('/:id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, stock_actual, stock_minimo, unidad, activo, flujo, categoria, color, alerta_bajo_stock, notas } = req.body;
        const result = await pool.query(
            `UPDATE nl_materiales SET 
                nombre = COALESCE($1, nombre),
                stock_actual = COALESCE($2, stock_actual),
                stock_minimo = COALESCE($3, stock_minimo),
                unidad = COALESCE($4, unidad),
                activo = COALESCE($5, activo),
                flujo = COALESCE($6, flujo),
                categoria = COALESCE($7, categoria),
                color = CASE WHEN $8 = '' THEN NULL ELSE COALESCE($8, color) END,
                alerta_bajo_stock = COALESCE($9, alerta_bajo_stock),
                notas = CASE WHEN $10 = '' THEN NULL ELSE COALESCE($10, notas) END
             WHERE id = $11 RETURNING *`,
            [
                toNullableString(nombre),
                stock_actual !== undefined ? toNumber(stock_actual, 0) : null,
                stock_minimo !== undefined ? toNumber(stock_minimo, 5) : null,
                toNullableString(unidad),
                activo !== undefined ? toBoolean(activo, true) : null,
                toNullableString(flujo),
                toNullableString(categoria),
                color,
                alerta_bajo_stock !== undefined ? toBoolean(alerta_bajo_stock, true) : null,
                notas,
                req.params.id
            ]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Material no encontrado' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// DELETE /api/inventory/:id - Soft delete material
router.delete('/:id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query(
            `UPDATE nl_materiales
             SET activo = false
             WHERE id = $1 AND activo = true
             RETURNING *`,
            [req.params.id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Material no encontrado o ya inactivo' });
        res.json({ success: true, material: result.rows[0] });
    } catch (err) { next(err); }
});

// PATCH /api/inventory/:id/restore - Restore soft deleted material
router.patch('/:id/restore', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query(
            `UPDATE nl_materiales
             SET activo = true
             WHERE id = $1 AND activo = false
             RETURNING *`,
            [req.params.id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Material no encontrado o ya activo' });
        res.json({ success: true, material: result.rows[0] });
    } catch (err) { next(err); }
});

export default router;
