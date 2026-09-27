import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const directory = path.dirname(fileURLToPath(import.meta.url));
const migrationFile = 'migration_926_expand_pedido_archivos.sql';

try {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sql = await fs.readFile(path.join(directory, migrationFile), 'utf8');
        console.log(`Executing ${migrationFile}...`);
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration 926 executed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
    }
} catch (err) {
    console.error('Database connection failed:', err);
} finally {
    await pool.end();
}
