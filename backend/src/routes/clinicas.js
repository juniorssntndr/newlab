import { Router } from 'express';
import { authenticateToken, forbidRole, requireRole } from '../middleware/auth.js';
import { apisperuIdentityAdapter } from '../infrastructure/identity/apisperuIdentityAdapter.js';
import { logger } from '../lib/logger.js';
import { ensureClinicEstablishment, validateAndPersistClinicContact, withClinicTransaction } from '../modules/crm/application/services/clinicCrmIntegration.js';

const router = Router();
router.use(authenticateToken);
router.use(forbidRole('visitador'));

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

// POST /api/clinicas/preview-ruc — lookup RUC and return proposal without saving
// Must be registered BEFORE /:id
router.post('/preview-ruc', requireRole('admin', 'operador', 'tecnico'), async (req, res) => {
    const { ruc } = req.body;
    if (!ruc || !/^\d{11}$/.test(String(ruc))) {
        return res.status(400).json({ error: 'El RUC debe tener exactamente 11 dígitos numéricos', code: 'INVALID_DOCUMENT' });
    }
    try {
        const identity = await apisperuIdentityAdapter.lookupRuc(String(ruc));
        const userId = req.user?.id;
        logger.info('clinicas.preview_ruc', { userId, last4: ruc.slice(-4), isActiveHabido: identity.isActiveHabido });
        res.json({
            proposal: {
                ruc: identity.documentNumber,
                nombre: identity.razonSocial,
                razon_social: identity.razonSocial,
                nombre_comercial: identity.nombreComercial,
                estado_ruc: identity.estado,
                condicion_ruc: identity.condicion,
                direccion: identity.direccion,
                departamento: identity.departamento,
                provincia: identity.provincia,
                distrito: identity.distrito,
            },
            warnings: identity.isActiveHabido ? [] : ['RUC_NOT_ACTIVE'],
            isActiveHabido: identity.isActiveHabido,
        });
    } catch (err) {
        const code = err.code || 'QUOTA_OR_PROVIDER_ERROR';
        const statusMap = { DOCUMENT_NOT_FOUND: 404, INVALID_DOCUMENT: 400, TOKEN_MISSING: 500, QUOTA_OR_PROVIDER_ERROR: 503 };
        res.status(statusMap[code] || 500).json({ error: err.message, code });
    }
});

// POST /api/clinicas/confirm — create or update clinic from validated RUC data
// Must be registered BEFORE /:id
router.post('/confirm', requireRole('admin', 'operador', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { ruc, overrides = {} } = req.body;

        if (!ruc || !/^\d{11}$/.test(String(ruc))) {
            return res.status(400).json({ error: 'El RUC debe tener exactamente 11 dígitos numéricos', code: 'INVALID_DOCUMENT' });
        }

        let identity;
        try {
            identity = await apisperuIdentityAdapter.lookupRuc(String(ruc));
        } catch (err) {
            const code = err.code || 'QUOTA_OR_PROVIDER_ERROR';
            const statusMap = { DOCUMENT_NOT_FOUND: 404, INVALID_DOCUMENT: 400, TOKEN_MISSING: 500, QUOTA_OR_PROVIDER_ERROR: 503 };
            return res.status(statusMap[code] || 500).json({ error: err.message, code });
        }

        const nombre = overrides.nombre || identity.razonSocial;
        const nombre_comercial = overrides.nombre_comercial !== undefined ? overrides.nombre_comercial : identity.nombreComercial;
        const email = overrides.email || null;
        const telefono = overrides.telefono || null;
        const contacto_nombre = overrides.contacto_nombre || null;
        const lista_precios_id = overrides.lista_precios_id || null;

        try {
            const outcome = await withClinicTransaction(pool, async (client) => {
                const existing = await client.query('SELECT * FROM nl_clinicas WHERE ruc=$1 FOR UPDATE', [ruc]);
                let clinic; let created = false;
                if (existing.rows[0]) {
                    const updated = await client.query(
                        `UPDATE nl_clinicas SET nombre=$1,razon_social=$2,nombre_comercial=$3,estado_ruc=$4,condicion_ruc=$5,
                         direccion=$6,departamento=$7,provincia=$8,distrito=$9,ubigeo=COALESCE($10,ubigeo),validado_externo_at=NOW(),
                         email=COALESCE($11,email),telefono=COALESCE($12,telefono),contacto_nombre=COALESCE($13,contacto_nombre),
                         lista_precios_id=COALESCE($14,lista_precios_id),tipo_doc='6',dni=NULL WHERE ruc=$15 RETURNING *`,
                        [nombre,identity.razonSocial,nombre_comercial,identity.estado,identity.condicion,identity.direccion,
                         identity.departamento,identity.provincia,identity.distrito,identity.ubigeo,email,telefono,contacto_nombre,lista_precios_id,ruc]
                    );
                    clinic = updated.rows[0];
                } else {
                    const inserted = await client.query(
                        `INSERT INTO nl_clinicas
                         (nombre,razon_social,ruc,nombre_comercial,tipo_doc,estado_ruc,condicion_ruc,direccion,departamento,provincia,distrito,ubigeo,validado_externo_at,email,telefono,contacto_nombre,lista_precios_id)
                         VALUES ($1,$2,$3,$4,'6',$5,$6,$7,$8,$9,$10,$11,NOW(),$12,$13,$14,$15) RETURNING *`,
                        [nombre,identity.razonSocial,ruc,nombre_comercial,identity.estado,identity.condicion,identity.direccion,
                         identity.departamento,identity.provincia,identity.distrito,identity.ubigeo,email,telefono,contacto_nombre,lista_precios_id]
                    );
                    clinic = inserted.rows[0]; created = true;
                }
                const principal = overrides.doctor_contacto_principal_id !== undefined
                    ? overrides.doctor_contacto_principal_id
                    : clinic.doctor_contacto_principal_id;
                await validateAndPersistClinicContact(client, {
                    clinicId: clinic.id,
                    phone: clinic.telefono,
                    principalDoctorId: principal,
                    doctorIds: overrides.doctor_ids || []
                });
                const establishment = await ensureClinicEstablishment(client, clinic, overrides.crm || {}, req.user?.id);
                return { clinic: { ...clinic, establecimiento_id: establishment.id, doctor_contacto_principal_id: principal || null }, created };
            });
            logger.info(outcome.created ? 'clinicas.confirm.created' : 'clinicas.confirm.updated', { userId: req.user?.id, ruc: ruc.slice(-4), id: outcome.clinic.id });
            return res.status(outcome.created ? 201 : 200).json({ clinica: outcome.clinic, created: outcome.created, warnings: identity.isActiveHabido ? [] : ['RUC_NOT_ACTIVE'] });
        } catch (dbErr) {
            if (dbErr.code === '23505') {
                return res.status(409).json({ error: 'Ya existe una clínica con ese RUC', code: 'DUPLICATE_RUC' });
            }
            throw dbErr;
        }
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
router.post('/', requireRole('admin', 'operador', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const {
            nombre, razon_social, ruc, dni, email, telefono, direccion, contacto_nombre,
            nombre_comercial, estado_ruc, condicion_ruc, departamento, provincia, distrito,
            doctor_contacto_principal_id, doctor_ids = [], crm = {},
        } = req.body;
        if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });
        if (ruc && !/^\d{11}$/.test(String(ruc))) {
            return res.status(400).json({ error: 'El RUC debe tener exactamente 11 dígitos numéricos', code: 'INVALID_DOCUMENT' });
        }

        try {
            const result = await withClinicTransaction(pool, async (client) => {
                const inserted = await client.query(
                    `INSERT INTO nl_clinicas
                        (nombre, razon_social, ruc, dni, email, telefono, direccion, contacto_nombre,
                         nombre_comercial, estado_ruc, condicion_ruc, departamento, provincia, distrito)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
                    [nombre, razon_social, ruc || null, dni || null, email || null, telefono || null, direccion || null, contacto_nombre || null,
                     nombre_comercial || null, estado_ruc || null, condicion_ruc || null, departamento || null, provincia || null, distrito || null]
                );
                await validateAndPersistClinicContact(client, {
                    clinicId: inserted.rows[0].id,
                    phone: telefono,
                    principalDoctorId: doctor_contacto_principal_id,
                    doctorIds: doctor_ids
                });
                const establishment = await ensureClinicEstablishment(client, inserted.rows[0], crm, req.user?.id);
                return { ...inserted.rows[0], establecimiento_id: establishment.id, doctor_contacto_principal_id: doctor_contacto_principal_id || null };
            });
            return res.status(201).json(result);
        } catch (dbErr) {
            if (dbErr.code === '23505') {
                return res.status(409).json({ error: 'Ya existe una clínica con ese RUC', code: 'DUPLICATE_RUC' });
            }
            throw dbErr;
        }
    } catch (err) { next(err); }
});

// PUT /api/clinicas/:id
router.put('/:id', requireRole('admin', 'operador', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const {
            nombre, razon_social, ruc, dni, email, telefono, direccion, contacto_nombre, estado, lista_precios_id,
            nombre_comercial, estado_ruc, condicion_ruc, departamento, provincia, distrito,
            doctor_contacto_principal_id, doctor_ids, crm = {},
        } = req.body;

        if (ruc && !/^\d{11}$/.test(String(ruc))) {
            return res.status(400).json({ error: 'El RUC debe tener exactamente 11 dígitos numéricos', code: 'INVALID_DOCUMENT' });
        }

        try {
            const result = await withClinicTransaction(pool, async (client) => {
                const current = await client.query('SELECT * FROM nl_clinicas WHERE id=$1 FOR UPDATE', [req.params.id]);
                if (!current.rows[0]) return null;
                const updated = await client.query(
                    `UPDATE nl_clinicas SET
                        nombre=$1, razon_social=$2, ruc=$3, dni=$4, email=$5, telefono=$6,
                        direccion=$7, contacto_nombre=$8, estado=COALESCE($9, estado), lista_precios_id=$10,
                        nombre_comercial=$11, estado_ruc=$12, condicion_ruc=$13,
                        departamento=$14, provincia=$15, distrito=$16
                     WHERE id=$17 RETURNING *`,
                    [nombre, razon_social, ruc || null, dni || null, email || null, telefono || null, direccion || null, contacto_nombre || null,
                     estado, lista_precios_id, nombre_comercial, estado_ruc, condicion_ruc,
                     departamento, provincia, distrito, req.params.id]
                );
                const principal = doctor_contacto_principal_id !== undefined
                    ? doctor_contacto_principal_id
                    : current.rows[0].doctor_contacto_principal_id;
                await validateAndPersistClinicContact(client, {
                    clinicId: updated.rows[0].id,
                    phone: updated.rows[0].telefono,
                    principalDoctorId: principal,
                    doctorIds: doctor_ids || []
                });
                const establishment = await ensureClinicEstablishment(client, updated.rows[0], crm, req.user?.id);
                return { ...updated.rows[0], establecimiento_id: establishment.id, doctor_contacto_principal_id: principal || null };
            });
            if (!result) return res.status(404).json({ error: 'Clínica no encontrada' });
            return res.json(result);
        } catch (dbErr) {
            if (dbErr.code === '23505') {
                return res.status(409).json({ error: 'Ya existe una clínica con ese RUC', code: 'DUPLICATE_RUC' });
            }
            throw dbErr;
        }
    } catch (err) { next(err); }
});

// DELETE /api/clinicas/:id  (soft delete)
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        await pool.query('UPDATE nl_clinicas SET estado = $1 WHERE id = $2', ['inactivo', req.params.id]);
        res.json({ message: 'Clínica desactivada' });
    } catch (err) { next(err); }
});

export default router;
