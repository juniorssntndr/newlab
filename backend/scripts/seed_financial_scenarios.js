import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: 'd:/Archivos personales/Codigo/NEWLAB/backend/.env' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('1. Actualizando datos de contacto y RUC de clínicas...');
        await client.query(`
            UPDATE nl_clinicas 
            SET ruc = '20601234567', contacto_nombre = 'Dra. Mariana Ruiz', telefono = '987654321', email = 'administracion@dentalsanisidro.pe'
            WHERE id = 2;

            UPDATE nl_clinicas 
            SET ruc = '20549876543', contacto_nombre = 'Dr. Alejandro Ramos', telefono = '998877665', email = 'finanzas@mirafloresdental.pe'
            WHERE id = 3;

            UPDATE nl_clinicas 
            SET ruc = '10456789012', contacto_nombre = 'Dr. Martín Morales', telefono = '912345678', email = 'martin@moralesdental.pe'
            WHERE id = 4;

            UPDATE nl_clinicas 
            SET ruc = '20109876543', contacto_nombre = 'Dr. Brandon Santander', telefono = '977593443'
            WHERE id = 1;
        `);

        // Obtener productos
        const prodRows = (await client.query(`SELECT id, nombre, precio_base FROM nl_productos ORDER BY id`)).rows;
        const pCorona = prodRows.find(p => p.nombre.toLowerCase().includes('corona')) || prodRows[0];
        const pPPR = prodRows.find(p => p.nombre.toLowerCase().includes('ppr')) || prodRows[1];
        const pFerula = prodRows.find(p => p.nombre.toLowerCase().includes('férula') || p.nombre.toLowerCase().includes('ferula')) || prodRows[2];
        const pGuia = prodRows.find(p => p.nombre.toLowerCase().includes('guía') || p.nombre.toLowerCase().includes('guia')) || prodRows[3];

        const adminId = (await client.query(`SELECT id FROM nl_usuarios WHERE tipo = 'admin' LIMIT 1`)).rows[0]?.id || 1;

        console.log('2. Limpiando pedidos de prueba previos si existen...');
        await client.query(`
            DELETE FROM nl_pedidos 
            WHERE codigo IN ('NL-00025', 'NL-00026', 'NL-00027', 'NL-00028', 'NL-00029', 'NL-00030', 'NL-00031', 'NL-00032', 'NL-00033', 'NL-00034')
        `);

        console.log('3. Creando pedidos con escenarios financieros específicos...');

        // ==========================================
        // GRUPO 1: CAJA DIARIA - COBRO MULTIPEDIDO (Clínica San Isidro, id: 2)
        // Cada orden representa un trabajo técnico específico con su propio producto
        // ==========================================
        // Pedido NL-00025: Terminado, 100% pendiente (por cancelar en rojo) - Corona Zirconia
        const p25 = (await client.query(`
            INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, created_by, responsable_id)
            VALUES ('NL-00025', 2, 'Camila Valdivia', CURRENT_DATE - 2, CURRENT_DATE, 'terminado', 360.00, 0.00, 360.00, $1, $1)
            RETURNING id;
        `, [adminId])).rows[0];

        await client.query(`
            INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, '{11, 21}', 'Zirconia Monolítica', 'A2', 2, 180.00, 360.00)
        `, [p25.id, pCorona.id]);

        // Pedido NL-00026: Enviado, con Abono Parcial - Estructura PPR Cr-Co (1 producto)
        const p26 = (await client.query(`
            INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, created_by, responsable_id)
            VALUES ('NL-00026', 2, 'Renzo Gamarra', CURRENT_DATE - 3, CURRENT_DATE, 'enviado', 200.00, 0.00, 200.00, $1, $1)
            RETURNING id;
        `, [adminId])).rows[0];

        await client.query(`
            INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, '{36}', 'Estructura Cr-Co', 'N/A', 1, 200.00, 200.00)
        `, [p26.id, pPPR.id]);

        // Pago parcial de S/. 100.00 en NL-00026 -> Saldo pendiente S/. 100.00
        await client.query(`
            INSERT INTO nl_pagos (pedido_id, clinica_id, monto, metodo, tipo_fondo, referencia, fecha_pago, notas, creado_por)
            VALUES ($1, 2, 100.00, 'transferencia', 'banco', 'BCP-ANTICIPO-9812', CURRENT_DATE - 1, 'Anticipo al ingresar trabajo', $2)
        `, [p26.id, adminId]);

        // Pedido NL-00027: Terminado, 100% pendiente - Guía quirúrgica impresa (1 producto)
        const p27 = (await client.query(`
            INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, created_by, responsable_id)
            VALUES ('NL-00027', 2, 'Lucía Fernández', CURRENT_DATE - 1, CURRENT_DATE, 'terminado', 150.00, 0.00, 150.00, $1, $1)
            RETURNING id;
        `, [adminId])).rows[0];

        await client.query(`
            INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, '{14}', 'Resina Quirúrgica 3D', 'N/A', 1, 150.00, 150.00)
        `, [p27.id, pGuia.id]);

        // Pedido NL-00034: Terminado, 100% pendiente - Férula Michigan (1 producto)
        const p34 = (await client.query(`
            INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, created_by, responsable_id)
            VALUES ('NL-00034', 2, 'Daniel Cortez', CURRENT_DATE - 1, CURRENT_DATE, 'terminado', 120.00, 0.00, 120.00, $1, $1)
            RETURNING id;
        `, [adminId])).rows[0];

        await client.query(`
            INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, '{superior}', 'Acrílico Rígido Termocurado', 'Transparente', 1, 120.00, 120.00)
        `, [p34.id, pFerula.id]);

        // ==========================================
        // GRUPO 2: COBRANZAS - MORA CRÍTICA >30 DÍAS (Centro Odontológico Miraflores, id: 3)
        // ==========================================
        // Pedido NL-00028: Deuda hace 45 días, saldo S/. 720.00
        const p28 = (await client.query(`
            INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, created_by, responsable_id, created_at)
            VALUES ('NL-00028', 3, 'Eduardo Palacios', CURRENT_DATE - 48, CURRENT_DATE - 45, 'enviado', 720.00, 0.00, 720.00, $1, $1, CURRENT_TIMESTAMP - INTERVAL '48 days')
            RETURNING id;
        `, [adminId])).rows[0];

        await client.query(`
            INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, '{11, 12, 21, 22}', 'Zirconia Multilayer', 'A1', 4, 180.00, 720.00)
        `, [p28.id, pCorona.id]);

        // Pedido NL-00029: Deuda hace 52 días, total S/. 900.00, con abono de S/. 300.00 -> saldo S/. 600.00
        const p29 = (await client.query(`
            INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, created_by, responsable_id, created_at)
            VALUES ('NL-00029', 3, 'Sofía Mendoza', CURRENT_DATE - 55, CURRENT_DATE - 52, 'enviado', 900.00, 0.00, 900.00, $1, $1, CURRENT_TIMESTAMP - INTERVAL '55 days')
            RETURNING id;
        `, [adminId])).rows[0];

        await client.query(`
            INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, '{14, 15, 16, 24, 25}', 'Zirconia 3D Pro', 'A2', 5, 180.00, 900.00)
        `, [p29.id, pCorona.id]);

        await client.query(`
            INSERT INTO nl_pagos (pedido_id, clinica_id, monto, metodo, tipo_fondo, referencia, fecha_pago, notas, creado_por)
            VALUES ($1, 3, 300.00, 'transferencia', 'banco', 'BBVA-MORA-22', CURRENT_DATE - 30, 'Abono antiguo de hace 1 mes', $2)
        `, [p29.id, adminId]);

        // ==========================================
        // GRUPO 3: COBRANZAS - SEGUIMIENTO PREVENTIVO 16–30 DÍAS (Dr. Martín Morales, id: 4)
        // ==========================================
        // Pedido NL-00030: Deuda hace 24 días, total S/. 540.00, pagado S/. 140.00 -> saldo S/. 400.00
        const p30 = (await client.query(`
            INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, created_by, responsable_id, created_at)
            VALUES ('NL-00030', 4, 'Valeria Quintana', CURRENT_DATE - 26, CURRENT_DATE - 24, 'enviado', 540.00, 0.00, 540.00, $1, $1, CURRENT_TIMESTAMP - INTERVAL '26 days')
            RETURNING id;
        `, [adminId])).rows[0];

        await client.query(`
            INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, '{13, 14, 15}', 'Zirconia High Translucency', 'B1', 3, 180.00, 540.00)
        `, [p30.id, pCorona.id]);

        await client.query(`
            INSERT INTO nl_pagos (pedido_id, clinica_id, monto, metodo, tipo_fondo, referencia, fecha_pago, notas, creado_por)
            VALUES ($1, 4, 140.00, 'efectivo', 'caja', 'REC-0912', CURRENT_DATE - 20, 'Abono en efectivo en recepción', $2)
        `, [p30.id, adminId]);

        // Pedido NL-00031: Deuda hace 19 días, total S/. 360.00 100% saldo
        const p31 = (await client.query(`
            INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, created_by, responsable_id, created_at)
            VALUES ('NL-00031', 4, 'Jorge Chávez', CURRENT_DATE - 21, CURRENT_DATE - 19, 'enviado', 360.00, 0.00, 360.00, $1, $1, CURRENT_TIMESTAMP - INTERVAL '21 days')
            RETURNING id;
        `, [adminId])).rows[0];

        await client.query(`
            INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, '{31, 41}', 'Disilicato E-max', 'BL3', 2, 180.00, 360.00)
        `, [p31.id, pCorona.id]);

        // ==========================================
        // GRUPO 4: COBRANZAS - CRÉDITO CORRIENTE 0–15 DÍAS Y SALDO A FAVOR (Brandon Santander, id: 1)
        // ==========================================
        // Pedido NL-00032: Deuda hace 6 días, total S/. 360.00, pagado S/. 160.00 -> saldo S/. 200.00
        const p32 = (await client.query(`
            INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, created_by, responsable_id, created_at)
            VALUES ('NL-00032', 1, 'Esteban Benítez', CURRENT_DATE - 8, CURRENT_DATE - 6, 'terminado', 360.00, 0.00, 360.00, $1, $1, CURRENT_TIMESTAMP - INTERVAL '8 days')
            RETURNING id;
        `, [adminId])).rows[0];

        await client.query(`
            INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, '{35, 36}', 'Zirconia Monolítica', 'A3', 2, 180.00, 360.00)
        `, [p32.id, pCorona.id]);

        await client.query(`
            INSERT INTO nl_pagos (pedido_id, clinica_id, monto, metodo, tipo_fondo, referencia, fecha_pago, notas, creado_por)
            VALUES ($1, 1, 160.00, 'transferencia', 'banco', 'INTERBANK-0091', CURRENT_DATE - 6, 'Abono inicial 44%', $2)
        `, [p32.id, adminId]);

        // Saldo a Favor disponible de S/. 150.00 para Clínica Brandon Santander (id: 1)
        await client.query(`
            INSERT INTO nl_pagos (clinica_id, monto, metodo, tipo_fondo, referencia, fecha_pago, notas, creado_por, es_saldo_favor, saldo_disponible)
            VALUES (1, 150.00, 'transferencia', 'banco', 'INTERBANK-ANTICIPO-FUTURO', CURRENT_DATE - 2, 'Anticipo para futuros trabajos', $1, TRUE, 150.00)
        `, [adminId]);

        // ==========================================
        // GRUPO 5: PEDIDO CANCELADO 100% (NL-00033) PARA AUDITORÍA HISTÓRICA
        // ==========================================
        const p33 = (await client.query(`
            INSERT INTO nl_pedidos (codigo, clinica_id, paciente_nombre, fecha, fecha_entrega, estado, subtotal, igv, total, created_by, responsable_id)
            VALUES ('NL-00033', 2, 'María Elena Ramos', CURRENT_DATE - 4, CURRENT_DATE - 1, 'enviado', 360.00, 0.00, 360.00, $1, $1)
            RETURNING id;
        `, [adminId])).rows[0];

        await client.query(`
            INSERT INTO nl_pedido_items (pedido_id, producto_id, piezas_dentales, material, color_vita, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, '{22, 23}', 'Zirconia Monolítica', 'A1', 2, 180.00, 360.00)
        `, [p33.id, pCorona.id]);

        await client.query(`
            INSERT INTO nl_pagos (pedido_id, clinica_id, monto, metodo, tipo_fondo, referencia, fecha_pago, notas, creado_por)
            VALUES ($1, 2, 360.00, 'efectivo', 'caja', 'REC-CANCELADO-TOTAL', CURRENT_DATE - 1, 'Cancelación total en entrega', $2)
        `, [p33.id, adminId]);

        await client.query('COMMIT');
        console.log('✅ Base de datos poblada exitosamente con todos los escenarios financieros!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante el seed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
