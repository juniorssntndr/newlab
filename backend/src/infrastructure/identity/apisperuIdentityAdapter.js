import axios from 'axios';
import { logger } from '../../lib/logger.js';

const IDENTITY_BASE = 'https://dniruc.apisperu.com/api/v1';
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 500;

// Simple LRU-TTL cache: Map preserves insertion order; on overflow evict oldest.
class TtlCache {
    constructor({ ttlMs = DEFAULT_TTL_MS, max = MAX_ENTRIES } = {}) {
        this._map = new Map();
        this._ttlMs = ttlMs;
        this._max = max;
    }

    get(key) {
        const entry = this._map.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this._map.delete(key);
            return undefined;
        }
        // Refresh recency (LRU: move to end)
        this._map.delete(key);
        this._map.set(key, entry);
        return entry.value;
    }

    set(key, value) {
        if (this._map.has(key)) this._map.delete(key);
        if (this._map.size >= this._max) {
            // Evict oldest (first in insertion order)
            this._map.delete(this._map.keys().next().value);
        }
        this._map.set(key, { value, expiresAt: Date.now() + this._ttlMs });
    }
}

const cache = new TtlCache();

const ERROR_CODES = {
    NOT_FOUND: 'DOCUMENT_NOT_FOUND',
    INVALID: 'INVALID_DOCUMENT',
    QUOTA: 'QUOTA_OR_PROVIDER_ERROR',
    TOKEN_MISSING: 'TOKEN_MISSING',
};

function getToken() {
    return process.env.EXTERNAL_API_TOKEN || null;
}

function redactedKey(type, numero) {
    return `${type}:${numero}`;
}

async function fetchIdentity(type, numero) {
    const token = getToken();
    if (!token || token.startsWith('tu_token')) {
        const err = new Error('Token de identidad no configurado');
        err.code = ERROR_CODES.TOKEN_MISSING;
        throw err;
    }

    const cacheKey = redactedKey(type, numero);
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // Build URL but never pass it to the logger
    const url = `${IDENTITY_BASE}/${type}/${numero}?token=${token}`;

    let data;
    try {
        const response = await axios.get(url, { timeout: 10000 });
        data = response.data;
    } catch (err) {
        if (err.response) {
            const status = err.response.status;
            const body = err.response.data;

            if (status === 401) {
                const e = new Error('Token de APISPERU inválido o expirado');
                e.code = ERROR_CODES.TOKEN_MISSING;
                throw e;
            }
            if (status === 500 && body?.message === 'Ocurrió un Error') {
                const e = new Error(type === 'dni'
                    ? 'Datos no encontrados en RENIEC'
                    : 'Datos no encontrados en SUNAT');
                e.code = ERROR_CODES.NOT_FOUND;
                throw e;
            }
            const e = new Error(body?.message || 'Error en proveedor externo');
            e.code = ERROR_CODES.QUOTA;
            throw e;
        }
        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            const e = new Error('Timeout consultando servicio de identidad');
            e.code = ERROR_CODES.QUOTA;
            throw e;
        }
        const e = new Error('No se pudo conectar con el servicio de identidad');
        e.code = ERROR_CODES.QUOTA;
        throw e;
    }

    if (data && data.success === false) {
        const msg = String(data.message || '').toLowerCase();
        const notFound = msg.includes('no se encontraron') || msg.includes('no encontrado');
        const e = new Error(notFound
            ? (type === 'dni' ? 'Datos no encontrados en RENIEC' : 'Datos no encontrados en SUNAT')
            : (data.message || 'Documento no encontrado'));
        e.code = ERROR_CODES.NOT_FOUND;
        throw e;
    }

    const normalized = type === 'dni'
        ? normalizeDni(data)
        : normalizeRuc(data);

    cache.set(cacheKey, normalized);
    return normalized;
}

function normalizeDni(raw) {
    const nombres = raw.nombres || raw.nombre || '';
    const apellidoPaterno = raw.apellidoPaterno || raw.apPaterno || '';
    const apellidoMaterno = raw.apellidoMaterno || raw.apMaterno || '';
    return {
        documentType: '1',
        documentNumber: raw.dni || raw.numeroDocumento || '',
        nombres,
        apellidoPaterno,
        apellidoMaterno,
        fullName: raw.nombreCompleto || [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' '),
        raw,
    };
}

function normalizeRuc(raw) {
    const estado = raw.estado || '';
    const condicion = raw.condicion || '';
    const isActiveHabido = estado.toLowerCase().includes('activo') &&
        condicion.toLowerCase().includes('habido');
    return {
        documentType: '6',
        documentNumber: raw.ruc || raw.numeroDocumento || '',
        razonSocial: raw.razonSocial || '',
        nombreComercial: raw.nombreComercial || null,
        estado,
        condicion,
        direccion: raw.direccion || null,
        ubigeo: raw.ubigeo || null,
        departamento: raw.departamento || null,
        provincia: raw.provincia || null,
        distrito: raw.distrito || null,
        isActiveHabido,
        raw,
    };
}

export const apisperuIdentityAdapter = {
    async lookupDni(numero) {
        if (!/^\d{8}$/.test(numero)) {
            const e = new Error('El DNI debe tener exactamente 8 dígitos numéricos');
            e.code = ERROR_CODES.INVALID;
            throw e;
        }
        logger.info('identity.lookup', { documentType: '1', last4: numero.slice(-4) });
        try {
            const result = await fetchIdentity('dni', numero);
            return result;
        } catch (err) {
            logger.warn('identity.lookup.failed', { documentType: '1', last4: numero.slice(-4), code: err.code });
            throw err;
        }
    },

    async lookupRuc(numero) {
        if (!/^\d{11}$/.test(numero)) {
            const e = new Error('El RUC debe tener exactamente 11 dígitos numéricos');
            e.code = ERROR_CODES.INVALID;
            throw e;
        }
        logger.info('identity.lookup', { documentType: '6', last4: numero.slice(-4) });
        try {
            const result = await fetchIdentity('ruc', numero);
            return result;
        } catch (err) {
            logger.warn('identity.lookup.failed', { documentType: '6', last4: numero.slice(-4), code: err.code });
            throw err;
        }
    },

    _cache: cache,
};
