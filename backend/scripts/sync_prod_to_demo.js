import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Client } = pg;
const PROD_URL = process.env.DATABASE_URL || 'postgres://postgres:5OnYuLbav12c9tmqPhduKI6XLzeDEsFpnbkc6keCV81seYxBZovTH93i3si4hg8Q@212.28.178.94:5432/postgres';
const DEMO_URL = 'postgres://postgres:JQjwmzw6sBED6ds6QLGdC5ExgmHObVwoOIvT9ppL6VufnbD3P76eISwybSRLGFt4@212.28.178.94:5433/postgres';

const migrationsDir = path.join(__dirname, '../src/db');

async function sync() {
    console.log('Connecting to Prod and Demo...');
    const prod = new Client({ connectionString: PROD_URL });
    const demo = new Client({ connectionString: DEMO_URL });

    await prod.connect();
    await demo.connect();

    console.log('Step 1: Running migrations on Demo DB...');
    const getMigrationOrder = (file) => {
        if (file === 'migration_000_base.sql') return 0;
        if (file === 'migration_materials.sql') return 100;
        if (file === 'migration_finanzas.sql') return 110;
        const numeric = file.match(/^migration_(\d+)_/);
        if (numeric) return 200 + parseInt(numeric[1], 10);
        return 1000;
    };

    const sqlFiles = fs.readdirSync(migrationsDir)
        .filter((file) => file.startsWith('migration_') && file.endsWith('.sql'))
        .sort((a, b) => {
            const orderA = getMigrationOrder(a);
            const orderB = getMigrationOrder(b);
            if (orderA !== orderB) return orderA - orderB;
            return a.localeCompare(b);
        });

    for (const file of sqlFiles) {
        const sqlPath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        try {
            await demo.query(sql);
        } catch (err) {
            // ignore idempotent migration errors
        }
    }

    await demo.query("ALTER TABLE nl_pagos ADD COLUMN IF NOT EXISTS movimiento_id INTEGER REFERENCES nl_fin_movimientos(id);");
    console.log('Migrations and schema sync applied on Demo.');

    console.log('Step 2: Copying data with fast batch insert...');
    await demo.query("SET session_replication_role = 'replica';");

    const tablesRes = await prod.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables to sync.`);

    // Truncate all tables at once beforehand so CASCADE doesn't wipe previously populated tables
    const allTablesList = tables.map(t => `"${t}"`).join(', ');

    await demo.query(`TRUNCATE TABLE ${allTablesList} CASCADE;`);
    console.log('Cleaned all destination tables.');

    for (const table of tables) {
        const { rows } = await prod.query(`SELECT * FROM "${table}";`);
        if (rows.length === 0) continue;


        const demoColsRes = await demo.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = $1;
        `, [table]);
        const demoColsMap = new Map(demoColsRes.rows.map(r => [r.column_name, r.data_type]));
        const demoUdtMap = new Map(demoColsRes.rows.map(r => [r.column_name, r.udt_name]));
        const cols = Object.keys(rows[0]).filter(c => demoColsMap.has(c));

        if (cols.length === 0) continue;
        const colList = cols.map(c => `"${c}"`).join(', ');

        const CHUNK_SIZE = 100;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const values = [];
            const valueRows = [];

            let paramIdx = 1;
            for (const row of chunk) {
                const placeholders = [];
                for (const col of cols) {
                    placeholders.push(`$${paramIdx++}`);
                    let val = row[col];
                    const dataType = demoColsMap.get(col);
                    const udtName = demoUdtMap.get(col);
                    if (val !== null && (dataType === 'json' || dataType === 'jsonb' || udtName === 'json' || udtName === 'jsonb')) {
                        if (typeof val !== 'string') {
                            val = JSON.stringify(val);
                        }
                    }
                    values.push(val);
                }
                valueRows.push(`(${placeholders.join(', ')})`);
            }

            const queryText = `INSERT INTO "${table}" (${colList}) VALUES ${valueRows.join(', ')};`;
            await demo.query(queryText, values);
        }

        console.log(`  ✓ Synced ${table}: ${rows.length} rows.`);

        try {
            await demo.query(`
                SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce(max(id), 1)) 
                FROM "${table}";
            `);
        } catch {
            // No serial sequence
        }
    }

    await demo.query("SET session_replication_role = 'origin';");
    console.log('Re-enabled triggers and foreign keys.');

    const countProd = await prod.query('SELECT count(*) FROM nl_pedidos;');
    const countDemo = await demo.query('SELECT count(*) FROM nl_pedidos;');
    console.log(`\n🎉 Verification: Prod pedidos = ${countProd.rows[0].count}, Demo pedidos = ${countDemo.rows[0].count}`);

    await prod.end();
    await demo.end();
    console.log('Cloning completed successfully!');
}

sync().catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
});
