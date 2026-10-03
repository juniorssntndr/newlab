import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOrderService } from './orderService.js';

const makeHarness = ({ status = 'esperando_aprobacion' } = {}) => {
    const calls = { statusUpdates: [], timeline: [], notifications: [], notificationsRead: [] };
    const order = { id: 42, codigo: 'AF-00042', clinica_id: 7, estado: status };
    const orderRepository = {
        getOrderBaseById: async () => order,
        respondOrderApproval: async () => ({
            pedido: order,
            approval: { id: 9, estado: 'ajuste_solicitado' }
        }),
        updateOrderStatus: async (input) => calls.statusUpdates.push(input),
        createOrderApprovalLink: async ({ link_exocad }) => ({ approval: { id: 10, link_exocad } }),
        getActiveClinicUsers: async () => [{ id: 11 }],
        addNotification: async (notification) => calls.notifications.push(notification),
        markOrderNotificationsRead: async (payload) => calls.notificationsRead.push(payload),
        addTimelineEntry: async (entry) => calls.timeline.push(entry),
        getActiveLabUsers: async () => [{ id: 2 }]
    };

    return { service: makeOrderService({ orderRepository }), order, calls };
};

test('client adjustment request returns a pending approval order to design', async () => {
    const { service, calls } = makeHarness();

    const result = await service.respondOrderApproval({
        user: { id: 11, tipo: 'cliente', clinica_id: 7 },
        orderId: 42,
        approvalId: 9,
        body: { estado: 'ajuste_solicitado', comentario_cliente: 'Ajustar margen' }
    });

    assert.equal(result.ok, true);
    assert.deepEqual(calls.statusUpdates, [{ orderId: 42, estado: 'en_diseno' }]);
    assert.equal(calls.timeline.at(-1).previousStatus, 'esperando_aprobacion');
    assert.equal(calls.timeline.at(-1).nextStatus, 'en_diseno');
    assert.equal(calls.notifications.at(-1).type, 'ajuste_solicitado');
    assert.deepEqual(calls.notificationsRead, [{ orderId: 42, types: ['aprobacion'] }]);
});

test('approval response does not change the order workflow status', async () => {
    const { service, calls } = makeHarness();

    await service.respondOrderApproval({
        user: { id: 11, tipo: 'cliente', clinica_id: 7 },
        orderId: 42,
        approvalId: 9,
        body: { estado: 'aprobado' }
    });

    assert.deepEqual(calls.statusUpdates, []);
    assert.equal(calls.timeline.at(-1).previousStatus, 'esperando_aprobacion');
    assert.equal(calls.timeline.at(-1).nextStatus, 'esperando_aprobacion');
    assert.deepEqual(calls.notificationsRead, [{ orderId: 42, types: ['aprobacion'] }]);
});

test('publishing a replacement approval from design returns the order to client review', async () => {
    const { service, calls } = makeHarness({ status: 'en_diseno' });

    const result = await service.createOrderApprovalLink({
        user: { id: 3, tipo: 'admin' },
        orderId: 42,
        body: { link_exocad: 'private-viewer://orders/42/diseno-v2.html' }
    });

    assert.equal(result.ok, true);
    assert.deepEqual(calls.statusUpdates, [{ orderId: 42, estado: 'esperando_aprobacion' }]);
    assert.equal(calls.timeline.at(-1).previousStatus, 'en_diseno');
    assert.equal(calls.timeline.at(-1).nextStatus, 'esperando_aprobacion');
    assert.equal(calls.notifications.at(-1).type, 'aprobacion');
});

test('an adjustment outside client review does not rewind another order state', async () => {
    const { service, calls } = makeHarness({ status: 'en_produccion' });

    await service.respondOrderApproval({
        user: { id: 11, tipo: 'cliente', clinica_id: 7 },
        orderId: 42,
        approvalId: 9,
        body: { estado: 'ajuste_solicitado', comentario_cliente: 'Ajustar margen' }
    });

    assert.deepEqual(calls.statusUpdates, []);
    assert.equal(calls.timeline.at(-1).previousStatus, 'en_produccion');
    assert.equal(calls.timeline.at(-1).nextStatus, 'en_produccion');
});
