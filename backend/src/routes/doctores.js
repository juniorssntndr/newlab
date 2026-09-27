import { Router } from 'express';
import { authenticateToken, forbidRole, requireRole } from '../middleware/auth.js';
import { apisperuIdentityAdapter } from '../infrastructure/identity/apisperuIdentityAdapter.js';
import { logger } from '../lib/logger.js';

const router = Router();
router.use(authenticateToken);
router.use(forbidRole('visitador'));

/** Normalize optional ISO date `YYYY-MM-DD` → DATE string or null. */
function normalizeFechaNacimiento(value) {
    if (value == null || value === '') return null;
    const iso = String(value).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const err = new Error('fecha_nacimiento debe ser una fecha válida (YYYY-MM-DD)');
        err.status = 400;
        err.code = 'INVALID_BIRTHDATE';
        throw err;
    }
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (
        date.getFullYear() !== y
        || date.getMonth() !== m - 1
        || date.getDate() !== d
    ) {
        const err = new Error('fecha_nacimiento no es una fecha de calendario válida');
        err.status = 400;
        err.code = 'INVALID_BIRTHDATE';
        throw err;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
        const err = new Error('fecha_nacimiento no puede ser una fecha futura');
        err.status = 400;
        err.code = 'INVALID_BIRTHDATE';
        throw err;
    }
    if (y < 1900) {
        const err = new Error('fecha_nacimiento fuera de rango');
        err.status = 400;
        err.code = 'INVALID_BIRTHDATE';
        throw err;
    }
    return iso;
}


// GET /api/doctores?search=&nombre=&dni=
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, dni, search } = req.query;
        let query = `SELECT d.*,
          COALESCE((
            SELECT json_agg(json_build_object('id', c.id, 'nombre', c.nombre, 'es_principal', cd.es_principal) ORDER BY cd.es_principal DESC, c.nombre)
            FROM nl_clinica_doctores cd JOIN nl_clinicas c ON c.id=cd.clinica_id
            WHERE cd.doctor_id=d.id
          ), '[]'::json) AS clinicas
          FROM nl_doctores d WHERE 1=1`;
        const params = [];

        const term = search || nombre;
        if (term) {
            params.push(`%${term}%`);
            query += ` AND (d.nombre_completo ILIKE $${params.length} OR d.dni ILIKE $${params.length} OR d.especialidad ILIKE $${params.length})`;
        }
        if (dni) {
            params.push(dni);
            query += ` AND d.dni = $${params.length}`;
        }
        query += ' ORDER BY d.nombre_completo ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/doctores/preview-dni — lookup DNI, return proposal without saving
// Must be registered BEFORE /:id
router.post('/preview-dni', requireRole('admin', 'operador', 'tecnico'), async (req, res) => {
    const { dni } = req.body;
    if (!dni || !/^\d{8}$/.test(String(dni))) {
        return res.status(400).json({ error: 'El DNI debe tener exactamente 8 dígitos numéricos', code: 'INVALID_DOCUMENT' });
    }
    try {
        const identity = await apisperuIdentityAdapter.lookupDni(String(dni));
        logger.info('doctores.preview_dni', { userId: req.user?.id, last4: dni.slice(-4) });
        res.json({
            proposal: {
                dni: identity.documentNumber,
                nombres: identity.nombres,
                apellido_paterno: identity.apellidoPaterno,
                apellido_materno: identity.apellidoMaterno,
                nombre_completo: identity.fullName,
            },
        });
    } catch (err) {
        const code = err.code || 'QUOTA_OR_PROVIDER_ERROR';
        const statusMap = { DOCUMENT_NOT_FOUND: 404, INVALID_DOCUMENT: 400, TOKEN_MISSING: 500, QUOTA_OR_PROVIDER_ERROR: 503 };
        res.status(statusMap[code] || 500).json({ error: err.message, code });
    }
});

// POST /api/doctores/confirm — create doctor from validated DNI data
// Must be registered BEFORE /:id
router.post('/confirm', requireRole('admin', 'operador', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { dni, cop, email, telefono, clinicaIds, fecha_nacimiento, especialidad, direccion } = req.body;
        let fechaNacimiento;
        try {
            fechaNacimiento = normalizeFechaNacimiento(fecha_nacimiento);
        } catch (validationErr) {
            return res.status(validationErr.status || 400).json({
                error: validationErr.message,
                code: validationErr.code || 'INVALID_BIRTHDATE',
            });
        }

        if (!dni || !/^\d{8}$/.test(String(dni))) {
            return res.status(400).json({ error: 'El DNI debe tener exactamente 8 dígitos numéricos', code: 'INVALID_DOCUMENT' });
        }
        if (!String(especialidad || '').trim()) {
            return res.status(400).json({ error: 'Especialidad es requerida', code: 'SPECIALTY_REQUIRED' });
        }

        let identity;
        try {
            identity = await apisperuIdentityAdapter.lookupDni(String(dni));
        } catch (err) {
            const code = err.code || 'QUOTA_OR_PROVIDER_ERROR';
            const statusMap = { DOCUMENT_NOT_FOUND: 404, INVALID_DOCUMENT: 400, TOKEN_MISSING: 500, QUOTA_OR_PROVIDER_ERROR: 503 };
            return res.status(statusMap[code] || 500).json({ error: err.message, code });
        }

        const existing = await pool.query('SELECT id FROM nl_doctores WHERE dni = $1', [dni]);

        let doctor;
        let created;
        if (existing.rows.length > 0) {
            const upd = await pool.query(
                `UPDATE nl_doctores SET
                    nombres=$1, apellido_paterno=$2, apellido_materno=$3, nombre_completo=$4,
                    cop=COALESCE($5, cop), email=COALESCE($6, email), telefono=COALESCE($7, telefono),
                    fecha_nacimiento=COALESCE($8, fecha_nacimiento), especialidad=$9, direccion=COALESCE($10,direccion),
                    validado_externo_at=NOW()
                 WHERE dni=$11 RETURNING *`,
                [identity.nombres, identity.apellidoPaterno, identity.apellidoMaterno, identity.fullName,
                 cop || null, email || null, telefono || null, fechaNacimiento, String(especialidad).trim(), direccion || null, dni]
            );
            doctor = upd.rows[0];
            created = false;
        } else {
            let ins;
            try {
                ins = await pool.query(
                    `INSERT INTO nl_doctores (dni, nombres, apellido_paterno, apellido_materno, nombre_completo, cop, email, telefono, fecha_nacimiento, especialidad, direccion, validado_externo_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING *`,
                    [dni, identity.nombres, identity.apellidoPaterno, identity.apellidoMaterno, identity.fullName,
                     cop || null, email || null, telefono || null, fechaNacimiento, String(especialidad).trim(), direccion || null]
                );
            } catch (dbErr) {
                if (dbErr.code === '23505') {
                    return res.status(409).json({ error: 'Ya existe un doctor con ese DNI', code: 'DUPLICATE_DNI' });
                }
                throw dbErr;
            }
            doctor = ins.rows[0];
            created = true;
        }

        if (Array.isArray(clinicaIds) && clinicaIds.length > 0) {
            await associateClinics(pool, doctor.id, clinicaIds);
        }

        logger.info(created ? 'doctores.confirm.created' : 'doctores.confirm.updated', {
            userId: req.user?.id, last4: dni.slice(-4), id: doctor.id,
        });

        const status = created ? 201 : 200;
        res.status(status).json({ doctor, created });
    } catch (err) { next(err); }
});

// POST /api/doctores — direct creation; DNI/Reniec enrichment is optional.
router.post('/', requireRole('admin', 'operador', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { dni, nombre, nombre_completo, nombres, apellido_paterno, apellido_materno, especialidad,
            cop, email, telefono, direccion, fecha_nacimiento, clinicaIds = [] } = req.body;
        const fullName = String(nombre_completo || nombre || '').trim();
        const specialty = String(especialidad || '').trim();
        if (!fullName || !specialty) return res.status(400).json({ error: 'Nombre y especialidad son requeridos' });
        const normalizedDni = String(dni || '').trim() || null;
        if (normalizedDni && !/^\d{8}$/.test(normalizedDni)) return res.status(400).json({ error: 'El DNI debe tener exactamente 8 dígitos numéricos', code: 'INVALID_DOCUMENT' });
        let birthday;
        try { birthday = normalizeFechaNacimiento(fecha_nacimiento); }
        catch (error) { return res.status(400).json({ error: error.message, code: error.code }); }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const inserted = await client.query(
                `INSERT INTO nl_doctores
                 (dni,nombres,apellido_paterno,apellido_materno,nombre_completo,especialidad,cop,email,telefono,direccion,fecha_nacimiento)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
                [normalizedDni, String(nombres || fullName).trim(), apellido_paterno || null, apellido_materno || null,
                 fullName, specialty, cop || null, email || null, telefono || null, direccion || null, birthday]
            );
            if (!Array.isArray(clinicaIds)) throw Object.assign(new Error('clinicaIds debe ser un arreglo'), { status: 400 });
            await associateClinics(client, inserted.rows[0].id, clinicaIds);
            await client.query('COMMIT');
            return res.status(201).json(inserted.rows[0]);
        } catch (error) {
            await client.query('ROLLBACK');
            if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un doctor con ese DNI', code: 'DUPLICATE_DNI' });
            throw error;
        } finally { client.release(); }
    } catch (err) { next(err); }
});

// GET /api/doctores/:id
router.get('/:id', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query('SELECT * FROM nl_doctores WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });

        const clinicas = await pool.query(
            `SELECT c.id, c.nombre, cd.es_principal
             FROM nl_clinica_doctores cd
             JOIN nl_clinicas c ON c.id = cd.clinica_id
             WHERE cd.doctor_id = $1`,
            [req.params.id]
        );
        res.json({ ...result.rows[0], clinicas: clinicas.rows });
    } catch (err) { next(err); }
});

// PUT /api/doctores/:id
router.put('/:id', requireRole('admin', 'operador', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const editable = ['dni','nombres','apellido_paterno','apellido_materno','nombre_completo','especialidad','cop','email','telefono','direccion'];

        let fechaNacimiento;
        try {
            // Allow explicit null to clear the birthday: only normalize when the key is present.
            if (Object.prototype.hasOwnProperty.call(req.body, 'fecha_nacimiento')) {
                fechaNacimiento = normalizeFechaNacimiento(req.body.fecha_nacimiento);
            }
        } catch (validationErr) {
            return res.status(validationErr.status || 400).json({
                error: validationErr.message,
                code: validationErr.code || 'INVALID_BIRTHDATE',
            });
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'dni')) {
            const normalized = String(req.body.dni || '').trim();
            if (normalized && !/^\d{8}$/.test(normalized)) return res.status(400).json({ error: 'El DNI debe tener exactamente 8 dígitos numéricos', code: 'INVALID_DOCUMENT' });
            req.body.dni = normalized || null;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'nombre_completo') && !String(req.body.nombre_completo || '').trim()) return res.status(400).json({ error: 'Nombre es requerido' });
        if (Object.prototype.hasOwnProperty.call(req.body, 'especialidad') && !String(req.body.especialidad || '').trim()) return res.status(400).json({ error: 'Especialidad es requerida' });
        const updates = []; const params = [];
        for (const field of editable) {
            if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
            params.push(req.body[field] === '' ? null : req.body[field]);
            updates.push(`${field}=$${params.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'fecha_nacimiento')) {
            params.push(fechaNacimiento ?? null); updates.push(`fecha_nacimiento=$${params.length}::date`);
        }
        if (!updates.length) return res.status(400).json({ error: 'Sin cambios' });
        params.push(req.params.id);
        let result;
        try { result = await pool.query(`UPDATE nl_doctores SET ${updates.join(', ')} WHERE id=$${params.length} RETURNING *`, params); }
        catch (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un doctor con ese DNI', code: 'DUPLICATE_DNI' });
            throw error;
        }
        if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// POST /api/doctores/:id/clinicas — replace clinic associations
router.post('/:id/clinicas', requireRole('admin', 'operador', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { clinicaIds } = req.body;
        if (!Array.isArray(clinicaIds)) {
            return res.status(400).json({ error: 'clinicaIds debe ser un arreglo' });
        }
        const doctorId = Number(req.params.id);
        const check = await pool.query('SELECT id FROM nl_doctores WHERE id = $1', [doctorId]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const previous = await client.query('SELECT clinica_id FROM nl_clinica_doctores WHERE doctor_id=$1', [doctorId]);
            const affectedClinicIds = [...new Set([...previous.rows.map((row) => Number(row.clinica_id)), ...clinicaIds.map(Number)])];
            await associateClinics(client, doctorId, clinicaIds, { replace: true });
            await client.query(
                `UPDATE nl_clinicas c SET doctor_contacto_principal_id=NULL
                 WHERE c.doctor_contacto_principal_id=$1
                   AND NOT EXISTS (SELECT 1 FROM nl_clinica_doctores cd WHERE cd.clinica_id=c.id AND cd.doctor_id=$1)`,
                [doctorId]
            );
            const invalid = await client.query(
                `SELECT c.id FROM nl_clinicas c
                 WHERE c.id=ANY($1::int[]) AND NULLIF(BTRIM(c.telefono),'') IS NULL
                   AND NOT EXISTS (
                     SELECT 1 FROM nl_clinica_doctores cd JOIN nl_doctores d ON d.id=cd.doctor_id
                     WHERE cd.clinica_id=c.id AND d.estado='activo' AND NULLIF(BTRIM(d.telefono),'') IS NOT NULL
                   ) AND c.estado='activo' LIMIT 1`,
                [affectedClinicIds]
            );
            if (invalid.rows[0]) throw Object.assign(new Error('La actualización dejaría una clínica sin contacto telefónico'), { status: 400, code: 'CONTACT_REQUIRED' });
            await client.query('COMMIT');
            res.json({ message: 'Asociaciones actualizadas', clinicaIds });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally { client.release(); }
    } catch (err) { next(err); }
});

// DELETE /api/doctores/:id — soft delete
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query(
            'UPDATE nl_doctores SET estado = $1 WHERE id = $2 RETURNING id',
            ['inactivo', req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });
        res.json({ message: 'Doctor desactivado' });
    } catch (err) { next(err); }
});

async function associateClinics(pool, doctorId, clinicaIds, { replace = false } = {}) {
    if (replace) {
        await pool.query('DELETE FROM nl_clinica_doctores WHERE doctor_id = $1', [doctorId]);
    }
    if (clinicaIds.length === 0) return;

    const values = clinicaIds
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
    await pool.query(
        `INSERT INTO nl_clinica_doctores (doctor_id, clinica_id) VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [doctorId, ...clinicaIds]
    );
}

export default router;
