import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const directory = path.dirname(fileURLToPath(import.meta.url));
const migrationFile = 'migration_925_push_subscriptions.sql';

try {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sql = await fs.readFile(path.join(directory, migrationFile), 'utf8');
        console.log(`Executing ${migrationFile}...`);
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration 925 executed successfully.');

        const check = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'nl_push_subscriptions'
        `);
        console.log('Table created:', check.rows[0]);
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
