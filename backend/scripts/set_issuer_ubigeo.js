import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const UBIGEO = process.argv[2] || '040126';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
    const { rows } = await pool.query(
        `UPDATE nl_empresas
         SET ubigeo = $1, updated_at = NOW()
         WHERE id = 1
         RETURNING id, ruc, direccion_fiscal, ubigeo`,
        [UBIGEO]
    );
    console.log(JSON.stringify(rows[0], null, 2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
