import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'unit-test-secret-must-be-long-enough-for-security-check';
import { makeOrderService } from './application/services/orderService.js';

test('Magic Link: generates valid token for order clinic client', async () => {
    let queriedClinicId = null;
    const fakeRepo = {
        getOrderBaseById: async ({ orderId }) => ({
            id: orderId,
            clinica_id: 42,
            estado: 'esperando_aprobacion'
        }),
        findClientUserByClinicId: async ({ clinicaId }) => {
            queriedClinicId = clinicaId;
            return {
                id: 99,
                nombre: 'Dr. Roberto Mendoza',
                email: 'mendoza@clinica.pe',
                tipo: 'cliente'
            };
        }
    };

    const orderService = makeOrderService({
        orderRepository: fakeRepo,
        repeatRepository: {},
        pool: {}
    });

    const result = await orderService.getOrderMagicLink({
        user: { id: 1, tipo: 'admin' },
        orderId: 105
    });

    assert.equal(result.ok, true);
    assert.equal(queriedClinicId, 42);
    assert.ok(result.data.token);
    assert.equal(result.data.orderId, 105);
    assert.equal(result.data.clientName, 'Dr. Roberto Mendoza');
    assert.ok(result.data.urlPath.startsWith('/acceso?token='));

    // Verify token content
    const decoded = jwt.decode(result.data.token);
    assert.equal(decoded.typ, 'magic-link');
    assert.equal(decoded.userId, 99);
    assert.equal(decoded.orderId, '105');
    assert.equal(decoded.clinicaId, 42);
    assert.equal(decoded.redirect, '/pedidos/105');
});

test('Magic Link: rejects client requesting magic link for orders', async () => {
    const orderService = makeOrderService({
        orderRepository: {},
        repeatRepository: {},
        pool: {}
    });

    const result = await orderService.getOrderMagicLink({
        user: { id: 99, tipo: 'cliente' },
        orderId: 105
    });

    assert.equal(result.ok, false);
    assert.equal(result.type, 'FORBIDDEN');
});
