import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationFile = 'migration_929_proveedores.sql';

try {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sql = await fs.readFile(path.join(directory, migrationFile), 'utf8');
        console.log(`Executing ${migrationFile}...`);
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration 929 executed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 929 failed:', err);
    } finally {
        client.release();
    }
} catch (err) {
    console.error('Database connection failed:', err);
} finally {
    await pool.end();
}
