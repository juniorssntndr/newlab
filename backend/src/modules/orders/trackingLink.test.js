import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'unit-test-secret-must-be-long-enough-for-security-check';
import { makeOrderService } from './application/services/orderService.js';

test('Tracking Link: generates valid tracking token for guest/counter order', async () => {
    const fakeRepo = {
        getOrderBaseById: async ({ orderId }) => ({
            id: orderId,
            clinica_id: 88,
            clinica_nombre: 'Clínica Dental del Sur',
            estado: 'en_diseno'
        })
    };

    const orderService = makeOrderService({
        orderRepository: fakeRepo,
        repeatRepository: {},
        pool: {}
    });

    const result = await orderService.getOrderTrackingLink({
        user: { id: 1, tipo: 'admin' },
        orderId: 200
    });

    assert.equal(result.ok, true);
    assert.ok(result.data.token);
    assert.equal(result.data.orderId, 200);
    assert.ok(result.data.urlPath.startsWith('/t/'));

    // Verify token content
    const decoded = jwt.decode(result.data.token);
    assert.equal(decoded.typ, 'order-tracking');
    assert.equal(decoded.orderId, '200');
    assert.equal(decoded.clinicaId, 88);
});

test('Tracking Link: rejects client role requesting link generation', async () => {
    const orderService = makeOrderService({
        orderRepository: {},
        repeatRepository: {},
        pool: {}
    });

    const result = await orderService.getOrderTrackingLink({
        user: { id: 5, tipo: 'cliente' },
        orderId: 200
    });

    assert.equal(result.ok, false);
    assert.equal(result.type, 'FORBIDDEN');
});
