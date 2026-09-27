import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Simulador oficial de clientes y pedidos técnicos para AFINIX Dental Lab.
 * Garantiza cumplimiento estricto de:
 * 1. Un solo producto por orden de trabajo.
 * 2. Catálogo real, precios oficiales y cálculo 18% IGV.
 * 3. Odontograma FDI y especificaciones dentales reales (material, color VITA).
 * 4. Tiempos de entrega basados en el producto y trazabilidad de logística.
 * 5. Distinción explícita entre cliente con cuenta (portal) y cliente mostrador (sin cuenta).
 */

const NOMBRES_PACIENTES = [
    'Sofía Mendoza Paredes',
    'Renzo Gamarra Alarcón',
    'Valeria Quintana Rivas',
    'Daniel Cortez Benítez',
    'Camila Valdivia Flores',
    'Esteban Benítez Huamán',
    'María Elena Ramos Castillo',
    'Jorge Chávez Ugarte'
];

const COLORES_VITA = ['A1', 'A2', 'A3', 'A3.5', 'B1', 'B2', 'BL2'];

/**
 * Crea o recupera un cliente realista.
 * @param {Object} options
 * @param {boolean} options.conCuenta - Si true, crea un usuario en nl_usuarios con acceso al portal. Si false, solo crea la clínica.
 * @param {string} [options.nombre] - Nombre de la clínica / consultorio
 * @param {string} [options.ruc] - RUC (11 dígitos) o DNI (8 dígitos)
 * @param {string} [options.contacto] - Nombre del odontólogo responsable
 */
export async function getOrCreateRealisticClient({ conCuenta = false, nombre = null, ruc = null, contacto = null } = {}) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const clinicaNombre = nombre || `Consultorio Dental Dr. ${contacto || 'Santander'} ${randomSuffix}`;
    const docNumero = ruc || `20${Math.floor(100000000 + Math.random() * 900000000)}`;
    const contactoNombre = contacto || 'Dr. Carlos Mendoza';
    const email = `contacto${randomSuffix}@dental${randomSuffix}.pe`;

    // 1. Buscar si ya existe la clínica por nombre o RUC
    if (nombre || ruc) {
        const existingRes = await pool.query(
            `SELECT * FROM nl_clinicas 
             WHERE ($1::text IS NOT NULL AND LOWER(nombre) = LOWER($1))
                OR ($2::text IS NOT NULL AND ruc = $2)
             LIMIT 1`,
            [nombre, ruc]
        );
        if (existingRes.rows.length > 0) {
            const clinica = existingRes.rows[0];
            let usuario = null;
            if (conCuenta) {
                const existingUser = await pool.query(
                    `SELECT id, nombre, email, tipo, clinica_id FROM nl_usuarios WHERE clinica_id = $1 AND tipo = 'cliente' LIMIT 1`,
                    [clinica.id]
                );
                usuario = existingUser.rows[0] || null;
            }
            return {
                clinica,
                usuario,
                tipoCliente: conCuenta ? 'cliente_con_portal' : 'cliente_mostrador_sin_cuenta'
            };
        }
    }

    // 2. Crear registro en nl_clinicas si no existe
    const clinicaRes = await pool.query(
        `INSERT INTO nl_clinicas (nombre, razon_social, ruc, email, telefono, direccion, contacto_nombre)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
            clinicaNombre,
            `${clinicaNombre} S.A.C.`,
            docNumero,
            email,
            `9${Math.floor(10000000 + Math.random() * 90000000)}`,
            'Av. Principal 456, Lima',
            contactoNombre
        ]
    );
    const clinica = clinicaRes.rows[0];

    let usuario = null;
    if (conCuenta) {
        const rolRes = await pool.query(`SELECT id FROM nl_roles WHERE nombre ILIKE '%cliente%' LIMIT 1`);
        const rolId = rolRes.rows[0]?.id || 3;
        const passwordHash = await bcrypt.hash('cliente123', 10);

        const userRes = await pool.query(
            `INSERT INTO nl_usuarios (nombre, email, telefono, password_hash, rol_id, tipo, clinica_id, estado)
             VALUES ($1, $2, $3, $4, $5, 'cliente', $6, 'activo')
             RETURNING id, nombre, email, tipo, clinica_id`,
            [
                contactoNombre,
                email,
                clinica.telefono,
                passwordHash,
                rolId,
                clinica.id
            ]
        );
        usuario = userRes.rows[0];
    }

    return {
        clinica,
        usuario,
        tipoCliente: conCuenta ? 'cliente_con_portal' : 'cliente_mostrador_sin_cuenta'
    };
}

/**
 * Crea una orden de trabajo (pedido) 100% realista siguiendo el modelo de dominio.
 * @param {Object} params
 * @param {number} params.clinicaId - ID de la clínica
 * @param {number} [params.productoId] - ID de un producto de nl_productos
 * @param {string} [params.productoNombre] - Nombre del producto deseado
 * @param {string} [params.pacienteNombre] - Nombre del paciente
 * @param {string[]} [params.piezasDentales] - Array de piezas FDI (ej. ['11', '21'] o ['36'])
 * @param {string} [params.colorVita] - Color VITA (ej. 'A2')
 * @param {string} [params.estado] - Estado inicial del pedido
 * @param {number} [params.createdBy] - ID del usuario creador
 */
export async function createRealisticOrder({
    clinicaId,
    productoId = null,
    productoNombre = null,
    pacienteNombre = null,
    piezasDentales = null,
    colorVita = null,
    estado = 'pendiente',
    createdBy = 1
} = {}) {
    let prodQuery = 'SELECT p.*, c.nombre as categoria_nombre FROM nl_productos p LEFT JOIN nl_categorias_trabajo c ON c.id = p.categoria_id';
    let prodParams = [];
    if (productoId) {
        prodQuery += ' WHERE p.id = $1';
        prodParams.push(productoId);
    } else if (productoNombre) {
        prodQuery += ' WHERE p.nombre ILIKE $1';
        prodParams.push(`%${productoNombre}%`);
    } else {
        prodQuery += ' ORDER BY RANDOM() LIMIT 1';
    }

    const prodRes = await pool.query(prodQuery, prodParams);
    if (prodRes.rows.length === 0) {
        throw new Error('No se encontró un producto de catálogo válido.');
    }
    const producto = prodRes.rows[0];

    const paciente = pacienteNombre || NOMBRES_PACIENTES[Math.floor(Math.random() * NOMBRES_PACIENTES.length)];
    const piezas = piezasDentales || ['11'];
    const cantidad = piezas.length;
    const color = colorVita || COLORES_VITA[Math.floor(Math.random() * COLORES_VITA.length)];
    const material = producto.material_default || 'Zirconia Monolítica';

    const precioUnitario = parseFloat(producto.precio_base || 180.00);
    const total = Math.round(precioUnitario * cantidad * 100) / 100;
    const subtotal = Math.round((total / 1.18) * 100) / 100;
    const igv = Math.round((total - subtotal) * 100) / 100;

    const diasProduccion = producto.tiempo_estimado_dias || 5;
    const fechaActual = new Date();
    const fechaEntrega = new Date();
    fechaEntrega.setDate(fechaActual.getDate() + diasProduccion);

    const codigoPedido = `NL-${Math.floor(10000 + Math.random() * 90000)}`;

    const pedidoRes = await pool.query(
        `INSERT INTO nl_pedidos (
            codigo, clinica_id, paciente_nombre, fecha, fecha_entrega,
            estado, subtotal, igv, total, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
            codigoPedido,
            clinicaId,
            paciente,
            fechaActual.toISOString().slice(0, 10),
            fechaEntrega.toISOString().slice(0, 10),
            estado,
            subtotal,
            igv,
            total,
            createdBy
        ]
    );
    const pedido = pedidoRes.rows[0];

    const itemRes = await pool.query(
        `INSERT INTO nl_pedido_items (
            pedido_id, producto_id, piezas_dentales, material,
            color_vita, cantidad, precio_unitario, subtotal
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
            pedido.id,
            producto.id,
            piezas,
            material,
            color,
            cantidad,
            precioUnitario,
            total
        ]
    );

    await pool.query(
        `INSERT INTO nl_pedido_timeline (pedido_id, estado_nuevo, usuario_id, comentario)
         VALUES ($1, $2, $3, $4)`,
        [
            pedido.id,
            estado,
            createdBy,
            `Pedido registrado para paciente ${paciente}: ${producto.nombre} (${cantidad} unidad/es, piezas ${piezas.join(', ')}, color ${color})`
        ]
    );

    return {
        pedido,
        item: itemRes.rows[0],
        producto,
        detalles: {
            paciente,
            piezas,
            color,
            material,
            diasProduccion,
            fechaEntrega: fechaEntrega.toISOString().slice(0, 10)
        }
    };
}
