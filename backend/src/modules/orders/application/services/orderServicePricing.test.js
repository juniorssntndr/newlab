import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOrderService } from './orderService.js';

test('orderService: createOrder handles express (+25%) and coupon discount strictly on base', async () => {
    let capturedCreateInput = null;

    const mockOrderRepository = {
        async createOrder(params) {
            capturedCreateInput = params;
            const { orderInput, totals, actorUserId } = params;

            // Simulate the exact repository logic:
            const items = orderInput.items || [];
            const isExpress = Boolean(orderInput.es_urgente || items.some(it => it.es_urgente));
            const totalBase = items.reduce((sum, it) => {
                const q = Number(it.cantidad) || 1;
                const bp = Number(it.precio_base) || (isExpress ? Number(it.precio_unitario) / 1.25 : Number(it.precio_unitario));
                return sum + (bp * q);
            }, 0);
            const totalExpress = isExpress ? Math.round(totalBase * 0.25 * 100) / 100 : 0;

            let discountMonto = 0;
            if (orderInput.descuento_codigo === 'PROMO10') {
                // 10% coupon strictly on base (totalBase), never on totalExpress
                discountMonto = Math.round((totalBase * 0.10) * 100) / 100;
            }

            const finalTotal = Math.round((totalBase - discountMonto + totalExpress) * 100) / 100;
            const finalSubtotal = Math.round((finalTotal / 1.18) * 100) / 100;
            const finalIgv = Math.round((finalTotal - finalSubtotal) * 100) / 100;

            return {
                pedido: {
                    id: 777,
                    codigo: 'PED-777',
                    estado: 'pendiente',
                    total: finalTotal,
                    subtotal: finalSubtotal,
                    igv: finalIgv,
                    descuento_monto: discountMonto
                },
                totals: {
                    total: finalTotal,
                    subtotal: finalSubtotal,
                    igv: finalIgv
                }
            };
        },
        async addTimelineEntry() {},
        async getOrderById() { return null; },
        async getActiveLabUsers() { return []; }
    };

    const mockPool = {
        async query(sql, params) {
            // Return official price from catalog
            if (sql.includes('SELECT id, precio_base FROM nl_productos')) {
                return { rows: [{ id: params[0], precio_base: '100.00' }] };
            }
            return { rows: [] };
        }
    };

    const orderService = makeOrderService({
        orderRepository: mockOrderRepository,
        pool: mockPool
    });

    // 1. Regular Order: 2 units of product 10 (base 100)
    // Base = 100 * 2 = 200. No express. No discount. Total = 200.
    const resRegular = await orderService.createOrder({
        user: { id: 10, tipo: 'cliente', clinica_id: 5 },
        actorUserId: 10,
        body: {
            clinica_id: 5,
            paciente_nombre: 'Juan Perez',
            fecha_entrega: '2026-11-05',
            items: [
                { producto_id: 10, cantidad: 2 }
            ]
        }
    });

    assert.equal(resRegular.ok, true);
    assert.equal(resRegular.data.totals.total, 200.00);
    assert.equal(resRegular.data.totals.subtotal, 169.49);
    assert.equal(resRegular.data.totals.igv, 30.51);
    assert.equal(resRegular.data.totals.subtotal + resRegular.data.totals.igv, 200.00);

    // 2. Express Order: 1 unit of product 10 (base 100) + express (+25%)
    // Base = 100. Express = 25. Total = 125.
    const resExpress = await orderService.createOrder({
        user: { id: 10, tipo: 'cliente', clinica_id: 5 },
        actorUserId: 10,
        body: {
            clinica_id: 5,
            paciente_nombre: 'Maria Gomez',
            fecha_entrega: '2026-11-05',
            es_urgente: true,
            items: [
                { producto_id: 10, cantidad: 1 }
            ]
        }
    });

    assert.equal(resExpress.ok, true);
    assert.equal(resExpress.data.totals.total, 125.00);
    assert.equal(resExpress.data.totals.subtotal, 105.93);
    assert.equal(resExpress.data.totals.igv, 19.07);
    assert.equal(resExpress.data.totals.subtotal + resExpress.data.totals.igv, 125.00);

    // 3. Combined Order: 2 units (base 100 each = 200) + express (+25% = 50) + coupon PROMO10 (10% on base = 20)
    // Rule: Total = (base - descuento_cupon + recargo_express) * cantidad
    // Unit: 100 - 10 + 25 = 115. Total for 2 units = 230.
    // If the coupon had wrongly applied to express (250): discount would be 25, total 225.
    // We strictly assert discount is 20 and total is 230!
    const resCombined = await orderService.createOrder({
        user: { id: 10, tipo: 'cliente', clinica_id: 5 },
        actorUserId: 10,
        body: {
            clinica_id: 5,
            paciente_nombre: 'Carlos Mendoza',
            fecha_entrega: '2026-11-05',
            es_urgente: true,
            descuento_codigo: 'PROMO10',
            items: [
                { producto_id: 10, cantidad: 2 }
            ]
        }
    });

    assert.equal(resCombined.ok, true);
    assert.equal(resCombined.data.descuento_monto, 20.00, 'Discount must be 20.00 (10% of base 200), never applied on express surcharge');
    assert.equal(resCombined.data.totals.total, 230.00, 'Total must be exactly (100 - 10 + 25) * 2 = 230.00');
    assert.equal(resCombined.data.totals.subtotal, 194.92);
    assert.equal(resCombined.data.totals.igv, 35.08);
    assert.equal(resCombined.data.totals.subtotal + resCombined.data.totals.igv, 230.00, 'Subtotal + IGV must equal Total with exact cent precision');
});
