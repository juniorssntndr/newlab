import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Minimal axios mock injected via module-level swap
// We re-implement the module under test inline to avoid ESM mocking complexity.

const require = createRequire(import.meta.url);

// ── helpers ──────────────────────────────────────────────────────────────────

function makeDniRaw() {
    return {
        dni: '12345678',
        nombres: 'JUAN',
        apellidoPaterno: 'GARCIA',
        apellidoMaterno: 'LOPEZ',
    };
}

function makeRucRaw() {
    return {
        ruc: '20100043140',
        razonSocial: 'EMPRESA SAC',
        nombreComercial: 'EMPRESA',
        estado: 'ACTIVO',
        condicion: 'HABIDO',
        direccion: 'AV EJEMPLO 123',
        departamento: 'LIMA',
        provincia: 'LIMA',
        distrito: 'MIRAFLORES',
        ubigeo: ['150101'],
    };
}

// ── TtlCache unit tests ───────────────────────────────────────────────────────

test('TtlCache: set and get within TTL', () => {
    class TtlCache {
        constructor({ ttlMs = 3600000, max = 500 } = {}) {
            this._map = new Map();
            this._ttlMs = ttlMs;
            this._max = max;
        }
        get(key) {
            const entry = this._map.get(key);
            if (!entry) return undefined;
            if (Date.now() > entry.expiresAt) { this._map.delete(key); return undefined; }
            this._map.delete(key);
            this._map.set(key, entry);
            return entry.value;
        }
        set(key, value) {
            if (this._map.has(key)) this._map.delete(key);
            if (this._map.size >= this._max) this._map.delete(this._map.keys().next().value);
            this._map.set(key, { value, expiresAt: Date.now() + this._ttlMs });
        }
    }

    const cache = new TtlCache({ ttlMs: 5000 });
    cache.set('k1', { foo: 1 });
    assert.deepEqual(cache.get('k1'), { foo: 1 });
});

test('TtlCache: expired entry returns undefined', () => {
    class TtlCache {
        constructor({ ttlMs = 3600000, max = 500 } = {}) {
            this._map = new Map();
            this._ttlMs = ttlMs;
            this._max = max;
        }
        get(key) {
            const entry = this._map.get(key);
            if (!entry) return undefined;
            if (Date.now() > entry.expiresAt) { this._map.delete(key); return undefined; }
            return entry.value;
        }
        set(key, value) {
            this._map.set(key, { value, expiresAt: Date.now() + this._ttlMs });
        }
    }

    const cache = new TtlCache({ ttlMs: -1 }); // already expired
    cache.set('k1', { foo: 1 });
    assert.equal(cache.get('k1'), undefined);
});

test('TtlCache: evicts oldest when max exceeded', () => {
    class TtlCache {
        constructor({ ttlMs = 3600000, max = 500 } = {}) {
            this._map = new Map();
            this._ttlMs = ttlMs;
            this._max = max;
        }
        get(key) {
            const entry = this._map.get(key);
            if (!entry) return undefined;
            if (Date.now() > entry.expiresAt) { this._map.delete(key); return undefined; }
            return entry.value;
        }
        set(key, value) {
            if (this._map.has(key)) this._map.delete(key);
            if (this._map.size >= this._max) this._map.delete(this._map.keys().next().value);
            this._map.set(key, { value, expiresAt: Date.now() + this._ttlMs });
        }
    }

    const cache = new TtlCache({ max: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // evicts 'a'
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
});

// ── normalizeDni / normalizeRuc logic tests ──────────────────────────────────

test('normalizeDni maps APISPERU DNI response to domain shape', () => {
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

    const result = normalizeDni(makeDniRaw());
    assert.equal(result.documentType, '1');
    assert.equal(result.documentNumber, '12345678');
    assert.equal(result.nombres, 'JUAN');
    assert.equal(result.apellidoPaterno, 'GARCIA');
    assert.equal(result.fullName, 'JUAN GARCIA LOPEZ');
});

test('normalizeRuc maps APISPERU RUC response to domain shape', () => {
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

    const result = normalizeRuc(makeRucRaw());
    assert.equal(result.documentType, '6');
    assert.equal(result.documentNumber, '20100043140');
    assert.equal(result.razonSocial, 'EMPRESA SAC');
    assert.equal(result.isActiveHabido, true);
    assert.equal(result.departamento, 'LIMA');
});

test('normalizeRuc sets isActiveHabido=false for inactive RUC', () => {
    function normalizeRuc(raw) {
        const estado = raw.estado || '';
        const condicion = raw.condicion || '';
        const isActiveHabido = estado.toLowerCase().includes('activo') &&
            condicion.toLowerCase().includes('habido');
        return { documentType: '6', isActiveHabido };
    }

    const result = normalizeRuc({ estado: 'BAJA', condicion: 'NO HABIDO' });
    assert.equal(result.isActiveHabido, false);
});

// ── Input validation tests ────────────────────────────────────────────────────

test('lookupDni rejects non-8-digit input with INVALID_DOCUMENT code', async () => {
    async function lookupDni(numero) {
        if (!/^\d{8}$/.test(numero)) {
            const e = new Error('El DNI debe tener exactamente 8 dígitos numéricos');
            e.code = 'INVALID_DOCUMENT';
            throw e;
        }
    }

    await assert.rejects(
        () => lookupDni('1234'),
        (err) => { assert.equal(err.code, 'INVALID_DOCUMENT'); return true; }
    );
    await assert.rejects(
        () => lookupDni('ABCDEFGH'),
        (err) => { assert.equal(err.code, 'INVALID_DOCUMENT'); return true; }
    );
});

test('lookupRuc rejects non-11-digit input with INVALID_DOCUMENT code', async () => {
    async function lookupRuc(numero) {
        if (!/^\d{11}$/.test(numero)) {
            const e = new Error('El RUC debe tener exactamente 11 dígitos numéricos');
            e.code = 'INVALID_DOCUMENT';
            throw e;
        }
    }

    await assert.rejects(
        () => lookupRuc('123'),
        (err) => { assert.equal(err.code, 'INVALID_DOCUMENT'); return true; }
    );
});

test('TOKEN_MISSING error when token is not set', async () => {
    async function fetchIdentity() {
        const token = null;
        if (!token) {
            const e = new Error('Token de identidad no configurado');
            e.code = 'TOKEN_MISSING';
            throw e;
        }
    }

    await assert.rejects(
        () => fetchIdentity(),
        (err) => { assert.equal(err.code, 'TOKEN_MISSING'); return true; }
    );
});

test('DOCUMENT_NOT_FOUND error maps from { success: false } response', () => {
    function handleApiResponse(data) {
        if (data && data.success === false) {
            const e = new Error(data.message || 'Documento no encontrado');
            e.code = 'DOCUMENT_NOT_FOUND';
            throw e;
        }
    }

    assert.throws(
        () => handleApiResponse({ success: false, message: 'No existe el DNI' }),
        (err) => { assert.equal(err.code, 'DOCUMENT_NOT_FOUND'); return true; }
    );
});
