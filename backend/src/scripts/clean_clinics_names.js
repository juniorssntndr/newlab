import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function clean() {
    try {
        console.log('--- Limpiando registros de clínicas en BD ---');
        await pool.query(
            "UPDATE nl_clinicas SET nombre = 'Consultorio Dental Dra. Patricia Valdivia', razon_social = 'Consultorio Dental Dra. Patricia Valdivia S.A.C.' WHERE id = 17"
        );
        await pool.query(
            "UPDATE nl_clinicas SET nombre = 'Consultorio Dental Dr. Fernando Salazar', razon_social = 'Consultorio Dental Dr. Fernando Salazar S.A.C.' WHERE id = 18"
        );

        const res = await pool.query('SELECT id, nombre, razon_social, ruc, telefono FROM nl_clinicas ORDER BY id ASC');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

clean();
