import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketingAudience } from './marketingAudience.js';

test('selected-clinic audience rejects empty or invalid IDs before a send query exists', () => {
    for (const ids of [[], undefined, ['bad'], [0], [1.5]]) {
        assert.throws(() => buildMarketingAudience('clinicas_especificas', ids), {
            status: 400
        });
    }
});

test('selected-clinic audience targets only selected clinics', () => {
    const audience = buildMarketingAudience('clinicas_especificas', ['12', '7', '12']);
    assert.deepEqual(audience.params, [[12, 7]]);
    assert.deepEqual(audience.clinicIds, [12, 7]);
    assert.match(audience.query, /u\.clinica_id = ANY\(\$1::int\[\]\)/);
});

test('unknown audience fails closed', () => {
    assert.throws(() => buildMarketingAudience('other', []), { status: 400 });
});
