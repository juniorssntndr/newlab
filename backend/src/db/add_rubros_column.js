import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE nl_proveedores ADD COLUMN IF NOT EXISTS rubros TEXT[] DEFAULT '{}';
            UPDATE nl_proveedores SET rubros = ARRAY['Discos CAD/CAM', 'Fresas'] WHERE razon_social ILIKE '%Dental Arequipa%';
            UPDATE nl_proveedores SET rubros = ARRAY['Resinas 3D', 'Consumibles'] WHERE razon_social ILIKE '%Prodent%';
            UPDATE nl_proveedores SET rubros = ARRAY['Servicios Técnicos', 'Fresadoras'] WHERE razon_social ILIKE '%Servicio Técnico%';
        `);
        console.log('Successfully added and populated rubros column in nl_proveedores.');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
