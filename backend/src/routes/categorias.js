import { Router } from 'express';
import { authenticateToken, forbidRole, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);
router.use(forbidRole('visitador'));

// GET /api/categorias
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query('SELECT * FROM nl_categorias_trabajo WHERE activo = true ORDER BY orden, nombre');
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/categorias
router.post('/', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, descripcion, icono, orden } = req.body;

        const nombreTrimmed = typeof nombre === 'string' ? nombre.trim() : '';
        if (!nombreTrimmed) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        const ordenVal = orden !== undefined && orden !== null && orden !== '' ? (Number(orden) || 0) : 0;
        const descVal = descripcion !== undefined && descripcion !== null ? String(descripcion).trim() || null : null;
        const iconoVal = icono !== undefined && icono !== null ? String(icono).trim() || null : null;

        // Check if a category with the same name exists (case-insensitive)
        const existing = await pool.query(
            'SELECT * FROM nl_categorias_trabajo WHERE LOWER(TRIM(nombre)) = LOWER($1)',
            [nombreTrimmed]
        );

        if (existing.rows.length > 0) {
            const row = existing.rows[0];
            if (!row.activo) {
                // Reactivate and update previously deactivated category
                const reactivated = await pool.query(
                    `UPDATE nl_categorias_trabajo
                     SET activo = true,
                         nombre = $1,
                         descripcion = COALESCE($2, descripcion),
                         icono = COALESCE($3, icono),
                         orden = $4,
                         updated_at = NOW()
                     WHERE id = $5
                     RETURNING *`,
                    [nombreTrimmed, descVal, iconoVal, ordenVal, row.id]
                );
                return res.status(201).json(reactivated.rows[0]);
            }
            return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
        }

        const result = await pool.query(
            `INSERT INTO nl_categorias_trabajo (nombre, descripcion, icono, orden, activo)
             VALUES ($1, $2, $3, $4, true)
             RETURNING *`,
            [nombreTrimmed, descVal, iconoVal, ordenVal]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
        }
        next(err);
    }
});

// PUT /api/categorias/:id
router.put('/:id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;
        const { nombre, descripcion, icono, orden, activo } = req.body;

        const current = await pool.query('SELECT * FROM nl_categorias_trabajo WHERE id = $1', [id]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        const updates = [];
        const params = [];

        if (nombre !== undefined) {
            const nombreTrimmed = typeof nombre === 'string' ? nombre.trim() : '';
            if (!nombreTrimmed) {
                return res.status(400).json({ error: 'El nombre es obligatorio' });
            }

            const dup = await pool.query(
                'SELECT id FROM nl_categorias_trabajo WHERE LOWER(TRIM(nombre)) = LOWER($1) AND id <> $2',
                [nombreTrimmed, id]
            );
            if (dup.rows.length > 0) {
                return res.status(400).json({ error: 'Ya existe otra categoría con ese nombre' });
            }

            params.push(nombreTrimmed);
            updates.push(`nombre = $${params.length}`);
        }

        if (descripcion !== undefined) {
            const descVal = descripcion !== null ? String(descripcion).trim() || null : null;
            params.push(descVal);
            updates.push(`descripcion = $${params.length}`);
        }

        if (icono !== undefined) {
            const iconoVal = icono !== null ? String(icono).trim() || null : null;
            params.push(iconoVal);
            updates.push(`icono = $${params.length}`);
        }

        if (orden !== undefined) {
            const ordenVal = orden !== null && orden !== '' ? (Number(orden) || 0) : 0;
            params.push(ordenVal);
            updates.push(`orden = $${params.length}`);
        }

        if (activo !== undefined) {
            const activoVal = activo === true || activo === 'true';
            params.push(activoVal);
            updates.push(`activo = $${params.length}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        params.push(id);
        const result = await pool.query(
            `UPDATE nl_categorias_trabajo
             SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING *`,
            params
        );

        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Ya existe otra categoría con ese nombre' });
        }
        next(err);
    }
});

// DELETE /api/categorias/:id
router.delete('/:id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;

        const prodCheck = await pool.query(
            'SELECT id FROM nl_productos WHERE categoria_id = $1 AND activo = true LIMIT 1',
            [id]
        );

        if (prodCheck.rows.length > 0) {
            return res.status(400).json({ error: 'No se puede eliminar la categoría porque tiene productos asignados.' });
        }

        const result = await pool.query(
            'UPDATE nl_categorias_trabajo SET activo = false, updated_at = NOW() WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json({ success: true });
    } catch (err) { next(err); }
});

export default router;
