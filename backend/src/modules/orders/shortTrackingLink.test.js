import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import trackingRoutes, { resolveTrackingToken } from '../../routes/tracking.js';
import { generateShortCode, makeShortLinkPgRepository } from './infrastructure/repositories/shortLinkPgRepository.js';
import { makeOrderService } from './application/services/orderService.js';

process.env.JWT_SECRET = 'unit-test-secret-must-be-long-enough-for-security-check';

test('Short Link Generator: creates 8-char crypto-random string from safe alphabet', () => {
    const code = generateShortCode();
    assert.equal(code.length, 8);
    // Unambiguous base56 alphabet: no 0, O, 1, l, I
    assert.match(code, /^[23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);

    const code2 = generateShortCode();
    assert.notEqual(code, code2);
});

test('Short Link Repository & Service: generates and reuses short code for order', async () => {
    const memoryDb = new Map();
    let insertCalls = 0;

    const mockPool = {
        query: async (sql, params) => {
            if (sql.includes('SELECT codigo FROM nl_enlaces_cortos')) {
                const orderId = params[0];
                for (const row of memoryDb.values()) {
                    if (row.pedido_id === orderId) {
                        return { rows: [{ codigo: row.codigo }] };
                    }
                }
                return { rows: [] };
            }
            if (sql.includes('INSERT INTO nl_enlaces_cortos')) {
                insertCalls++;
                const [codigo, tipo, pedido_id, clinica_id, url_destino] = params;
                memoryDb.set(codigo, { codigo, tipo, pedido_id, clinica_id, url_destino, visitas: 0 });
                return { rows: [] };
            }
            if (sql.includes('SELECT pedido_id, clinica_id, tipo')) {
                const code = params[0];
                const row = memoryDb.get(code);
                return { rows: row ? [row] : [] };
            }
            if (sql.includes('UPDATE nl_enlaces_cortos')) {
                const code = params[0];
                if (memoryDb.has(code)) {
                    memoryDb.get(code).visitas++;
                }
                return { rows: [] };
            }
            return { rows: [] };
        }
    };

    const fakeRepo = {
        getOrderBaseById: async ({ orderId }) => ({
            id: orderId,
            clinica_id: 42,
            clinica_nombre: 'Clínica Dental Arequipa'
        })
    };

    const orderService = makeOrderService({
        orderRepository: fakeRepo,
        repeatRepository: {},
        pool: mockPool
    });

    // Primera llamada: genera código corto nuevo
    const res1 = await orderService.getOrderTrackingLink({
        user: { id: 1, tipo: 'admin' },
        orderId: 555
    });

    assert.equal(res1.ok, true);
    assert.ok(res1.data.shortCode);
    assert.equal(res1.data.shortCode.length, 8);
    assert.equal(res1.data.urlPath, `/t/${res1.data.shortCode}`);
    assert.equal(res1.data.trackingUrlPath, `/t/${res1.data.shortCode}`);
    assert.equal(insertCalls, 1);

    // Segunda llamada para el mismo pedido: debe REUTILIZAR el código existente
    const res2 = await orderService.getOrderTrackingLink({
        user: { id: 1, tipo: 'admin' },
        orderId: 555
    });

    assert.equal(res2.ok, true);
    assert.equal(res2.data.shortCode, res1.data.shortCode);
    assert.equal(insertCalls, 1); // No inserta duplicado
});

test('Public Tracking Router with Short Link: resolves short code and serves order', async () => {
    const memoryDb = new Map();
    memoryDb.set('8xK9mP2q', {
        codigo: '8xK9mP2q',
        pedido_id: 777,
        clinica_id: 15,
        visitas: 0
    });

    const mockPool = {
        query: async (sql, params) => {
            if (sql.includes('SELECT pedido_id, clinica_id, tipo')) {
                const code = params[0];
                const row = memoryDb.get(code);
                return { rows: row ? [row] : [] };
            }
            if (sql.includes('UPDATE nl_enlaces_cortos')) {
                const code = params[0];
                if (memoryDb.has(code)) memoryDb.get(code).visitas++;
                return { rows: [] };
            }
            return { rows: [] };
        }
    };

    const app = express();
    app.use(express.json());
    app.locals.pool = mockPool;

    const mockOrder = {
        id: 777,
        codigo: 'NL-00777',
        estado: 'esperando_aprobacion',
        fecha: '2026-11-01',
        fecha_entrega: '2026-11-06',
        paciente_nombre: 'Ricardo Palma',
        clinica_id: 15,
        clinica_nombre: 'Clínica Melgar',
        observaciones: 'Caso de prueba'
    };

    app.locals.modules = {
        orders: {
            orderRepository: {
                getOrderBaseById: async ({ orderId }) => (Number(orderId) === 777 ? mockOrder : null),
                listOrderItems: async () => [],
                listOrderTimeline: async () => [],
                listOrderApprovals: async () => []
            }
        }
    };

    app.use('/tracking', trackingRoutes);

    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    try {
        // Test con código corto de 8 caracteres
        const resShort = await fetch(`http://127.0.0.1:${port}/tracking/8xK9mP2q`);
        assert.equal(resShort.status, 200);
        const dataShort = await resShort.json();
        assert.equal(dataShort.ok, true);
        assert.equal(dataShort.order.codigo, 'NL-00777');
        assert.equal(dataShort.order.paciente_nombre, 'Ricardo Palma');
        assert.equal(memoryDb.get('8xK9mP2q').visitas, 1);

        // Test de retrocompatibilidad con JWT clásico
        const jwtToken = jwt.sign(
            { typ: 'order-tracking', orderId: '777', clinicaId: 15 },
            process.env.JWT_SECRET
        );
        const resJwt = await fetch(`http://127.0.0.1:${port}/tracking/${jwtToken}`);
        assert.equal(resJwt.status, 200);
        const dataJwt = await resJwt.json();
        assert.equal(dataJwt.ok, true);
        assert.equal(dataJwt.order.codigo, 'NL-00777');

        // Test con token inexistente/inválido
        const resInvalid = await fetch(`http://127.0.0.1:${port}/tracking/noexiste9`);
        assert.equal(resInvalid.status, 401);
    } finally {
        server.close();
    }
});
