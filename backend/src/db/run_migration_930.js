import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationFile = 'migration_930_modo_odontograma.sql';

try {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sql = await fs.readFile(path.join(directory, migrationFile), 'utf8');
        console.log(`Executing ${migrationFile}...`);
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration 930 executed successfully.');

        const check = await client.query(`
            SELECT id, nombre, modo_odontograma, admite_puente 
            FROM nl_productos 
            ORDER BY id ASC
        `);
        console.log('Updated products sample:', check.rows.slice(0, 10));
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 930 failed:', err);
        process.exitCode = 1;
    } finally {
        client.release();
    }
} catch (err) {
    console.error('Database connection failed:', err);
    process.exitCode = 1;
} finally {
    await pool.end();
}
