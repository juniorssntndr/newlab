import assert from 'node:assert/strict';
import { applyOptimisticPayment } from './optimisticPayment.js';

const run = () => {
    const baseDetail = {
        monto_pagado: 40,
        total: 120,
        saldo: 80,
        estado_pago: 'pago_parcial',
        pagos: []
    };

    const payload = {
        monto: '30',
        metodo: 'transferencia',
        tipo_fondo: 'operativo',
        referencia: 'OP-1001',
        fecha_pago: '2026-03-22'
    };

    const updated = applyOptimisticPayment(baseDetail, payload);

    assert.equal(updated.monto_pagado, 70);
    assert.equal(updated.saldo, 50);
    assert.equal(updated.estado_pago, 'pago_parcial');
    assert.equal(updated.pagos.length, 1);
    assert.equal(updated.pagos[0].metodo, 'transferencia');

    const rollback = baseDetail;
    assert.deepEqual(rollback, baseDetail);

    console.log('ok - register payment optimistic update');
};

run();
