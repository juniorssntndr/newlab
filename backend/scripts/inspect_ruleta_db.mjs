import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'nl_ruleta_premios'");
        console.log('COLUMNAS nl_ruleta_premios:');
        console.table(cols.rows);

        const rows = await pool.query("SELECT * FROM nl_ruleta_premios LIMIT 15");
        console.log('FILAS EN nl_ruleta_premios:', rows.rows.length);
        console.log(rows.rows);

        const referenced = await pool.query(`SELECT DISTINCT premio_id FROM nl_ruleta_giros`);
        console.log('PREMIOS REFERENCIADOS EN GIROS:', referenced.rows.map(r => r.premio_id));
        const allPremios = await pool.query(`SELECT id, titulo, orden, activo FROM nl_ruleta_premios ORDER BY id`);
        console.log('TODOS LOS PREMIOS ACTUALES:', allPremios.rows);
    } catch (err) {
        console.error('ERROR DB:', err.message);
    } finally {
        await pool.end();
    }
}

check();
