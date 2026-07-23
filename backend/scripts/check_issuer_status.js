import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
    const result = await pool.query(`
        SELECT id, ruc, razon_social, entorno, serie_factura, serie_boleta, activo,
               CASE
                 WHEN token_apisperu IS NULL OR length(trim(token_apisperu)) = 0 THEN 'EMPTY'
                 WHEN token_apisperu ILIKE 'TU_%' OR token_apisperu ILIKE 'tu_%' THEN 'PLACEHOLDER'
                 ELSE 'SET(len=' || length(token_apisperu) || ')'
               END AS token_status
        FROM nl_empresas
        ORDER BY id
    `);
    console.log(JSON.stringify(result.rows, null, 2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
