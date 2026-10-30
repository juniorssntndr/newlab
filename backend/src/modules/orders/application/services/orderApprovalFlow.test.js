import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOrderService } from './orderService.js';

const makeHarness = ({ status = 'esperando_aprobacion', approvals = null } = {}) => {
    const calls = { statusUpdates: [], timeline: [], notifications: [], notificationsRead: [] };
    const order = { id: 42, codigo: 'AF-00042', clinica_id: 7, estado: status };
    const approvalsList = approvals || [
        { id: 9, link_exocad: 'https://viewer.exocad.com/demo', estado: 'pendiente', archivo_disponible: true }
    ];
    const orderRepository = {
        getOrderBaseById: async () => order,
        listOrderApprovals: async () => approvalsList,
        respondOrderApproval: async ({ approvalId, estado, comentarioCliente }) => {
            const approval = approvalsList.find((a) => a.id === approvalId) || approvalsList[0];
            approval.estado = estado;
            approval.comentario_cliente = comentarioCliente;
            return {
                pedido: order,
                approval
            };
        },
        updateOrderStatus: async (input) => {
            calls.statusUpdates.push(input);
            const prev = order.estado;
            order.estado = input.estado;
            return {
                pedido: { ...order },
                previousOrder: { ...order, estado: prev }
            };
        },
        createOrderApprovalLink: async ({ link_exocad }) => {
            const approval = { id: approvalsList.length + 10, link_exocad, estado: 'pendiente', archivo_disponible: true };
            approvalsList.unshift(approval);
            return { approval };
        },
        getActiveClinicUsers: async () => [{ id: 11 }],
        addNotification: async (notification) => calls.notifications.push(notification),
        markOrderNotificationsRead: async (payload) => calls.notificationsRead.push(payload),
        addTimelineEntry: async (entry) => calls.timeline.push(entry),
        getActiveLabUsers: async () => [{ id: 2 }],
        getDesignNotificationRecipients: async () => [{ id: 5, nombre: 'Diseñador CAD', tipo: 'tecnico' }, { id: 2, nombre: 'Admin', tipo: 'admin' }]
    };

    return { service: makeOrderService({ orderRepository }), order, calls, approvalsList };
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

test('bidirectional cycle: esperando_aprobacion -> en_produccion -> esperando_aprobacion -> en_produccion -> terminado', async () => {
    const { service, order, calls, approvalsList } = makeHarness({ status: 'esperando_aprobacion' });

    // Step 1: Doctor approves initial design -> moves to en_produccion
    const clientUser = { id: 11, tipo: 'cliente', clinica_id: 7 };
    const labUser = { id: 2, tipo: 'tecnico' };

    const approve1 = await service.respondOrderApproval({
        user: clientUser,
        orderId: 42,
        approvalId: 9,
        body: { estado: 'aprobado' }
    });
    assert.equal(approve1.ok, true);
    assert.equal(order.estado, 'en_produccion');
    assert.equal(calls.timeline.at(-1).nextStatus, 'en_produccion');

    // Step 2: During production, lab sends order back to approval for intermediate clinical trial
    const trialTransition = await service.updateOrderStatus({
        user: labUser,
        orderId: 42,
        body: {
            estado: 'esperando_aprobacion',
            comentario: 'Prueba de estructura metálica enviada a clínica'
        }
    });
    assert.equal(trialTransition.ok, true);
    assert.equal(order.estado, 'esperando_aprobacion');
    assert.equal(calls.timeline.at(-1).previousStatus, 'en_produccion');
    assert.equal(calls.timeline.at(-1).nextStatus, 'esperando_aprobacion');
    assert.equal(calls.timeline.at(-1).comment, 'Prueba de estructura metálica enviada a clínica');
    // Notice that an approval iteration was created so the client can respond
    assert.equal(approvalsList[0].estado, 'pendiente');

    // Step 3: Doctor approves the clinical trial -> advances back to en_produccion
    const approve2 = await service.respondOrderApproval({
        user: clientUser,
        orderId: 42,
        approvalId: approvalsList[0].id,
        body: { estado: 'aprobado', comentario_cliente: 'Estructura asienta perfecto, proceder a cerámica' }
    });
    assert.equal(approve2.ok, true);
    assert.equal(order.estado, 'en_produccion');
    assert.equal(calls.timeline.at(-1).previousStatus, 'esperando_aprobacion');
    assert.equal(calls.timeline.at(-1).nextStatus, 'en_produccion');

    // Step 4: Final production completes -> lab advances to terminado
    const finishOrder = await service.updateOrderStatus({
        user: labUser,
        orderId: 42,
        body: {
            estado: 'terminado'
        }
    });
    assert.equal(finishOrder.ok, true);
    assert.equal(order.estado, 'terminado');
    assert.equal(calls.timeline.at(-1).previousStatus, 'en_produccion');
    assert.equal(calls.timeline.at(-1).nextStatus, 'terminado');

    // Verify timeline history preserves all steps accurately
    const statusSequence = calls.timeline.map((entry) => `${entry.previousStatus}->${entry.nextStatus}`);
    assert.deepEqual(statusSequence, [
        'esperando_aprobacion->en_produccion',
        'en_produccion->esperando_aprobacion',
        'esperando_aprobacion->en_produccion',
        'en_produccion->terminado'
    ]);
});

test('transition en_produccion -> esperando_aprobacion does not require rollback reason and uses default clinical comment', async () => {
    const { service, order, calls } = makeHarness({ status: 'en_produccion' });
    const labUser = { id: 2, tipo: 'tecnico' };

    const result = await service.updateOrderStatus({
        user: labUser,
        orderId: 42,
        body: {
            estado: 'esperando_aprobacion'
            // No comment provided
        }
    });

    assert.equal(result.ok, true);
    assert.equal(order.estado, 'esperando_aprobacion');
    assert.equal(calls.timeline.at(-1).comment, 'Prueba clínica intermedia enviada a aprobación');
    assert.equal(calls.notifications.at(-1).title, '⭐ Prueba clínica lista para aprobación');
});

test('createOrderApprovalLink while in en_produccion transitions order to esperando_aprobacion', async () => {
    const { service, order, calls } = makeHarness({ status: 'en_produccion' });
    const labUser = { id: 2, tipo: 'admin' };

    const result = await service.createOrderApprovalLink({
        user: labUser,
        orderId: 42,
        body: {
            link_exocad: 'https://viewer.exocad.com/adjusted-v3',
            comentario: 'Diseño reajustado tras prueba clínica'
        }
    });

    assert.equal(result.ok, true);
    assert.equal(order.estado, 'esperando_aprobacion');
    assert.equal(calls.timeline.at(-1).previousStatus, 'en_produccion');
    assert.equal(calls.timeline.at(-1).nextStatus, 'esperando_aprobacion');
    assert.equal(calls.timeline.at(-1).comment, 'Diseño reajustado tras prueba clínica');
    assert.equal(calls.notifications.at(-1).type, 'aprobacion');
    assert.match(calls.notifications.at(-1).title, /Prueba clínica/);
});

test('invalid transitions remain strictly forbidden', async () => {
    const labUser = { id: 2, tipo: 'admin' };

    // From pendiente to terminado directly
    const { service: service1 } = makeHarness({ status: 'pendiente' });
    const invalid1 = await service1.updateOrderStatus({
        user: labUser,
        orderId: 42,
        body: { estado: 'terminado' }
    });
    assert.equal(invalid1.ok, false);
    assert.equal(invalid1.type, 'BAD_REQUEST');
    assert.match(invalid1.error, /Transición de "pendiente" a "terminado" no permitida/);

    // From esperando_aprobacion to terminado directly
    const { service: service2 } = makeHarness({ status: 'esperando_aprobacion' });
    const invalid2 = await service2.updateOrderStatus({
        user: labUser,
        orderId: 42,
        body: { estado: 'terminado' }
    });
    assert.equal(invalid2.ok, false);
    assert.equal(invalid2.type, 'BAD_REQUEST');
    assert.match(invalid2.error, /Transición de "esperando_aprobacion" a "terminado" no permitida/);

    // Normal rollback still requires comment if not en_produccion -> esperando_aprobacion
    const { service: service3 } = makeHarness({ status: 'en_produccion' });
    const invalid3 = await service3.updateOrderStatus({
        user: labUser,
        orderId: 42,
        body: { estado: 'en_diseno' } // rewinding to design without comment
    });
    assert.equal(invalid3.ok, false);
    assert.equal(invalid3.type, 'BAD_REQUEST');
    assert.equal(invalid3.error, 'Motivo es requerido para retroceder estado');
});
