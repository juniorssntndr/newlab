import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
    const comps = await pool.query(`
        SELECT id, pedido_id, tipo_comprobante, serie, correlativo, estado_sunat,
               provider_error, receptor_documento, receptor_razon_social,
               left(coalesce(provider_error::text, ''), 400) AS err_preview
        FROM nl_comprobantes
        ORDER BY id DESC
        LIMIT 5
    `);
    console.log('--- last comprobantes ---');
    console.log(JSON.stringify(comps.rows, null, 2));

    const issuer = await pool.query(`
        SELECT id, ruc, razon_social, entorno,
               CASE WHEN token_apisperu IS NULL OR length(trim(token_apisperu))=0 THEN 'EMPTY'
                    ELSE 'SET(len=' || length(token_apisperu) || ')' END AS token_status
        FROM nl_empresas WHERE id=1
    `);
    console.log('--- issuer ---');
    console.log(JSON.stringify(issuer.rows, null, 2));
    console.log('APISPERU_MOCK=', process.env.APISPERU_MOCK);
    console.log('USE_NEW_BILLING_ACL=', process.env.USE_NEW_BILLING_ACL);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
