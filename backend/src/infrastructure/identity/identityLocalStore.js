/**
 * Almacén local de identidades DNI/RUC (fallback cuando RENIEC/SUNAT no responde datos).
 */
export function rowToIdentity(row) {
    if (!row) return null;
    const isDni = row.document_type === '1';
    if (isDni) {
        return {
            documentType: '1',
            documentNumber: row.document_number,
            nombres: row.nombres || '',
            apellidoPaterno: row.apellido_paterno || '',
            apellidoMaterno: row.apellido_materno || '',
            fullName: row.full_name,
            direccion: row.direccion || null,
            ubigeo: row.ubigeo || null,
            source: 'local',
            notInReniec: row.not_in_reniec !== false,
        };
    }
    return {
        documentType: '6',
        documentNumber: row.document_number,
        razonSocial: row.full_name,
        nombreComercial: null,
        estado: null,
        condicion: null,
        direccion: row.direccion || null,
        ubigeo: row.ubigeo || null,
        departamento: null,
        provincia: null,
        distrito: null,
        isActiveHabido: null,
        source: 'local',
        notInReniec: row.not_in_reniec !== false,
    };
}

export async function findIdentityOverride(pool, documentType, documentNumber) {
    const { rows } = await pool.query(
        `SELECT * FROM nl_identity_overrides
         WHERE document_type = $1 AND document_number = $2
         LIMIT 1`,
        [documentType, String(documentNumber)]
    );
    return rowToIdentity(rows[0]);
}

/**
 * Upsert de identidad local. fullName obligatorio.
 */
export async function upsertIdentityOverride(pool, {
    documentType,
    documentNumber,
    fullName,
    nombres = null,
    apellidoPaterno = null,
    apellidoMaterno = null,
    direccion = null,
    ubigeo = null,
    source = 'manual',
    notInReniec = true,
    createdBy = null,
}) {
    const tipo = String(documentType);
    const numero = String(documentNumber || '').replace(/\D/g, '');
    const nombre = String(fullName || '').trim();
    if (!['1', '6'].includes(tipo) || !numero || !nombre) {
        return null;
    }
    if (tipo === '1' && numero.length !== 8) return null;
    if (tipo === '6' && numero.length !== 11) return null;

    const { rows } = await pool.query(
        `INSERT INTO nl_identity_overrides (
            document_type, document_number, full_name,
            nombres, apellido_paterno, apellido_materno,
            direccion, ubigeo, source, not_in_reniec, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (document_type, document_number) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            nombres = COALESCE(EXCLUDED.nombres, nl_identity_overrides.nombres),
            apellido_paterno = COALESCE(EXCLUDED.apellido_paterno, nl_identity_overrides.apellido_paterno),
            apellido_materno = COALESCE(EXCLUDED.apellido_materno, nl_identity_overrides.apellido_materno),
            direccion = COALESCE(EXCLUDED.direccion, nl_identity_overrides.direccion),
            ubigeo = COALESCE(EXCLUDED.ubigeo, nl_identity_overrides.ubigeo),
            source = EXCLUDED.source,
            not_in_reniec = EXCLUDED.not_in_reniec,
            updated_at = NOW()
         RETURNING *`,
        [
            tipo,
            numero,
            nombre,
            nombres,
            apellidoPaterno,
            apellidoMaterno,
            direccion,
            ubigeo,
            source,
            Boolean(notInReniec),
            createdBy,
        ]
    );
    return rowToIdentity(rows[0]);
}

export function clientToOverridePayload(client = {}, { notInReniec = true, source = 'manual', createdBy = null } = {}) {
    const numDoc = String(client.numDoc || client.documentNumber || '').replace(/\D/g, '');
    const tipoDoc = String(client.tipoDoc || (numDoc.length === 11 ? '6' : '1'));
    const fullName = String(client.rznSocial || client.razonSocial || client.fullName || '').trim();
    return {
        documentType: tipoDoc,
        documentNumber: numDoc,
        fullName,
        direccion: client.direccion || null,
        ubigeo: client.ubigeo || null,
        source,
        notInReniec,
        createdBy,
    };
}
