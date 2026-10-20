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
        getActiveLabUsers: async () => [{ id: 2 }],
        getDesignNotificationRecipients: async () => [{ id: 5, nombre: 'Diseñador CAD', tipo: 'tecnico' }, { id: 2, nombre: 'Admin', tipo: 'admin' }]
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

test('approval response advances the order workflow to production', async () => {
    const { service, calls } = makeHarness();

    await service.respondOrderApproval({
        user: { id: 11, tipo: 'cliente', clinica_id: 7 },
        orderId: 42,
        approvalId: 9,
        body: { estado: 'aprobado' }
    });

    assert.deepEqual(calls.statusUpdates, [{ orderId: 42, estado: 'en_produccion' }]);
    assert.equal(calls.timeline.at(-1).previousStatus, 'esperando_aprobacion');
    assert.equal(calls.timeline.at(-1).nextStatus, 'en_produccion');
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

test('client requesting 3D design notifies designer and admin and records timeline', async () => {
    const { service, calls } = makeHarness({ status: 'en_diseno' });

    const result = await service.requestDesign({
        user: { id: 11, tipo: 'cliente', clinica_id: 7 },
        orderId: 42
    });

    assert.equal(result.ok, true);
    assert.equal(calls.notifications.length, 2);
    assert.equal(calls.notifications[0].type, 'solicitud_diseno');
    assert.match(calls.notifications[0].title, /Solicitud de diseño 3D/);
    assert.equal(calls.timeline.at(-1).comment, 'Cliente solicitó el diseño 3D interactivo');
});

test('client requesting 3D design on an already sent order succeeds and notifies team', async () => {
    const { service, calls } = makeHarness({ status: 'enviado' });

    const result = await service.requestDesign({
        user: { id: 11, tipo: 'cliente', clinica_id: 7 },
        orderId: 42
    });

    assert.equal(result.ok, true);
    assert.equal(calls.notifications.length, 2);
});

