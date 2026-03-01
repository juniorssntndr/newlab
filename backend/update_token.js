import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("UPDATE nl_empresas SET token_apisperu = 'TU_TOKEN_AQUI' WHERE id = 1").then(() => {
    console.log('Token actualizado a un valor base');
    process.exit(0);
}).catch(console.error);
