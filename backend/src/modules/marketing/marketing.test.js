import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Marketing: Cálculo de descuento porcentual con tope máximo', () => {
    const subtotal = 200;
    const porcentaje = 10; // 10% de 200 = 20
    const topeMaximo = 15; // Debería topar a 15

    let calc = (subtotal * porcentaje) / 100;
    if (topeMaximo && calc > topeMaximo) {
        calc = topeMaximo;
    }
    const finalTotal = subtotal - calc;

    assert.equal(calc, 15);
    assert.equal(finalTotal, 185);
});

test('Marketing: Cálculo de descuento de monto fijo', () => {
    const subtotal = 180;
    const montoFijo = 50;

    const calc = Math.min(montoFijo, subtotal);
    const finalTotal = subtotal - calc;

    assert.equal(calc, 50);
    assert.equal(finalTotal, 130);
});

test('Marketing: Validación de pedido mínimo requerido', () => {
    const montoMinimo = 150;
    const subtotalBajo = 120;
    const subtotalAlto = 180;

    assert.equal(subtotalBajo >= montoMinimo, false);
    assert.equal(subtotalAlto >= montoMinimo, true);
});
