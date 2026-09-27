import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'assert';
import { itemsSchema, createPedidoSchema, productoSchema } from '../src/validation/schemas.js';
import { makeOrderPgRepository } from '../src/modules/orders/infrastructure/repositories/orderPgRepository.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
    console.log('=== 1. Testing Validation Schemas ===');
    
    // Test itemsSchema
    const validItem = {
        producto_id: 1,
        piezas_dentales: ['14', '16'],
        pilares_dentales: ['14', '16'],
        ponticos_dentales: ['15'],
        tramos_detalle: [
            { tipo: 'pilar', pieza: '14' },
            { tipo: 'pontico', pieza: '15' },
            { tipo: 'pilar', pieza: '16' }
        ],
        guia_color: 'vita_3d_master',
        es_puente: true,
        material: 'Zirconia Monolítica',
        color_vita: '2M2',
        cantidad: 3,
        precio_unitario: 120
    };
    
    const parsedItem = itemsSchema.parse(validItem);
    assert.deepStrictEqual(parsedItem.ponticos_dentales, ['15']);
    assert.strictEqual(parsedItem.guia_color, 'vita_3d_master');
    assert.strictEqual(parsedItem.tramos_detalle.length, 3);
    console.log('✔ itemsSchema validation passed');

    // Test createPedidoSchema
    const validPedido = {
        clinica_id: 1,
        paciente_nombre: 'Paciente Test Multi-Span',
        fecha_entrega: '2026-10-01',
        items: [validItem]
    };
    const parsedPedido = createPedidoSchema.parse(validPedido);
    assert.strictEqual(parsedPedido.items[0].ponticos_dentales[0], '15');
    console.log('✔ createPedidoSchema validation passed');

    // Test productoSchema
    const validProduct = {
        nombre: 'Puente Zirconia Multi-Span',
        precio_base: 150,
        admite_puente: true
    };
    const parsedProduct = productoSchema.parse(validProduct);
    assert.strictEqual(parsedProduct.admite_puente, true);
    console.log('✔ productoSchema validation passed');

    console.log('\n=== 2. Testing Database Repository & Queries ===');
    const orderRepo = makeOrderPgRepository({ pool });

    // Verify products table has columns and query works
    const productsRes = await pool.query(
        'SELECT id, nombre, admite_puente FROM nl_productos WHERE admite_puente = true LIMIT 5'
    );
    console.log(`Found ${productsRes.rows.length} products with admite_puente = true`);
    assert(productsRes.rows.length > 0, 'Should have products with admite_puente = true');

    // Pick first clinic and user for test insertion
    const clinicRes = await pool.query('SELECT id FROM nl_clinicas LIMIT 1');
    const userRes = await pool.query('SELECT id FROM nl_usuarios LIMIT 1');
    
    if (clinicRes.rows.length > 0 && userRes.rows.length > 0) {
        const clinicaId = clinicRes.rows[0].id;
        const userId = userRes.rows[0].id;

        const testOrderInput = {
            clinica_id: clinicaId,
            paciente_nombre: 'TEST BRIDGE SPANS VERIFICATION',
            fecha_entrega: '2026-10-15',
            observaciones: 'Test order for multi-span bridge verification',
            archivos_urls: [],
            items: [
                {
                    producto_id: productsRes.rows[0].id,
                    piezas_dentales: ['14', '16'],
                    pilares_dentales: ['14', '16'],
                    ponticos_dentales: ['15'],
                    tramos_detalle: [
                        { tipo: 'pilar', pieza: '14' },
                        { tipo: 'pontico', pieza: '15' },
                        { tipo: 'pilar', pieza: '16' }
                    ],
                    guia_color: 'vita_3d_master',
                    es_puente: true,
                    pieza_inicio: '14',
                    pieza_fin: '16',
                    material: 'Zirconia',
                    color_vita: '2M2',
                    cantidad: 3,
                    precio_unitario: 100
                }
            ]
        };

        const created = await orderRepo.createOrder({
            orderInput: testOrderInput,
            totals: { total: 300, subtotal: 254.24, igv: 45.76 },
            actorUserId: userId
        });

        console.log('Order created with ID:', created.pedido.id);

        const items = await orderRepo.listOrderItems({ orderId: created.pedido.id });
        console.log('Fetched items count:', items.length);
        assert.strictEqual(items.length, 1);
        
        const item = items[0];
        console.log('Item columns fetched:');
        console.log('- ponticos_dentales:', item.ponticos_dentales);
        console.log('- tramos_detalle:', item.tramos_detalle);
        console.log('- guia_color:', item.guia_color);
        
        assert.deepStrictEqual(item.ponticos_dentales, ['15']);
        assert.strictEqual(item.guia_color, 'vita_3d_master');
        assert(Array.isArray(item.tramos_detalle) && item.tramos_detalle.length === 3);

        // Cleanup test order
        await pool.query('DELETE FROM nl_pedido_items WHERE pedido_id = $1', [created.pedido.id]);
        await pool.query('DELETE FROM nl_pedidos WHERE id = $1', [created.pedido.id]);
        console.log('✔ Test order cleaned up successfully');
    }

    console.log('\n=== All Phase 1 Backend checks passed successfully! ===');
}

verify()
    .catch((err) => {
        console.error('Verification failed:', err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
