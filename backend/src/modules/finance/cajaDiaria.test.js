import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFinanceService } from './application/services/financeService.js';

test('Caja Diaria: getActiveCashSession calcula resumen en vivo para la sesión abierta', async () => {
    const mockRepo = {
        getActiveCashSession: async () => ({
            hasActiveSession: true,
            session: { id: 1, fecha: '2026-09-01', turno: 'general', monto_apertura: 100, estado: 'abierta' },
            targetDate: '2026-09-01',
            resumenEnVivo: {
                monto_apertura: 100,
                total_ingresos_efectivo: 350,
                total_egresos_efectivo: 50,
                saldo_teorico_efectivo: 400,
                total_ingresos_banco: 1200,
                total_egresos_banco: 200,
                balance_neto_banco: 1000,
                balance_neto_dia: 1350
            }
        })
    };

    const service = makeFinanceService({ financeRepository: mockRepo });
    const res = await service.getActiveCashSession({ user: { id: 1, tipo: 'operador' } });

    assert.equal(res.ok, true);
    assert.equal(res.data.hasActiveSession, true);
    assert.equal(res.data.resumenEnVivo.saldo_teorico_efectivo, 400);
});

test('Caja Diaria: closeCashSession valida monto real en efectivo', async () => {
    const mockRepo = {};
    const service = makeFinanceService({ financeRepository: mockRepo });

    const resInvalid = await service.closeCashSession({
        user: { id: 1, tipo: 'operador' },
        sesionId: 1,
        body: { monto_real_efectivo: 'invalido' }
    });

    assert.equal(resInvalid.ok, false);
    assert.equal(resInvalid.status, 400);
});

test('Caja Diaria: closeCashSession realiza arqueo y registra diferencia', async () => {
    let capturedArgs = null;
    const mockRepo = {
        closeCashSession: async (args) => {
            capturedArgs = args;
            return {
                ok: true,
                status: 200,
                data: {
                    id: args.sesionId,
                    estado: 'cerrada',
                    monto_esperado_efectivo: 400,
                    monto_real_efectivo: args.montoRealEfectivo,
                    diferencia_efectivo: args.montoRealEfectivo - 400,
                    observaciones_cierre: args.observacionesCierre
                }
            };
        }
    };

    const service = makeFinanceService({ financeRepository: mockRepo });
    const res = await service.closeCashSession({
        user: { id: 2, tipo: 'operador' },
        sesionId: 5,
        body: {
            monto_real_efectivo: 395.50,
            observaciones_cierre: 'Faltante de S/. 4.50 por redondeo en caja'
        }
    });

    assert.equal(res.ok, true);
    assert.equal(res.data.estado, 'cerrada');
    assert.equal(res.data.diferencia_efectivo, -4.50);
    assert.equal(capturedArgs.actorUserId, 2);
});

test('Caja Diaria: reopenCashSession solo permite a usuarios con rol admin', async () => {
    const mockRepo = {
        reopenCashSession: async () => ({ ok: true, status: 200 })
    };
    const service = makeFinanceService({ financeRepository: mockRepo });

    // Intento con rol operador (debe rechazar 403)
    const resOperator = await service.reopenCashSession({
        user: { id: 2, tipo: 'operador' },
        sesionId: 5,
        body: { motivo: 'Corrección' }
    });
    assert.equal(resOperator.ok, false);
    assert.equal(resOperator.status, 403);

    // Intento con rol admin (debe permitir)
    const resAdmin = await service.reopenCashSession({
        user: { id: 1, tipo: 'admin' },
        sesionId: 5,
        body: { motivo: 'Reapertura autorizada por auditoría' }
    });
    assert.equal(resAdmin.ok, true);
});
