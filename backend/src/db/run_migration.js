import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        const getMigrationOrder = (file) => {
            if (file === 'migration_000_base.sql') return 0;
            if (file === 'migration_materials.sql') return 100;
            if (file === 'migration_finanzas.sql') return 110;
            const numeric = file.match(/^migration_(\d+)_/);
            if (numeric) return 200 + parseInt(numeric[1], 10);
            return 1000;
        };

        const files = fs.readdirSync(__dirname)
            .filter((file) => file.startsWith('migration_') && file.endsWith('.sql'))
            .sort((a, b) => {
                const orderA = getMigrationOrder(a);
                const orderB = getMigrationOrder(b);
                if (orderA !== orderB) return orderA - orderB;
                return a.localeCompare(b);
            });

        console.log('Running migrations...');
        for (const file of files) {
            const sqlPath = path.join(__dirname, file);
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`- ${file}`);
            await pool.query(sql);
        }
        console.log('Migrations completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
