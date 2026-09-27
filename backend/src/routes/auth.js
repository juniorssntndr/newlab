import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import { getJwtSecret } from '../config/env.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerClientSchema } from '../validation/schemas.js';
import { writeAuditEvent } from '../services/audit.js';

const router = Router();

export const resolveUserModules = (user) => {
    if (user.permisos_modulos) {
        if (Array.isArray(user.permisos_modulos)) {
            return user.permisos_modulos;
        }
        if (typeof user.permisos_modulos === 'object') {
            return Object.keys(user.permisos_modulos).filter((k) => !!user.permisos_modulos[k]);
        }
    }

    if (user.rol_permisos && typeof user.rol_permisos === 'object') {
        const keys = Object.keys(user.rol_permisos).filter((k) => !!user.rol_permisos[k]);
        if (keys.length > 0) return keys;
    }

    switch (user.tipo) {
        case 'admin':
            return ['dashboard', 'pedidos', 'caja', 'cobros', 'calendario', 'crm', 'catalogo', 'almacen', 'usuarios', 'cuenta'];
        case 'socio':
            return ['dashboard', 'pedidos', 'caja', 'cobros', 'calendario', 'crm', 'catalogo', 'cuenta'];
        case 'tecnico':
            return ['pedidos', 'catalogo', 'almacen', 'calendario', 'cuenta'];
        case 'operador':
            return ['caja', 'pedidos', 'calendario', 'crm', 'catalogo', 'cuenta'];
        case 'visitador':
            return ['crm', 'calendario', 'cuenta'];
        case 'cliente':
            return ['pedidos_cliente', 'catalogo_cliente', 'cuenta'];
        default:
            return ['cuenta'];
    }
};

// POST /api/auth/login
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

        const pool = req.app.locals.pool;
        const result = await pool.query(
            `SELECT u.*, r.nombre as rol_nombre, r.permisos as rol_permisos, c.nombre as clinica_nombre, c.direccion as clinica_direccion,
              COALESCE(
                (
                  SELECT NULLIF(TRIM(e.direccion_fiscal), '')
                  FROM nl_empresas e
                  WHERE e.activo = true
                  ORDER BY e.id ASC
                  LIMIT 1
                ),
                'Calle Piura 316, Mariano Melgar'
              ) as laboratorio_direccion
       FROM nl_usuarios u
       LEFT JOIN nl_roles r ON u.rol_id = r.id
       LEFT JOIN nl_clinicas c ON u.clinica_id = c.id
       WHERE LOWER(u.email) = LOWER($1)`,
            [email]
        );

        if (result.rows.length === 0) {
            await writeAuditEvent(req, {
                entidad: 'auth',
                accion: 'login_failed',
                descripcion: 'Intento de login con email no encontrado',
                metadata: { email }
            });
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            await writeAuditEvent(req, {
                entidad: 'auth',
                entidadId: user.id,
                accion: 'login_failed',
                descripcion: 'Intento de login con password invalido',
                metadata: { email }
            });
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (user.estado === 'pendiente') {
            await writeAuditEvent(req, {
                entidad: 'auth',
                entidadId: user.id,
                accion: 'login_blocked_pending',
                descripcion: 'Intento de login de usuario en estado pendiente',
                metadata: { email: user.email, tipo: user.tipo }
            });
            return res.status(403).json({
                error: 'Tu cuenta ha sido registrada con éxito pero se encuentra en proceso de validación por el equipo de AFINIX Dental Lab. Nos comunicaremos contigo para confirmar los datos y activarla.',
                code: 'ACCOUNT_PENDING'
            });
        }

        if (user.estado === 'inactivo') {
            return res.status(403).json({
                error: 'Tu cuenta se encuentra inactiva. Comunícate con la administración de AFINIX Dental Lab.',
                code: 'ACCOUNT_INACTIVE'
            });
        }

        // Update last access
        await pool.query('UPDATE nl_usuarios SET ultimo_acceso = NOW() WHERE id = $1', [user.id]);

        const modulos = resolveUserModules(user);
        const JWT_SECRET = getJwtSecret();
        const token = jwt.sign(
            { id: user.id, email: user.email, tipo: user.tipo, nombre: user.nombre, clinica_id: user.clinica_id, rol: user.rol_nombre, modulos },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                nombre: user.nombre,
                email: user.email,
                telefono: user.telefono,
                tipo: user.tipo,
                rol: user.rol_nombre,
                modulos,
                permisos_modulos: user.permisos_modulos,
                clinica_id: user.clinica_id,
                clinica_nombre: user.clinica_nombre,
                clinica_direccion: user.clinica_direccion,
                laboratorio_direccion: user.laboratorio_direccion,
                avatar_url: user.avatar_url
            }
        });
        await writeAuditEvent(req, {
            entidad: 'auth',
            entidadId: user.id,
            accion: 'login_success',
            descripcion: 'Inicio de sesion exitoso',
            metadata: { email: user.email, tipo: user.tipo }
        });
    } catch (err) { next(err); }
});

// POST /api/auth/register-client
router.post('/register-client', validateBody(registerClientSchema), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, email, password, telefono, clinica_nombre, ruc, dni, direccion, distrito } = req.body;

        const emailCheck = await pool.query('SELECT id FROM nl_usuarios WHERE LOWER(email) = LOWER($1)', [email]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado. Si olvidaste tu contraseña o necesitas ayuda, contáctanos.' });
        }

        const roleResult = await pool.query("SELECT id FROM nl_roles WHERE es_admin = false AND (nombre ILIKE '%cliente%' OR LOWER(nombre) = 'cliente') LIMIT 1");
        const rolId = roleResult.rows[0]?.id;
        if (!rolId) {
            return res.status(500).json({ error: 'Configuración de roles no encontrada en el sistema' });
        }

        let clinicaId = null;
        if (ruc) {
            const existingClinic = await pool.query('SELECT id FROM nl_clinicas WHERE ruc = $1 LIMIT 1', [ruc]);
            if (existingClinic.rows.length > 0) {
                clinicaId = existingClinic.rows[0].id;
            }
        }

        const fullDireccion = [direccion, distrito].filter(Boolean).join(', ');

        if (!clinicaId) {
            const clinicInsert = await pool.query(
                `INSERT INTO nl_clinicas (nombre, razon_social, ruc, dni, email, telefono, direccion, contacto_nombre, estado)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente')
                 RETURNING id`,
                [clinica_nombre, clinica_nombre, ruc || null, dni || null, email, telefono, fullDireccion || null, nombre]
            );
            clinicaId = clinicInsert.rows[0].id;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const userInsert = await pool.query(
            `INSERT INTO nl_usuarios (nombre, email, telefono, password_hash, rol_id, tipo, clinica_id, estado)
             VALUES ($1, $2, $3, $4, $5, 'cliente', $6, 'pendiente')
             RETURNING id, nombre, email, telefono, tipo, clinica_id, estado, created_at`,
            [nombre, email, telefono, passwordHash, rolId, clinicaId]
        );

        await writeAuditEvent(req, {
            entidad: 'auth',
            entidadId: userInsert.rows[0].id,
            accion: 'client_registered',
            descripcion: 'Auto-registro público de cliente (solicitud pendiente de verificación)',
            metadata: { email, clinica_nombre, ruc, telefono }
        });

        res.status(201).json({
            message: 'Tu solicitud de registro ha sido recibida con éxito. Nuestro equipo de AFINIX Dental Lab validará tus datos para darte la bienvenida y activar tu acceso.',
            user: {
                id: userInsert.rows[0].id,
                nombre: userInsert.rows[0].nombre,
                email: userInsert.rows[0].email,
                estado: userInsert.rows[0].estado
            }
        });
    } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query(
            `SELECT u.id, u.nombre, u.email, u.telefono, u.tipo, u.estado, u.avatar_url, u.clinica_id, u.permisos_modulos,
              r.nombre as rol, r.permisos as rol_permisos, c.nombre as clinica_nombre, c.direccion as clinica_direccion,
              COALESCE(
                (
                  SELECT NULLIF(TRIM(e.direccion_fiscal), '')
                  FROM nl_empresas e
                  WHERE e.activo = true
                  ORDER BY e.id ASC
                  LIMIT 1
                ),
                'Calle Piura 316, Mariano Melgar'
              ) as laboratorio_direccion
       FROM nl_usuarios u
       LEFT JOIN nl_roles r ON u.rol_id = r.id
       LEFT JOIN nl_clinicas c ON u.clinica_id = c.id
       WHERE u.id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        const user = result.rows[0];
        const modulos = resolveUserModules(user);
        res.json({ ...user, modulos });
    } catch (err) { next(err); }
});

// PATCH /api/auth/me
router.patch('/me', authenticateToken, async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, email, telefono, avatar_url, clinica_direccion } = req.body;
        const updates = [];
        const params = [];

        if (nombre) { params.push(nombre); updates.push(`nombre = $${params.length}`); }
        if (email) { params.push(email); updates.push(`email = $${params.length}`); }
        if (telefono !== undefined) { params.push(telefono || null); updates.push(`telefono = $${params.length}`); }
        if (avatar_url !== undefined) { params.push(avatar_url || null); updates.push(`avatar_url = $${params.length}`); }

        let clinicUpdated = false;
        if (clinica_direccion !== undefined) {
            const userRow = await pool.query(
                'SELECT tipo, clinica_id FROM nl_usuarios WHERE id = $1',
                [req.user.id]
            );
            const current = userRow.rows[0];
            if (!current?.clinica_id || current.tipo !== 'cliente') {
                return res.status(403).json({ error: 'No puedes editar la dirección de la clínica' });
            }
            const nextAddress = String(clinica_direccion || '').trim() || null;
            const clinicResult = await pool.query(
                `UPDATE nl_clinicas
                 SET direccion = $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING id, direccion`,
                [nextAddress, current.clinica_id]
            );
            if (clinicResult.rowCount === 0) {
                return res.status(404).json({ error: 'Clínica no encontrada' });
            }
            clinicUpdated = true;
        }

        if (updates.length === 0 && !clinicUpdated) {
            return res.status(400).json({ error: 'Sin cambios' });
        }

        if (updates.length > 0) {
            params.push(req.user.id);
            await pool.query(
                `UPDATE nl_usuarios SET ${updates.join(', ')} WHERE id = $${params.length}`,
                params
            );
        }

        const refreshed = await pool.query(
            `SELECT u.id, u.nombre, u.email, u.telefono, u.tipo, u.avatar_url, u.clinica_id,
              r.nombre as rol, c.nombre as clinica_nombre, c.direccion as clinica_direccion,
              COALESCE(
                (
                  SELECT NULLIF(TRIM(e.direccion_fiscal), '')
                  FROM nl_empresas e
                  WHERE e.activo = true
                  ORDER BY e.id ASC
                  LIMIT 1
                ),
                'Calle Piura 316, Mariano Melgar'
              ) as laboratorio_direccion
       FROM nl_usuarios u
       LEFT JOIN nl_roles r ON u.rol_id = r.id
       LEFT JOIN nl_clinicas c ON u.clinica_id = c.id
       WHERE u.id = $1`,
            [req.user.id]
        );

        res.json(refreshed.rows[0]);
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

        await writeAuditEvent(req, {
            entidad: 'usuario',
            entidadId: req.user.id,
            accion: 'password_updated',
            descripcion: 'Usuario actualizo su contraseña'
        });

        res.json({ success: true });
    } catch (err) { next(err); }
});

export default router;
