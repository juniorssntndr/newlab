/**
 * Limpia pedidos y comprobantes de prueba en entorno local/beta.
 *
 * Uso:
 *   node scripts/clean_test_billing.js           # dry-run
 *   node scripts/clean_test_billing.js --confirm # ejecuta
 *
 * Conserva empresas, clínicas, usuarios y catálogos.
 * Deja el correlativo B001/F001 en un piso seguro para no chocar
 * con números ya usados en APISPERU beta (Swagger / emisiones previas).
 */
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const CONFIRM = process.argv.includes('--confirm');
const CORRELATIVO_PISO = Number(process.env.CLEAN_CORRELATIVO_PISO || 50);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const count = async (sql) => {
    const { rows } = await pool.query(sql);
    return Number(rows[0]?.n || 0);
};

try {
    const snapshot = {
        pedidos: await count('SELECT COUNT(*)::int AS n FROM nl_pedidos'),
        comprobantes: await count('SELECT COUNT(*)::int AS n FROM nl_comprobantes'),
        notasCredito: await count('SELECT COUNT(*)::int AS n FROM nl_notas_credito'),
        bajas: await count('SELECT COUNT(*)::int AS n FROM nl_comunicaciones_baja'),
        resumenItems: await count('SELECT COUNT(*)::int AS n FROM nl_resumen_diario_items'),
        pagos: await count('SELECT COUNT(*)::int AS n FROM nl_pagos')
    };

    const { rows: correlativos } = await pool.query(
        'SELECT tipo_comprobante, serie, ultimo_correlativo FROM nl_correlativos ORDER BY tipo_comprobante, serie'
    );

    console.log(JSON.stringify({ mode: CONFIRM ? 'CONFIRM' : 'DRY_RUN', snapshot, correlativos }, null, 2));

    if (!CONFIRM) {
        console.log('\nDry-run only. Re-run with --confirm to delete.');
        process.exit(0);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Quitar FKs RESTRICT antes de borrar comprobantes/pedidos
        await client.query('DELETE FROM nl_resumen_diario_items');
        await client.query('DELETE FROM nl_comunicaciones_baja');
        await client.query('DELETE FROM nl_notas_credito');
        await client.query('DELETE FROM nl_comprobantes');
        // Cascade: items, timeline, aprobaciones, pagos ligados al pedido
        const delPedidos = await client.query('DELETE FROM nl_pedidos RETURNING id');

        await client.query(`
            INSERT INTO nl_correlativos (tipo_comprobante, serie, ultimo_correlativo, updated_at)
            VALUES
                ('03', 'B001', $1, NOW()),
                ('01', 'F001', $1, NOW())
            ON CONFLICT (tipo_comprobante, serie) DO UPDATE
            SET ultimo_correlativo = GREATEST(nl_correlativos.ultimo_correlativo, EXCLUDED.ultimo_correlativo),
                updated_at = NOW()
        `, [CORRELATIVO_PISO]);

        // Si quedó algún correlativo residual, elevarlo al piso
        await client.query(`
            UPDATE nl_correlativos
            SET ultimo_correlativo = GREATEST(ultimo_correlativo, $1),
                updated_at = NOW()
        `, [CORRELATIVO_PISO]);

        await client.query('COMMIT');

        const after = {
            pedidosDeleted: delPedidos.rowCount,
            pedidos: await count('SELECT COUNT(*)::int AS n FROM nl_pedidos'),
            comprobantes: await count('SELECT COUNT(*)::int AS n FROM nl_comprobantes'),
            correlativos: (await pool.query(
                'SELECT tipo_comprobante, serie, ultimo_correlativo FROM nl_correlativos ORDER BY tipo_comprobante, serie'
            )).rows
        };
        console.log(JSON.stringify({ ok: true, after }, null, 2));
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
} catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
