import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateOrderPricing,
    fromCents,
    roundHalfUp,
    splitTotalIntoTax,
    toCents,
    EXPRESS_SURCHARGE_RATE,
    IGV_RATE
} from './pricingCanonical.js';

test('roundHalfUp, toCents and fromCents arithmetic', () => {
    assert.equal(toCents(100), 10000);
    assert.equal(toCents(100.55), 10055);
    assert.equal(fromCents(10055), 100.55);
    assert.equal(roundHalfUp(1.005, 2), 1.01);
    assert.equal(roundHalfUp(1.004, 2), 1.00);
});

test('splitTotalIntoTax satisfies SUNAT equation subtotal + igv === total without float drift', () => {
    const testTotals = [0, 1, 10, 33.33, 99.99, 100, 115, 118, 125, 230, 247.50, 999.99, 1234.56];

    for (const total of testTotals) {
        const result = splitTotalIntoTax(total);
        assert.equal(result.total, total);
        const sum = Math.round((result.subtotal + result.igv) * 100) / 100;
        assert.equal(sum, total, `Failed equation for total ${total}: ${result.subtotal} + ${result.igv} !== ${total}`);
        assert.equal(result.subtotal + result.igv, total);
    }
});

test('Regular order without discount or express', () => {
    const pricing = calculateOrderPricing({
        basePrice: 100,
        quantity: 2,
        isExpress: false,
        coupon: null
    });

    assert.equal(pricing.unitBase, 100);
    assert.equal(pricing.unitExpress, 0);
    assert.equal(pricing.unitDiscount, 0);
    assert.equal(pricing.unitEffectivePrice, 100);
    assert.equal(pricing.totalBase, 200);
    assert.equal(pricing.totalExpress, 0);
    assert.equal(pricing.totalDiscount, 0);
    assert.equal(pricing.total, 200);
    assert.equal(pricing.subtotal, 169.49);
    assert.equal(pricing.igv, 30.51);
    assert.equal(pricing.subtotal + pricing.igv, 200);
});

test('Express order without discount: recargo express +25% applied on base', () => {
    const pricing = calculateOrderPricing({
        basePrice: 100,
        quantity: 1,
        isExpress: true,
        coupon: null
    });

    assert.equal(pricing.unitBase, 100);
    assert.equal(pricing.unitExpress, 25);
    assert.equal(pricing.unitDiscount, 0);
    assert.equal(pricing.unitEffectivePrice, 125);
    assert.equal(pricing.totalBase, 100);
    assert.equal(pricing.totalExpress, 25);
    assert.equal(pricing.total, 125);
    assert.equal(pricing.subtotal, 105.93);
    assert.equal(pricing.igv, 19.07);
    assert.equal(pricing.subtotal + pricing.igv, 125);
});

test('Order with Percentage Coupon AND Express: discount strictly on base, never on express surcharge', () => {
    // Base = 100, Qty = 2.
    // Base total = 200. Express total (+25%) = 50.
    // Coupon = 10% (should be 10% of 200 = 20, NOT 10% of 250 = 25).
    // Total = (100 - 10 + 25) * 2 = 115 * 2 = 230.
    const pricing = calculateOrderPricing({
        basePrice: 100,
        quantity: 2,
        isExpress: true,
        coupon: { tipo: 'porcentaje', valor: 10 }
    });

    assert.equal(pricing.unitBase, 100);
    assert.equal(pricing.unitExpress, 25);
    assert.equal(pricing.unitDiscount, 10); // 10% of 100 base
    assert.equal(pricing.unitEffectivePrice, 115); // 100 - 10 + 25
    assert.equal(pricing.totalBase, 200);
    assert.equal(pricing.totalExpress, 50);
    assert.equal(pricing.totalDiscount, 20); // 10% of 200, strictly on base
    assert.equal(pricing.total, 230);
    assert.equal(pricing.subtotal, 194.92);
    assert.equal(pricing.igv, 35.08);
    assert.equal(pricing.subtotal + pricing.igv, 230);
});

test('Order with Fixed Amount Coupon AND Express', () => {
    // Base = 100, Qty = 2.
    // Total base = 200. Express = 50.
    // Coupon = S/. 30.
    // Total = 200 - 30 + 50 = 220.
    const pricing = calculateOrderPricing({
        basePrice: 100,
        quantity: 2,
        isExpress: true,
        coupon: { tipo: 'monto_fijo', valor: 30 }
    });

    assert.equal(pricing.totalBase, 200);
    assert.equal(pricing.totalExpress, 50);
    assert.equal(pricing.totalDiscount, 30);
    assert.equal(pricing.total, 220);
    assert.equal(pricing.subtotal, 186.44);
    assert.equal(pricing.igv, 33.56);
    assert.equal(pricing.subtotal + pricing.igv, 220);
});

test('Order with Percentage Coupon respecting tope_descuento_maximo', () => {
    // Base = 500, Qty = 1.
    // Coupon = 50% (250 soles), but tope is 100 soles.
    // Total = 500 - 100 = 400.
    const pricing = calculateOrderPricing({
        basePrice: 500,
        quantity: 1,
        isExpress: false,
        coupon: { tipo: 'porcentaje', valor: 50, tope_descuento_maximo: 100 }
    });

    assert.equal(pricing.totalBase, 500);
    assert.equal(pricing.totalDiscount, 100);
    assert.equal(pricing.total, 400);
    assert.equal(pricing.subtotal, 338.98);
    assert.equal(pricing.igv, 61.02);
    assert.equal(pricing.subtotal + pricing.igv, 400);
});
