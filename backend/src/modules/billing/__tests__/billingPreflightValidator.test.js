import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateAndReconcileApisperuPayload,
    validateAndReconcileDraft,
    BillingPreflightValidationError
} from '../domain/billingPreflightValidator.js';

test('BillingPreflightValidator: passes already balanced payload', () => {
    const payload = {
        mtoOperGravadas: 100.00,
        mtoIGV: 18.00,
        mtoImpVenta: 118.00,
        details: [
            {
                cantidad: 1,
                mtoValorUnitario: 100.00,
                mtoValorVenta: 100.00,
                igv: 18.00
            }
        ]
    };

    const validated = validateAndReconcileApisperuPayload(payload);
    assert.equal(validated.mtoOperGravadas, 100.00);
    assert.equal(validated.mtoIGV, 18.00);
    assert.equal(validated.mtoImpVenta, 118.00);
    assert.equal(validated.details[0].mtoValorVenta, 100.00);
    assert.equal(validated.details[0].igv, 18.00);
});

test('BillingPreflightValidator: reconciles header drift and single line to exact centavo', () => {
    const payload = {
        mtoOperGravadas: 84.74, // 0.01 float drift from 84.75
        mtoIGV: 15.25,
        mtoImpVenta: 100.00,
        details: [
            {
                cantidad: 1,
                mtoValorUnitario: 84.74,
                mtoValorVenta: 84.74,
                igv: 15.25
            }
        ]
    };

    const validated = validateAndReconcileApisperuPayload(payload);
    assert.equal(validated.mtoOperGravadas, 84.75);
    assert.equal(validated.mtoIGV, 15.25);
    assert.equal(validated.mtoImpVenta, 100.00);
    assert.equal(validated.mtoOperGravadas + validated.mtoIGV, 100.00);
    assert.equal(validated.details[0].mtoValorVenta, 84.75);
    assert.equal(validated.details[0].igv, 15.25);
    assert.equal(validated.details[0].mtoBaseIgv, 84.75);
    assert.equal(validated.details[0].totalImpuestos, 15.25);
});

test('BillingPreflightValidator: reconciles 0.01 rounding drift in multi-line invoice on the last line', () => {
    // 3 lines for total 100.00:
    // canonical gravada = 84.75, igv = 15.25
    // Suppose lines were calculated independently:
    // line 1: 28.25, igv: 5.09
    // line 2: 28.25, igv: 5.09
    // line 3: 28.24 (sum = 84.74, diff = +0.01), igv: 5.09 (sum = 15.27, diff = -0.02)
    const payload = {
        mtoOperGravadas: 84.75,
        mtoIGV: 15.25,
        mtoImpVenta: 100.00,
        details: [
            { cantidad: 1, mtoValorUnitario: 28.25, mtoValorVenta: 28.25, igv: 5.09 },
            { cantidad: 1, mtoValorUnitario: 28.25, mtoValorVenta: 28.25, igv: 5.09 },
            { cantidad: 1, mtoValorUnitario: 28.24, mtoValorVenta: 28.24, igv: 5.09 }
        ]
    };

    const validated = validateAndReconcileApisperuPayload(payload);
    assert.equal(validated.mtoOperGravadas, 84.75);
    assert.equal(validated.mtoIGV, 15.25);
    assert.equal(validated.mtoImpVenta, 100.00);

    const sumLinesGravada = validated.details.reduce((sum, d) => sum + d.mtoValorVenta, 0);
    const sumLinesIgv = validated.details.reduce((sum, d) => sum + d.igv, 0);

    assert.equal(Math.round(sumLinesGravada * 100) / 100, 84.75);
    assert.equal(Math.round(sumLinesIgv * 100) / 100, 15.25);
    assert.equal(validated.details[2].mtoValorVenta, 28.25); // adjusted from 28.24 to 28.25
    assert.equal(validated.details[2].igv, 5.07); // adjusted from 5.09 to 5.07
});

test('BillingPreflightValidator: throws on zero or negative total', () => {
    assert.throws(() => {
        validateAndReconcileApisperuPayload({ mtoImpVenta: 0 });
    }, BillingPreflightValidationError);
});

test('validateAndReconcileDraft: enforces subtotal + igv === total', () => {
    const draft = {
        orderId: '123',
        total: { amount: 100, currency: 'PEN' },
        subtotal: { amount: 80, currency: 'PEN' }, // drift
        igv: { amount: 20, currency: 'PEN' }
    };

    const reconciled = validateAndReconcileDraft(draft);
    assert.equal(reconciled.total.amount, 100.00);
    assert.equal(reconciled.subtotal.amount, 84.75);
    assert.equal(reconciled.igv.amount, 15.25);
    assert.equal(reconciled.subtotal.amount + reconciled.igv.amount, 100.00);
});
