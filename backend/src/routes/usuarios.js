import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const ensureAdmin = (req, res, next) => {
    if (req.user.tipo !== 'admin') {
        return res.status(403).json({ error: 'No autorizado' });
    }
    next();
};

const getRoleIdByTipo = async (pool, tipo) => {
    if (tipo === 'admin') {
        const result = await pool.query('SELECT id FROM nl_roles WHERE es_admin = true LIMIT 1');
        return result.rows[0]?.id || null;
    }
    if (tipo === 'tecnico') {
        const result = await pool.query("SELECT id FROM nl_roles WHERE es_admin = false AND nombre ILIKE 'T%' LIMIT 1");
        return result.rows[0]?.id || null;
    }
    return null;
};

// GET /api/usuarios
router.get('/', ensureAdmin, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { tipo } = req.query;
        let query = `SELECT u.id, u.nombre, u.email, u.telefono, u.tipo, u.estado, u.ultimo_acceso,
          u.avatar_url, r.nombre as rol_nombre, c.nombre as clinica_nombre
          FROM nl_usuarios u
          LEFT JOIN nl_roles r ON u.rol_id = r.id
          LEFT JOIN nl_clinicas c ON u.clinica_id = c.id
          WHERE 1=1`;
        const params = [];

        if (tipo) {
            if (tipo === 'equipo') {
                query += " AND u.tipo IN ('admin','tecnico')";
            } else {
                params.push(tipo);
                query += ` AND u.tipo = $${params.length}`;
            }
        }

        query += ' ORDER BY u.id DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/usuarios
router.post('/', ensureAdmin, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, email, telefono, tipo, password, estado } = req.body;

        if (!nombre || !email || !tipo || !password) {
            return res.status(400).json({ error: 'Nombre, email, tipo y password son requeridos' });
        }
        if (!['admin', 'tecnico'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo no valido' });
        }

        const rolId = await getRoleIdByTipo(pool, tipo);
        if (!rolId) return res.status(400).json({ error: 'Rol no encontrado' });

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO nl_usuarios (nombre, email, telefono, password_hash, rol_id, tipo, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, nombre, email, telefono, tipo, estado`,
            [nombre, email, telefono || null, passwordHash, rolId, tipo, estado || 'activo']
        );

        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PATCH /api/usuarios/:id
router.patch('/:id', ensureAdmin, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, email, telefono, tipo, estado, password } = req.body;

        if (tipo && !['admin', 'tecnico'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo no valido' });
        }

        const updates = [];
        const params = [];

        if (nombre) { params.push(nombre); updates.push(`nombre = $${params.length}`); }
        if (email) { params.push(email); updates.push(`email = $${params.length}`); }
        if (telefono !== undefined) { params.push(telefono || null); updates.push(`telefono = $${params.length}`); }
        if (estado) { params.push(estado); updates.push(`estado = $${params.length}`); }

        if (tipo) {
            const rolId = await getRoleIdByTipo(pool, tipo);
            if (!rolId) return res.status(400).json({ error: 'Rol no encontrado' });
            params.push(tipo);
            updates.push(`tipo = $${params.length}`);
            params.push(rolId);
            updates.push(`rol_id = $${params.length}`);
        }

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            params.push(passwordHash);
            updates.push(`password_hash = $${params.length}`);
        }

        if (updates.length === 0) return res.status(400).json({ error: 'Sin cambios' });

        params.push(req.params.id);
        const result = await pool.query(
            `UPDATE nl_usuarios SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, nombre, email, telefono, tipo, estado`,
            params
        );

        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

export default router;
