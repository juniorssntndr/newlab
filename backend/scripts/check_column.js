import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const result = await pool.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'nl_pedido_items'
    AND column_name = 'pilares_dentales'
`);

if (result.rows.length > 0) {
    console.log('✅ Columna pilares_dentales existe:', result.rows[0]);
} else {
    console.log('❌ Columna pilares_dentales no encontrada');
}

await pool.end();