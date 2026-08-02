import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dir = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(dir, '../src/db/migration_916_identity_local_overrides.sql');

try {
    const sql = await fs.readFile(sqlPath, 'utf8');
    await pool.query(sql);
    const { rows } = await pool.query("SELECT to_regclass('public.nl_identity_overrides') AS table_name");
    console.log(JSON.stringify({ ok: true, table: rows[0]?.table_name }, null, 2));
} catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
