import test from 'node:test';
import assert from 'node:assert/strict';
import { readMarketingData, marketingErrorMessage, settleMarketingResources, marketingClinicLabel } from './marketingData.js';

test('reads fetch client marketing envelopes instead of Axios response shapes', () => {
    assert.deepEqual(readMarketingData({ ok: true, data: [{ id: 1 }] }), [{ id: 1 }]);
    assert.deepEqual(readMarketingData({ ok: true, data: { cupones_activos: 3 } }), { cupones_activos: 3 });
    assert.deepEqual(readMarketingData([{ id: 2 }]), [{ id: 2 }]);
});

test('does not turn a failed response into an empty state', () => {
    assert.throws(() => readMarketingData({ ok: false, error: 'Denied' }), /Denied/);
    assert.throws(() => readMarketingData({ unexpected: true }), /no válida/);
});

test('uses fetch client error payload', () => {
    assert.equal(marketingErrorMessage({ payload: { error: 'Invalid clinic' }, message: 'Error de red' }), 'Invalid clinic');
});

test('clinic labels use real province and never invent a location', () => {
    assert.equal(marketingClinicLabel({ nombre: 'Dental Clinic', provincia: 'Lima' }), 'Dental Clinic (Lima)');
    assert.equal(marketingClinicLabel({ nombre: 'Dental Clinic', provincia: null }), 'Dental Clinic');
});

test('clinic failure does not discard roulette prizes or history', async () => {
    const loaded = {};
    const errors = {};
    const responses = {
        premios: { ok: true, data: [{ id: 1 }], totalPesoActivo: 10 },
        historial: { ok: true, data: [{ id: 2 }] }
    };
    await settleMarketingResources([
        ...Object.entries(responses).map(([key, response]) => ({
            key, request: async () => response,
            onSuccess: (result) => { loaded[key] = readMarketingData(result); }
        })),
        { key: 'clinicas', request: async () => { throw new Error('Clinic lookup failed'); }, onSuccess: () => assert.fail('Must not report failed clinics as loaded') }
    ], (key, error) => { errors[key] = error.message; });
    assert.deepEqual(loaded, { premios: [{ id: 1 }], historial: [{ id: 2 }] });
    assert.deepEqual(errors, { clinicas: 'Clinic lookup failed' });
});

test('malformed resource response fails independently without reporting an empty list', async () => {
    const loaded = {};
    const errors = [];
    await settleMarketingResources(['premios', 'historial'].map((key) => ({
        key, request: async () => key === 'premios' ? { unexpected: true } : { ok: true, data: [] },
        onSuccess: (response) => { loaded[key] = readMarketingData(response); }
    })), (key) => errors.push(key));
    assert.deepEqual(loaded, { historial: [] });
    assert.deepEqual(errors, ['premios']);
});
