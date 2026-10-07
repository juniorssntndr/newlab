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

async function purgeProduction() {
    console.log('Connecting to PRODUCTION DB at 212.28.178.94:5432/postgres ...');
    const client = new Client({ connectionString: PROD_URL });
    await client.connect();

    console.log('\n--- VERIFICACIÓN PREVIA DE DATOS MAESTROS (A PRESERVAR) ---');
    const masters = [
        'nl_productos',
        'nl_categorias_trabajo',
        'nl_clinicas',
        'nl_usuarios',
        'nl_crm_establecimientos',
        'nl_empresas',
        'nl_materiales'
    ];
    const preMastersCounts = {};
    for (const m of masters) {
        const res = await client.query(`SELECT count(*) FROM "${m}";`);
        preMastersCounts[m] = parseInt(res.rows[0].count, 10);
        console.log(`  ✓ ${m}: ${preMastersCounts[m]} registros (INTACTOS)`);
    }

    console.log('\n--- VERIFICACIÓN PREVIA DE DATOS TRANSACCIONALES (A PURGAR) ---');
    const transactional = [
        'nl_saldo_favor_aplicaciones',
        'nl_comprobante_pedidos',
        'nl_comprobantes',
        'nl_pagos',
        'nl_pedido_aprobaciones',
        'nl_pedido_timeline',
        'nl_pedido_items',
        'nl_pedidos',
        'nl_fin_movimientos',
        'nl_fin_sesiones_caja',
        'nl_notificaciones'
    ];
    const preTxCounts = {};
    for (const t of transactional) {
        const res = await client.query(`SELECT count(*) FROM "${t}";`);
        preTxCounts[t] = parseInt(res.rows[0].count, 10);
        console.log(`  🗑️ ${t}: ${preTxCounts[t]} registros`);
    }

    // Backup transactional tables to disk before purging
    console.log('\n--- GENERANDO BACKUP DE SEGURIDAD EN DISCO ---');
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const backupData = {};
    for (const t of transactional) {
        const res = await client.query(`SELECT * FROM "${t}";`);
        backupData[t] = res.rows;
    }
    const backupFilePath = path.join(backupDir, `prod_pre_purge_backup_${Date.now()}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
    console.log(`  ✓ Backup de seguridad guardado en: ${backupFilePath}`);

    console.log('\n--- EJECUTANDO PURGA QUIRÚRGICA EN PRODUCCIÓN ---');
    await client.query('BEGIN;');

    const txTableList = transactional.map(t => `"${t}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${txTableList} RESTART IDENTITY CASCADE;`);

    // Reset sequences for clean correlatives
    const seqTables = [
        'nl_pedidos',
        'nl_pedido_items',
        'nl_pedido_timeline',
        'nl_pedido_aprobaciones',
        'nl_comprobantes',
        'nl_comprobante_pedidos',
        'nl_pagos',
        'nl_saldo_favor_aplicaciones',
        'nl_fin_movimientos',
        'nl_fin_sesiones_caja',
        'nl_notificaciones'
    ];
    for (const s of seqTables) {
        try {
            await client.query(`SELECT setval(pg_get_serial_sequence('"${s}"', 'id'), 1, false);`);
        } catch {
            // Ignorar si no usa secuencia estándar
        }
    }

    await client.query('COMMIT;');
    console.log('✓ Purga y reinicio de correlativos completado exitosamente.');

    console.log('\n--- VERIFICACIÓN POST-PURGA EN PRODUCCIÓN ---');
    const postOrdersRes = await client.query('SELECT count(*) FROM nl_pedidos;');
    console.log(`  -> nl_pedidos en producción: ${postOrdersRes.rows[0].count} (esperado: 0)`);

    console.log('\n--- VERIFICACIÓN DE INTEGRIDAD DE MAESTROS EN PRODUCCIÓN ---');
    let allMastersIntact = true;
    for (const m of masters) {
        const res = await client.query(`SELECT count(*) FROM "${m}";`);
        const currentCount = parseInt(res.rows[0].count, 10);
        const diff = currentCount - preMastersCounts[m];
        console.log(`  ✓ ${m}: ${currentCount} registros (Delta: ${diff})`);
        if (diff !== 0) allMastersIntact = false;
    }

    if (!allMastersIntact) {
        console.error('ALERTA: Hubo una discrepancia en los maestros.');
    } else {
        console.log('\n🎉 ÉXITO: Todos los maestros están 100% intactos y la capa transaccional está en cero.');
    }

    await client.end();
}

purgeProduction().catch(err => {
    console.error('Error durante la purga:', err);
    process.exit(1);
});
