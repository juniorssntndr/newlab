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
    const client = await pool.connect();
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

        // 1. Ensure schema_migrations table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Fetch already applied migrations
        const appliedRes = await client.query('SELECT name FROM schema_migrations');
        const appliedSet = new Set(appliedRes.rows.map((r) => r.name));

        // 3. If schema_migrations was just created on an existing database,
        // backfill all currently existing migrations so they aren't re-run destructively.
        if (appliedSet.size === 0) {
            const hasLegacyTables = await client.query(`
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'nl_pedidos'
            `);
            if (hasLegacyTables.rows.length > 0) {
                console.log('Existing database detected. Initializing schema_migrations baseline...');
                for (const file of files) {
                    await client.query(
                        'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
                        [file]
                    );
                    appliedSet.add(file);
                }
                console.log(`Baseline established with ${files.length} migrations.`);
            }
        }

        // 4. Run only pending migrations
        const pendingFiles = files.filter((f) => !appliedSet.has(f));
        if (pendingFiles.length === 0) {
            console.log('No pending migrations. Database schema is up to date.');
            return;
        }

        console.log(`Running ${pendingFiles.length} pending migration(s)...`);
        for (const file of pendingFiles) {
            const sqlPath = path.join(__dirname, file);
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`- Executing: ${file}`);
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (name) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');
                console.log(`  ✓ Applied: ${file}`);
            } catch (stepErr) {
                await client.query('ROLLBACK');
                throw new Error(`Failed during migration ${file}: ${stepErr.message}`);
            }
        }
        console.log('All pending migrations completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
