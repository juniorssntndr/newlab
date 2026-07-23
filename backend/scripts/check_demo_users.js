import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
    const result = await pool.query(`
        SELECT id, email, tipo, estado,
               CASE
                 WHEN password_hash IS NULL OR length(trim(password_hash)) = 0 THEN 'NO_HASH'
                 ELSE 'HAS_HASH'
               END AS pwd
        FROM nl_usuarios
        WHERE email ILIKE '%admin%'
           OR email ILIKE '%tecnico%'
           OR email ILIKE '%newlab%'
           OR email ILIKE '%sonrisas%'
        ORDER BY id
        LIMIT 20
    `);
    console.log(JSON.stringify(result.rows, null, 2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
