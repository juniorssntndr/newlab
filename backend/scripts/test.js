import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'").then(res => { res.rows.forEach(r => console.log(r.table_name)); pool.end(); }).catch(console.error);
