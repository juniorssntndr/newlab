import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv'; // Note: dotenv might need 'dotenv/config' or just normal import

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

let dbConfig = {};
if (process.env.DATABASE_URL) {
    let connectionString = process.env.DATABASE_URL;
    if (connectionString.includes('@localhost')) {
        connectionString = connectionString.replace('@localhost', '@127.0.0.1');
    }
    dbConfig = { connectionString };
} else {
    dbConfig = {
        user: process.env.DB_USER,
        host: process.env.DB_HOST === 'localhost' ? '127.0.0.1' : process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    };
}

console.log('Using DB Config:', { ...dbConfig, password: dbConfig.password ? '****' : undefined, connectionString: dbConfig.connectionString ? 'masked' : undefined });

const pool = new Pool(dbConfig);

async function runSeed() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'seed_cadcam_materials.sql'), 'utf8');
        console.log('Seeding materials...');
        await pool.query(sql);
        console.log('Materials seeded successfully.');
    } catch (err) {
        console.error('Error seeding materials:', err);
    } finally {
        await pool.end();
    }
}

runSeed();
