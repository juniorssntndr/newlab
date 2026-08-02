import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const demos = [
    { email: 'admin@newlab.pe', password: 'admin123', tipo: 'admin', nombre: 'Admin Lab' },
    { email: 'tecnico@newlab.pe', password: 'tecnico123', tipo: 'tecnico', nombre: 'Juan Técnico' },
    { email: 'roberto@sonrisas.pe', password: 'cliente123', tipo: 'cliente', nombre: 'Dr. Roberto Gómez' },
];

const main = async () => {
    const roles = await pool.query('SELECT id, nombre FROM nl_roles');
    const roleByTipo = {
        admin: roles.rows.find((r) => /admin/i.test(r.nombre))?.id,
        tecnico: roles.rows.find((r) => /t[eé]cnico/i.test(r.nombre))?.id,
        cliente: roles.rows.find((r) => /cliente/i.test(r.nombre))?.id,
    };

    const clinica = await pool.query('SELECT id FROM nl_clinicas ORDER BY id LIMIT 1');
    const clinicaId = clinica.rows[0]?.id || null;

    for (const d of demos) {
        if (!roleByTipo[d.tipo]) {
            throw new Error(`No se encontró rol para tipo=${d.tipo}`);
        }

        const hash = await bcrypt.hash(d.password, 10);
        const existing = await pool.query(
            'SELECT id, estado, tipo FROM nl_usuarios WHERE lower(email) = lower($1)',
            [d.email]
        );

        if (existing.rows.length) {
            await pool.query(
                `UPDATE nl_usuarios
                 SET password_hash = $1,
                     estado = 'activo',
                     tipo = $2::text,
                     rol_id = $3,
                     clinica_id = CASE
                       WHEN $2::text = 'cliente' THEN COALESCE(clinica_id, $4)
                       ELSE NULL
                     END
                 WHERE id = $5`,
                [hash, d.tipo, roleByTipo[d.tipo], clinicaId, existing.rows[0].id]
            );
            console.log(`RESET ${d.email} id=${existing.rows[0].id} prevEstado=${existing.rows[0].estado}`);
        } else {
            const inserted = await pool.query(
                `INSERT INTO nl_usuarios
                   (nombre, email, telefono, password_hash, rol_id, tipo, clinica_id, estado)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')
                 RETURNING id`,
                [
                    d.nombre,
                    d.email,
                    '999000000',
                    hash,
                    roleByTipo[d.tipo],
                    d.tipo,
                    d.tipo === 'cliente' ? clinicaId : null,
                ]
            );
            console.log(`CREATED ${d.email} id=${inserted.rows[0].id}`);
        }
    }

    for (const d of demos) {
        const res = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: d.email, password: d.password }),
        });
        console.log(`LOGIN ${d.email} => ${res.status}`);
    }
};

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
