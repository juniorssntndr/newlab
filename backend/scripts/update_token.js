import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const token = process.argv[2] || process.env.APISPERU_COMPANY_TOKEN;
if (!token || token === 'TU_TOKEN_AQUI' || token.length < 20) {
    console.error('Uso: node scripts/update_token.js "<TOKEN_DE_EMPRESA>"');
    console.error('O define APISPERU_COMPANY_TOKEN en el entorno.');
    process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('UPDATE nl_empresas SET token_apisperu = $1 WHERE id = 1', [token])
    .then(() => {
        console.log('Token actualizado');
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
