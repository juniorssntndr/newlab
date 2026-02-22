import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const now = new Date();
const daysFromNow = (days) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
};

async function getRoleId(client, roleName) {
    const result = await client.query('SELECT id FROM nl_roles WHERE nombre ILIKE $1 LIMIT 1', [roleName]);
    return result.rows[0]?.id || null;
}

async function getOrCreateClinic(client, clinic) {
    const found = await client.query('SELECT id FROM nl_clinicas WHERE nombre = $1 LIMIT 1', [clinic.nombre]);
    if (found.rows.length) return found.rows[0].id;

    const created = await client.query(
        `INSERT INTO nl_clinicas (nombre, razon_social, ruc, email, telefono, direccion, contacto_nombre, estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'activo') RETURNING id`,
        [clinic.nombre, clinic.razon_social, clinic.ruc, clinic.email, clinic.telefono, clinic.direccion, clinic.contacto_nombre]
    );
    return created.rows[0].id;
}

async function getOrCreateUser(client, user, roleId) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const result = await client.query(
        `INSERT INTO nl_usuarios (nombre, email, telefono, password_hash, rol_id, tipo, clinica_id, estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'activo')
         ON CONFLICT (email) DO UPDATE
         SET nombre = EXCLUDED.nombre,
             telefono = EXCLUDED.telefono,
             password_hash = EXCLUDED.password_hash,
             rol_id = EXCLUDED.rol_id,
             tipo = EXCLUDED.tipo,
             clinica_id = EXCLUDED.clinica_id,
             estado = 'activo',
             updated_at = NOW()
         RETURNING id`,
        [user.nombre, user.email, user.telefono || null, passwordHash, roleId, user.tipo, user.clinica_id || null]
    );
    return result.rows[0].id;
}

async function getOrCreateMaterial(client, nombre, unidad = 'unid') {
    const found = await client.query('SELECT id FROM nl_materiales WHERE nombre = $1 LIMIT 1', [nombre]);
    if (found.rows.length) return found.rows[0].id;

    const created = await client.query(
        `INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, activo)
         VALUES ($1, 20, 5, $2, true) RETURNING id`,
        [nombre, unidad]
    );
    return created.rows[0].id;
}

async function getOrCreateProduct(client, product) {
    const found = await client.query('SELECT id FROM nl_productos WHERE nombre = $1 LIMIT 1', [product.nombre]);
    if (found.rows.length) return found.rows[0].id;

    const created = await client.query(
        `INSERT INTO nl_productos (nombre, descripcion, categoria_id, precio_base, material_id, tiempo_estimado_dias, visible, activo)
         VALUES ($1,$2,$3,$4,$5,$6,true,true) RETURNING id`,
        [product.nombre, product.descripcion, product.categoria_id, product.precio_base, product.material_id, product.tiempo_estimado_dias]
    );
    return created.rows[0].id;
}

async function createPedidoScenario(client, params) {
    const exists = await client.query('SELECT id FROM nl_pedidos WHERE codigo = $1 LIMIT 1', [params.codigo]);
    if (exists.rows.length) return;

    const pedidoResult = await client.query(
        `INSERT INTO nl_pedidos (
            codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado,
            subtotal, igv, total, responsable_id, created_by, observaciones, archivos_urls
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id`,
        [
            params.codigo,
            params.clinica_id,
            params.paciente_nombre,
            params.fecha,
            params.fecha_entrega,
            params.estado,
            params.subtotal,
            params.igv,
            params.total,
            params.responsable_id,
            params.created_by,
            params.observaciones || null,
            JSON.stringify(params.archivos_urls || [])
        ]
    );

    const pedidoId = pedidoResult.rows[0].id;

    await client.query(
        `INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal, notas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
            pedidoId,
            params.producto_id,
            params.piezas_dentales || ['11'],
            params.material,
            params.color_vita,
            params.cantidad || 1,
            params.precio_unitario,
            params.subtotal,
            params.item_notas || null
        ]
    );

    for (const t of params.timeline || []) {
        await client.query(
            `INSERT INTO nl_pedido_timeline (pedido_id, estado_anterior, estado_nuevo, usuario_id, comentario, created_at)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [pedidoId, t.estado_anterior || null, t.estado_nuevo || null, t.usuario_id, t.comentario || null, t.created_at || new Date()]
        );
    }

    if (params.aprobacion) {
        await client.query(
            `INSERT INTO nl_pedido_aprobaciones (pedido_id, link_exocad, estado, comentario_cliente, respondido_at)
             VALUES ($1,$2,$3,$4,$5)`,
            [
                pedidoId,
                params.aprobacion.link_exocad,
                params.aprobacion.estado,
                params.aprobacion.comentario_cliente || null,
                params.aprobacion.respondido_at || null
            ]
        );
    }

    for (const pago of params.pagos || []) {
        await client.query(
            `INSERT INTO nl_pagos (pedido_id, monto, metodo, referencia, fecha_pago, notas, creado_por)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [pedidoId, pago.monto, pago.metodo || 'transferencia', pago.referencia || null, pago.fecha_pago || null, pago.notas || null, pago.creado_por]
        );
    }

    for (const notif of params.notificaciones || []) {
        await client.query(
            `INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link)
             VALUES ($1,$2,$3,$4,$5)`,
            [notif.usuario_id, notif.tipo, notif.titulo, notif.mensaje || null, `/pedidos/${pedidoId}`]
        );
    }
}

async function seedSmall() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const adminResult = await client.query("SELECT id FROM nl_usuarios WHERE tipo='admin' ORDER BY id ASC LIMIT 1");
        const adminId = adminResult.rows[0]?.id;
        if (!adminId) throw new Error('No existe usuario admin. Ejecuta primero npm run bootstrap:clean');

        const tecnicoRoleId = await getRoleId(client, 'Técnico');
        const clienteRoleId = await getRoleId(client, 'Cliente');
        if (!tecnicoRoleId || !clienteRoleId) throw new Error('No se encontraron roles base. Ejecuta npm run bootstrap:clean');

        const clinicId = await getOrCreateClinic(client, {
            nombre: 'Clinica Demo QA',
            razon_social: 'Clinica Demo QA S.A.C.',
            ruc: '20999999991',
            email: 'contacto@demolab.pe',
            telefono: '01-5557788',
            direccion: 'Av. Demo 123, Lima',
            contacto_nombre: 'Dra. Diana Pruebas'
        });

        const tecnicoId = await getOrCreateUser(client, {
            nombre: 'Luis Tecnico QA',
            email: 'tecnico.qa@newlab.pe',
            telefono: '999111222',
            tipo: 'tecnico',
            password: 'tecnico123'
        }, tecnicoRoleId);

        const clienteId = await getOrCreateUser(client, {
            nombre: 'Dra. Elena Cliente',
            email: 'cliente.qa@demolab.pe',
            telefono: '999333444',
            tipo: 'cliente',
            clinica_id: clinicId,
            password: 'cliente123'
        }, clienteRoleId);

        const catCorona = await client.query("SELECT id FROM nl_categorias_trabajo WHERE nombre = 'Corona' LIMIT 1");
        const catCarilla = await client.query("SELECT id FROM nl_categorias_trabajo WHERE nombre = 'Carilla' LIMIT 1");
        if (!catCorona.rows[0] || !catCarilla.rows[0]) {
            throw new Error('Categorias base incompletas. Ejecuta npm run bootstrap:clean');
        }

        const zirconiaId = await getOrCreateMaterial(client, 'Zirconia');
        const disilicatoId = await getOrCreateMaterial(client, 'Disilicato de Litio');

        const prodCoronaId = await getOrCreateProduct(client, {
            nombre: 'Corona QA Zirconia',
            descripcion: 'Producto demo para pruebas de flujo',
            categoria_id: catCorona.rows[0].id,
            precio_base: 180,
            material_id: zirconiaId,
            tiempo_estimado_dias: 5
        });

        const prodCarillaId = await getOrCreateProduct(client, {
            nombre: 'Carilla QA Disilicato',
            descripcion: 'Producto demo para pruebas de aprobacion',
            categoria_id: catCarilla.rows[0].id,
            precio_base: 220,
            material_id: disilicatoId,
            tiempo_estimado_dias: 4
        });

        await createPedidoScenario(client, {
            codigo: 'QA-00001', clinica_id: clinicId, paciente_nombre: 'Paula Inicio',
            fecha: daysFromNow(-2), fecha_entrega: daysFromNow(4), estado: 'pendiente',
            subtotal: 180, igv: 0, total: 180, responsable_id: null, created_by: adminId,
            producto_id: prodCoronaId, piezas_dentales: ['11'], material: 'Zirconia', color_vita: 'A2', cantidad: 1, precio_unitario: 180,
            timeline: [{ estado_anterior: null, estado_nuevo: 'pendiente', usuario_id: adminId, comentario: 'Pedido creado' }],
            notificaciones: [{ usuario_id: tecnicoId, tipo: 'nuevo_pedido', titulo: 'Nuevo pedido QA', mensaje: 'Pedido QA-00001 disponible' }]
        });

        await createPedidoScenario(client, {
            codigo: 'QA-00002', clinica_id: clinicId, paciente_nombre: 'Mario Diseño',
            fecha: daysFromNow(-3), fecha_entrega: daysFromNow(3), estado: 'en_diseno',
            subtotal: 220, igv: 0, total: 220, responsable_id: tecnicoId, created_by: adminId,
            producto_id: prodCarillaId, piezas_dentales: ['21'], material: 'Disilicato de Litio', color_vita: 'A1', cantidad: 1, precio_unitario: 220,
            timeline: [
                { estado_nuevo: 'pendiente', usuario_id: adminId, comentario: 'Pedido creado' },
                { estado_anterior: 'pendiente', estado_nuevo: 'en_diseno', usuario_id: tecnicoId, comentario: 'Asignado a diseño' }
            ]
        });

        await createPedidoScenario(client, {
            codigo: 'QA-00003', clinica_id: clinicId, paciente_nombre: 'Nora Aprobacion',
            fecha: daysFromNow(-4), fecha_entrega: daysFromNow(2), estado: 'esperando_aprobacion',
            subtotal: 220, igv: 0, total: 220, responsable_id: tecnicoId, created_by: adminId,
            producto_id: prodCarillaId, piezas_dentales: ['12'], material: 'Disilicato de Litio', color_vita: 'B1', cantidad: 1, precio_unitario: 220,
            timeline: [
                { estado_nuevo: 'pendiente', usuario_id: adminId, comentario: 'Pedido creado' },
                { estado_anterior: 'pendiente', estado_nuevo: 'en_diseno', usuario_id: tecnicoId, comentario: 'Diseño iniciado' },
                { estado_anterior: 'en_diseno', estado_nuevo: 'esperando_aprobacion', usuario_id: tecnicoId, comentario: 'Diseño enviado a aprobación' }
            ],
            aprobacion: {
                link_exocad: 'https://exocad.example.com/revision/qa-00003',
                estado: 'pendiente'
            },
            notificaciones: [{ usuario_id: clienteId, tipo: 'aprobacion', titulo: 'Diseño listo para aprobar', mensaje: 'Revisar QA-00003' }]
        });

        await createPedidoScenario(client, {
            codigo: 'QA-00004', clinica_id: clinicId, paciente_nombre: 'Lucia Produccion',
            fecha: daysFromNow(-6), fecha_entrega: daysFromNow(1), estado: 'en_produccion',
            subtotal: 360, igv: 0, total: 360, responsable_id: tecnicoId, created_by: adminId,
            producto_id: prodCoronaId, piezas_dentales: ['14', '15'], material: 'Zirconia', color_vita: 'A3', cantidad: 2, precio_unitario: 180,
            timeline: [
                { estado_nuevo: 'pendiente', usuario_id: adminId, comentario: 'Pedido creado' },
                { estado_anterior: 'pendiente', estado_nuevo: 'en_diseno', usuario_id: tecnicoId, comentario: 'Diseño iniciado' },
                { estado_anterior: 'en_diseno', estado_nuevo: 'esperando_aprobacion', usuario_id: tecnicoId, comentario: 'Diseño enviado a aprobación' },
                { estado_anterior: 'esperando_aprobacion', estado_nuevo: 'en_produccion', usuario_id: clienteId, comentario: 'Diseño aprobado por cliente' }
            ],
            aprobacion: {
                link_exocad: 'https://exocad.example.com/revision/qa-00004',
                estado: 'aprobado',
                comentario_cliente: 'Aprobado, proceder',
                respondido_at: new Date()
            },
            pagos: [{ monto: 150, metodo: 'transferencia', referencia: 'QA-PARCIAL-1', fecha_pago: daysFromNow(-1), creado_por: adminId }]
        });

        await createPedidoScenario(client, {
            codigo: 'QA-00005', clinica_id: clinicId, paciente_nombre: 'Renato Terminado',
            fecha: daysFromNow(-8), fecha_entrega: daysFromNow(-1), estado: 'terminado',
            subtotal: 180, igv: 0, total: 180, responsable_id: tecnicoId, created_by: adminId,
            producto_id: prodCoronaId, piezas_dentales: ['24'], material: 'Zirconia', color_vita: 'A2', cantidad: 1, precio_unitario: 180,
            timeline: [
                { estado_nuevo: 'pendiente', usuario_id: adminId, comentario: 'Pedido creado' },
                { estado_anterior: 'pendiente', estado_nuevo: 'en_diseno', usuario_id: tecnicoId, comentario: 'Diseño iniciado' },
                { estado_anterior: 'en_diseno', estado_nuevo: 'esperando_aprobacion', usuario_id: tecnicoId, comentario: 'Diseño enviado a aprobación' },
                { estado_anterior: 'esperando_aprobacion', estado_nuevo: 'en_produccion', usuario_id: clienteId, comentario: 'Diseño aprobado por cliente' },
                { estado_anterior: 'en_produccion', estado_nuevo: 'terminado', usuario_id: tecnicoId, comentario: 'Trabajo terminado' }
            ]
        });

        await createPedidoScenario(client, {
            codigo: 'QA-00006', clinica_id: clinicId, paciente_nombre: 'Sara Enviado',
            fecha: daysFromNow(-10), fecha_entrega: daysFromNow(-2), estado: 'enviado',
            subtotal: 220, igv: 0, total: 220, responsable_id: tecnicoId, created_by: adminId,
            producto_id: prodCarillaId, piezas_dentales: ['31'], material: 'Disilicato de Litio', color_vita: 'A1', cantidad: 1, precio_unitario: 220,
            timeline: [
                { estado_nuevo: 'pendiente', usuario_id: adminId, comentario: 'Pedido creado' },
                { estado_anterior: 'pendiente', estado_nuevo: 'en_diseno', usuario_id: tecnicoId, comentario: 'Diseño iniciado' },
                { estado_anterior: 'en_diseno', estado_nuevo: 'esperando_aprobacion', usuario_id: tecnicoId, comentario: 'Diseño enviado a aprobación' },
                { estado_anterior: 'esperando_aprobacion', estado_nuevo: 'en_produccion', usuario_id: clienteId, comentario: 'Diseño aprobado por cliente' },
                { estado_anterior: 'en_produccion', estado_nuevo: 'terminado', usuario_id: tecnicoId, comentario: 'Trabajo terminado' },
                { estado_anterior: 'terminado', estado_nuevo: 'enviado', usuario_id: adminId, comentario: 'Pedido enviado' }
            ],
            pagos: [
                { monto: 100, metodo: 'transferencia', referencia: 'QA-FULL-1', fecha_pago: daysFromNow(-5), creado_por: adminId },
                { monto: 120, metodo: 'transferencia', referencia: 'QA-FULL-2', fecha_pago: daysFromNow(-3), creado_por: adminId }
            ],
            notificaciones: [{ usuario_id: clienteId, tipo: 'enviado', titulo: 'Pedido enviado', mensaje: 'QA-00006 fue despachado' }]
        });

        await client.query('COMMIT');

        console.log('Seed small completado.');
        console.log('Usuarios de prueba:');
        console.log('- tecnico.qa@newlab.pe / tecnico123');
        console.log('- cliente.qa@demolab.pe / cliente123');
        console.log('Pedidos QA creados: QA-00001 ... QA-00006 (idempotente por codigo)');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error en seed small:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

seedSmall();
