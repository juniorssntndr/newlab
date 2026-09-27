import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCommercialHealth, suggestNextVisitDate, visitCadenceDays } from './commercialHealth.js';

const now = new Date('2026-08-29T12:00:00-05:00');

for (const [days, expected] of [[29,'verde'],[30,'amarillo'],[59,'amarillo'],[60,'rojo']]) {
    test(`commercial health boundary at ${days} days is ${expected}`, () => {
        const orderDate = new Date('2026-08-29T00:00:00Z');
        orderDate.setUTCDate(orderDate.getUTCDate() - days);
        const result = calculateCommercialHealth({ lastOrderDate: orderDate.toISOString().slice(0,10), now });
        assert.equal(result.health, expected);
        assert.equal(result.daysSinceLastOrder, days);
    });
}

test('prospect without orders has no retention health', () => {
    assert.deepEqual(calculateCommercialHealth({ lastOrderDate: null, now }), {
        health: null, visiblePriority: null, daysSinceLastOrder: null, reason: 'sin pedidos'
    });
});

test('open complaint raises visible priority but preserves base health', () => {
    const result = calculateCommercialHealth({ lastOrderDate: '2026-08-20', openComplaint: true, now });
    assert.equal(result.health, 'verde');
    assert.equal(result.visiblePriority, 'rojo');
    assert.equal(result.reason, 'reclamo abierto');
});

test('visit cadence follows red/yellow/green and complaint rules', () => {
    assert.equal(visitCadenceDays({ health: 'rojo' }), 7);
    assert.equal(visitCadenceDays({ health: 'amarillo' }), 15);
    assert.equal(visitCadenceDays({ health: 'verde' }), 45);
    assert.equal(visitCadenceDays({ health: 'verde', openComplaint: true }), 7);
    assert.equal(suggestNextVisitDate({ health: 'amarillo', from: new Date('2026-08-29T12:00:00-05:00') }), '2026-09-13');
});
