import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const ensureCanManageUsers = (req, res, next) => {
    if (req.user.tipo !== 'admin' && req.user.tipo !== 'visitador') {
        return res.status(403).json({ error: 'No autorizado para gestionar usuarios' });
    }
    next();
};

const getRoleIdByTipo = async (pool, tipo) => {
    if (tipo === 'admin') {
        const result = await pool.query('SELECT id FROM nl_roles WHERE es_admin = true LIMIT 1');
        return result.rows[0]?.id || null;
    }
    if (tipo === 'socio') {
        const result = await pool.query("SELECT id FROM nl_roles WHERE LOWER(nombre) = 'socio' LIMIT 1");
        return result.rows[0]?.id || null;
    }
    if (tipo === 'operador') {
        const result = await pool.query("SELECT id FROM nl_roles WHERE LOWER(nombre) = 'operador' LIMIT 1");
        return result.rows[0]?.id || null;
    }
    if (tipo === 'tecnico') {
        const result = await pool.query("SELECT id FROM nl_roles WHERE es_admin = false AND (nombre ILIKE 'T%' OR LOWER(nombre) = 'protesista') LIMIT 1");
        return result.rows[0]?.id || null;
    }
    if (tipo === 'visitador') {
        const result = await pool.query("SELECT id FROM nl_roles WHERE nombre ILIKE 'Visitador' LIMIT 1");
        return result.rows[0]?.id || null;
    }
    if (tipo === 'cliente') {
        const result = await pool.query("SELECT id FROM nl_roles WHERE es_admin = false AND (nombre ILIKE '%cliente%' OR LOWER(nombre) = 'cliente') LIMIT 1");
        return result.rows[0]?.id || null;
    }
    return null;
};

// GET /api/usuarios
router.get('/', ensureCanManageUsers, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { tipo, estado } = req.query;
        let query = `SELECT u.id, u.nombre, u.email, u.telefono, u.tipo, u.estado, u.ultimo_acceso,
          u.avatar_url, u.clinica_id, u.permisos_modulos, u.created_at,
          r.nombre as rol_nombre, r.permisos as rol_permisos,
          c.nombre as clinica_nombre, c.ruc as clinica_ruc, c.direccion as clinica_direccion
          FROM nl_usuarios u
          LEFT JOIN nl_roles r ON u.rol_id = r.id
          LEFT JOIN nl_clinicas c ON u.clinica_id = c.id
          WHERE 1=1`;
        const params = [];

        // Si es visitador, solo puede ver usuarios clientes
        if (req.user.tipo === 'visitador') {
            query += " AND u.tipo = 'cliente'";
        } else if (tipo) {
            if (tipo === 'equipo') {
                query += " AND u.tipo IN ('admin','socio','operador','tecnico','visitador')";
            } else if (tipo === 'cliente') {
                query += " AND u.tipo = 'cliente'";
            } else if (tipo !== 'todos') {
                params.push(tipo);
                query += ` AND u.tipo = $${params.length}`;
            }
        }

        if (estado) {
            params.push(estado);
            query += ` AND u.estado = $${params.length}`;
        }

        query += ' ORDER BY u.id DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/usuarios
router.post('/', ensureCanManageUsers, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, email, telefono, tipo, password, estado, clinica_id, permisos_modulos } = req.body;

        if (!nombre || !email || !tipo || !password) {
            return res.status(400).json({ error: 'Nombre, email, tipo y password son requeridos' });
        }
        if (!['admin', 'socio', 'operador', 'tecnico', 'visitador', 'cliente'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo de usuario no válido' });
        }

        // El visitador solo puede otorgar cuentas a clientes de clínicas
        if (req.user.tipo === 'visitador' && tipo !== 'cliente') {
            return res.status(403).json({ error: 'Como visitador solo tiene autorización para otorgar cuentas a clientes de clínicas' });
        }

        if (tipo === 'cliente' && !clinica_id) {
            return res.status(400).json({ error: 'Debe seleccionar la clínica asociada al usuario cliente' });
        }

        const rolId = await getRoleIdByTipo(pool, tipo);
        if (!rolId) return res.status(400).json({ error: 'Rol no encontrado en el sistema' });

        const passwordHash = await bcrypt.hash(password, 10);
        const modulosValue = permisos_modulos ? JSON.stringify(permisos_modulos) : null;

        const result = await pool.query(
            `INSERT INTO nl_usuarios (nombre, email, telefono, password_hash, rol_id, tipo, clinica_id, estado, permisos_modulos)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING id, nombre, email, telefono, tipo, clinica_id, estado, permisos_modulos`,
            [nombre, email, telefono || null, passwordHash, rolId, tipo, tipo === 'cliente' ? clinica_id : null, estado || 'activo', modulosValue]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// POST /api/usuarios/:id/activar-cliente
router.post('/:id/activar-cliente', ensureCanManageUsers, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { clinica_id } = req.body || {};
        const userResult = await pool.query('SELECT id, clinica_id, tipo, estado FROM nl_usuarios WHERE id = $1', [req.params.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const target = userResult.rows[0];
        const oldClinicaId = target.clinica_id;
        const finalClinicaId = clinica_id ? Number(clinica_id) : oldClinicaId;

        await pool.query("UPDATE nl_usuarios SET estado = 'activo', clinica_id = $2 WHERE id = $1", [target.id, finalClinicaId]);

        if (finalClinicaId) {
            await pool.query("UPDATE nl_clinicas SET estado = 'activo' WHERE id = $1", [finalClinicaId]);
        }

        // Si se vinculó a otra clínica existente, limpiamos la clínica pendiente huérfana creada durante el registro
        if (oldClinicaId && finalClinicaId && oldClinicaId !== finalClinicaId) {
            const otherUsers = await pool.query('SELECT id FROM nl_usuarios WHERE clinica_id = $1 AND id != $2 LIMIT 1', [oldClinicaId, target.id]);
            const orders = await pool.query('SELECT id FROM nl_pedidos WHERE clinica_id = $1 LIMIT 1', [oldClinicaId]);
            if (otherUsers.rows.length === 0 && orders.rows.length === 0) {
                await pool.query('DELETE FROM nl_clinicas WHERE id = $1', [oldClinicaId]);
            }
        }

        res.json({ message: 'Cuenta activada exitosamente', id: target.id, estado: 'activo', clinica_id: finalClinicaId });
    } catch (err) { next(err); }
});

// PATCH /api/usuarios/:id
router.patch('/:id', ensureCanManageUsers, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, email, telefono, tipo, estado, password, clinica_id, permisos_modulos } = req.body;

        // Si es visitador, verificar que el usuario objetivo sea de tipo cliente
        if (req.user.tipo === 'visitador') {
            const checkUser = await pool.query('SELECT tipo FROM nl_usuarios WHERE id = $1', [req.params.id]);
            if (checkUser.rows.length === 0 || checkUser.rows[0].tipo !== 'cliente') {
                return res.status(403).json({ error: 'Solo puede modificar usuarios clientes' });
            }
            if (tipo && tipo !== 'cliente') {
                return res.status(403).json({ error: 'No puede cambiar el tipo de un cliente a un rol de equipo' });
            }
        }

        if (tipo && !['admin', 'socio', 'operador', 'tecnico', 'visitador', 'cliente'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo no válido' });
        }

        const updates = [];
        const params = [];

        if (nombre) { params.push(nombre); updates.push(`nombre = $${params.length}`); }
        if (email) { params.push(email); updates.push(`email = $${params.length}`); }
        if (telefono !== undefined) { params.push(telefono || null); updates.push(`telefono = $${params.length}`); }
        if (estado) { params.push(estado); updates.push(`estado = $${params.length}`); }
        if (clinica_id !== undefined) { params.push(clinica_id || null); updates.push(`clinica_id = $${params.length}`); }

        if (permisos_modulos !== undefined) {
            params.push(permisos_modulos ? JSON.stringify(permisos_modulos) : null);
            updates.push(`permisos_modulos = $${params.length}`);
        }

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
             RETURNING id, nombre, email, telefono, tipo, clinica_id, estado, permisos_modulos`,
            params
        );

        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

export default router;
