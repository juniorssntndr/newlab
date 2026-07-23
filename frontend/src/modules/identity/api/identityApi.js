import { API_URL } from '../../../config.js';

const throwFromResponse = async (res, fallback) => {
    let payload;
    try { payload = await res.json(); } catch { payload = {}; }
    const err = new Error(payload?.error || payload?.message || fallback);
    err.status = res.status;
    err.payload = payload;
    err.code = payload?.code;
    throw err;
};

const flattenRucPreview = (data) => {
    const proposal = data?.proposal || data || {};
    return {
        documentType: data?.documentType || proposal.documentType || '6',
        documentNumber: proposal.ruc || proposal.documentNumber || data?.documentNumber || '',
        razonSocial: proposal.razon_social || proposal.razonSocial || data?.razonSocial || '',
        nombreComercial: proposal.nombre_comercial || proposal.nombreComercial || data?.nombreComercial || null,
        estado: proposal.estado_ruc || proposal.estado || data?.estado || '',
        condicion: proposal.condicion_ruc || proposal.condicion || data?.condicion || '',
        direccion: proposal.direccion || data?.direccion || null,
        ubigeo: proposal.ubigeo || data?.ubigeo || null,
        departamento: proposal.departamento || data?.departamento || null,
        provincia: proposal.provincia || data?.provincia || null,
        distrito: proposal.distrito || data?.distrito || null,
        isActiveHabido: data?.isActiveHabido ?? proposal.isActiveHabido,
        warnings: data?.warnings || [],
        // Compat aliases used by existing pages
        nombres: undefined,
        apellidoPaterno: undefined,
        apellidoMaterno: undefined,
        razon_social: proposal.razon_social || proposal.razonSocial || data?.razonSocial || '',
    };
};

const flattenDniPreview = (data) => {
    const proposal = data?.proposal || data || {};
    return {
        documentType: data?.documentType || proposal.documentType || '1',
        documentNumber: proposal.dni || proposal.documentNumber || data?.documentNumber || '',
        nombres: proposal.nombres || data?.nombres || '',
        apellidoPaterno: proposal.apellido_paterno || proposal.apellidoPaterno || data?.apellidoPaterno || '',
        apellidoMaterno: proposal.apellido_materno || proposal.apellidoMaterno || data?.apellidoMaterno || '',
        fullName: proposal.nombre_completo || proposal.fullName || data?.fullName || '',
        nombre: proposal.nombre_completo || data?.fullName || '',
    };
};

/**
 * Consulta DNI en RENIEC vía proxy backend.
 */
export const consultarDNI = async ({ dni, headers }) => {
    const res = await fetch(`${API_URL}/consultas/dni/${dni}`, { headers });
    if (!res.ok) await throwFromResponse(res, 'Error consultando DNI');
    return flattenDniPreview(await res.json());
};

/**
 * Consulta RUC en SUNAT vía proxy backend.
 */
export const consultarRUC = async ({ ruc, headers }) => {
    const res = await fetch(`${API_URL}/consultas/ruc/${ruc}`, { headers });
    if (!res.ok) await throwFromResponse(res, 'Error consultando RUC');
    return flattenRucPreview(await res.json());
};

/**
 * Preview de clínica a partir de RUC.
 * POST /api/clinicas/preview-ruc { ruc }
 */
export const previewRUC = async ({ ruc, headers }) => {
    const res = await fetch(`${API_URL}/clinicas/preview-ruc`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ruc }),
    });

    if (res.status === 404) {
        return consultarRUC({ ruc, headers });
    }
    if (!res.ok) await throwFromResponse(res, 'Error obteniendo preview RUC');
    return flattenRucPreview(await res.json());
};

/**
 * Confirma la creación de clínica desde RUC validado.
 * POST /api/clinicas/confirm { ruc, overrides? }
 */
export const confirmClinica = async ({ ruc, overrides = {}, headers }) => {
    const res = await fetch(`${API_URL}/clinicas/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ruc, overrides }),
    });

    if (res.status === 404) {
        const res2 = await fetch(`${API_URL}/clinicas`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ruc,
                nombre: overrides.nombre || overrides.razon_social,
                razon_social: overrides.razon_social,
                direccion: overrides.direccion,
                email: overrides.email,
                telefono: overrides.telefono,
                contacto_nombre: overrides.contacto_nombre,
            }),
        });
        if (!res2.ok) await throwFromResponse(res2, 'Error creando clínica');
        return res2.json();
    }
    if (!res.ok) await throwFromResponse(res, 'Error confirmando clínica');
    return res.json();
};

/**
 * Preview de doctor a partir de DNI.
 * POST /api/doctores/preview-dni { dni }
 */
export const previewDNI = async ({ dni, headers }) => {
    const res = await fetch(`${API_URL}/doctores/preview-dni`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ dni }),
    });

    if (res.status === 404) {
        return consultarDNI({ dni, headers });
    }
    if (!res.ok) await throwFromResponse(res, 'Error obteniendo preview DNI');
    return flattenDniPreview(await res.json());
};

/**
 * Confirma la creación de doctor desde DNI validado.
 * POST /api/doctores/confirm { dni, cop?, email?, telefono?, clinicaIds? }
 */
export const confirmDoctor = async ({ dni, overrides = {}, headers }) => {
    const clinicaIds = (overrides.clinicaIds || overrides.clinicas || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);

    const body = {
        dni,
        cop: overrides.cop || null,
        email: overrides.email || null,
        telefono: overrides.telefono || null,
        clinicaIds,
    };

    const res = await fetch(`${API_URL}/doctores/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (res.status === 404) {
        const res2 = await fetch(`${API_URL}/doctores`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!res2.ok) await throwFromResponse(res2, 'Error creando doctor');
        return res2.json();
    }
    if (!res.ok) await throwFromResponse(res, 'Error confirmando doctor');
    return res.json();
};
