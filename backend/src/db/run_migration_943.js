import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationFile = 'migration_943_enlaces_cortos.sql';

async function run() {
    console.log('Connecting to database...');
    const client = await pool.connect();

    try {
        console.log(`Ejecutando migración ${migrationFile}...`);
        const sqlPath = path.resolve(directory, migrationFile);
        const sql = await fs.readFile(sqlPath, 'utf8');
        await client.query(sql);
        console.log('Migración 943 ejecutada con éxito.');

        const checkRes = await client.query(
            "SELECT table_name FROM information_schema.tables WHERE table_name = 'nl_enlaces_cortos'"
        );
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
