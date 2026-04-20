import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Check for unique constraints on nl_materiales
const constraints = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'nl_materiales'::regclass
    AND contype IN ('u', 'p')
`);

console.log('Constraints:', constraints.rows);

// Check the actual stock_actual and activo values for a sample material
const sample = await pool.query('SELECT id, nombre, stock_actual, activo FROM nl_materiales LIMIT 3');
console.log('Sample materials:', sample.rows);

await pool.end();