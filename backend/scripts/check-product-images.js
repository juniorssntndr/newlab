import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  `SELECT id, nombre, image_url
   FROM nl_productos
   WHERE image_url LIKE '%uploads%'
      OR nombre ILIKE '%disilicato%'
   ORDER BY id`
);
console.log(JSON.stringify(rows, null, 2));
await pool.end();
