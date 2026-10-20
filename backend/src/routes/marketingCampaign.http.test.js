import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import marketingRoutes from './marketing.js';

process.env.JWT_SECRET = 'marketing-test-secret';

async function requestCampaign(pool, body, { method = 'POST', path = '/campanas', role = 'admin' } = {}) {
    const app = express();
    app.locals.pool = { ...pool, query: (sql, params) => sql.includes("tipo IN ('admin','operador','visitador')") ? Promise.resolve({ rows: [{ id: 99 }] }) : pool.query(sql, params) };
    app.use(express.json());
    app.use('/api/marketing', marketingRoutes);
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    try {
        const token = jwt.sign({ id: 99, tipo: role }, process.env.JWT_SECRET);
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/marketing${path}`, {
            method,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: method === 'POST' ? JSON.stringify({ titulo: 'Campaign', mensaje: 'Message', request_id: 'campaign-request-0001', fecha_inicio: '2026-01-01', fecha_fin: '2099-12-31', mostrar_toast_in_app: true, enviar_push_web: false, link_destino: '/pedidos/nuevo', ...body }) : undefined
        });
        return { status: response.status, body: await response.json() };
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

test('clinic lookup selects only real clinic columns and returns province', async () => {
    const clinics = [{ id: 12, nombre: 'Dental Clinic', provincia: 'Lima' }];
    const pool = {
        async query(sql) {
            // Schema-shaped mock rejects invented columns rather than accepting any SQL.
            const columns = sql.match(/^SELECT (.+) FROM nl_clinicas ORDER BY nombre ASC$/)?.[1].split(',').map((column) => column.trim());
            assert.deepEqual(columns, ['id', 'nombre', 'provincia']);
            return { rows: clinics };
        }
    };
    const response = await requestCampaign(pool, undefined, { method: 'GET', path: '/campanas/clinicas' });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true, data: clinics });
});

test('clinic lookup failure returns an error, not an empty list', async () => {
    const pool = { query: async () => { throw new Error('Database unavailable'); } };
    const response = await requestCampaign(pool, undefined, { method: 'GET', path: '/campanas/clinicas' });
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { error: 'Error al cargar clínicas' });
});

test('client role cannot access marketing clinic lookup', async () => {
    const pool = { query: async () => assert.fail('Unauthorized lookup must not query') };
    const response = await requestCampaign(pool, undefined, { method: 'GET', path: '/campanas/clinicas', role: 'cliente' });
    assert.equal(response.status, 403);
});

test('coupon creation persists custom soles or percent values and returns the saved coupon', async () => {
    for (const [tipo, valor] of [['monto_fijo', 30], ['monto_fijo', 50], ['monto_fijo', 100], ['monto_fijo', 0.5], ['porcentaje', 25], ['porcentaje', 100]]) {
        const saved = { id: 123, codigo: 'WELCOME', tipo, valor, activo: true, clinica_id: null };
        const pool = { async query(sql, params) {
            assert.match(sql, /INSERT INTO nl_descuentos/);
            assert.equal(params[2], tipo);
            assert.equal(params[3], valor);
            assert.equal(params[10], null);
            return { rows: [saved] };
        } };
        const response = await requestCampaign(pool, { codigo: 'welcome', tipo, valor }, { path: '/cupones' });
        assert.equal(response.status, 201);
        assert.deepEqual(response.body.data, saved);
    }
});

test('invalid discounts and use limits fail before any coupon database write', async () => {
    const pool = { query: async () => assert.fail('Invalid coupon must not query') };
    for (const patch of [{ valor: 0 }, { valor: -1 }, { valor: 'Infinity' }, { valor: 'NaN' }, { valor: true }, { valor: [] }, { tipo: 'porcentaje', valor: 100.01 }, { codigo: '  ' }, { limite_usos_total: 0 }, { limite_usos_por_doctor: 1.5 }]) {
        const response = await requestCampaign(pool, { codigo: 'WELCOME', tipo: 'monto_fijo', valor: 50, ...patch }, { path: '/cupones' });
        assert.equal(response.status, 400);
    }
});

test('empty selected-clinic list rejects before any query or notification', async () => {
    let queries = 0;
    const pool = { query: async () => { queries++; throw new Error('Should not query'); } };
    const response = await requestCampaign(pool, { tipo_audiencia: 'clinicas_especificas', segmento_ids: [] });
    assert.equal(response.status, 400);
    assert.equal(queries, 0);
});

test('old schema blocks a campaign before any writes or dispatch', async () => {
    const calls = [];
    const pool = { async query(sql) { calls.push(sql); assert.match(sql, /to_regclass/); return { rows: [{ ready: false }] }; } };
    const response = await requestCampaign(pool, { tipo_audiencia: 'clinicas_especificas', segmento_ids: [12] });
    assert.equal(response.status, 503);
    assert.match(response.body.error, /migration_938/);
    assert.equal(calls.length, 1);
});

async function requestVisibleCampaign(campaigns, hasRecentOrder = false) {
    const app = express();
    app.locals.pool = {
        async query(sql, params) {
            if (sql.includes('FROM nl_usuarios')) {
                assert.deepEqual(params, [4]);
                return { rows: [{ clinica_id: 12 }] };
            }
            if (sql.includes('FROM nl_campanas_marketing c')) {
                assert.match(sql, /n\.usuario_id = \$1/);
                assert.match(sql, /n\.data->>'campana_id' = c\.id::text/);
                assert.deepEqual(params, [4]);
                return { rows: campaigns };
            }
            if (sql.includes('FROM nl_pedidos')) {
                assert.deepEqual(params, [12]);
                return { rows: [{ has_recent_order: hasRecentOrder }] };
            }
            throw new Error('Unexpected query');
        }
    };
    app.use('/api/marketing', marketingRoutes);
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    try {
        const token = jwt.sign({ id: 4, tipo: 'cliente', clinica_id: 999 }, process.env.JWT_SECRET);
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/marketing/campanas/activas-in-app`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return { status: response.status, body: await response.json() };
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

const visibleCampaign = (tipo_audiencia, segmento_ids) => ({
    id: 30, titulo: 'Campaign', mensaje: 'Message',
    tipo_audiencia, segmento_ids
});

test('in-app campaign is visible only to its selected clinic', async () => {
    const selected = await requestVisibleCampaign([visibleCampaign('clinicas_especificas', [12])]);
    assert.equal(selected.status, 200);
    assert.equal(selected.body.campana.id, 30);
    const notSelected = await requestVisibleCampaign([visibleCampaign('clinicas_especificas', [13])]);
    assert.equal(notSelected.body.campana, null);
});

test('in-app inactive campaign requires no recent clinic order', async () => {
    const inactive = visibleCampaign('inactivos', []);
    assert.equal((await requestVisibleCampaign([inactive], false)).body.campana.id, 30);
    assert.equal((await requestVisibleCampaign([inactive], true)).body.campana, null);
});

test('in-app all-client campaign is visible to a notified client', async () => {
    const response = await requestVisibleCampaign([visibleCampaign('todos', [])]);
    assert.equal(response.body.campana.id, 30);
});

test('in-app malformed stored audience or segment list fails closed', async () => {
    for (const campaign of [
        visibleCampaign('clinicas_especificas', []),
        visibleCampaign('clinicas_especificas', ['bad', 12]),
        visibleCampaign('todos', null),
        visibleCampaign('unknown', [])
    ]) {
        assert.equal((await requestVisibleCampaign([campaign])).body.campana, null);
    }
});
