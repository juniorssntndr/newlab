import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        const movs = await pool.query(`
            SELECT id, tipo, tipo_fondo, fecha_movimiento, monto, beneficiario, sustento_tipo, 
                   sustento_comprobante_tipo, sustento_serie, sustento_numero, created_at
            FROM nl_fin_movimientos
            ORDER BY id DESC
            LIMIT 10
        `);
        console.log("Recent movements:", JSON.stringify(movs.rows, null, 2));

        const comps = await pool.query(`
            SELECT id, pedido_id, tipo_comprobante, serie, correlativo, total_venta, estado_sunat, created_at
            FROM nl_comprobantes
            ORDER BY id DESC
            LIMIT 10
        `);
        console.log("Recent comprobantes:", JSON.stringify(comps.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
