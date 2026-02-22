import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const defaultCategories = [
    { nombre: 'Corona', tipo: 'fija', descripcion: 'Coronas unitarias en diversos materiales', icono: 'bi-gem', orden: 1 },
    { nombre: 'Carilla', tipo: 'fija', descripcion: 'Carillas estéticas', icono: 'bi-stars', orden: 2 },
    { nombre: 'Inlay/Onlay', tipo: 'fija', descripcion: 'Restauraciones parciales', icono: 'bi-puzzle', orden: 3 },
    { nombre: 'Puente', tipo: 'fija', descripcion: 'Prótesis fija múltiple', icono: 'bi-link-45deg', orden: 4 },
    { nombre: 'Perno', tipo: 'fija', descripcion: 'Pernos y postes', icono: 'bi-pin-angle', orden: 5 },
    { nombre: 'Corona sobre implante', tipo: 'implante', descripcion: 'Corona atornillada o cementada', icono: 'bi-gear', orden: 6 },
    { nombre: 'Híbrida', tipo: 'implante', descripcion: 'Prótesis híbrida sobre implantes', icono: 'bi-grid-3x3-gap', orden: 7 },
    { nombre: 'Barra', tipo: 'implante', descripcion: 'Barra sobre implantes', icono: 'bi-dash-lg', orden: 8 },
    { nombre: 'Pilar personalizado', tipo: 'implante', descripcion: 'Abutment personalizado CAD/CAM', icono: 'bi-cone-striped', orden: 9 },
    { nombre: 'Estructura metálica PPR', tipo: 'removible', descripcion: 'Estructura para PPR', icono: 'bi-layers', orden: 10 },
    { nombre: 'Acrílico', tipo: 'removible', descripcion: 'Prótesis removible acrílica', icono: 'bi-palette', orden: 11 },
    { nombre: 'Flexible', tipo: 'removible', descripcion: 'Prótesis removible flexible', icono: 'bi-wind', orden: 12 },
    { nombre: 'Férula de relajación', tipo: 'especialidad', descripcion: 'Férulas oclusales', icono: 'bi-shield-check', orden: 13 },
    { nombre: 'Guía quirúrgica', tipo: 'especialidad', descripcion: 'Guías quirúrgicas 3D', icono: 'bi-bullseye', orden: 14 },
    { nombre: 'Alineador', tipo: 'especialidad', descripcion: 'Alineadores transparentes', icono: 'bi-align-center', orden: 15 }
];

const defaultAdmin = {
    nombre: process.env.CLEAN_ADMIN_NAME || 'Admin Lab',
    email: process.env.CLEAN_ADMIN_EMAIL || 'admin@newlab.pe',
    password: process.env.CLEAN_ADMIN_PASSWORD || 'admin123',
    telefono: process.env.CLEAN_ADMIN_PHONE || null
};

async function bootstrapClean() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `INSERT INTO nl_roles (nombre, permisos, activo, es_admin)
             VALUES
             ('Administrador', '{"all": true}'::jsonb, true, true),
             ('Técnico', '{"pedidos": true, "produccion": true}'::jsonb, true, false),
             ('Cliente', '{"pedidos_propios": true}'::jsonb, true, false)
             ON CONFLICT (nombre) DO UPDATE
             SET permisos = EXCLUDED.permisos,
                 activo = EXCLUDED.activo,
                 es_admin = EXCLUDED.es_admin,
                 updated_at = NOW()`
        );

        const adminRoleRes = await client.query('SELECT id FROM nl_roles WHERE es_admin = true ORDER BY id ASC LIMIT 1');
        const adminRoleId = adminRoleRes.rows[0]?.id;
        if (!adminRoleId) throw new Error('No se pudo resolver el rol administrador');

        const passwordHash = await bcrypt.hash(defaultAdmin.password, 10);
        await client.query(
            `INSERT INTO nl_usuarios (nombre, email, telefono, password_hash, rol_id, tipo, estado)
             VALUES ($1, $2, $3, $4, $5, 'admin', 'activo')
             ON CONFLICT (email) DO UPDATE
             SET nombre = EXCLUDED.nombre,
                 telefono = EXCLUDED.telefono,
                 password_hash = EXCLUDED.password_hash,
                 rol_id = EXCLUDED.rol_id,
                 tipo = EXCLUDED.tipo,
                 estado = EXCLUDED.estado,
                 updated_at = NOW()`,
            [defaultAdmin.nombre, defaultAdmin.email, defaultAdmin.telefono, passwordHash, adminRoleId]
        );

        for (const category of defaultCategories) {
            await client.query(
                `INSERT INTO nl_categorias_trabajo (nombre, tipo, descripcion, icono, orden, activo)
                 VALUES ($1, $2, $3, $4, $5, true)
                 ON CONFLICT (nombre) DO UPDATE
                 SET tipo = EXCLUDED.tipo,
                     descripcion = EXCLUDED.descripcion,
                     icono = EXCLUDED.icono,
                     orden = EXCLUDED.orden,
                     activo = true,
                     updated_at = NOW()`,
                [category.nombre, category.tipo, category.descripcion, category.icono, category.orden]
            );
        }

        await client.query('COMMIT');

        console.log('Bootstrap limpio completado.');
        console.log(`Admin: ${defaultAdmin.email}`);
        console.log(`Password: ${defaultAdmin.password}`);
        console.log('Categorias base: OK');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Fallo bootstrap limpio:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

bootstrapClean();
