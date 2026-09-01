const normalizedName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const normalizedPhone = (value) => String(value || '').replace(/\D/g, '') || null;

export const withClinicTransaction = async (pool, callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
};

export const ensureClinicEstablishment = async (client, clinic, crm = {}, actorUserId = null) => {
    const existingId = clinic.establecimiento_id;
    if (existingId) {
        const updated = await client.query(
            `UPDATE nl_crm_establecimientos SET
               nombre=$1,nombre_normalizado=$2,tipo=COALESCE($3,tipo),telefono=$4,telefono_normalizado=$5,
               email=$6,direccion=$7,latitud=COALESCE($8,latitud),longitud=COALESCE($9,longitud),
               responsable_id=COALESCE(responsable_id, $10),etapa='convertido',activo=$11
             WHERE id=$12 RETURNING *`,
            [clinic.nombre,normalizedName(clinic.nombre),crm.tipo || 'clinica',clinic.telefono || null,normalizedPhone(clinic.telefono),
             clinic.email || null,clinic.direccion || null,crm.latitud ?? null,crm.longitud ?? null,
             crm.responsable_id || null,clinic.estado !== 'inactivo',existingId]
        );
        return updated.rows[0];
    }
    const inserted = await client.query(
        `INSERT INTO nl_crm_establecimientos
         (nombre,nombre_normalizado,tipo,telefono,telefono_normalizado,email,direccion,latitud,longitud,origen,origen_id,responsable_id,etapa,activo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'convertido',$13) RETURNING *`,
        [clinic.nombre,normalizedName(clinic.nombre),crm.tipo || 'clinica',clinic.telefono || null,normalizedPhone(clinic.telefono),
         clinic.email || null,clinic.direccion || null,crm.latitud ?? null,crm.longitud ?? null,
         crm.origen || 'manual',crm.origen_id || `clinica:${clinic.id}`,crm.responsable_id || actorUserId,clinic.estado !== 'inactivo']
    );
    await client.query('UPDATE nl_clinicas SET establecimiento_id=$1 WHERE id=$2', [inserted.rows[0].id,clinic.id]);
    return inserted.rows[0];
};

export const validateAndPersistClinicContact = async (client, {
    clinicId,
    phone,
    principalDoctorId = null,
    doctorIds = []
}) => {
    const ids = [...new Set((Array.isArray(doctorIds) ? doctorIds : []).map(Number).filter(Number.isInteger))];
    const principalId = principalDoctorId ? Number(principalDoctorId) : null;
    if (principalId && !ids.includes(principalId)) ids.push(principalId);

    for (const doctorId of ids) {
        const doctor = await client.query(`SELECT id FROM nl_doctores WHERE id=$1 AND estado='activo'`, [doctorId]);
        if (!doctor.rows[0]) throw Object.assign(new Error(`Doctor ${doctorId} no encontrado o inactivo`), { status: 400, code: 'INVALID_DOCTOR' });
        await client.query(
            `INSERT INTO nl_clinica_doctores (clinica_id,doctor_id,es_principal) VALUES ($1,$2,FALSE)
             ON CONFLICT (clinica_id,doctor_id) DO NOTHING`,
            [clinicId,doctorId]
        );
    }

    if (principalId) {
        const belongs = await client.query(
            `SELECT d.id,d.telefono FROM nl_clinica_doctores cd JOIN nl_doctores d ON d.id=cd.doctor_id
             WHERE cd.clinica_id=$1 AND cd.doctor_id=$2 AND d.estado='activo'`,
            [clinicId,principalId]
        );
        if (!belongs.rows[0]) throw Object.assign(new Error('El doctor principal debe pertenecer a la clínica'), { status: 400, code: 'PRINCIPAL_NOT_ASSOCIATED' });
        await client.query(`UPDATE nl_clinica_doctores SET es_principal=(doctor_id=$2) WHERE clinica_id=$1`, [clinicId,principalId]);
    }

    if (!String(phone || '').trim()) {
        const linkedPhone = await client.query(
            `SELECT d.id FROM nl_clinica_doctores cd JOIN nl_doctores d ON d.id=cd.doctor_id
             WHERE cd.clinica_id=$1 AND d.estado='activo' AND NULLIF(BTRIM(d.telefono),'') IS NOT NULL LIMIT 1`,
            [clinicId]
        );
        if (!linkedPhone.rows[0]) throw Object.assign(new Error('Se requiere teléfono de clínica o de un doctor vinculado'), { status: 400, code: 'CONTACT_REQUIRED' });
    }

    await client.query('UPDATE nl_clinicas SET doctor_contacto_principal_id=$1 WHERE id=$2', [principalId,clinicId]);
};
