import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
    const { rows } = await pool.query(`
        SELECT ruc, razon_social, nombre_comercial, direccion_fiscal, ubigeo, entorno,
               length(token_apisperu) AS token_len,
               (ubigeo IS NOT NULL AND length(trim(ubigeo)) > 0) AS has_ubigeo,
               (direccion_fiscal IS NOT NULL AND length(trim(direccion_fiscal)) > 0) AS has_direccion
        FROM nl_empresas
        WHERE id = 1
    `);
    console.log(JSON.stringify(rows[0], null, 2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
