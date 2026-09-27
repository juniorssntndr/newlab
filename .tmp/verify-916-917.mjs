import dotenv from 'dotenv';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, 'backend', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const table = await pool.query(
    "SELECT to_regclass('public.nl_identity_overrides') AS table_name",
  );
  const column = await pool.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'nl_doctores'
       AND column_name = 'fecha_nacimiento'`,
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        identity_table: table.rows[0]?.table_name,
        fecha_nacimiento: column.rows[0] || null,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
