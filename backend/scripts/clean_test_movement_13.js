import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        const res = await pool.query(
            "UPDATE nl_fin_movimientos SET sustento_numero = 'B001-00000013' WHERE id = 13 RETURNING id, sustento_numero"
        );
        console.log("Updated movement 13:", res.rows[0]);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
