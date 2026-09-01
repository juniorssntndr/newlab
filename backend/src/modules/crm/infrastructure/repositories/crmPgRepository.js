const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const accessSql = (user, params, alias = 'e') => {
    if (user?.tipo !== 'visitador') return '';
    params.push(user.id);
    return ` AND ${alias}.responsable_id = $${params.length}`;
};

const healthSelect = `
    order_stats.last_order_date,
    COALESCE(order_stats.order_count, 0)::int AS order_count,
    COALESCE(complaint_stats.open_complaints, 0)::int AS open_complaints,
    CASE
      WHEN order_stats.last_order_date IS NULL THEN NULL
      WHEN ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - order_stats.last_order_date) >= 60 THEN 'rojo'
      WHEN ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - order_stats.last_order_date) >= 30 THEN 'amarillo'
      ELSE 'verde'
    END AS salud_comercial,
    CASE
      WHEN COALESCE(complaint_stats.open_complaints, 0) > 0 THEN 'rojo'
      WHEN order_stats.last_order_date IS NULL THEN NULL
      WHEN ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - order_stats.last_order_date) >= 60 THEN 'rojo'
      WHEN ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - order_stats.last_order_date) >= 30 THEN 'amarillo'
      ELSE 'verde'
    END AS prioridad_visible,
    CASE WHEN order_stats.last_order_date IS NULL THEN NULL
      ELSE ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - order_stats.last_order_date)
    END::int AS dias_sin_pedido`;

const healthJoins = `
    LEFT JOIN LATERAL (
      SELECT MAX(p.fecha) FILTER (WHERE p.estado <> 'cancelado') AS last_order_date,
             COUNT(*) FILTER (WHERE p.estado <> 'cancelado') AS order_count
      FROM nl_pedidos p WHERE p.clinica_id = c.id
    ) order_stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS open_complaints
      FROM nl_crm_reclamos r WHERE r.establecimiento_id = e.id AND r.estado = 'abierto'
    ) complaint_stats ON TRUE`;

const withClient = async (pool, callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const findDuplicate = async (client, row) => {
    if (row.origen_id) {
        const exact = await client.query(
            `SELECT id, nombre, 'origen_id' AS criterio
             FROM nl_crm_establecimientos
             WHERE origen = $1 AND origen_id = $2 LIMIT 1`,
            [row.origen, row.origen_id]
        );
        if (exact.rows[0]) return exact.rows[0];
    }

    const params = [row.nombre_normalizado, row.telefono_normalizado || null];
    let geo = '';
    if (row.latitud != null && row.longitud != null) {
        params.push(row.latitud, row.longitud);
        geo = ` AND e.latitud IS NOT NULL AND e.longitud IS NOT NULL
          AND 6371000 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(e.latitud - $3) / 2), 2) +
            COS(RADIANS($3)) * COS(RADIANS(e.latitud)) * POWER(SIN(RADIANS(e.longitud - $4) / 2), 2)
          )) <= 150`;
    } else {
        geo = ' AND e.latitud IS NULL AND e.longitud IS NULL';
    }

    const fallback = await client.query(
        `SELECT e.id, e.nombre, 'nombre_telefono_ubicacion' AS criterio
         FROM nl_crm_establecimientos e
         WHERE e.nombre_normalizado = $1
           AND ($2::text IS NULL OR e.telefono_normalizado = $2)
           ${geo}
         ORDER BY e.id LIMIT 1`,
        params
    );
    return fallback.rows[0] || null;
};

const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const findBatchDuplicate = (seenValidBatch, row) => {
    if (row.origen_id) {
        const exact = seenValidBatch.find(
            (item) => item.origen === row.origen && item.origen_id === row.origen_id
        );
        if (exact) {
            return {
                id: null,
                nombre: exact.nombre,
                criterio: 'origen_id_lote',
                numero_fila_duplicada: exact.rowNumber,
            };
        }
    }

    const fallback = seenValidBatch.find((item) => {
        if (item.nombre_normalizado !== row.nombre_normalizado) return false;
        if (row.telefono_normalizado && item.telefono_normalizado && item.telefono_normalizado !== row.telefono_normalizado) {
            return false;
        }
        const hasGeoRow = row.latitud != null && row.longitud != null;
        const hasGeoItem = item.latitud != null && item.longitud != null;
        if (hasGeoRow && hasGeoItem) {
            return haversineMeters(Number(item.latitud), Number(item.longitud), Number(row.latitud), Number(row.longitud)) <= 150;
        }
        if (!hasGeoRow && !hasGeoItem) {
            return true;
        }
        return false;
    });

    if (fallback) {
        return {
            id: null,
            nombre: fallback.nombre,
            criterio: 'nombre_telefono_ubicacion_lote',
            numero_fila_duplicada: fallback.rowNumber,
        };
    }

    return null;
};

export const makeCrmPgRepository = ({ pool }) => ({
    getSummary: async ({ user }) => {
        const params = [];
        const access = accessSql(user, params);
        const result = await pool.query(
            `WITH base AS (
               SELECT e.id, e.etapa, ${healthSelect}
               FROM nl_crm_establecimientos e
               LEFT JOIN nl_clinicas c ON c.establecimiento_id = e.id
               ${healthJoins}
               WHERE e.activo = TRUE ${access}
             ), visits AS (
               SELECT
                 COUNT(*) FILTER (WHERE v.estado IN ('programada','reprogramada') AND (v.programada_para AT TIME ZONE 'America/Lima')::date < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date)::int AS vencidas,
                 COUNT(*) FILTER (WHERE v.estado IN ('programada','reprogramada') AND (v.programada_para AT TIME ZONE 'America/Lima')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date)::int AS hoy
               FROM nl_crm_visitas v
               JOIN nl_crm_establecimientos e ON e.id = v.establecimiento_id
               WHERE TRUE ${accessSql(user, params, 'e')}
             )
             SELECT
               COUNT(*) FILTER (WHERE salud_comercial = 'verde')::int AS verdes,
               COUNT(*) FILTER (WHERE salud_comercial = 'amarillo')::int AS amarillos,
               COUNT(*) FILTER (WHERE salud_comercial = 'rojo')::int AS rojos,
               COALESCE(SUM(open_complaints), 0)::int AS reclamos_abiertos,
               COUNT(*) FILTER (WHERE etapa = 'nuevo')::int AS prospectos_nuevos,
               COUNT(*) FILTER (WHERE etapa = 'contactado')::int AS prospectos_contactados,
               COUNT(*) FILTER (WHERE etapa = 'visita_programada')::int AS prospectos_visita_programada,
               COUNT(*) FILTER (WHERE etapa = 'visitado')::int AS prospectos_visitados,
               COUNT(*) FILTER (WHERE etapa = 'convertido')::int AS convertidos,
               (SELECT vencidas FROM visits) AS visitas_vencidas,
               (SELECT hoy FROM visits) AS visitas_hoy
             FROM base`,
            params
        );
        return result.rows[0];
    },

    listEstablishments: async ({ user, filters }) => {
        const params = [];
        let where = 'WHERE e.activo = TRUE';
        where += accessSql(user, params);
        const add = (value, sql) => {
            if (value === undefined || value === null || value === '') return;
            params.push(value);
            where += sql(params.length);
        };
        add(filters.etapa, (n) => ` AND e.etapa = $${n}`);
        add(filters.tipo, (n) => ` AND e.tipo = $${n}`);
        add(filters.responsable_id, (n) => ` AND e.responsable_id = $${n}`);
        add(filters.search, (n) => ` AND (e.nombre ILIKE '%' || $${n} || '%' OR e.telefono ILIKE '%' || $${n} || '%' OR e.direccion ILIKE '%' || $${n} || '%')`);
        add(filters.salud, (n) => ` AND CASE
          WHEN order_stats.last_order_date IS NULL THEN NULL
          WHEN ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - order_stats.last_order_date) >= 60 THEN 'rojo'
          WHEN ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - order_stats.last_order_date) >= 30 THEN 'amarillo'
          ELSE 'verde' END = $${n}`);

        const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
        const page = Math.max(Number(filters.page) || 1, 1);
        params.push(limit, (page - 1) * limit);
        const result = await pool.query(
            `SELECT e.*, c.id AS clinica_id, c.doctor_contacto_principal_id,
                    u.nombre AS responsable_nombre,
                    ${healthSelect},
                    last_visit.last_visit_at, next_visit.next_visit_at,
                    COUNT(*) OVER()::int AS total_count
             FROM nl_crm_establecimientos e
             LEFT JOIN nl_clinicas c ON c.establecimiento_id = e.id
             LEFT JOIN nl_usuarios u ON u.id = e.responsable_id
             ${healthJoins}
             LEFT JOIN LATERAL (
               SELECT MAX(COALESCE(v.completada_at, v.programada_para)) AS last_visit_at
               FROM nl_crm_visitas v
               WHERE v.establecimiento_id = e.id AND v.estado IN ('completada','sin_contacto')
             ) last_visit ON TRUE
             LEFT JOIN LATERAL (
               SELECT MIN(v.programada_para) AS next_visit_at
               FROM nl_crm_visitas v
               WHERE v.establecimiento_id = e.id AND v.estado IN ('programada','reprogramada')
             ) next_visit ON TRUE
             ${where}
             ORDER BY CASE
               WHEN COALESCE(complaint_stats.open_complaints, 0) > 0 THEN 0
               WHEN order_stats.last_order_date IS NOT NULL AND ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - order_stats.last_order_date) >= 60 THEN 1
               WHEN order_stats.last_order_date IS NOT NULL AND ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date - order_stats.last_order_date) >= 30 THEN 2
               ELSE 3 END, e.nombre
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        const total = result.rows[0]?.total_count || 0;
        return { rows: result.rows.map(({ total_count, ...row }) => row), total, page, limit };
    },

    getEstablishment: async ({ id, user }) => {
        const params = [id];
        const access = accessSql(user, params);
        const base = await pool.query(
            `SELECT e.*, c.id AS clinica_id, c.nombre AS clinica_nombre, c.ruc, c.dni,
                    c.doctor_contacto_principal_id, u.nombre AS responsable_nombre,
                    ${healthSelect}, last_visit.last_visit_at, next_visit.next_visit_at
             FROM nl_crm_establecimientos e
             LEFT JOIN nl_clinicas c ON c.establecimiento_id = e.id
             LEFT JOIN nl_usuarios u ON u.id = e.responsable_id
             ${healthJoins}
             LEFT JOIN LATERAL (SELECT MAX(COALESCE(v.completada_at, v.programada_para)) AS last_visit_at FROM nl_crm_visitas v WHERE v.establecimiento_id=e.id AND v.estado IN ('completada','sin_contacto')) last_visit ON TRUE
             LEFT JOIN LATERAL (SELECT MIN(v.programada_para) AS next_visit_at FROM nl_crm_visitas v WHERE v.establecimiento_id=e.id AND v.estado IN ('programada','reprogramada')) next_visit ON TRUE
             WHERE e.id = $1 AND e.activo = TRUE ${access}`,
            params
        );
        if (!base.rows[0]) return null;
        const [doctors, complaints, visits] = await Promise.all([
            base.rows[0].clinica_id ? pool.query(
                `SELECT d.id, d.nombre_completo, d.especialidad, d.cop, d.telefono, d.email, d.fecha_nacimiento, cd.es_principal
                 FROM nl_clinica_doctores cd JOIN nl_doctores d ON d.id=cd.doctor_id
                 WHERE cd.clinica_id=$1 AND d.estado='activo' ORDER BY cd.es_principal DESC, d.nombre_completo`,
                [base.rows[0].clinica_id]
            ) : { rows: [] },
            pool.query(`SELECT r.*, uc.nombre AS creado_por_nombre, ur.nombre AS resuelto_por_nombre FROM nl_crm_reclamos r LEFT JOIN nl_usuarios uc ON uc.id=r.creado_por LEFT JOIN nl_usuarios ur ON ur.id=r.resuelto_por WHERE r.establecimiento_id=$1 ORDER BY r.created_at DESC LIMIT 50`, [id]),
            pool.query(
                `SELECT v.*, u.nombre AS responsable_nombre FROM nl_crm_visitas v LEFT JOIN nl_usuarios u ON u.id=v.responsable_id
                 WHERE v.establecimiento_id=$1 ${user?.tipo === 'visitador' ? 'AND v.responsable_id=$2' : ''}
                 ORDER BY COALESCE(v.programada_para,v.created_at) DESC LIMIT 100`,
                user?.tipo === 'visitador' ? [id,user.id] : [id]
            )
        ]);
        return { ...base.rows[0], doctores: doctors.rows, reclamos: complaints.rows, visitas: visits.rows };
    },

    createEstablishment: async ({ input, actorUserId }) => {
        const result = await pool.query(
            `INSERT INTO nl_crm_establecimientos
             (nombre,nombre_normalizado,tipo,telefono,telefono_normalizado,email,direccion,latitud,longitud,origen,origen_id,responsable_id,etapa,notas)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [input.nombre, normalizeName(input.nombre), input.tipo, input.telefono, normalizePhone(input.telefono) || null,
             input.email, input.direccion, input.latitud, input.longitud, input.origen || 'manual', input.origen_id,
             input.responsable_id ?? actorUserId, input.etapa || 'nuevo', input.notas]
        );
        return result.rows[0];
    },

    updateEstablishment: async ({ id, input, user }) => {
        const allowed = ['nombre','tipo','telefono','email','direccion','latitud','longitud','origen_id','responsable_id','etapa','activo','notas'];
        const updates = [];
        const params = [];
        for (const key of allowed) {
            if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
            params.push(input[key]);
            updates.push(`${key}=$${params.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(input, 'nombre')) {
            params.push(normalizeName(input.nombre)); updates.push(`nombre_normalizado=$${params.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(input, 'telefono')) {
            params.push(normalizePhone(input.telefono) || null); updates.push(`telefono_normalizado=$${params.length}`);
        }
        if (!updates.length) return null;
        params.push(id);
        let where = `id=$${params.length}`;
        where += accessSql(user, params);
        const result = await pool.query(`UPDATE nl_crm_establecimientos e SET ${updates.join(', ')} WHERE ${where} RETURNING e.*`, params);
        return result.rows[0] || null;
    },

    assignEstablishment: async ({ id, responsableId }) => {
        const responsible = await pool.query(`SELECT id FROM nl_usuarios WHERE id=$1 AND estado='activo' AND tipo IN ('admin','tecnico','visitador')`, [responsableId]);
        if (!responsible.rows[0]) return { invalidResponsible: true };
        const result = await pool.query(
            `UPDATE nl_crm_establecimientos SET responsable_id=$1 WHERE id=$2 AND activo=TRUE RETURNING *`,
            [responsableId, id]
        );
        return result.rows[0] || null;
    },

    convertEstablishment: async ({ id, input, user }) => withClient(pool, async (client) => {
        const params = [id];
        let access = '';
        if (user?.tipo === 'visitador') { params.push(user.id); access = ` AND responsable_id=$2`; }
        const locked = await client.query(`SELECT * FROM nl_crm_establecimientos WHERE id=$1 AND activo=TRUE ${access} FOR UPDATE`, params);
        const establishment = locked.rows[0];
        if (!establishment) return { notFound: true };
        const existing = await client.query('SELECT * FROM nl_clinicas WHERE establecimiento_id=$1', [id]);
        if (existing.rows[0]) return { clinic: existing.rows[0], created: false };

        const doctorIds = [...new Set((input.doctor_ids || []).map(Number).filter(Number.isInteger))];
        const principalId = input.doctor_contacto_principal_id ? Number(input.doctor_contacto_principal_id) : null;
        if (principalId && !doctorIds.includes(principalId)) doctorIds.push(principalId);
        let principal = null;
        if (principalId) {
            const found = await client.query(`SELECT id, telefono FROM nl_doctores WHERE id=$1 AND estado='activo'`, [principalId]);
            principal = found.rows[0] || null;
            if (!principal) return { invalidPrincipal: true };
        }
        const contactPhone = input.telefono ?? establishment.telefono;
        if (!String(contactPhone || '').trim() && !String(principal?.telefono || '').trim()) return { missingContact: true };

        const inserted = await client.query(
            `INSERT INTO nl_clinicas
             (nombre,razon_social,ruc,dni,email,telefono,direccion,contacto_nombre,establecimiento_id,doctor_contacto_principal_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [input.nombre || establishment.nombre, input.razon_social || null, input.ruc || null, input.dni || null,
             input.email ?? establishment.email, contactPhone || null, input.direccion ?? establishment.direccion,
             input.contacto_nombre || null, id, principalId]
        );
        for (const doctorId of doctorIds) {
            await client.query(
                `INSERT INTO nl_clinica_doctores (clinica_id,doctor_id,es_principal) VALUES ($1,$2,$3)
                 ON CONFLICT (clinica_id,doctor_id) DO UPDATE SET es_principal=EXCLUDED.es_principal`,
                [inserted.rows[0].id, doctorId, doctorId === principalId]
            );
        }
        await client.query(`UPDATE nl_crm_establecimientos SET etapa='convertido', telefono=COALESCE($1,telefono), telefono_normalizado=COALESCE($2,telefono_normalizado) WHERE id=$3`, [contactPhone || null, normalizePhone(contactPhone) || null, id]);
        return { clinic: inserted.rows[0], created: true };
    }),

    listComplaints: async ({ user, filters }) => {
        const params = [];
        let where = 'WHERE 1=1';
        where += accessSql(user, params);
        if (filters.estado) { params.push(filters.estado); where += ` AND r.estado=$${params.length}`; }
        if (filters.establecimiento_id) { params.push(filters.establecimiento_id); where += ` AND r.establecimiento_id=$${params.length}`; }
        const result = await pool.query(
            `SELECT r.*, e.nombre AS establecimiento_nombre FROM nl_crm_reclamos r JOIN nl_crm_establecimientos e ON e.id=r.establecimiento_id ${where} ORDER BY r.created_at DESC`,
            params
        );
        return result.rows;
    },

    createComplaint: async ({ input, actorUserId, user }) => {
        const params = [input.establecimiento_id];
        const access = accessSql(user, params);
        const allowed = await pool.query(`SELECT e.id FROM nl_crm_establecimientos e WHERE e.id=$1 ${access}`, params);
        if (!allowed.rows[0]) return null;
        const result = await pool.query(
            `INSERT INTO nl_crm_reclamos (establecimiento_id,motivo,detalle,creado_por) VALUES ($1,$2,$3,$4) RETURNING *`,
            [input.establecimiento_id, input.motivo, input.detalle, actorUserId]
        );
        return result.rows[0];
    },

    updateComplaint: async ({ id, input, actorUserId, user }) => {
        const params = [];
        const updates = [];
        if (Object.prototype.hasOwnProperty.call(input, 'motivo')) { params.push(input.motivo); updates.push(`motivo=$${params.length}`); }
        if (Object.prototype.hasOwnProperty.call(input, 'detalle')) { params.push(input.detalle); updates.push(`detalle=$${params.length}`); }
        if (input.estado === 'resuelto') {
            params.push('resuelto', actorUserId);
            updates.push(`estado=$${params.length - 1}`, `resuelto_por=$${params.length}`, 'resuelto_at=NOW()');
        }
        if (!updates.length) return null;
        params.push(id);
        let where = `r.id=$${params.length}`;
        if (user?.tipo === 'visitador') { params.push(user.id); where += ` AND e.responsable_id=$${params.length}`; }
        const result = await pool.query(
            `UPDATE nl_crm_reclamos r SET ${updates.join(', ')} FROM nl_crm_establecimientos e WHERE r.establecimiento_id=e.id AND ${where} RETURNING r.*`,
            params
        );
        return result.rows[0] || null;
    },

    listVisits: async ({ user, filters }) => {
        const params = [];
        let where = 'WHERE 1=1';
        where += accessSql(user, params);
        if (user?.tipo === 'visitador') { params.push(user.id); where += ` AND v.responsable_id=$${params.length}`; }
        if (filters.estado) { params.push(filters.estado); where += ` AND v.estado=$${params.length}`; }
        if (filters.establecimiento_id) { params.push(filters.establecimiento_id); where += ` AND v.establecimiento_id=$${params.length}`; }
        if (filters.desde) { params.push(filters.desde); where += ` AND v.programada_para >= $${params.length}::timestamptz`; }
        if (filters.hasta) { params.push(filters.hasta); where += ` AND v.programada_para < ($${params.length}::date + 1)`; }
        const result = await pool.query(
            `SELECT v.*, e.nombre AS establecimiento_nombre, e.telefono, e.direccion, e.latitud, e.longitud, u.nombre AS responsable_nombre
             FROM nl_crm_visitas v JOIN nl_crm_establecimientos e ON e.id=v.establecimiento_id
             LEFT JOIN nl_usuarios u ON u.id=v.responsable_id ${where}
             ORDER BY v.programada_para ASC NULLS LAST, v.created_at DESC`,
            params
        );
        return result.rows;
    },

    getVisit: async ({ id, user }) => {
        const params = [id];
        let where = 'v.id=$1';
        if (user?.tipo === 'visitador') {
            params.push(user.id);
            where += ` AND v.responsable_id=$${params.length} AND e.responsable_id=$${params.length}`;
        }
        const result = await pool.query(
            `SELECT v.*, e.responsable_id AS establecimiento_responsable_id
             FROM nl_crm_visitas v JOIN nl_crm_establecimientos e ON e.id=v.establecimiento_id
             WHERE ${where}`,
            params
        );
        return result.rows[0] || null;
    },

    createVisit: async ({ input, actorUserId, user }) => {
        const params = [input.establecimiento_id];
        const access = accessSql(user, params);
        const establishment = await pool.query(`SELECT e.id,e.responsable_id FROM nl_crm_establecimientos e WHERE e.id=$1 ${access}`, params);
        if (!establishment.rows[0]) return null;
        const responsableId = user?.tipo === 'visitador' ? user.id : (input.responsable_id || establishment.rows[0].responsable_id || actorUserId);
        const responsible = await pool.query(`SELECT id FROM nl_usuarios WHERE id=$1 AND estado='activo' AND tipo IN ('admin','tecnico','visitador')`, [responsableId]);
        if (!responsible.rows[0]) return { invalidResponsible: true };
        const result = await pool.query(
            `INSERT INTO nl_crm_visitas
             (establecimiento_id,responsable_id,estado,proposito,programada_para,proxima_accion,creado_por)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [input.establecimiento_id, responsableId, input.estado || 'programada', input.proposito,
             input.programada_para, input.proxima_accion, actorUserId]
        );
        if (input.programada_para) await pool.query(`UPDATE nl_crm_establecimientos SET etapa=CASE WHEN etapa IN ('nuevo','contactado') THEN 'visita_programada' ELSE etapa END WHERE id=$1`, [input.establecimiento_id]);
        return result.rows[0];
    },

    updateVisit: async ({ id, input, user }) => {
        if (input.responsable_id && user?.tipo !== 'visitador') {
            const responsible = await pool.query(`SELECT id FROM nl_usuarios WHERE id=$1 AND estado='activo' AND tipo IN ('admin','tecnico','visitador')`, [input.responsable_id]);
            if (!responsible.rows[0]) return { invalidResponsible: true };
        }
        const allowed = ['estado','proposito','resultado','notas','proxima_accion','programada_para','iniciada_at','completada_at','proxima_visita_at','checkin_latitud','checkin_longitud','responsable_id'];
        const params = [];
        const updates = [];
        for (const key of allowed) {
            if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
            if (user?.tipo === 'visitador' && key === 'responsable_id') continue;
            params.push(input[key]); updates.push(`${key}=$${params.length}`);
        }
        if (!updates.length) return null;
        params.push(id);
        let where = `v.id=$${params.length}`;
        if (user?.tipo === 'visitador') {
            params.push(user.id); where += ` AND v.responsable_id=$${params.length} AND e.responsable_id=$${params.length}`;
        }
        const result = await pool.query(
            `UPDATE nl_crm_visitas v SET ${updates.join(', ')} FROM nl_crm_establecimientos e
             WHERE v.establecimiento_id=e.id AND ${where} RETURNING v.*`,
            params
        );
        const visit = result.rows[0];
        if (visit && ['completada','sin_contacto'].includes(visit.estado)) {
            await pool.query(`UPDATE nl_crm_establecimientos SET etapa=CASE WHEN etapa <> 'convertido' THEN 'visitado' ELSE etapa END WHERE id=$1`, [visit.establecimiento_id]);
        }
        return visit || null;
    },

    getAlerts: async ({ user }) => {
        const params = [];
        let access = accessSql(user, params);
        if (user?.tipo === 'visitador') { params.push(user.id); access += ` AND v.responsable_id=$${params.length}`; }
        const visits = await pool.query(
            `SELECT v.*, e.nombre AS establecimiento_nombre,
              CASE
                WHEN (v.programada_para AT TIME ZONE 'America/Lima')::date < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date THEN 'vencida'
                WHEN (v.programada_para AT TIME ZONE 'America/Lima')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date THEN 'hoy'
                ELSE 'proxima' END AS grupo
             FROM nl_crm_visitas v JOIN nl_crm_establecimientos e ON e.id=v.establecimiento_id
             WHERE v.estado IN ('programada','reprogramada')
               AND (v.programada_para AT TIME ZONE 'America/Lima')::date <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date + 7
               ${access}
             ORDER BY v.programada_para`,
            params
        );
        const birthdayParams = [];
        const birthdayAccess = accessSql(user, birthdayParams);
        const followupParams = [];
        let followupAccess = accessSql(user, followupParams);
        if (user?.tipo === 'visitador') { followupParams.push(user.id); followupAccess += ` AND v.responsable_id=$${followupParams.length}`; }
        const followups = await pool.query(
            `SELECT DISTINCT ON (v.establecimiento_id)
               v.id,v.establecimiento_id,v.responsable_id,v.proxima_visita_at AS programada_para,
               e.nombre AS establecimiento_nombre,'seguimiento' AS alerta_tipo,
               CASE
                 WHEN (v.proxima_visita_at AT TIME ZONE 'America/Lima')::date < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date THEN 'vencida'
                 WHEN (v.proxima_visita_at AT TIME ZONE 'America/Lima')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date THEN 'hoy'
                 ELSE 'proxima' END AS grupo
             FROM nl_crm_visitas v JOIN nl_crm_establecimientos e ON e.id=v.establecimiento_id
             WHERE v.estado IN ('completada','sin_contacto') AND v.proxima_visita_at IS NOT NULL
               AND (v.proxima_visita_at AT TIME ZONE 'America/Lima')::date <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date + 7
               AND NOT EXISTS (
                 SELECT 1 FROM nl_crm_visitas scheduled
                 WHERE scheduled.establecimiento_id=v.establecimiento_id
                   AND scheduled.estado IN ('programada','reprogramada')
                   AND scheduled.programada_para >= v.completada_at
               ) ${followupAccess}
             ORDER BY v.establecimiento_id,v.completada_at DESC NULLS LAST`,
            followupParams
        );
        const birthdays = await pool.query(
            `SELECT DISTINCT d.id,d.nombre_completo,d.fecha_nacimiento,e.id AS establecimiento_id,e.nombre AS establecimiento_nombre
             FROM nl_doctores d JOIN nl_clinica_doctores cd ON cd.doctor_id=d.id
             JOIN nl_clinicas c ON c.id=cd.clinica_id
             JOIN nl_crm_establecimientos e ON e.id=c.establecimiento_id
             WHERE d.fecha_nacimiento IS NOT NULL AND d.estado='activo' ${birthdayAccess}`,
            birthdayParams
        );
        return { visits: [...visits.rows, ...followups.rows], birthdays: birthdays.rows };
    },

    createImportPreview: async ({ fileName, format, mapping, rows, actorUserId }) => withClient(pool, async (client) => {
        const batch = await client.query(
            `INSERT INTO nl_crm_importaciones (nombre_archivo,formato,mapeo,creado_por) VALUES ($1,$2,$3,$4) RETURNING *`,
            [fileName, format, mapping, actorUserId]
        );
        const previewRows = [];
        const seenValid = [];
        let valid = 0; let errors = 0; let duplicates = 0;
        for (const row of rows) {
            let duplicate = null;
            if (!row.errors.length) {
                duplicate = await findDuplicate(client, row.normalized);
                if (!duplicate) {
                    duplicate = findBatchDuplicate(seenValid, {
                        ...row.normalized,
                        rowNumber: row.rowNumber,
                        nombre: row.original?.nombre || row.normalized.nombre,
                    });
                }
            }
            const status = row.errors.length ? 'error' : duplicate ? 'duplicada' : 'valida';
            if (status === 'error') errors += 1;
            else if (status === 'duplicada') duplicates += 1;
            else {
                valid += 1;
                seenValid.push({
                    ...row.normalized,
                    rowNumber: row.rowNumber,
                    nombre: row.original?.nombre || row.normalized.nombre,
                });
            }
            const inserted = await client.query(
                `INSERT INTO nl_crm_importacion_filas
                 (importacion_id,numero_fila,datos_originales,datos_normalizados,errores,estado,duplicado_establecimiento_id,aprobada)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                [batch.rows[0].id,row.rowNumber,row.original,row.normalized,row.errors,status,duplicate?.id || null,status === 'valida']
            );
            previewRows.push({ ...inserted.rows[0], duplicado: duplicate });
        }
        const updated = await client.query(
            `UPDATE nl_crm_importaciones SET total_filas=$1,filas_validas=$2,filas_error=$3,filas_duplicadas=$4 WHERE id=$5 RETURNING *`,
            [rows.length,valid,errors,duplicates,batch.rows[0].id]
        );
        return { importacion: updated.rows[0], filas: previewRows };
    }),

    getImport: async ({ id, user }) => {
        const params = [id];
        let where = 'id=$1';
        if (user?.tipo !== 'admin') { params.push(user.id); where += ` AND creado_por=$${params.length}`; }
        const batch = await pool.query(`SELECT * FROM nl_crm_importaciones WHERE ${where}`, params);
        if (!batch.rows[0]) return null;
        const rows = await pool.query(`SELECT * FROM nl_crm_importacion_filas WHERE importacion_id=$1 ORDER BY numero_fila`, [id]);
        return { importacion: batch.rows[0], filas: rows.rows };
    },

    commitImport: async ({ id, approvedRowIds, actorUserId }) => withClient(pool, async (client) => {
        const batch = await client.query(`SELECT * FROM nl_crm_importaciones WHERE id=$1 AND creado_por=$2 FOR UPDATE`, [id,actorUserId]);
        if (!batch.rows[0]) return { notFound: true };
        if (batch.rows[0].estado === 'completada') {
            const count = await client.query(`SELECT COUNT(*)::int AS count FROM nl_crm_importacion_filas WHERE importacion_id=$1 AND estado='importada'`, [id]);
            return { imported: count.rows[0].count, alreadyCommitted: true };
        }
        await client.query(`UPDATE nl_crm_importaciones SET estado='procesando' WHERE id=$1`, [id]);
        const params = [id];
        let selected = `importacion_id=$1 AND estado='valida' AND aprobada=TRUE`;
        if (Array.isArray(approvedRowIds)) { params.push(approvedRowIds); selected += ` AND id=ANY($2::int[])`; }
        const rows = await client.query(`SELECT * FROM nl_crm_importacion_filas WHERE ${selected} ORDER BY numero_fila FOR UPDATE`, params);
        let imported = 0;
        for (const row of rows.rows) {
            const data = row.datos_normalizados;
            const duplicate = await findDuplicate(client, data);
            if (duplicate) {
                await client.query(`UPDATE nl_crm_importacion_filas SET estado='duplicada',duplicado_establecimiento_id=$1 WHERE id=$2`, [duplicate.id,row.id]);
                continue;
            }
            const inserted = await client.query(
                `INSERT INTO nl_crm_establecimientos
                 (nombre,nombre_normalizado,tipo,telefono,telefono_normalizado,email,direccion,latitud,longitud,origen,origen_id,responsable_id,etapa,notas)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
                [data.nombre,data.nombre_normalizado,data.tipo,data.telefono,data.telefono_normalizado,data.email,data.direccion,
                 data.latitud,data.longitud,data.origen,data.origen_id,data.responsable_id || actorUserId,data.etapa,data.notas]
            );
            await client.query(`UPDATE nl_crm_importacion_filas SET estado='importada',establecimiento_id=$1 WHERE id=$2`, [inserted.rows[0].id,row.id]);
            imported += 1;
        }
        await client.query(`UPDATE nl_crm_importacion_filas SET estado='omitida' WHERE importacion_id=$1 AND estado='valida'`, [id]);
        const completed = await client.query(`UPDATE nl_crm_importaciones SET estado='completada',committed_at=NOW() WHERE id=$1 RETURNING *`, [id]);
        return { imported, alreadyCommitted: false, importacion: completed.rows[0] };
    })
});

export const crmRepositoryHelpers = { normalizeName, normalizePhone };
