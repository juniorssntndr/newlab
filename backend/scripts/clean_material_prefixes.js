import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PREFIX_REGEX = '^(Analogico|Digital)\\s*-\\s*';

const preview = async () => {
    const result = await pool.query(
        `SELECT id, nombre, flujo
         FROM nl_materiales
         WHERE nombre ~* $1
         ORDER BY nombre`,
        [PREFIX_REGEX]
    );

    return result.rows;
};

const clean = async () => {
    const result = await pool.query(
        `UPDATE nl_materiales
         SET nombre = regexp_replace(nombre, $1, '', 'i')
         WHERE nombre ~* $1
         RETURNING id, nombre, flujo`,
        [PREFIX_REGEX]
    );

    return result.rows;
};

const mode = process.argv[2] || 'preview';

try {
    if (mode === 'apply') {
        const updated = await clean();
        console.log(JSON.stringify({ mode, count: updated.length, rows: updated }, null, 2));
    } else {
        const rows = await preview();
        console.log(JSON.stringify({ mode: 'preview', count: rows.length, rows }, null, 2));
    }
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await pool.end();
}
