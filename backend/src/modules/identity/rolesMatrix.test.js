import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { requireRole, forbidRole, authenticateToken } from '../../middleware/auth.js';

process.env.JWT_SECRET = 'role-matrix-test-secret';

const createToken = (tipo) => jwt.sign({ id: 10, tipo, nombre: `User-${tipo}` }, process.env.JWT_SECRET);

const buildTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use(authenticateToken);

    // Admin-only route
    app.get('/api/test/admin-only', requireRole('admin'), (req, res) => res.json({ ok: true }));

    // Cashier route (Admin + Operador)
    app.get('/api/test/cashier', requireRole('admin', 'operador'), (req, res) => res.json({ ok: true }));

    // Production route (Admin + Tecnico)
    app.get('/api/test/production', requireRole('admin', 'tecnico'), (req, res) => res.json({ ok: true }));

    // CRM operational route (Admin + Operador + Tecnico + Visitador)
    app.get('/api/test/crm-ops', requireRole('admin', 'operador', 'tecnico', 'visitador'), (req, res) => res.json({ ok: true }));

    // Customer route
    app.get('/api/test/customer', requireRole('cliente'), (req, res) => res.json({ ok: true }));

    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
};

test('Role Matrix: Admin has full access to all privileged routes', async () => {
    const server = await buildTestApp();
    const base = `http://127.0.0.1:${server.address().port}`;
    const token = createToken('admin');

    try {
        const r1 = await fetch(`${base}/api/test/admin-only`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(r1.status, 200);

        const r2 = await fetch(`${base}/api/test/cashier`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(r2.status, 200);

        const r3 = await fetch(`${base}/api/test/production`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(r3.status, 200);

        const r4 = await fetch(`${base}/api/test/crm-ops`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(r4.status, 200);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('Role Matrix: Operador can access cashier and crm-ops, but NOT production or admin-only', async () => {
    const server = await buildTestApp();
    const base = `http://127.0.0.1:${server.address().port}`;
    const token = createToken('operador');

    try {
        const rAdmin = await fetch(`${base}/api/test/admin-only`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rAdmin.status, 403);

        const rCashier = await fetch(`${base}/api/test/cashier`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rCashier.status, 200);

        const rProd = await fetch(`${base}/api/test/production`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rProd.status, 403);

        const rCrm = await fetch(`${base}/api/test/crm-ops`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rCrm.status, 200);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('Role Matrix: Tecnico can access production, but NOT cashier or admin-only', async () => {
    const server = await buildTestApp();
    const base = `http://127.0.0.1:${server.address().port}`;
    const token = createToken('tecnico');

    try {
        const rAdmin = await fetch(`${base}/api/test/admin-only`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rAdmin.status, 403);

        const rCashier = await fetch(`${base}/api/test/cashier`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rCashier.status, 403);

        const rProd = await fetch(`${base}/api/test/production`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rProd.status, 200);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('Role Matrix: Visitador is restricted to CRM and blocked from financial/production/admin routes', async () => {
    const server = await buildTestApp();
    const base = `http://127.0.0.1:${server.address().port}`;
    const token = createToken('visitador');

    try {
        const rAdmin = await fetch(`${base}/api/test/admin-only`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rAdmin.status, 403);

        const rCashier = await fetch(`${base}/api/test/cashier`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rCashier.status, 403);

        const rProd = await fetch(`${base}/api/test/production`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rProd.status, 403);

        const rCrm = await fetch(`${base}/api/test/crm-ops`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(rCrm.status, 200);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
