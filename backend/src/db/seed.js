import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const seed = async () => {
  console.log('🌱 Seeding NewLab database...');

  try {
    // Clean all tables in reverse dependency order
    await pool.query(`
      TRUNCATE nl_notificaciones, nl_pedido_timeline, nl_pedido_items, nl_pedidos,
               nl_precios_producto, nl_productos, nl_categorias_trabajo,
               nl_usuarios, nl_clinicas, nl_roles CASCADE
    `);
    console.log('🗑️  Tables cleaned');

    // Roles
    const rolesResult = await pool.query(`
      INSERT INTO nl_roles (nombre, permisos, activo, es_admin) VALUES
        ('Administrador', '{"all": true}', true, true),
        ('Técnico', '{"pedidos": true, "produccion": true}', true, false),
        ('Cliente', '{"pedidos_propios": true}', true, false)
      RETURNING id, nombre
    `);
    const roleMap = {};
    rolesResult.rows.forEach(r => roleMap[r.nombre] = r.id);
    console.log('✅ Roles created');

    // Clínicas
    const clinicasResult = await pool.query(`
      INSERT INTO nl_clinicas (nombre, razon_social, ruc, email, telefono, direccion, contacto_nombre) VALUES
        ('Clínica Dental Sonrisas', 'Sonrisas S.A.C.', '20123456789', 'info@sonrisas.pe', '01-4567890', 'Av. Arequipa 1234, Lima', 'Dr. Roberto Gómez'),
        ('Centro Odontológico Premium', 'Premium Dental E.I.R.L.', '20987654321', 'contacto@premium.pe', '01-9876543', 'Jr. Huallaga 567, Lima', 'Dra. María López'),
        ('DentiCare', 'DentiCare S.A.C.', '20456789123', 'admin@denticare.pe', '01-3456789', 'Av. Javier Prado 890, San Isidro', 'Dr. Carlos Mendoza')
      RETURNING id, nombre
    `);
    console.log('✅ Clínicas created');

    // Hash passwords
    const adminHash = await bcrypt.hash('admin123', 10);
    const tecnicoHash = await bcrypt.hash('tecnico123', 10);
    const clienteHash = await bcrypt.hash('cliente123', 10);

    // Usuarios
    const usuariosResult = await pool.query(`
      INSERT INTO nl_usuarios (nombre, email, telefono, password_hash, rol_id, tipo, clinica_id, estado) VALUES
        ('Admin Lab', 'admin@newlab.pe', '999888777', $1, $4, 'admin', NULL, 'activo'),
        ('Juan Técnico', 'tecnico@newlab.pe', '999777666', $2, $5, 'tecnico', NULL, 'activo'),
        ('María Diseñadora', 'diseno@newlab.pe', '999666555', $2, $5, 'tecnico', NULL, 'activo'),
        ('Dr. Roberto Gómez', 'roberto@sonrisas.pe', '999555444', $3, $6, 'cliente', $7, 'activo')
      RETURNING id, tipo
    `, [adminHash, tecnicoHash, clienteHash, roleMap['Administrador'], roleMap['Técnico'], roleMap['Cliente'], clinicasResult.rows[0].id]);
    console.log('✅ Usuarios created');

    const adminId = usuariosResult.rows.find(u => u.tipo === 'admin')?.id;
    const tecnicoId = usuariosResult.rows.find(u => u.tipo === 'tecnico')?.id;
    const clienteId = usuariosResult.rows.find(u => u.tipo === 'cliente')?.id;

    // Categorías de trabajo
    const catsResult = await pool.query(`
      INSERT INTO nl_categorias_trabajo (nombre, tipo, descripcion, icono, orden) VALUES
        ('Corona', 'fija', 'Coronas unitarias en diversos materiales', 'bi-gem', 1),
        ('Carilla', 'fija', 'Carillas estéticas', 'bi-stars', 2),
        ('Inlay/Onlay', 'fija', 'Restauraciones parciales', 'bi-puzzle', 3),
        ('Puente', 'fija', 'Prótesis fija múltiple', 'bi-link-45deg', 4),
        ('Perno', 'fija', 'Pernos y postes', 'bi-pin-angle', 5),
        ('Corona sobre implante', 'implante', 'Corona atornillada o cementada', 'bi-gear', 6),
        ('Híbrida', 'implante', 'Prótesis híbrida sobre implantes', 'bi-grid-3x3-gap', 7),
        ('Barra', 'implante', 'Barra sobre implantes', 'bi-dash-lg', 8),
        ('Pilar personalizado', 'implante', 'Abutment personalizado CAD/CAM', 'bi-cone-striped', 9),
        ('Estructura metálica PPR', 'removible', 'Estructura para PPR', 'bi-layers', 10),
        ('Acrílico', 'removible', 'Prótesis removible acrílica', 'bi-palette', 11),
        ('Flexible', 'removible', 'Prótesis removible flexible', 'bi-wind', 12),
        ('Férula de relajación', 'especialidad', 'Férulas oclusales', 'bi-shield-check', 13),
        ('Guía quirúrgica', 'especialidad', 'Guías quirúrgicas 3D', 'bi-bullseye', 14),
        ('Alineador', 'especialidad', 'Alineadores transparentes', 'bi-align-center', 15)
      RETURNING id, nombre
    `);
    const catMap = {};
    catsResult.rows.forEach(c => catMap[c.nombre] = c.id);
    console.log('✅ Categorías created');

    // Productos
    const prodsResult = await pool.query(`
      INSERT INTO nl_productos (nombre, descripcion, categoria_id, precio_base, material_default, tiempo_estimado_dias) VALUES
        ('Corona Zirconia', 'Corona monolítica en zirconia translúcida', $1, 180.00, 'Zirconia', 5),
        ('Corona Disilicato', 'Corona de disilicato de litio e.max', $1, 200.00, 'Disilicato de Litio', 5),
        ('Corona Metal-Cerámica', 'Corona metal-cerámica Cr-Co', $1, 120.00, 'Cr-Co + Cerámica', 6),
        ('Corona PMMA Provisional', 'Corona provisional fresada', $1, 60.00, 'PMMA', 2),
        ('Carilla Disilicato', 'Carilla vestibular en disilicato', $2, 220.00, 'Disilicato de Litio', 5),
        ('Carilla Zirconia', 'Carilla en zirconia estética', $2, 200.00, 'Zirconia', 5),
        ('Inlay Disilicato', 'Inlay/Onlay en disilicato', $3, 150.00, 'Disilicato de Litio', 4),
        ('Puente Zirconia 3U', 'Puente de 3 unidades en zirconia', $4, 540.00, 'Zirconia', 7),
        ('Puente Metal-Cerámica 3U', 'Puente de 3 unidades metal-cerámica', $4, 360.00, 'Cr-Co + Cerámica', 7),
        ('Perno Colado', 'Perno muñón colado', $5, 80.00, 'Cr-Co', 3),
        ('Corona Implante Zirconia', 'Corona atornillada sobre implante', $6, 250.00, 'Zirconia', 6),
        ('Pilar Ti personalizado', 'Abutment personalizado en titanio', $7, 180.00, 'Titanio', 5),
        ('Estructura PPR Cr-Co', 'Estructura metálica para PPR', $8, 200.00, 'Cr-Co', 8),
        ('Férula Michigan', 'Férula de relajación tipo Michigan', $9, 100.00, 'PMMA', 3),
        ('Guía quirúrgica impresa', 'Guía quirúrgica estereolitográfica', $10, 150.00, 'Resina SLA', 3)
      RETURNING id, nombre, precio_base
    `, [catMap['Corona'], catMap['Carilla'], catMap['Inlay/Onlay'], catMap['Puente'], catMap['Perno'],
    catMap['Corona sobre implante'], catMap['Pilar personalizado'], catMap['Estructura metálica PPR'],
    catMap['Férula de relajación'], catMap['Guía quirúrgica']]);
    console.log('✅ Productos created');

    // Sample pedidos
    const pedidosResult = await pool.query(`
      INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, responsable_id, created_by) VALUES
        ('NL-00001', $1, 'Ana García Pérez', CURRENT_DATE - 5, CURRENT_DATE + 3, 'en_produccion', 180.00, 32.40, 212.40, $3, $4),
        ('NL-00002', $1, 'Luis Mendoza Torres', CURRENT_DATE - 2, CURRENT_DATE + 5, 'en_diseno', 420.00, 75.60, 495.60, $3, $4),
        ('NL-00003', $2, 'Carmen Quispe Flores', CURRENT_DATE, CURRENT_DATE + 7, 'pendiente', 200.00, 36.00, 236.00, NULL, $4)
      RETURNING id, codigo
    `, [clinicasResult.rows[0].id, clinicasResult.rows[1].id, tecnicoId, clienteId]);
    console.log('✅ Pedidos created');

    // Pedido items
    const p1 = pedidosResult.rows[0].id;
    const p2 = pedidosResult.rows[1].id;
    const p3 = pedidosResult.rows[2].id;
    const prod1 = prodsResult.rows[0].id;
    const prod2 = prodsResult.rows[1].id;
    const prod3 = prodsResult.rows[2].id;

    await pool.query(`
      INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal) VALUES
        ($1, $4, '{11}', 'Zirconia', 'A2', 1, 180.00, 180.00),
        ($2, $5, '{21,22}', 'Disilicato de Litio', 'A1', 2, 210.00, 420.00),
        ($3, $6, '{36}', 'Cr-Co + Cerámica', 'A3', 1, 120.00, 120.00)
    `, [p1, p2, p3, prod1, prod2, prod3]);
    console.log('✅ Pedido items created');

    // Timeline
    await pool.query(`
      INSERT INTO nl_pedido_timeline (pedido_id, estado_nuevo, usuario_id, comentario) VALUES
        ($1, 'pendiente', $4, 'Pedido creado'),
        ($1, 'en_diseno', $5, 'Asignado a técnico'),
        ($1, 'esperando_aprobacion', $5, 'Diseño completado'),
        ($1, 'en_produccion', $4, 'Diseño aprobado por cliente'),
        ($2, 'pendiente', $4, 'Pedido creado'),
        ($2, 'en_diseno', $5, 'En proceso de diseño'),
        ($3, 'pendiente', $4, 'Pedido creado')
    `, [p1, p2, p3, clienteId, tecnicoId]);
    console.log('✅ Timeline entries created');

    // Notifications
    await pool.query(`
      INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link) VALUES
        ($1, 'nuevo_pedido', 'Nuevo Pedido Recibido', 'Pedido NL-00003 de Carmen Quispe', '/pedidos'),
        ($1, 'sistema', 'Bienvenido a NewLab', 'Tu plataforma dental digital está lista', '/dashboard')
    `, [adminId]);
    console.log('✅ Notificaciones created');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Demo credentials:');
    console.log('  Admin:    admin@newlab.pe / admin123');
    console.log('  Técnico:  tecnico@newlab.pe / tecnico123');
    console.log('  Cliente:  roberto@sonrisas.pe / cliente123');
  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    await pool.end();
  }
};

seed();
