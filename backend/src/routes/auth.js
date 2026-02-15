import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'newlab-secret';

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

        const pool = req.app.locals.pool;
        const result = await pool.query(
            `SELECT u.*, r.nombre as rol_nombre, c.nombre as clinica_nombre
       FROM nl_usuarios u
       LEFT JOIN nl_roles r ON u.rol_id = r.id
       LEFT JOIN nl_clinicas c ON u.clinica_id = c.id
       WHERE u.email = $1 AND u.estado = 'activo'`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

        // Update last access
        await pool.query('UPDATE nl_usuarios SET ultimo_acceso = NOW() WHERE id = $1', [user.id]);

        const token = jwt.sign(
            { id: user.id, email: user.email, tipo: user.tipo, nombre: user.nombre, clinica_id: user.clinica_id, rol: user.rol_nombre },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id, nombre: user.nombre, email: user.email, tipo: user.tipo,
                rol: user.rol_nombre, clinica_id: user.clinica_id, clinica_nombre: user.clinica_nombre,
                avatar_url: user.avatar_url
            }
        });
    } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query(
            `SELECT u.id, u.nombre, u.email, u.telefono, u.tipo, u.avatar_url, u.clinica_id,
              r.nombre as rol, c.nombre as clinica_nombre
       FROM nl_usuarios u
       LEFT JOIN nl_roles r ON u.rol_id = r.id
       LEFT JOIN nl_clinicas c ON u.clinica_id = c.id
       WHERE u.id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// PATCH /api/auth/me
router.patch('/me', authenticateToken, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, email, telefono, avatar_url } = req.body;
        const updates = [];
        const params = [];

        if (nombre) { params.push(nombre); updates.push(`nombre = $${params.length}`); }
        if (email) { params.push(email); updates.push(`email = $${params.length}`); }
        if (telefono !== undefined) { params.push(telefono || null); updates.push(`telefono = $${params.length}`); }
        if (avatar_url !== undefined) { params.push(avatar_url || null); updates.push(`avatar_url = $${params.length}`); }

        if (updates.length === 0) return res.status(400).json({ error: 'Sin cambios' });

        params.push(req.user.id);
        const result = await pool.query(
            `UPDATE nl_usuarios SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, nombre, email, telefono, tipo, avatar_url`,
            params
        );

        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// PATCH /api/auth/password
router.patch('/password', authenticateToken, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
        }

        const result = await pool.query('SELECT password_hash FROM nl_usuarios WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

        const newHash = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE nl_usuarios SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

        res.json({ success: true });
    } catch (err) { next(err); }
});

export default router;
