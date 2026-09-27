import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const directory = path.dirname(fileURLToPath(import.meta.url));
const migrationFile = 'migration_924_bridge_multi_spans.sql';

try {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sql = await fs.readFile(path.join(directory, migrationFile), 'utf8');
        console.log(`Executing ${migrationFile}...`);
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration 924 executed successfully.');

        // Verify columns
        const productCheck = await client.query(`
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'nl_productos' AND column_name = 'admite_puente'
        `);
        console.log('nl_productos.admite_puente:', productCheck.rows[0]);

        const itemsCheck = await client.query(`
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'nl_pedido_items' AND column_name IN ('ponticos_dentales', 'tramos_detalle', 'guia_color')
        `);
        console.log('nl_pedido_items new columns:', itemsCheck.rows);

        const countUpdated = await client.query(`
            SELECT COUNT(*) as count 
            FROM nl_productos 
            WHERE admite_puente = true
        `);
        console.log('Products with admite_puente = true:', countUpdated.rows[0].count);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
} catch (error) {
    console.error('Migration 924 failed:', error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
