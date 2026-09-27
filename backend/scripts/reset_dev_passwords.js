import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function resetPasswords() {
    try {
        const hash = await bcrypt.hash('admin123', 10);
        const opHash = await bcrypt.hash('operador123', 10);
        const tecHash = await bcrypt.hash('tecnico123', 10);

        // Update existing afinixdentallab@gmail.com
        await pool.query('UPDATE nl_usuarios SET password_hash = $1 WHERE email = $2', [hash, 'afinixdentallab@gmail.com']);

        // Check if admin role exists
        const adminRole = await pool.query('SELECT id FROM nl_roles WHERE es_admin = true LIMIT 1');
        const adminRoleId = adminRole.rows[0]?.id;

        const opRole = await pool.query("SELECT id FROM nl_roles WHERE LOWER(nombre) = 'operador' LIMIT 1");
        const opRoleId = opRole.rows[0]?.id;

        // Upsert admin@newlab.pe
        await pool.query(`
            INSERT INTO nl_usuarios (nombre, email, password_hash, rol_id, tipo, estado)
            VALUES ('Admin General', 'admin@newlab.pe', $1, $2, 'admin', 'activo')
            ON CONFLICT (email) DO UPDATE SET password_hash = $1, estado = 'activo'
        `, [hash, adminRoleId]);

        // Upsert operador@newlab.pe
        await pool.query(`
            INSERT INTO nl_usuarios (nombre, email, password_hash, rol_id, tipo, estado)
            VALUES ('Operador Caja', 'operador@newlab.pe', $1, $2, 'operador', 'activo')
            ON CONFLICT (email) DO UPDATE SET password_hash = $1, estado = 'activo'
        `, [opHash, opRoleId]);

        // Update tecnico
        await pool.query('UPDATE nl_usuarios SET password_hash = $1 WHERE email = $2', [tecHash, 'tecnico@newlab.pe']);

        console.log('✅ Passwords configured:');
        console.log('- afinixdentallab@gmail.com -> admin123');
        console.log('- admin@newlab.pe -> admin123');
        console.log('- operador@newlab.pe -> operador123');
        console.log('- tecnico@newlab.pe -> tecnico123');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

resetPasswords();
