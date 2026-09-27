import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { makeCrmService } from '../../application/services/crmService.js';
import { makeCrmController } from '../../application/controllers/crmController.js';
import { makeCrmRoutes } from './crmRoutes.js';

process.env.JWT_SECRET = 'crm-route-test-secret';

const buildServer = async () => {
    const crmRepository = {
        async listEstablishments() { return { rows: [], total: 0, page: 1, limit: 100 }; }
    };
    const crmService = makeCrmService({ crmRepository });
    const crmController = makeCrmController({ crmService });
    const app = express();
    app.use(express.json());
    app.use('/api/crm', makeCrmRoutes({ crmController }));
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
};

const token = (tipo) => jwt.sign({ id: 7, tipo, nombre: 'QA' }, process.env.JWT_SECRET);

test('CRM rejects anonymous access and allows visitor operational listing', async () => {
    const server = await buildServer();
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const anonymous = await fetch(`${base}/api/crm/establecimientos`);
        assert.equal(anonymous.status, 401);
        const response = await fetch(`${base}/api/crm/establecimientos`, { headers: { Authorization: `Bearer ${token('visitador')}` } });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.deepEqual(body.rows, []);
    } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('visitor cannot access import preview', async () => {
    const server = await buildServer();
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const response = await fetch(`${base}/api/crm/importaciones/preview`, {
            method: 'POST', headers: { Authorization: `Bearer ${token('visitador')}` }
        });
        assert.equal(response.status, 403);
    } finally { await new Promise((resolve) => server.close(resolve)); }
});
