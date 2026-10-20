import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignDispatch, previewCampaignAudience } from './marketingCampaignService.js';

const body = patch => ({ titulo: 'Opening', mensaje: 'S/ 50 for your next order.', tipo_audiencia: 'todos', segmento_ids: [], request_id: 'campaign-request-0001', fecha_inicio: '2026-01-01', fecha_fin: '2099-12-31', link_destino: '/pedidos/nuevo', mostrar_toast_in_app: true, enviar_push_web: false, beneficio: { tipo: 'monto_fijo', valor: 50, limite_usos_por_clinica: 1 }, ...patch });

// This models orchestration and transaction boundaries, not PostgreSQL trigger execution.
function fakePool({ ready = true, recipientRows = [{ id: 4, clinica_id: 12 }, { id: 5, clinica_id: 12 }], devices = [], failAt = '', sendState = 'accepted' } = {}) {
    const calls = []; const receipts = new Map(); const jobs = new Map(); const coupons = [];
    let coupon = 0; let campaign = 0; let releaseLock = null; let lockTail = Promise.resolve();
    const pool = {
        calls, coupons,
        async query(sql, params = []) {
            calls.push({ sql, params });
            if (failAt && sql.includes(failAt)) throw new Error('synthetic database failure');
            if (sql.includes('to_regclass')) return { rows: [{ ready }] };
            if (sql.includes('SELECT u.id')) return { rows: recipientRows };
            if (sql.startsWith('SELECT id FROM nl_clinicas')) return { rows: params[0].map(id => ({ id })) };
            if (sql.includes('COUNT(*)::int AS devices')) return { rows: [{ devices: devices.length, accounts: new Set(devices.map(s => s.usuario_id)).size }] };
            if (sql.includes('SELECT id,usuario_id,endpoint')) return { rows: devices.filter(d => params[0].includes(d.usuario_id)) };
            if (sql.startsWith('SELECT * FROM nl_campana_envios')) return { rows: [...receipts.values()].filter(r => r.creado_por === params[0] && r.request_id === params[1]) };
            if (sql.includes('SELECT estado, COUNT')) {
                const counts = new Map(); for (const job of jobs.values()) if (job.envio_id === params[0]) counts.set(job.estado, (counts.get(job.estado) || 0) + 1);
                return { rows: [...counts].map(([estado, total]) => ({ estado, total })) };
            }
            if (sql.startsWith('UPDATE nl_campana_push_envios')) { const job = jobs.get(`${params[0]}:${params[1]}`); if (job) job.estado = params[2] || 'sending'; return { rows: [] }; }
            if (sql.startsWith('UPDATE nl_campana_envios')) { receipts.get(params[0]).estado = params[1] || 'partial'; return { rows: [] }; }
            return { rows: [] };
        },
        async connect() {
            let snapshot;
            return { release() {}, async query(sql, params = []) {
                if (sql === 'BEGIN') { snapshot = { receipts: new Map(receipts), jobs: new Map(jobs), coupon, campaign, couponCount: coupons.length }; calls.push({ sql, params }); return { rows: [] }; }
                if (sql.includes('pg_advisory_xact_lock')) {
                    const previous = lockTail; lockTail = new Promise(resolve => { releaseLock = resolve; });
                    const unlock = releaseLock; await previous;
                    this.unlock = unlock;
                    // Each competing transaction observes a fresh committed state after the lock.
                    snapshot = { receipts: new Map(receipts), jobs: new Map(jobs), coupon, campaign, couponCount: coupons.length };
                    return { rows: [] };
                }
                if (sql === 'ROLLBACK') {
                    calls.push({ sql, params }); receipts.clear(); for (const [k, v] of snapshot.receipts) receipts.set(k, v); jobs.clear(); for (const [k, v] of snapshot.jobs) jobs.set(k, v);
                    coupon = snapshot.coupon; campaign = snapshot.campaign; coupons.length = snapshot.couponCount; this.unlock?.(); return { rows: [] };
                }
                if (sql === 'COMMIT') { calls.push({ sql, params }); this.unlock?.(); return { rows: [] }; }
                if (sql.startsWith('SELECT id, payload_hash')) return { rows: [...receipts.values()].filter(r => r.creado_por === params[0] && r.request_id === params[1]) };
                if (sql.includes('INSERT INTO nl_descuentos')) { calls.push({ sql, params }); coupons.push(params); return { rows: [{ id: ++coupon }] }; }
                if (sql.includes('INSERT INTO nl_campanas_marketing')) { calls.push({ sql, params }); return { rows: [{ id: ++campaign }] }; }
                if (sql.includes('INSERT INTO nl_campana_envios')) { calls.push({ sql, params }); receipts.set(params[0], { id: params[0], request_id: params[1], creado_por: params[2], payload_hash: params[3], es_prueba: params[4], campana_id: params[5], estado: 'dispatching', metricas: JSON.parse(params[6]) }); return { rows: [] }; }
                if (sql.includes('INSERT INTO nl_campana_push_envios')) { for (const s of JSON.parse(params[1])) jobs.set(`${params[0]}:${s.id}`, { envio_id: params[0], ...s, estado: 'pending' }); return { rows: [] }; }
                return pool.query(sql, params);
            } };
        }
    };
    return pool;
}
const create = (pool, input = body(), extra = {}) => createCampaignDispatch({ pool, ownerId: 99, body: input, validateImage: () => {}, sendPush: async () => ({ state: 'accepted' }), ...extra });

test('preview distinguishes accounts, clinics and push-enabled devices without guaranteed delivery', async () => {
    const pool = fakePool({ devices: [{ id: 1, usuario_id: 4 }, { id: 2, usuario_id: 4 }] });
    assert.deepEqual(await previewCampaignAudience(pool, body()), { total: 2, cuentas: 2, clinicas: 1, cuentas_push: 1, dispositivos_push: 2, sin_push: 1 });
});
test('missing migration and invalid input fail before writes or provider calls', async () => {
    const pool = fakePool({ ready: false });
    await assert.rejects(create(pool), { status: 503 });
    await assert.rejects(create(pool, body({ mostrar_toast_in_app: false })), { status: 400 });
    assert.equal(pool.calls.some(c => /INSERT|UPDATE|BEGIN/.test(c.sql)), false);
});
test('campaign and coupon persist together with clinic quota and independent code', async () => {
    const pool = fakePool();
    const result = await create(pool);
    await create(pool, body({ request_id: 'campaign-request-0002' }));
    assert.equal(result.metricas.avisos_portal, 2);
    assert.equal(result.metricas.clinicas_objetivo, 1);
    assert.equal(pool.coupons.length, 2);
    assert.notEqual(pool.coupons[0][0], pool.coupons[1][0]);
    assert.equal(pool.coupons[0][4], 1);
    const third = await create(pool, body({ request_id: 'campaign-request-0003', beneficio: { tipo: 'porcentaje', valor: 30, limite_usos_por_clinica: 3 } }));
    assert.equal(pool.coupons[2][4], 3);
    assert.equal(third.estado, 'completed');
});
test('transaction failure rolls back campaign, coupon, audience and notices', async () => {
    const pool = fakePool({ failAt: 'INSERT INTO nl_notificaciones' });
    await assert.rejects(create(pool), /synthetic/);
    assert.equal(pool.coupons.length, 0);
    assert.ok(pool.calls.some(c => c.sql === 'ROLLBACK'));
    assert.equal(pool.calls.some(c => c.sql === 'COMMIT'), false);
});
test('concurrent duplicate request is serialized and does not duplicate writes or push', async () => {
    const pool = fakePool({ devices: [{ id: 1, usuario_id: 4, endpoint: 'synthetic' }] });
    let sent = 0;
    const sendPush = async () => { sent++; return { state: 'accepted' }; };
    const results = await Promise.all([create(pool, body({ enviar_push_web: true }), { sendPush }), create(pool, body({ enviar_push_web: true }), { sendPush })]);
    assert.equal(sent, 1);
    assert.equal(pool.coupons.length, 1);
    assert.ok(results.some(r => r.repetido));
    await assert.rejects(create(pool, body({ mensaje: 'different payload', enviar_push_web: true })), { status: 409 });
});
test('self-test fixes target to owner, creates no campaign/coupon and keeps honest receipt', async () => {
    const pool = fakePool({ devices: [{ id: 1, usuario_id: 99 }] });
    const result = await create(pool, body({ enviar_push_web: true, userIds: [4], segmento_ids: [12] }), { isTest: true, sendPush: async () => ({ state: 'failed' }) });
    assert.equal(pool.coupons.length, 0);
    assert.equal(pool.calls.some(c => c.sql.includes('INSERT INTO nl_campanas_marketing')), false);
    const notice = pool.calls.find(c => c.sql.includes('INSERT INTO nl_notificaciones'));
    assert.deepEqual(notice.params[0], [99]);
    assert.equal(notice.params[1], 'prueba_campana');
    assert.equal(result.metricas.push_fallidos, 1);
    assert.equal(result.estado, 'partial');
});
test('push-only channel never creates portal notices; unknown provider result never replays', async () => {
    const pool = fakePool({ devices: [{ id: 1, usuario_id: 4 }] });
    let attempts = 0;
    const sendPush = async () => { attempts++; throw new Error('interrupted provider'); };
    const input = body({ mostrar_toast_in_app: false, enviar_push_web: true });
    const result = await create(pool, input, { sendPush });
    assert.equal(result.metricas.avisos_portal, 0);
    assert.equal(result.metricas.push_inciertos, 1);
    assert.equal(result.estado, 'partial');
    assert.equal(pool.calls.some(c => c.sql.includes('INSERT INTO nl_notificaciones')), false);
    await create(pool, input, { sendPush });
    assert.equal(attempts, 1);
});
test('push batching caps provider concurrency at five', async () => {
    const devices = Array.from({ length: 13 }, (_, i) => ({ id: i + 1, usuario_id: 4 }));
    const pool = fakePool({ devices }); let active = 0; let maximum = 0;
    const result = await create(pool, body({ enviar_push_web: true }), { sendPush: async () => { maximum = Math.max(maximum, ++active); await new Promise(resolve => setTimeout(resolve, 2)); active--; return { state: 'accepted' }; } });
    assert.equal(maximum, 5);
    assert.equal(result.metricas.push_aceptados, 13);
});
test('adapter unknown outcome stays uncertain/partial and never authorizes replay', async () => {
    const pool = fakePool({ devices: [{ id: 1, usuario_id: 4 }] });
    let attempts = 0;
    const sendPush = async () => { attempts++; return { state: 'unknown', reason: 'provider_result_unconfirmed' }; };
    const input = body({ enviar_push_web: true });
    const result = await create(pool, input, { sendPush });
    assert.equal(result.estado, 'partial');
    assert.equal(result.metricas.push_inciertos, 1);
    assert.equal(result.metricas.push_fallidos, 0);
    assert.match(result.advertencia, /sin resultado confirmado/);
    await create(pool, input, { sendPush });
    assert.equal(attempts, 1);
});
