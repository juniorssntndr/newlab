const stringifyError = (error) => {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return String(error);
};

export const writeAuditEvent = async (req, {
    entidad,
    entidadId = null,
    accion,
    descripcion = null,
    metadata = {}
}) => {
    try {
        const pool = req.app?.locals?.pool;
        if (!pool) return;

        await pool.query(
            `INSERT INTO nl_audit_eventos (usuario_id, entidad, entidad_id, accion, descripcion, metadata, ip, user_agent)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                req.user?.id || null,
                entidad,
                entidadId ? String(entidadId) : null,
                accion,
                descripcion,
                metadata,
                req.ip || null,
                req.headers['user-agent'] || null
            ]
        );
    } catch (error) {
        console.error('[AUDIT_ERROR]', stringifyError(error));
    }
};
