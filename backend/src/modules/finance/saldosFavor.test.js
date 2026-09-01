import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFinanceService } from './application/services/financeService.js';

test('Saldos a Favor: Rechaza registro si el monto es inválido o menor a 0', async () => {
    let repoCalled = false;
    const mockRepo = {
        registerSaldoFavor: async () => {
            repoCalled = true;
            return { ok: true };
        }
    };

    const service = makeFinanceService({ financeRepository: mockRepo });

    const resultZero = await service.registerSaldoFavor({
        user: { id: 1, tipo: 'admin' },
        clinicaId: 5,
        body: { monto: 0 }
    });
    assert.equal(resultZero.ok, false);
    assert.equal(resultZero.status, 400);

    const resultNegative = await service.registerSaldoFavor({
        user: { id: 1, tipo: 'admin' },
        clinicaId: 5,
        body: { monto: -50 }
    });
    assert.equal(resultNegative.ok, false);
    assert.equal(resultNegative.status, 400);
    assert.equal(repoCalled, false);
});

test('Saldos a Favor: Registra cobro a cuenta de clínica correctamente', async () => {
    const mockRepo = {
        registerSaldoFavor: async ({ clinicaId, actorUserId, paymentInput }) => ({
            ok: true,
            data: {
                id: 101,
                pedido_id: null,
                clinica_id: clinicaId,
                monto: paymentInput.monto,
                es_saldo_favor: true,
                saldo_disponible: paymentInput.monto,
                creado_por: actorUserId
            }
        })
    };

    const service = makeFinanceService({ financeRepository: mockRepo });
    const result = await service.registerSaldoFavor({
        user: { id: 1, tipo: 'admin' },
        clinicaId: 10,
        body: {
            monto: 500,
            tipo_fondo: 'banco',
            referencia: 'Transferencia anticipada BCP'
        }
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 201);
    assert.equal(result.data.monto, 500);
    assert.equal(result.meta.clinica_id, 10);
});

test('Saldos a Favor: Rechaza aplicación si falta origen o destino o monto', async () => {
    const mockRepo = {};
    const service = makeFinanceService({ financeRepository: mockRepo });

    const resultIncomplete = await service.aplicarSaldoFavor({
        user: { id: 1, tipo: 'admin' },
        body: { pago_origen_id: 10, monto_aplicado: 100 }
    });

    assert.equal(resultIncomplete.ok, false);
    assert.equal(resultIncomplete.status, 400);
});

test('Saldos a Favor: Delegación de aplicación exitosa al repositorio transaccional', async () => {
    let capturedArgs = null;
    const mockRepo = {
        aplicarSaldoFavor: async (args) => {
            capturedArgs = args;
            return {
                ok: true,
                status: 201,
                data: {
                    aplicacion: { id: 1, monto_aplicado: 200 },
                    pago_pedido: { id: 205, monto: 200 },
                    saldo_restante_origen: 300,
                    saldo_restante_pedido: 0
                }
            };
        }
    };

    const service = makeFinanceService({ financeRepository: mockRepo });
    const result = await service.aplicarSaldoFavor({
        user: { id: 2, tipo: 'operador' },
        body: {
            pago_origen_id: 101,
            pedido_destino_id: 50,
            monto_aplicado: 200,
            notas: 'Aplicado a pedido #1050'
        }
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 201);
    assert.equal(capturedArgs.pagoOrigenId, 101);
    assert.equal(capturedArgs.pedidoDestinoId, 50);
    assert.equal(capturedArgs.montoAplicado, 200);
    assert.equal(capturedArgs.actorUserId, 2);
});
