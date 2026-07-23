import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { apisperuIdentityAdapter } from '../infrastructure/identity/apisperuIdentityAdapter.js';
import { logger } from '../lib/logger.js';

const router = Router();
router.use(authenticateToken);

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
        const { dni, cop, email, telefono, clinicaIds } = req.body;

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
                    validado_externo_at=NOW()
                 WHERE dni=$8 RETURNING *`,
                [identity.nombres, identity.apellidoPaterno, identity.apellidoMaterno, identity.fullName,
                 cop || null, email || null, telefono || null, dni]
            );
            doctor = upd.rows[0];
            created = false;
        } else {
            let ins;
            try {
                ins = await pool.query(
                    `INSERT INTO nl_doctores (dni, nombres, apellido_paterno, apellido_materno, nombre_completo, cop, email, telefono, validado_externo_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
                    [dni, identity.nombres, identity.apellidoPaterno, identity.apellidoMaterno, identity.fullName,
                     cop || null, email || null, telefono || null]
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
        const { nombres, apellido_paterno, apellido_materno, nombre_completo, cop, email, telefono } = req.body;
        const result = await pool.query(
            `UPDATE nl_doctores SET
                nombres=COALESCE($1, nombres),
                apellido_paterno=COALESCE($2, apellido_paterno),
                apellido_materno=COALESCE($3, apellido_materno),
                nombre_completo=COALESCE($4, nombre_completo),
                cop=COALESCE($5, cop),
                email=COALESCE($6, email),
                telefono=COALESCE($7, telefono)
             WHERE id=$8 RETURNING *`,
            [nombres, apellido_paterno, apellido_materno, nombre_completo, cop, email, telefono, req.params.id]
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
