import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// Explicit opt-in only. Never load .env or use the configured application database.
// Run against a disposable PostgreSQL database, with CREATE SCHEMA permission.
const url = process.env.CAMPAIGN_TEST_DATABASE_URL;
test('PostgreSQL campaign quota serializes concurrent clinic claims and rolls back excess use', { skip: !url }, async () => {
    assert.notEqual(url, process.env.DATABASE_URL, 'Use a disposable database, not the configured application database');
    const schema = `campaign_test_${crypto.randomBytes(6).toString('hex')}`;
    const root = new pg.Pool({ connectionString: url });
    await root.query(`CREATE SCHEMA ${schema}`);
    const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    try {
        await pool.query(`CREATE TABLE nl_usuarios(id INTEGER PRIMARY KEY);
            CREATE TABLE nl_clinicas(id INTEGER PRIMARY KEY);
            CREATE TABLE nl_pedidos(id INTEGER PRIMARY KEY);
            CREATE TABLE nl_descuentos(id INTEGER PRIMARY KEY, activo BOOLEAN, fecha_inicio TIMESTAMPTZ, fecha_fin TIMESTAMPTZ, limite_usos_por_doctor INTEGER, usos_actuales INTEGER);
            CREATE TABLE nl_campanas_marketing(id INTEGER PRIMARY KEY, cupon_id INTEGER, activo BOOLEAN);
            CREATE TABLE nl_descuentos_usos(id SERIAL PRIMARY KEY, descuento_id INTEGER, clinica_id INTEGER, pedido_id INTEGER);
            INSERT INTO nl_usuarios VALUES(4),(5); INSERT INTO nl_clinicas VALUES(12);`);
        const migration = await fs.readFile(new URL('../db/migration_938_campaign_delivery.sql', import.meta.url), 'utf8');
        await pool.query(migration);
        await pool.query(`INSERT INTO nl_descuentos VALUES(1,TRUE,NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 days',1,0),(2,TRUE,NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 days',2,0),(3,TRUE,NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 days',1,0);
            INSERT INTO nl_campanas_marketing(id,cupon_id,activo,fecha_inicio,fecha_fin) VALUES(1,1,TRUE,NOW(),NOW()+INTERVAL '30 days'),(2,2,TRUE,NOW(),NOW()+INTERVAL '30 days');
            INSERT INTO nl_campana_destinatarios VALUES(1,4,12),(2,4,12);`);
        const claim = async (couponId, orderId) => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query('SELECT id FROM nl_descuentos WHERE id=$1 FOR UPDATE', [couponId]);
                await client.query('UPDATE nl_descuentos SET usos_actuales=usos_actuales+1 WHERE id=$1', [couponId]);
                await client.query('INSERT INTO nl_pedidos VALUES($1)', [orderId]);
                await client.query('INSERT INTO nl_descuentos_usos(descuento_id,clinica_id,pedido_id) VALUES($1,12,$2)', [couponId, orderId]);
                await client.query('COMMIT');
            } catch (error) { await client.query('ROLLBACK'); throw error; }
            finally { client.release(); }
        };
        const results = await Promise.allSettled([claim(1, 1), claim(1, 2)]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === '23514').length, 1);
        assert.equal((await pool.query('SELECT COUNT(*)::int AS total FROM nl_pedidos')).rows[0].total, 1);
        assert.equal((await pool.query('SELECT usos_actuales FROM nl_descuentos WHERE id=1')).rows[0].usos_actuales, 1);
        await claim(2, 3); await claim(2, 4); await assert.rejects(claim(2, 5), { code: '23514' });
        // An unrelated ordinary coupon is deliberately outside the new trigger policy.
        await claim(3, 6); await claim(3, 7);
    } finally { await pool.end(); await root.query(`DROP SCHEMA ${schema} CASCADE`); await root.end(); }
});
