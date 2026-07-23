import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
    const pedidos = await pool.query(`
        SELECT p.id, p.codigo, p.estado, p.total, p.paciente_nombre,
               c.razon_social AS clinica,
               (SELECT count(*) FROM nl_comprobantes x
                 WHERE x.pedido_id = p.id AND x.estado_sunat != 'anulado') AS comps_activos
        FROM nl_pedidos p
        LEFT JOIN nl_clinicas c ON c.id = p.clinica_id
        ORDER BY p.id DESC
        LIMIT 10
    `);
    console.log('--- pedidos ---');
    console.log(JSON.stringify(pedidos.rows, null, 2));

    const comps = await pool.query(`
        SELECT id, pedido_id, serie, correlativo, estado_sunat, idempotency_key,
               left(coalesce(provider_error::text,''), 200) AS err
        FROM nl_comprobantes
        ORDER BY id DESC
        LIMIT 5
    `);
    console.log('--- comprobantes ---');
    console.log(JSON.stringify(comps.rows, null, 2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
