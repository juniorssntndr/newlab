import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { apisperuIdentityAdapter } from '../infrastructure/identity/apisperuIdentityAdapter.js';
import { logger } from '../lib/logger.js';

const router = Router();
router.use(authenticateToken);

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
        let query = 'SELECT * FROM nl_doctores WHERE 1=1';
        const params = [];

        const term = search || nombre;
        if (term) {
            params.push(`%${term}%`);
            query += ` AND (nombre_completo ILIKE $${params.length} OR dni ILIKE $${params.length})`;
        }
        if (dni) {
            params.push(dni);
            query += ` AND dni = $${params.length}`;
        }
        query += ' ORDER BY nombre_completo ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/doctores/preview-dni — lookup DNI, return proposal without saving
// Must be registered BEFORE /:id
router.post('/preview-dni', requireRole('admin', 'tecnico'), async (req, res) => {
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
router.post('/confirm', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { dni, cop, email, telefono, clinicaIds, fecha_nacimiento } = req.body;
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
                    fecha_nacimiento=COALESCE($8, fecha_nacimiento),
                    validado_externo_at=NOW()
                 WHERE dni=$9 RETURNING *`,
                [identity.nombres, identity.apellidoPaterno, identity.apellidoMaterno, identity.fullName,
                 cop || null, email || null, telefono || null, fechaNacimiento, dni]
            );
            doctor = upd.rows[0];
            created = false;
        } else {
            let ins;
            try {
                ins = await pool.query(
                    `INSERT INTO nl_doctores (dni, nombres, apellido_paterno, apellido_materno, nombre_completo, cop, email, telefono, fecha_nacimiento, validado_externo_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING *`,
                    [dni, identity.nombres, identity.apellidoPaterno, identity.apellidoMaterno, identity.fullName,
                     cop || null, email || null, telefono || null, fechaNacimiento]
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
router.put('/:id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombres, apellido_paterno, apellido_materno, nombre_completo, cop, email, telefono, fecha_nacimiento } = req.body;

        let fechaNacimiento;
        try {
            // Allow explicit null to clear the birthday: only normalize when the key is present.
            if (Object.prototype.hasOwnProperty.call(req.body, 'fecha_nacimiento')) {
                fechaNacimiento = normalizeFechaNacimiento(fecha_nacimiento);
            }
        } catch (validationErr) {
            return res.status(validationErr.status || 400).json({
                error: validationErr.message,
                code: validationErr.code || 'INVALID_BIRTHDATE',
            });
        }

        const result = await pool.query(
            `UPDATE nl_doctores SET
                nombres=COALESCE($1, nombres),
                apellido_paterno=COALESCE($2, apellido_paterno),
                apellido_materno=COALESCE($3, apellido_materno),
                nombre_completo=COALESCE($4, nombre_completo),
                cop=COALESCE($5, cop),
                email=COALESCE($6, email),
                telefono=COALESCE($7, telefono),
                fecha_nacimiento=CASE
                    WHEN $9::boolean THEN $8::date
                    ELSE fecha_nacimiento
                END
             WHERE id=$10 RETURNING *`,
            [
                nombres,
                apellido_paterno,
                apellido_materno,
                nombre_completo,
                cop,
                email,
                telefono,
                fechaNacimiento ?? null,
                Object.prototype.hasOwnProperty.call(req.body, 'fecha_nacimiento'),
                req.params.id,
            ]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// POST /api/doctores/:id/clinicas — replace clinic associations
router.post('/:id/clinicas', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { clinicaIds } = req.body;
        if (!Array.isArray(clinicaIds)) {
            return res.status(400).json({ error: 'clinicaIds debe ser un arreglo' });
        }
        const doctorId = Number(req.params.id);
        const check = await pool.query('SELECT id FROM nl_doctores WHERE id = $1', [doctorId]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });

        await associateClinics(pool, doctorId, clinicaIds, { replace: true });
        res.json({ message: 'Asociaciones actualizadas', clinicaIds });
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
