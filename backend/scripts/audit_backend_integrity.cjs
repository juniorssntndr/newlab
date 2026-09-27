const dotenv = require('dotenv');
const { Pool } = require('pg');
dotenv.config({ path: 'backend/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function audit() {
  console.log('=== INICIANDO AUDITORÍA EXHAUSTIVA DE INTEGRIDAD DE DATOS Y BACKEND ===\n');

  // 1. Audit nl_clinicas duplicates
  console.log('--- 1. AUDITORÍA DE CLÍNICAS (nl_clinicas) ---');
  const clinicas = (await pool.query(`
    SELECT id, nombre, razon_social, ruc, email, telefono, direccion, contacto_nombre, created_at 
    FROM nl_clinicas 
    ORDER BY id
  `)).rows;
  console.log(`Total clínicas registradas: ${clinicas.length}`);
  
  // Group by name
  const byName = {};
  for (const c of clinicas) {
    const key = c.nombre.trim().toLowerCase();
    if (!byName[key]) byName[key] = [];
    byName[key].push(c);
  }
  for (const [key, list] of Object.entries(byName)) {
    if (list.length > 1) {
      console.log(`⚠️ Clínicas duplicadas por nombre "${key}": ${list.length} registros:`, list.map(x => ({ id: x.id, ruc: x.ruc, email: x.email })));
    }
  }

  // 2. Audit nl_doctores
  console.log('\n--- 2. AUDITORÍA DE DOCTORES (nl_doctores) ---');
  const doctores = (await pool.query(`SELECT id, nombre_completo, dni, cop, email, telefono FROM nl_doctores ORDER BY id`)).rows;
  console.log(`Total doctores: ${doctores.length}`);
  const docByDni = {};
  for (const d of doctores) {
    if (d.dni) {
      if (!docByDni[d.dni]) docByDni[d.dni] = [];
      docByDni[d.dni].push(d);
    }
  }
  for (const [dni, list] of Object.entries(docByDni)) {
    if (list.length > 1) {
      console.log(`⚠️ Doctores duplicados por DNI ${dni}:`, list);
    }
  }

  // 3. Audit nl_usuarios
  console.log('\n--- 3. AUDITORÍA DE USUARIOS (nl_usuarios) ---');
  const usuarios = (await pool.query(`SELECT id, nombre, email, tipo, rol_id, clinica_id, estado FROM nl_usuarios ORDER BY id`)).rows;
  console.log(`Total usuarios: ${usuarios.length}`);
  // Check users with invalid clinica_id
  const invalidUserClinicas = (await pool.query(`
    SELECT u.id, u.nombre, u.email, u.clinica_id 
    FROM nl_usuarios u 
    LEFT JOIN nl_clinicas c ON c.id = u.clinica_id 
    WHERE u.clinica_id IS NOT NULL AND c.id IS NULL
  `)).rows;
  console.log(`Usuarios con clinica_id huérfano: ${invalidUserClinicas.length}`);

  // 4. Audit nl_pedidos and nl_pedido_items
  console.log('\n--- 4. AUDITORÍA DE PEDIDOS (nl_pedidos) ---');
  const totalPedidos = (await pool.query('SELECT count(*) FROM nl_pedidos')).rows[0].count;
  console.log(`Total pedidos: ${totalPedidos}`);
  
  // Pedidos with invalid clinica_id
  const orphanPedidos = (await pool.query(`
    SELECT p.id, p.codigo, p.clinica_id 
    FROM nl_pedidos p 
    LEFT JOIN nl_clinicas c ON c.id = p.clinica_id 
    WHERE c.id IS NULL
  `)).rows;
  console.log(`Pedidos con clinica_id inexistente: ${orphanPedidos.length}`);

  // Pedidos without items
  const pedidosSinItems = (await pool.query(`
    SELECT p.id, p.codigo, p.total 
    FROM nl_pedidos p 
    LEFT JOIN nl_pedido_items pi ON pi.pedido_id = p.id 
    WHERE pi.id IS NULL
  `)).rows;
  console.log(`Pedidos sin ningún ítem técnico: ${pedidosSinItems.length}`, pedidosSinItems);

  // Math check on pedidos: subtotal + igv vs total
  const mathMismatches = (await pool.query(`
    SELECT id, codigo, subtotal, igv, total, (subtotal + igv) as sum_calc, ABS((subtotal + igv) - total) as diff
    FROM nl_pedidos 
    WHERE ABS((subtotal + igv) - total) > 0.05
  `)).rows;
  console.log(`Pedidos con discrepancia matemática (subtotal + igv != total): ${mathMismatches.length}`);
  if (mathMismatches.length > 0) {
    console.table(mathMismatches.slice(0, 5));
  }

  // Multi-product violation check: domain rule is "un solo producto por orden"
  const multiProductOrders = (await pool.query(`
    SELECT pedido_id, count(DISTINCT producto_id) as prod_count 
    FROM nl_pedido_items 
    GROUP BY pedido_id 
    HAVING count(DISTINCT producto_id) > 1
  `)).rows;
  console.log(`Pedidos que violan la regla de Un Solo Producto por Orden: ${multiProductOrders.length}`);

  // 5. Audit nl_pagos and nl_pedidos consistency
  console.log('\n--- 5. AUDITORÍA DE PAGOS (nl_pagos) ---');
  const pagos = (await pool.query('SELECT count(*) FROM nl_pagos')).rows[0].count;
  console.log(`Total registros de pagos: ${pagos}`);
  
  const orphanPagos = (await pool.query(`
    SELECT p.id, p.pedido_id, p.monto 
    FROM nl_pagos p 
    LEFT JOIN nl_pedidos ped ON ped.id = p.pedido_id 
    WHERE p.pedido_id IS NOT NULL AND ped.id IS NULL
  `)).rows;
  console.log(`Pagos con pedido_id huérfano: ${orphanPagos.length}`);

  // Check overpaid orders
  const overpaidOrders = (await pool.query(`
    SELECT ped.id, ped.codigo, ped.total, COALESCE(SUM(p.monto), 0) as total_pagado, (COALESCE(SUM(p.monto), 0) - ped.total) as sobrepago
    FROM nl_pedidos ped
    JOIN nl_pagos p ON p.pedido_id = ped.id
    GROUP BY ped.id, ped.codigo, ped.total
    HAVING SUM(p.monto) > ped.total + 0.05
  `)).rows;
  console.log(`Pedidos sobrepagados (pagos > total): ${overpaidOrders.length}`, overpaidOrders);

  // 6. Audit Comprobantes (nl_comprobantes)
  console.log('\n--- 6. AUDITORÍA DE COMPROBANTES FISCALES (nl_comprobantes) ---');
  const compCount = (await pool.query('SELECT count(*) FROM nl_comprobantes')).rows[0].count;
  console.log(`Total comprobantes emitidos: ${compCount}`);

  // Check duplicate series-correlativo
  const dupComps = (await pool.query(`
    SELECT tipo_comprobante, serie, correlativo, count(*) 
    FROM nl_comprobantes 
    GROUP BY tipo_comprobante, serie, correlativo 
    HAVING count(*) > 1
  `)).rows;
  console.log(`Comprobantes con serie-correlativo duplicado: ${dupComps.length}`);

  // 7. Audit CRM Territorial (nl_crm_establecimientos, visitas, etc.)
  console.log('\n--- 7. AUDITORÍA DE CRM TERRITORIAL ---');
  const estCount = (await pool.query('SELECT count(*) FROM nl_crm_establecimientos')).rows[0].count;
  const visitCount = (await pool.query('SELECT count(*) FROM nl_crm_visitas')).rows[0].count;
  const recCount = (await pool.query('SELECT count(*) FROM nl_crm_reclamos')).rows[0].count;
  console.log(`Establecimientos CRM: ${estCount}`);
  console.log(`Visitas CRM: ${visitCount}`);
  console.log(`Reclamos CRM: ${recCount}`);

  // 8. Audit Database constraints & Indexes on nl_clinicas
  console.log('\n--- 8. RESTRICCIONES (CONSTRAINTS) EN nl_clinicas ---');
  const constraints = (await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid) 
    FROM pg_constraint c 
    JOIN pg_class t ON t.oid = c.conrelid 
    WHERE t.relname = 'nl_clinicas'
  `)).rows;
  console.table(constraints);

  console.log('\n--- 9. ÍNDICES EN nl_clinicas ---');
  const indexes = (await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'nl_clinicas'
  `)).rows;
  console.table(indexes);

  console.log('\n=== FIN DE AUDITORÍA ===');
  pool.end();
}

audit().catch(e => {
  console.error(e);
  pool.end();
});
