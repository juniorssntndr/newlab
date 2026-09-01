import { API_URL } from '../../../config.js';

const buildUrl = (path, query) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${API_URL}${cleanPath}`, window.location.origin);
    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, value);
            }
        });
    }
    if (API_URL.startsWith('http')) return url.toString();
    return `${API_URL}${cleanPath}${url.search}`;
};

const crmFetch = async (path, options = {}) => {
    const { method = 'GET', query, headers = {}, body } = options;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const requestHeaders = { ...headers };

    if (!isFormData) {
        if (!requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
            requestHeaders['Content-Type'] = 'application/json';
        }
    } else {
        delete requestHeaders['Content-Type'];
        delete requestHeaders['content-type'];
    }

    const res = await fetch(buildUrl(path, query), {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body)
    });

    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
        ? await res.json()
        : await res.text();

    if (!res.ok) {
        const message = typeof payload === 'string'
            ? payload
            : (payload?.error || payload?.message || 'Error en la solicitud CRM');
        const err = new Error(message);
        err.status = res.status;
        err.payload = payload;
        err.code = payload?.code;
        throw err;
    }

    return payload;
};

/* --- CRM Endpoints --- */

export const fetchCrmSummary = ({ headers }) =>
    crmFetch('/crm/resumen', { headers });

export const fetchEstablecimientos = ({ filters = {}, headers }) =>
    crmFetch('/crm/establecimientos', { query: filters, headers });

export const fetchEstablecimientoDetail = ({ id, headers }) =>
    crmFetch(`/crm/establecimientos/${id}`, { headers });

export const createEstablecimiento = ({ payload, headers }) =>
    crmFetch('/crm/establecimientos', { method: 'POST', body: payload, headers });

export const updateEstablecimiento = ({ id, payload, headers }) =>
    crmFetch(`/crm/establecimientos/${id}`, { method: 'PATCH', body: payload, headers });

export const assignEstablecimiento = ({ id, responsable_id, headers }) =>
    crmFetch(`/crm/establecimientos/${id}/asignacion`, {
        method: 'PATCH',
        body: { responsable_id },
        headers
    });

export const convertEstablecimiento = ({ id, payload = {}, headers }) =>
    crmFetch(`/crm/establecimientos/${id}/convertir`, {
        method: 'POST',
        body: payload,
        headers
    });

export const fetchReclamos = ({ filters = {}, headers }) =>
    crmFetch('/crm/reclamos', { query: filters, headers });

export const createReclamo = ({ payload, headers }) =>
    crmFetch('/crm/reclamos', { method: 'POST', body: payload, headers });

export const resolveReclamo = ({ id, headers }) =>
    crmFetch(`/crm/reclamos/${id}`, {
        method: 'PATCH',
        body: { estado: 'resuelto' },
        headers
    });

export const fetchVisitas = ({ filters = {}, headers }) =>
    crmFetch('/crm/visitas', { query: filters, headers });

export const createVisita = ({ payload, headers }) =>
    crmFetch('/crm/visitas', { method: 'POST', body: payload, headers });

export const updateVisita = ({ id, payload, headers }) =>
    crmFetch(`/crm/visitas/${id}`, { method: 'PATCH', body: payload, headers });

export const fetchAlertas = ({ headers }) =>
    crmFetch('/crm/alertas', { headers });

export const previewImport = ({ file, mapping, headers }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (mapping) formData.append('mapping', JSON.stringify(mapping));
    return crmFetch('/crm/importaciones/preview', {
        method: 'POST',
        body: formData,
        headers
    });
};

export const fetchImportDetail = ({ id, headers }) =>
    crmFetch(`/crm/importaciones/${id}`, { headers });

export const commitImport = ({ id, approvedRowIds, headers }) =>
    crmFetch(`/crm/importaciones/${id}/commit`, {
        method: 'POST',
        body: { approvedRowIds },
        headers
    });

/* --- Doctores & Clínicas Endpoints --- */

export const fetchDoctores = ({ filters = {}, headers }) =>
    crmFetch('/doctores', { query: filters, headers });

export const createDoctor = ({ payload, headers }) =>
    crmFetch('/doctores', { method: 'POST', body: payload, headers });

export const updateDoctor = ({ id, payload, headers }) =>
    crmFetch(`/doctores/${id}`, { method: 'PUT', body: payload, headers });

export const fetchUsuarios = ({ headers }) =>
    crmFetch('/usuarios', { headers });
