export function buildMarketingAudience(tipoAudiencia = 'todos', segmentoIds = []) {
    const base = `SELECT u.id, u.nombre, u.clinica_id FROM nl_usuarios u WHERE u.tipo = 'cliente' AND u.estado = 'activo' AND u.clinica_id IS NOT NULL AND EXISTS (SELECT 1 FROM nl_clinicas c WHERE c.id = u.clinica_id)`;
    if (tipoAudiencia === 'todos') return { query: base, params: [], clinicIds: [] };
    if (tipoAudiencia === 'inactivos') {
        return {
            query: `${base} AND u.clinica_id NOT IN (
                SELECT DISTINCT clinica_id FROM nl_pedidos
                WHERE fecha >= NOW() - INTERVAL '30 days' AND clinica_id IS NOT NULL
            )`,
            params: [],
            clinicIds: []
        };
    }
    if (tipoAudiencia === 'clinicas_especificas') {
        if (!Array.isArray(segmentoIds) || segmentoIds.some(id => !['string', 'number'].includes(typeof id) || !/^\d+$/.test(String(id)))) {
            const error = new Error('Selecciona clínicas con identificadores válidos.');
            error.status = 400;
            throw error;
        }
        const ids = Array.isArray(segmentoIds) ? segmentoIds.map(Number) : [];
        if (!ids.length || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
            const error = new Error('Selecciona al menos una clínica válida antes de enviar.');
            error.status = 400;
            throw error;
        }
        const clinicIds = [...new Set(ids)];
        return {
            query: `${base} AND u.clinica_id = ANY($1::int[])`,
            params: [clinicIds],
            clinicIds
        };
    }
    const error = new Error('Audiencia no válida.');
    error.status = 400;
    throw error;
}

export function campaignMatchesClient(campaign, clinicId, hasRecentOrder) {
    if (!Array.isArray(campaign.segmento_ids)) return false;
    const type = campaign.tipo_audiencia;
    if (type === 'clinicas_especificas') {
        try {
            const audience = buildMarketingAudience(type, campaign.segmento_ids);
            return Number.isSafeInteger(Number(clinicId)) && audience.clinicIds.includes(Number(clinicId));
        } catch {
            return false;
        }
    }
    // Non-segmented campaigns created by this module store an empty segment list.
    if (campaign.segmento_ids.length !== 0) return false;
    if (type === 'todos') return true;
    if (type === 'inactivos') return hasRecentOrder === false;
    return false;
}
