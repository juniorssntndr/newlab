import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { buildRepeatQuote, validateRepeatInput, canManageOrderRepeats } from './domain/orderRepeat.js';
import { detectRepeatPhoto } from './domain/repeatPhoto.js';
import { makeOrderRepeatPgRepository } from './infrastructure/repositories/orderRepeatPgRepository.js';
import { makeOrderRepeatService } from './application/services/orderRepeatService.js';
import { makeOrderService } from './application/services/orderService.js';
import { makeOrderController } from './application/controllers/orderController.js';
import { makeOrderRoutes } from './transport/http/orderRoutes.js';
import legacyRoutes from '../../routes/pedidos.js';

const source = { id: 1, codigo: 'NL-00001', estado: 'enviado', clinica_id: 10,
    paciente_nombre: 'Ana García Pérez', total: '118.00', subtotal: '100.00', igv: '18.00',
    observaciones: '[INGRESO:digital]\nCorona pieza 36', responsable_id: 9, fecha_entrega: '2026-01-01' };
const item = { id: 5, producto_id: 7, cantidad: '1.00', precio_base: '118.00', activo: true,
    producto_nombre: 'Corona de Zirconia Monolítica', material: 'Zirconia Monolítica', color_vita: 'A2',
    piezas_dentales: ['36'], pilares_dentales: [], ponticos_dentales: [], tramos_detalle: [], guia_color: 'vita',
    notas: 'Arcada inferior', delivery_date: '2026-10-08' };
const admin = { id: 4, tipo: 'admin' };
const body = { kind: 'warranty', reason: 'No adapta: repetir pieza 36',
    requestKey: '0b924312-ef47-4c23-b634-5768427a94c9', expectedTotal: 0 };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

test('only authorized internal order staff can repeat or read private evidence', () => {
    assert.equal(canManageOrderRepeats(admin), true);
    for (const tipo of ['socio','tecnico','operador']) {
        assert.equal(canManageOrderRepeats({ tipo, modulos: ['pedidos'] }), true);
        assert.equal(canManageOrderRepeats({ tipo, modulos: [] }), false);
    }
    for (const tipo of ['cliente','visitador','unknown',undefined]) assert.equal(canManageOrderRepeats({ tipo, modulos: ['pedidos'] }), false);
});
test('brief mandatory reason, optional photos and explicit paid agreement', () => {
    assert.equal(validateRepeatInput(body).photos.length, 0);
    assert.throws(() => validateRepeatInput({ ...body, reason: ' ' }));
    assert.throws(() => validateRepeatInput({ ...body, kind: 'paid', expectedTotal: 118 }));
    assert.equal(validateRepeatInput({ ...body, kind: 'paid', chargeAgreed: 'true', expectedTotal: 118 }).chargeAgreed, true);
    assert.throws(() => validateRepeatInput({ ...body, requestKey: '-'.repeat(36) }));
});
test('catalogue total is IGV-inclusive and source must have one valid product', () => {
    assert.deepEqual(buildRepeatQuote(source, [item], 1.18), { total: 118, subtotal: 100, igv: 18, deliveryDate: item.delivery_date, productName: item.producto_nombre });
    for (const items of [[], [{ ...item, producto_id: null }], [item,{ ...item, producto_id: 8 }], [{ ...item, activo: false }], [{ ...item, cantidad: Infinity }]]) assert.throws(() => buildRepeatQuote(source, items, 1.18));
    assert.throws(() => buildRepeatQuote({ ...source, estado: 'terminado' }, [item], 1.18));
    assert.equal(buildRepeatQuote(source, [item,{ ...item, cantidad: '2' }], 1.18).total, 354);
});
test('photo validation rejects executable bytes, forged/truncated containers, oversize and mismatched MIME', () => {
    // Generate a valid PNG using independently computed CRC in the test fixture below.
    assert.equal(detectRepeatPhoto(validPng()), 'image/png');
    const photo = { buffer: validPng(), mimetype: 'image/png' };
    assert.equal(validateRepeatInput(body,[photo]).photos.length, 1);
    for (const buffer of [Buffer.from('<script>alert(1)</script>'), png.subarray(0,16), Buffer.concat([validPng(),Buffer.from('<script>')]), Buffer.alloc(5242881)]) assert.equal(detectRepeatPhoto(buffer), null);
    assert.throws(() => validateRepeatInput(body,[{ ...photo, mimetype: 'image/jpeg' }]));
    assert.throws(() => validateRepeatInput(body,Array(4).fill(photo)));
    const jpeg = Buffer.from('/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAB//Z','base64');
    const webp = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=','base64');
    assert.equal(detectRepeatPhoto(jpeg),'image/jpeg');
    assert.equal(detectRepeatPhoto(webp),'image/webp');
    assert.equal(detectRepeatPhoto(webp.subarray(0,24)),null);
});
function validPng() {
    const bytes = Buffer.from(png);
    let offset = 8;
    while (offset + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
        let crc = 0xffffffff;
        for (const byte of bytes.subarray(offset + 4, end - 4)) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
        bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0,end - 4);
        offset = end;
    }
    return bytes;
}

const mockPool = ({ failPhotos = false, items = [item] } = {}) => {
    const calls = [], children = [], photos = [];
    let snapshot;
    const query = async (sql, values = []) => {
        calls.push({ sql, values });
        if (sql === 'BEGIN') snapshot = { children: children.length, photos: photos.length };
        if (sql === 'ROLLBACK') { children.length = snapshot.children; photos.length = snapshot.photos; }
        if (sql.includes('WHERE repeat_request_key')) return { rows: children.filter(c => c.repeat_request_key === values[0]) };
        if (sql.startsWith('SELECT * FROM nl_pedidos WHERE id=')) return { rows: [source] };
        if (sql.includes('FROM nl_pedido_items i')) return { rows: items };
        if (sql.includes('nextval')) return { rows: [{ id: 2 }] };
        if (sql.includes('INSERT INTO nl_pedidos')) {
            const c = { id: values[0], codigo: values[1], clinica_id: values[2], paciente_nombre: values[3], fecha_entrega: values[4],
                estado: 'en_diseno', subtotal: values[6], igv: values[7], total: values[8], created_by: values[9],
                repeat_source_id: values[10], repeat_kind: values[11], repeat_reason: values[12], repeat_reference_total: values[13],
                repeat_request_key: values[14], repeat_request_hash: values[15], responsable_id: null };
            children.push(c);
            return { rows: [c] };
        }
        if (sql.includes('INSERT INTO nl_pedido_repeat_photos')) {
            if (failPhotos) throw new Error('Photo insert failed');
            photos.push(values);
        }
        return { rows: [] };
    };
    return { query, connect: async () => ({ query, release() {} }), calls, children, photos };
};
for (const kind of ['warranty','paid']) test(`${kind}: atomic independent child, clinical copy and untouched original finances`, async () => {
    const pool = mockPool(), original = structuredClone(source);
    const repo = makeOrderRepeatPgRepository({ pool, igvFactor: 1.18 });
    const input = validateRepeatInput({ ...body, kind, chargeAgreed: true, expectedTotal: kind === 'paid' ? 118 : 0 });
    const child = await repo.create(1,4,input);
    assert.deepEqual(source,original);
    assert.equal(child.id,2);
    assert.equal(child.estado,'en_diseno');
    assert.equal(child.responsable_id,null);
    assert.equal(child.fecha_entrega,item.delivery_date);
    assert.equal(child.repeat_source_id,1);
    assert.equal(child.repeat_reference_total,118);
    assert.equal(child.total,kind === 'paid' ? 118 : 0);
    assert.equal(child.subtotal,kind === 'paid' ? 100 : 0);
    assert.equal(child.igv,kind === 'paid' ? 18 : 0);
    const line = pool.calls.find(c => c.sql.includes('INSERT INTO nl_pedido_items'));
    assert.deepEqual(line.values[2],['36']);
    assert.equal(line.values[10],item.material);
    assert.equal(line.values[11],item.color_vita);
    assert.equal(line.values[17],kind === 'paid' ? 118 : 0);
    assert.equal(pool.calls.some(c => /UPDATE nl_pedidos|nl_pagos|nl_comprobantes|nl_pedido_aprobaciones/.test(c.sql)),false);
    assert.equal(pool.calls.at(-1).sql,'COMMIT');
    assert.equal(pool.calls.filter(c => c.sql.includes('INSERT INTO nl_pedido_timeline')).length,1);
    const replay = await repo.create(1,4,input);
    assert.equal(replay.id,child.id);
    assert.equal(pool.children.length,1);
    await assert.rejects(repo.create(1,4,{ ...input, reason: 'Changed' }),/otros datos/);
    await assert.rejects(repo.create(3,4,input),/otros datos/);
    await assert.rejects(repo.create(1,8,input),/otros datos/);
});
test('transaction rollback leaves no partial child or photo; changed price and mixed products fail before insert', async () => {
    const pool = mockPool({ failPhotos: true }), repo = makeOrderRepeatPgRepository({ pool, igvFactor: 1.18 });
    const input = validateRepeatInput(body,[{ buffer: validPng(), mimetype: 'image/png' }]);
    await assert.rejects(repo.create(1,4,input),/Photo insert failed/);
    assert.equal(pool.children.length,0);
    assert.equal(pool.photos.length,0);
    assert.equal(pool.calls.at(-1).sql,'ROLLBACK');
    await assert.rejects(repo.create(1,4,{ ...input, kind: 'paid', expectedTotal: 119 }),/precio cambió/);
    const mixed = makeOrderRepeatPgRepository({ pool: mockPool({ items: [item,{ ...item, producto_id: 9 }] }), igvFactor: 1.18 });
    await assert.rejects(mixed.create(1,4,input),/único tipo/);
});
test('sent rollback and old approval response blocked before mutation', async () => {
    const service = makeOrderService({ orderRepository: { getOrderBaseById: async () => source } });
    const result = await service.updateOrderStatus({ user: admin, orderId:1, body: { estado:'terminado', comentario:'Returned' } });
    assert.equal(result.type,'BAD_REQUEST');
    const response = await service.respondOrderApproval({ user:{ id:5,tipo:'cliente',clinica_id:10 }, orderId:1,approvalId:1,body:{ estado:'aprobado' } });
    assert.equal(response.type,'BAD_REQUEST');
    const link = await service.createOrderApprovalLink({ user:admin,orderId:1,body:{ link_exocad:'https://example.com/design' } });
    assert.equal(link.type,'BAD_REQUEST');
});

for (const routeKind of ['module','legacy']) test(`${routeKind} HTTP: clients cannot quote, create or download; authorized photos are private attachments`, async () => {
    process.env.JWT_SECRET = 'repeat-test-key';
    let writes = 0;
    const repeatService = makeOrderRepeatService({ repeatRepository: {
        quote: async () => ({ total:118 }), create: async () => { writes++; return { id:2 }; },
        readPhoto: async (orderId, photoId) => orderId === '2' && photoId === '1' ? { data:validPng(),mime_type:'image/png' } : null
    } });
    const orderController = makeOrderController({ orderService: repeatService });
    const app = express();
    app.locals.modules = { orders: { orderController } };
    app.use(express.json());
    app.use('/pedidos', routeKind === 'module' ? makeOrderRoutes({ orderController }) : legacyRoutes);
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening',resolve));
    const url = `http://127.0.0.1:${server.address().port}/pedidos`;
    const headers = (user) => ({ Authorization:`Bearer ${jwt.sign(user,process.env.JWT_SECRET)}` });
    try {
        for (const user of [{ id:1,tipo:'cliente',clinica_id:10 },{ id:1,tipo:'tecnico',modulos:[] },{ id:1,tipo:'visitador',modulos:['pedidos'] }]) {
            assert.equal((await fetch(`${url}/1/repeticion/cotizacion`,{ headers:headers(user) })).status,403);
            assert.equal((await fetch(`${url}/1/repeticion`,{ method:'POST',headers:headers(user) })).status,403);
            assert.equal((await fetch(`${url}/2/repeticion/fotos/1`,{ headers:headers(user) })).status,403);
        }
        assert.equal(writes,0);
        assert.equal((await fetch(`${url}/1/repeticion/cotizacion`)).status,401);
        assert.equal((await fetch(`${url}/1/repeticion/cotizacion`,{ headers:headers(admin) })).status,200);
        const photo = await fetch(`${url}/2/repeticion/fotos/1`,{ headers:headers(admin) });
        assert.equal(photo.status,200);
        assert.equal(photo.headers.get('cache-control'),'private, no-store');
        assert.match(photo.headers.get('content-disposition'),/^attachment/);
        assert.equal(photo.headers.get('x-content-type-options'),'nosniff');
        assert.equal((await fetch(`${url}/1/repeticion/fotos/1`,{ headers:headers(admin) })).status,404);
        const form = new FormData();
        for (const [key,value] of Object.entries(body)) form.append(key,String(value));
        form.append('photos',new Blob([validPng()],{ type:'image/png' }),'../../evidence.png');
        assert.equal((await fetch(`${url}/1/repeticion`,{ method:'POST',headers:headers(admin),body:form })).status,200);
        assert.equal(writes,1);
        const forged = new FormData();
        for (const [key,value] of Object.entries(body)) forged.append(key,String(value));
        forged.append('photos',new Blob(['<html>'],{ type:'image/png' }),'image.png');
        assert.equal((await fetch(`${url}/1/repeticion`,{ method:'POST',headers:headers(admin),body:forged })).status,400);
        assert.equal(writes,1);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
