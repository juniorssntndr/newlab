import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCrmService } from './crmService.js';

const admin = { id: 1, tipo: 'admin' };
const visitor = { id: 7, tipo: 'visitador' };

test('visitor establishment query retains ownership context', async () => {
    let receivedUser;
    const service = makeCrmService({ crmRepository: {
        async listEstablishments({ user }) { receivedUser = user; return { rows: [], total: 0, page: 1, limit: 100 }; }
    } });
    const result = await service.listEstablishments({ user: visitor, filters: {} });
    assert.equal(result.ok, true);
    assert.equal(receivedUser.id, visitor.id);
});

test('visitor cannot preview imports', async () => {
    const service = makeCrmService({ crmRepository: {} });
    const result = await service.previewImport({ user: visitor, file: null, mapping: {} });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
});

test('conversion is idempotent and preserves repository created flag', async () => {
    let calls = 0;
    const service = makeCrmService({ crmRepository: {
        async convertEstablishment() {
            calls += 1;
            return { clinic: { id: 20, establecimiento_id: 5 }, created: calls === 1 };
        }
    } });
    const first = await service.convertEstablishment({ user: admin, id: 5, body: {} });
    const second = await service.convertEstablishment({ user: admin, id: 5, body: {} });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(first.data.clinic.establecimiento_id, 5);
});

test('conversion exposes contact validation failure', async () => {
    const service = makeCrmService({ crmRepository: { async convertEstablishment() { return { missingContact: true }; } } });
    const result = await service.convertEstablishment({ user: admin, id: 5, body: {} });
    assert.equal(result.ok, false);
    assert.match(result.error, /teléfono/i);
});
