import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationFile = 'migration_938_campaign_delivery.sql';

async function run() {
    console.log('Connecting to database...');
    const client = await pool.connect();

    try {
        // 1. Respaldo previo de seguridad de las tablas impactadas
        const timestamp = Date.now();
        const backupDir = path.resolve(directory, '../../backups');
        await fs.mkdir(backupDir, { recursive: true });
        const backupPath = path.join(backupDir, `pre_migration_938_backup_${timestamp}.json`);

        console.log('Generando respaldo preventivo...');
        const [campanasRes, descuentosRes, usosRes] = await Promise.all([
            client.query('SELECT * FROM nl_campanas_marketing').catch(() => ({ rows: [] })),
            client.query('SELECT * FROM nl_descuentos').catch(() => ({ rows: [] })),
            client.query('SELECT * FROM nl_descuentos_usos').catch(() => ({ rows: [] }))
        ]);

        const backupData = {
            timestamp: new Date().toISOString(),
            migration: migrationFile,
            nl_campanas_marketing: campanasRes.rows,
            nl_descuentos: descuentosRes.rows,
            nl_descuentos_usos: usosRes.rows
        };

        await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
        console.log(`Respaldo preventivo guardado en: ${backupPath}`);
        console.log(`Registros respaldados: ${campanasRes.rows.length} campañas, ${descuentosRes.rows.length} descuentos, ${usosRes.rows.length} usos.`);

        // 2. Ejecución de la migración en transacción
        console.log(`Ejecutando migración ${migrationFile}...`);
        await client.query('BEGIN');
        const sql = await fs.readFile(path.join(directory, migrationFile), 'utf8');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migración 938 ejecutada con éxito.');

        // 3. Verificación de readiness
        const checkRes = await client.query(`
            SELECT
                to_regclass('public.nl_campana_envios') IS NOT NULL
                AND to_regclass('public.nl_campana_destinatarios') IS NOT NULL
                AND to_regclass('public.nl_campana_push_envios') IS NOT NULL
                AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nl_campanas_marketing' AND column_name IN ('fecha_inicio', 'fecha_fin')) = 2
                AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_campaign_coupon_usage' AND tgrelid = to_regclass('public.nl_descuentos_usos') AND NOT tgisinternal AND tgenabled = 'O')
                AND to_regclass('public.uq_campaign_coupon') IS NOT NULL AS ready
        `);

        const isReady = checkRes.rows[0]?.ready === true;
        console.log('Estado de readiness tras migración:', { ready: isReady });

        if (!isReady) {
            throw new Error('La verificación de readiness falló tras aplicar la migración.');
        }

    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}
        console.error('Error durante el proceso:', err);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

run();
