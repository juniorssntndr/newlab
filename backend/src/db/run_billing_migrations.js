import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const directory = path.dirname(fileURLToPath(import.meta.url));
const files = ['migration_912_billing_delivery_safety.sql', 'migration_913_billing_phase2.sql'];

try {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const file of files) {
            const sql = await fs.readFile(path.join(directory, file), 'utf8');
            console.log(`- ${file}`);
            await client.query(sql);
        }
        await client.query('COMMIT');
        console.log('Billing migrations completed successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
} catch (error) {
    console.error('Billing migration failed:', error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
