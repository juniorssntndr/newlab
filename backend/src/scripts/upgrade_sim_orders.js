import { pool } from '../utils/orderSimulator.js';

async function main() {
    // 1. Obtener pedidos con prefijo SIM-
    const simPeds = await pool.query("SELECT p.id, p.codigo, p.paciente_nombre, p.total, p.clinica_id FROM nl_pedidos p WHERE p.codigo LIKE 'SIM-%' ORDER BY p.id ASC");
    console.log(`Pedidos SIM encontrados: ${simPeds.rows.length}`);

    // 2. Productos reales de catálogo
    const prods = await pool.query("SELECT id, nombre, precio_base, material_default, tiempo_estimado_dias FROM nl_productos ORDER BY id ASC");
    
    // 3. Clínicas reales para distribuir
    const clinicas = await pool.query("SELECT id, nombre FROM nl_clinicas ORDER BY id ASC");

    const pacientes = [
        'Carlos Mendoza Ramos',
        'Ana Lucía Benavides',
        'Daniela Flores Huamán',
        'Renato Salazar Paredes',
        'Luciana Castillo Rivas',
        'Gabriel Ortiz Vega',
        'Mariana Quispe Torres',
        'Esteban Morales Benítez'
    ];
    const piezasList = [
        ['11', '12'],
        ['21'],
        ['36'],
        ['46'],
        ['24', '25'],
        ['16'],
        ['31', '41'],
        ['13']
    ];
    const tonos = ['A1', 'A2', 'A3', 'B1', 'BL2'];

    for (let i = 0; i < simPeds.rows.length; i++) {
        const ped = simPeds.rows[i];
        const paciente = pacientes[i % pacientes.length];
        const prod = prods.rows[i % prods.rows.length];
        const clinica = clinicas.rows[i % clinicas.rows.length];
        const piezas = piezasList[i % piezasList.length];
        const tono = tonos[i % tonos.length];
        const material = prod.material_default || 'Zirconia Monolítica';
        const cantidad = piezas.length;

        // Actualizar pedido
        await pool.query(
            'UPDATE nl_pedidos SET paciente_nombre = $1, clinica_id = $2 WHERE id = $3',
            [paciente, clinica.id, ped.id]
        );

        // Limpiar items viejos e insertar item con catálogo oficial
        await pool.query('DELETE FROM nl_pedido_items WHERE pedido_id = $1', [ped.id]);
        await pool.query(
            `INSERT INTO nl_pedido_items (
                pedido_id, producto_id, piezas_dentales, material,
                color_vita, cantidad, precio_unitario, subtotal
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                ped.id,
                prod.id,
                piezas,
                material,
                tono,
                cantidad,
                parseFloat(ped.total) / cantidad,
                parseFloat(ped.total)
            ]
        );

        console.log(`Pedido ${ped.codigo} actualizado -> Paciente: ${paciente} | Clínica: ${clinica.nombre} | Producto: ${prod.nombre} | Piezas: ${piezas.join(', ')} | Tono: ${tono}`);
    }

    console.log('>>> TODOS LOS PEDIDOS FUERON ACTUALIZADOS CON ANATOMÍA REAL');
    await pool.end();
}

main().catch(err => {
    console.error(err);
    pool.end();
});
