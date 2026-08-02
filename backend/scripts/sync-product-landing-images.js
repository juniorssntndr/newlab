import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Must stay in sync with frontend/src/utils/productCatalogImages.js */
const BY_NAME = {
    'Corona Zirconia': '/images/afinix-landing/service-zirconia-crown.jpg',
    'Corona Disilicato': '/images/afinix-landing/service-crown-disilicate.png',
    'Corona Metal-Cerámica': '/images/afinix-landing/service-cad-real.jpg',
    'Corona PMMA Provisional': '/images/afinix-landing/service-provisional-pmma.jpg',
    'Carilla Disilicato': '/images/afinix-landing/service-veneer-disilicate.jpg',
    'Carilla Zirconia': '/images/afinix-landing/service-veneer-disilicate.jpg',
    'Inlay Disilicato': '/images/afinix-landing/service-inlay-onlay-3d.jpg',
    'Puente de Zirconia': '/images/afinix-landing/service-zirconia-bridge.jpg',
    'Puente Zirconia 3U': '/images/afinix-landing/service-zirconia-bridge.jpg',
    'Puente Metal-Cerámica 3U': '/images/afinix-landing/service-zirconia-bridge.jpg',
    'Corona Implante Zirconia': '/images/afinix-landing/service-implant-real.jpg',
    'Guía quirúrgica impresa': '/images/afinix-landing/service-guide.jpg',
};

async function main() {
    const { rows } = await pool.query('SELECT id, nombre, image_url FROM nl_productos ORDER BY id');
    let updated = 0;
    for (const row of rows) {
        const next = BY_NAME[row.nombre];
        if (!next) {
            console.log('skip (no landing map):', row.nombre);
            continue;
        }
        if (row.image_url === next) {
            console.log('ok already:', row.nombre);
            continue;
        }
        await pool.query('UPDATE nl_productos SET image_url = $1, updated_at = NOW() WHERE id = $2', [next, row.id]);
        console.log('updated:', row.nombre, '→', next);
        updated += 1;
    }
    console.log(`Done. Updated ${updated} products.`);
    await pool.end();
}

main().catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
});
