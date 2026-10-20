import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import notificationsRoutes, { visibleNotificationPredicate } from './notificaciones.js';

process.env.JWT_SECRET = 'campaign-notification-mock-secret';
const notices = [
    { id: 1, usuario_id: 99, tipo: 'campana_marketing', leida: false, data: { campana_id: 10, mostrar_toast_in_app: true, fecha_fin: '2099-01-01' }, created_at: '2026-01-01' },
    { id: 2, usuario_id: 99, tipo: 'pedido', leida: false, data: { campana_id: 10 }, created_at: '2026-01-02' },
    { id: 3, usuario_id: 99, tipo: 'prueba_campana', leida: false, data: { campana_id: null, fecha_fin: '2020-01-01' }, created_at: '2026-01-03' },
    { id: 4, usuario_id: 99, tipo: 'pedido', leida: true, data: {}, created_at: '2026-01-04' }
];
async function withInbox(run) {
    const campaigns = new Map([[10, { activo: true, mostrar_toast_in_app: true, fecha_fin: '2099-01-01' }]]);
    let calls = 0;
    const app = express();
    app.locals.pool = { async query(sql, params) {
        calls++;
        assert.deepEqual(params, [99]);
        assert.ok(sql.includes(visibleNotificationPredicate));
        assert.equal(sql.split(visibleNotificationPredicate).length - 1, 1);
        assert.match(sql, /WITH visible AS MATERIALIZED/);
        assert.match(sql, /FROM visible WHERE leida = FALSE/);
        assert.match(sql, /jsonb_agg/);
        // Schema-shaped oracle exercises the actual SQL contract above without
        // pretending to execute PostgreSQL. Optional PG proof lives separately.
        const visible = notices.filter(notice => {
            if (notice.tipo !== 'campana_marketing') return true;
            const campaign = campaigns.get(notice.data.campana_id);
            return Boolean(campaign?.activo && campaign.mostrar_toast_in_app && (!campaign.fecha_fin || new Date(campaign.fecha_fin) >= new Date()));
        });
        const unreadOnly = sql.includes('SELECT * FROM visible WHERE leida = FALSE');
        return { rows: [{ items: visible.filter(n => !unreadOnly || !n.leida).toSorted((a, b) => b.created_at.localeCompare(a.created_at)), no_leidas: visible.filter(n => !n.leida).length }] };
    } };
    app.use('/api/notificaciones', notificationsRoutes);
    const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const token = jwt.sign({ id: 99, tipo: 'cliente' }, process.env.JWT_SECRET);
    const poll = async unread => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/notificaciones${unread ? '?no_leidas=true' : ''}`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 200);
        return response.json();
    };
    try { await run({ campaigns, poll, calls: () => calls }); }
    finally { await new Promise(resolve => server.close(resolve)); }
}
test('pause before poll hides campaign notice and unread contribution even with stale copied active data', async () => {
    await withInbox(async ({ campaigns, poll, calls }) => {
        assert.deepEqual((await poll(false)).items.map(n => n.id), [4, 3, 2, 1]);
        campaigns.get(10).activo = false;
        const full = await poll(false);
        const unread = await poll(true);
        assert.deepEqual(full.items.map(n => n.id), [4, 3, 2]);
        assert.deepEqual(unread.items.map(n => n.id), [3, 2]);
        assert.equal(full.no_leidas, 2);
        assert.equal(unread.no_leidas, 2);
        assert.equal(calls(), 3); // One consistent snapshot/round trip per poll.
        assert.deepEqual(full.items.find(n => n.id === 2).data, { campana_id: 10 });
    });
});
test('authoritative expiry and disabled portal channel suppress campaign only; ordinary and test stay intact', async () => {
    await withInbox(async ({ campaigns, poll }) => {
        campaigns.get(10).fecha_fin = '2020-01-01';
        const expired = await poll(false);
        assert.deepEqual(expired.items.map(n => n.id), [4, 3, 2]);
        assert.equal(expired.no_leidas, 2);
        campaigns.get(10).fecha_fin = null; // Legacy campaign without end remains compatible.
        assert.equal((await poll(false)).no_leidas, 3);
        campaigns.get(10).mostrar_toast_in_app = false;
        assert.equal((await poll(false)).no_leidas, 2);
        campaigns.delete(10);
        assert.equal((await poll(false)).no_leidas, 2);
    });
});
