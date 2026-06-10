import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is missing.');
    process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../src/db/migration_950_rescued_data.sql');

const tables = [
    { name: 'nl_categorias_trabajo', sequence: 'nl_categorias_trabajo_id_seq' },
    { name: 'nl_materiales', sequence: 'nl_materiales_id_seq' },
    { name: 'nl_productos', sequence: 'nl_productos_id_seq' }
];

function formatValue(val) {
    if (val === null || val === undefined) {
        return 'NULL';
    }
    if (typeof val === 'string') {
        return `'${val.replace(/'/g, "''")}'`;
    }
    if (typeof val === 'number') {
        return val;
    }
    if (typeof val === 'boolean') {
        return val ? 'true' : 'false';
    }
    if (val instanceof Date) {
        return `'${val.toISOString()}'`;
    }
    if (Array.isArray(val)) {
        const elements = val.map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(', ');
        return `ARRAY[${elements}]`;
    }
    if (typeof val === 'object') {
        return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
}

async function rescue() {
    const pool = new Pool({ connectionString });
    let sqlContent = `-- SQL Migration generated to restore original catalogs\n`;
    sqlContent += `-- Generated at: ${new Date().toISOString()}\n\n`;

    try {
        console.log('Connecting to Supabase...');
        
        for (const table of tables) {
            console.log(`Extracting data from ${table.name}...`);
            const { rows, fields } = await pool.query(`SELECT * FROM ${table.name} ORDER BY id ASC`);
            
            if (rows.length === 0) {
                console.log(`- Table ${table.name} is empty. Skipping.`);
                continue;
            }

            sqlContent += `-- Data for ${table.name}\n`;
            sqlContent += `-- Total rows: ${rows.length}\n`;
            
            const columns = fields.map(f => `"${f.name}"`).join(', ');
            
            for (const row of rows) {
                const values = fields.map(f => formatValue(row[f.name])).join(', ');
                sqlContent += `INSERT INTO ${table.name} (${columns}) VALUES (${values}) ON CONFLICT (id) DO NOTHING;\n`;
            }

            // Reset sequence
            sqlContent += `-- Reset sequence for ${table.name}\n`;
            sqlContent += `SELECT setval(pg_get_serial_sequence('${table.name}', 'id'), coalesce(max(id), 1)) FROM ${table.name};\n\n`;
            
            console.log(`- Extracted ${rows.length} rows from ${table.name}.`);
        }

        fs.writeFileSync(outputPath, sqlContent, 'utf8');
        console.log(`\nSUCCESS: Rescued SQL generated at ${outputPath}`);
    } catch (err) {
        console.error('Extraction failed:', err);
    } finally {
        await pool.end();
    }
}

rescue();
