import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFinanceService } from './application/services/financeService.js';

test('Cobranzas: getCobranzasOverview calcula KPIs globales y desglose por antigüedad', async () => {
    const mockClinicas = [
        {
            clinica_id: 1,
            clinica_nombre: 'Dental Lima Norte',
            pedidos_pendientes_count: '3',
            total_deuda: '1200.00',
            deuda_0_15: '500.00',
            deuda_15_30: '400.00',
            deuda_30_mas: '300.00',
            saldo_favor_disponible: '200.00',
            deuda_neta: '1000.00'
        },
        {
            clinica_id: 2,
            clinica_nombre: 'Clínica San Borja',
            pedidos_pendientes_count: '1',
            total_deuda: '300.00',
            deuda_0_15: '300.00',
            deuda_15_30: '0.00',
            deuda_30_mas: '0.00',
            saldo_favor_disponible: '0.00',
            deuda_neta: '300.00'
        }
    ];

    const mockRepo = {
        getCobranzasOverview: async () => mockClinicas
    };

    const service = makeFinanceService({ financeRepository: mockRepo });
    const res = await service.getCobranzasOverview({ user: { id: 1, tipo: 'operador' } });

    assert.equal(res.ok, true);
    assert.equal(res.data.kpis.total_deuda_calle, 1500);
    assert.equal(res.data.kpis.total_deuda_0_15, 800);
    assert.equal(res.data.kpis.total_deuda_15_30, 400);
    assert.equal(res.data.kpis.total_deuda_30_mas, 300);
    assert.equal(res.data.kpis.total_saldo_favor_custodia, 200);
    assert.equal(res.data.kpis.total_deuda_neta, 1300);
    assert.equal(res.data.kpis.clinicas_con_deuda_count, 2);
    assert.equal(res.data.clinicas.length, 2);
});

test('Cobranzas: getClinicDebtDetail formatea pedidos pendientes y saldos a favor', async () => {
    const mockRepo = {
        getClinicDebtDetail: async ({ clinicaId }) => ({
            pedidos_pendientes: [
                {
                    id: 101,
                    codigo: 'PED-101',
                    paciente_nombre: 'Carlos Perez',
                    doctor_nombre: 'Dra. Ramos',
                    total: '500.00',
                    pagado: '200.00',
                    saldo: '300.00',
                    dias_antiguedad: 12
                }
            ],
            saldos_favor: [
                {
                    id: 45,
                    monto: '150.00',
                    saldo_disponible: '150.00',
                    cuenta_nombre: 'BCP Operaciones'
                }
            ]
        })
    };

    const service = makeFinanceService({ financeRepository: mockRepo });
    const res = await service.getClinicDebtDetail({ user: { id: 1, tipo: 'admin' }, clinicaId: 5 });

    assert.equal(res.ok, true);
    assert.equal(res.data.pedidos_pendientes.length, 1);
    assert.equal(res.data.pedidos_pendientes[0].saldo, 300);
    assert.equal(res.data.saldos_favor.length, 1);
    assert.equal(res.data.saldos_favor[0].saldo_disponible, 150);
});
