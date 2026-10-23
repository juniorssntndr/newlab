import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationFile = 'migration_941_producto_permite_express.sql';

async function run() {
    console.log('Connecting to database...');
    const client = await pool.connect();

    try {
        console.log(`Ejecutando migración ${migrationFile}...`);
        const sqlPath = path.resolve(directory, migrationFile);
        const sql = await fs.readFile(sqlPath, 'utf8');
        await client.query(sql);
        console.log('Migración 941 ejecutada con éxito.');

        const checkRes = await client.query('SELECT id, nombre, permite_express FROM nl_productos LIMIT 5');
        console.log('Productos de muestra tras migración:');
        console.table(checkRes.rows);
    } catch (err) {
        console.error('Error durante la migración:', err);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

run();
