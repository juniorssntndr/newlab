import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import express from 'express';
import trackingRoutes from './tracking.js';

process.env.JWT_SECRET = 'unit-test-secret-must-be-long-enough-for-security-check';

test('Public Tracking Router: validates token and returns sanitized order details', async () => {
    const app = express();
    app.use(express.json());

    const mockOrder = {
        id: 101,
        codigo: 'NL-00101',
        estado: 'esperando_aprobacion',
        fecha: '2026-10-25',
        fecha_entrega: '2026-10-30',
        paciente_nombre: 'Valeria Castro',
        clinica_id: 12,
        clinica_nombre: 'Dental Art Cusco',
        observaciones: 'Por favor cuidar anatomía oclusal'
    };

    const mockItems = [
        { id: 1, producto_nombre: 'Corona Zirconia Monolítica', cantidad: 1, dientes: [16], color: 'A2', material: 'Zirconia' }
    ];

    const mockApprovals = [
        {
            id: 'app-1',
            estado: 'pendiente',
            comentario: 'Diseño anatómico terminado',
            link_exocad: 'https://webview.dental/preview/12345',
            created_at: '2026-10-26T10:00:00Z'
        }
    ];

    app.locals.modules = {
        orders: {
            orderRepository: {
                getOrderBaseById: async ({ orderId }) => (Number(orderId) === 101 ? mockOrder : null),
                listOrderItems: async () => mockItems,
                listOrderTimeline: async () => [
                    { id: 1, estado_anterior: 'en_diseno', estado_nuevo: 'esperando_aprobacion', created_at: '2026-10-26T10:00:00Z', comentario: 'Enviado a revisión' }
                ],
                listOrderApprovals: async () => mockApprovals
            }
        }
    };

    app.use('/tracking', trackingRoutes);

    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    try {
        const token = jwt.sign(
            { typ: 'order-tracking', orderId: '101', clinicaId: 12 },
            process.env.JWT_SECRET
        );

        const res = await fetch(`http://127.0.0.1:${port}/tracking/${token}`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.order.codigo, 'NL-00101');
        assert.equal(data.order.paciente_nombre, 'Valeria Castro');
        assert.equal(data.order.approval.has3dDesign, true);
        assert.equal(data.order.approval.isDirectWebLink, true);
        assert.equal(data.order.approval.directWebLink, 'https://webview.dental/preview/12345');
    } finally {
        server.close();
    }
});

test('Public Tracking Router: rejects invalid or tampered token', async () => {
    const app = express();
    app.use('/tracking', trackingRoutes);

    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/tracking/invalid-token-here`);
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.ok, false);
    } finally {
        server.close();
    }
});
