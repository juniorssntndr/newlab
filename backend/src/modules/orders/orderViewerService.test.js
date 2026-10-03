import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import express from 'express';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { makeOrderViewerService, verifyViewerCapability } from './application/services/orderViewerService.js';
import viewerRoutes from '../../routes/viewer.js';
import { uploadOrderApprovalHtml, readOrderApprovalHtml } from '../../services/storage.js';
import { sanitizeRequestPath } from '../../lib/sanitizeRequestPath.js';

process.env.JWT_SECRET ||= 'viewer-test-secret';
process.env.VIEWER_ORIGIN = 'https://viewer.afinixlab.com';
process.env.FRONTEND_ORIGIN = 'https://afinixlab.com';

const approval = { id: 'approval-1', link_exocad: 'private-viewer://orders/10/diseno-v1.html' };
const repository = {
    getOrderBaseById: async () => ({ id: 10, clinica_id: 4 }),
    listOrderApprovals: async () => [approval]
};

test('viewer session is bound to its order, approval and private object', async () => {
    const result = await makeOrderViewerService({ orderRepository: repository }).createViewerSession({ user: { tipo: 'cliente', clinica_id: 4 }, orderId: 10, approvalId: 'approval-1', parentOrigin: 'https://afinixlab.com' });
    assert.equal(result.ok, true);
    const token = decodeURIComponent(result.data.url.split('/').at(-1));
    const claim = verifyViewerCapability(token);
    assert.deepEqual([claim.orderId, claim.approvalId, claim.objectKey], ['10', 'approval-1', approval.link_exocad]);
    assert.equal(claim.parentOrigin, 'https://afinixlab.com');
    assert.throws(() => jwt.verify(`${token}tampered`, process.env.JWT_SECRET));
});

test('viewer session rejects a clinic that does not own the order', async () => {
    const result = await makeOrderViewerService({ orderRepository: repository }).createViewerSession({ user: { tipo: 'cliente', clinica_id: 9 }, orderId: 10, approvalId: 'approval-1', parentOrigin: 'https://afinixlab.com' });
    assert.equal(result.type, 'FORBIDDEN');
});

test('viewer session refuses an unconfigured postMessage parent origin', async () => {
    const result = await makeOrderViewerService({ orderRepository: repository }).createViewerSession({ user: { tipo: 'cliente', clinica_id: 4 }, orderId: 10, approvalId: 'approval-1', parentOrigin: 'https://attacker.example' });
    assert.equal(result.type, 'FORBIDDEN');
});

test('viewer capability fails closed when expired or for the wrong audience', () => {
    const expired = jwt.sign({ typ: 'order-viewer' }, process.env.JWT_SECRET, { audience: 'afinix-order-viewer', expiresIn: -1 });
    assert.throws(() => verifyViewerCapability(expired));
    const wrongAudience = jwt.sign({ typ: 'order-viewer' }, process.env.JWT_SECRET, { audience: 'different', expiresIn: 60 });
    assert.throws(() => verifyViewerCapability(wrongAudience));
});

test('private upload preserves exact bytes and viewer document headers allow cross-origin embedding', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afinix-viewer-'));
    process.env.PRIVATE_VIEWER_STORAGE_DIR = root;
    process.env.FRONTEND_ORIGIN = 'https://afinixlab.com';
    const html = Buffer.from('<!doctype html><canvas id="model"></canvas>');
    const key = await uploadOrderApprovalHtml({ file: { originalname: 'case.html', buffer: html }, orderId: 10, version: 1 });
    assert.deepEqual(await readOrderApprovalHtml(key), html);
    if (process.platform !== 'win32') assert.equal((await fs.stat(path.join(root, 'orders', '10'))).mode & 0o777, 0o700);
    const token = jwt.sign({ typ: 'order-viewer', orderId: '10', approvalId: 'approval-1', objectKey: key, parentOrigin: 'https://afinixlab.com' }, process.env.JWT_SECRET, { audience: 'afinix-order-viewer', expiresIn: 60 });
    const app = express(); app.use('/viewer', viewerRoutes);
    const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
    try {
        const base = `http://127.0.0.1:${server.address().port}`;
        const response = await fetch(`${base}/viewer/document/${encodeURIComponent(token)}`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-frame-options'), null);
        assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self' https:\/\/afinixlab\.com/);
        assert.match(response.headers.get('cache-control'), /no-store/);
        assert.equal(await response.text(), html.toString());
        const missing = jwt.sign({ typ: 'order-viewer', orderId: '10', approvalId: 'approval-1', objectKey: 'private-viewer://orders/10/missing.html' }, process.env.JWT_SECRET, { audience: 'afinix-order-viewer', expiresIn: 60 });
        assert.equal((await fetch(`${base}/viewer/document/${encodeURIComponent(missing)}`)).status, 404);
        const expired = jwt.sign({ typ: 'order-viewer', orderId: '10', approvalId: 'approval-1', objectKey: key }, process.env.JWT_SECRET, { audience: 'afinix-order-viewer', expiresIn: -1 });
        assert.equal((await fetch(`${base}/viewer/document/${encodeURIComponent(expired)}`)).status, 403);
    } finally { await new Promise((resolve) => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); delete process.env.PRIVATE_VIEWER_STORAGE_DIR; }
});

test('viewer capability paths are redacted before diagnostics', () => {
    assert.equal(sanitizeRequestPath('/viewer/session/eyJ.secret?trace=1'), '/viewer/session/[redacted]?trace=1');
    assert.equal(sanitizeRequestPath('/api/pedidos/10'), '/api/pedidos/10');
});
