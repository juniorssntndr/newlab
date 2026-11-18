import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOrderService } from './orderService.js';

test('orderService: deleteOrder blocks non-admin users', async () => {
    const mockRepo = {
        async deleteOrder() {
            throw new Error('Should not be called');
        }
    };
    const orderService = makeOrderService({ orderRepository: mockRepo });

    const clientRes = await orderService.deleteOrder({
        user: { id: 1, tipo: 'cliente', rol: 'cliente' },
        orderId: 10
    });
    assert.equal(clientRes.ok, false);
    assert.equal(clientRes.type, 'FORBIDDEN');

    const techRes = await orderService.deleteOrder({
        user: { id: 2, tipo: 'tecnico', rol: 'tecnico' },
        orderId: 10
    });
    assert.equal(techRes.ok, false);
    assert.equal(techRes.type, 'FORBIDDEN');
});

test('orderService: deleteOrder validates invalid orderId', async () => {
    const mockRepo = {};
    const orderService = makeOrderService({ orderRepository: mockRepo });

    const res = await orderService.deleteOrder({
        user: { id: 1, tipo: 'admin', rol: 'admin' },
        orderId: 'abc'
    });
    assert.equal(res.ok, false);
    assert.equal(res.type, 'BAD_REQUEST');
});

test('orderService: deleteOrder propagates fiscal/session block from repository', async () => {
    const mockRepo = {
        async deleteOrder({ orderId }) {
            return {
                ok: false,
                status: 400,
                error: 'No se puede eliminar el pedido porque tiene un comprobante fiscal SUNAT emitido (F001-00000001).'
            };
        }
    };
    const orderService = makeOrderService({ orderRepository: mockRepo });

    const res = await orderService.deleteOrder({
        user: { id: 1, tipo: 'admin', rol: 'admin' },
        orderId: 15
    });
    assert.equal(res.ok, false);
    assert.equal(res.type, 'BAD_REQUEST');
    assert.match(res.error, /comprobante fiscal/);
});

test('orderService: deleteOrder succeeds when admin deletes clean/test order', async () => {
    let capturedOrderId = null;
    const mockRepo = {
        async deleteOrder({ orderId }) {
            capturedOrderId = orderId;
            return {
                ok: true,
                data: { id: orderId, codigo: 'NL-00099', paciente_nombre: 'Paciente Test' }
            };
        }
    };
    const orderService = makeOrderService({ orderRepository: mockRepo });

    const res = await orderService.deleteOrder({
        user: { id: 1, tipo: 'admin', rol: 'admin' },
        orderId: '99'
    });
    assert.equal(res.ok, true);
    assert.equal(res.type, 'SUCCESS');
    assert.equal(capturedOrderId, 99);
    assert.equal(res.data.codigo, 'NL-00099');
});
