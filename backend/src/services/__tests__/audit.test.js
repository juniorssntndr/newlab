import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDiff, writeAuditEvent } from '../audit.js';

test('computeDiff calcula cambios con precisión solo para campos modificados', () => {
    const before = {
        nombre: 'Corona Zirconia',
        precio_base: 120,
        categoria_id: 1,
        tiempo_estimado_dias: 5,
        activo: true
    };

    const after = {
        nombre: 'Corona Zirconia Monolítica',
        precio_base: 150,
        categoria_id: 1, // sin cambio
        tiempo_estimado_dias: 5, // sin cambio
        activo: true // sin cambio
    };

    const diff = computeDiff(before, after, ['nombre', 'precio_base', 'categoria_id', 'tiempo_estimado_dias', 'activo']);

    assert.deepEqual(diff, {
        nombre: {
            before: 'Corona Zirconia',
            after: 'Corona Zirconia Monolítica'
        },
        precio_base: {
            before: 120,
            after: 150
        }
    });
});

test('computeDiff retorna objeto vacío si no hubo alteraciones en los campos vigilados', () => {
    const before = { precio_base: 200, activo: true };
    const after = { precio_base: 200, activo: true };

    const diff = computeDiff(before, after, ['precio_base', 'activo']);
    assert.deepEqual(diff, {});
});

test('computeDiff detecta diferencias en arreglos o sub-objetos JSON', () => {
    const before = { piezas: ['11', '21'] };
    const after = { piezas: ['11', '21', '22'] };

    const diff = computeDiff(before, after, ['piezas']);
    assert.deepEqual(diff, {
        piezas: {
            before: ['11', '21'],
            after: ['11', '21', '22']
        }
    });
});

test('writeAuditEvent ejecuta query con parámetros saneados sin fallar si no hay pool', async () => {
    // Si no hay pool, la llamada debe retornar sin arrojar excepción
    await assert.doesNotReject(async () => {
        await writeAuditEvent({}, {
            entidad: 'pedido',
            entidadId: 42,
            accion: 'pedido_created',
            metadata: { total: 150 }
        });
    });
});

test('writeAuditEvent envía parámetros esperados a pool.query', async () => {
    const queries = [];
    const fakePool = {
        query: async (sql, params) => {
            queries.push({ sql, params });
            return { rows: [] };
        }
    };

    const fakeReq = {
        user: { id: 7, email: 'admin@afinixlab.com' },
        ip: '192.168.1.10',
        headers: { 'user-agent': 'Mozilla/5.0 Test' },
        app: { locals: { pool: fakePool } }
    };

    await writeAuditEvent(fakeReq, {
        entidad: 'comprobante',
        entidadId: 99,
        accion: 'comprobante_emitido',
        descripcion: 'Factura F001-00000010 emitida',
        metadata: { total: 350.50, serie: 'F001' }
    });

    assert.equal(queries.length, 1);
    const [q] = queries;
    assert.match(q.sql, /INSERT INTO nl_audit_eventos/);
    assert.equal(q.params[0], 7); // usuario_id
    assert.equal(q.params[1], 'comprobante'); // entidad
    assert.equal(q.params[2], '99'); // entidad_id
    assert.equal(q.params[3], 'comprobante_emitido'); // accion
    assert.equal(q.params[4], 'Factura F001-00000010 emitida'); // descripcion
    assert.deepEqual(q.params[5], { total: 350.50, serie: 'F001' }); // metadata
    assert.equal(q.params[6], '192.168.1.10'); // ip
    assert.equal(q.params[7], 'Mozilla/5.0 Test'); // user-agent
});
