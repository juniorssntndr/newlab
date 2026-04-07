const GASTOS_OPERATIVOS = ['alquiler', 'servicios', 'sueldos', 'marketing', 'mantenimiento'];
const COSTOS_DIRECTOS = ['insumos', 'materiales', 'laboratorio', 'logistica'];

const normalizePago = (pago) => ({
    ...pago,
    monto: parseFloat(pago.monto || 0),
    conciliado: !!pago.conciliado
});

const normalizeMovimiento = (movimiento) => ({
    ...movimiento,
    monto: parseFloat(movimiento.monto || 0)
});

const metodoToTipoFondo = (metodo = '') => {
    const normalized = String(metodo || '').trim().toLowerCase();
    if (normalized === 'efectivo') return 'caja';
    return 'banco';
};

const forbiddenForClient = (user) => user?.tipo === 'cliente';

export const makeFinanceService = ({ financeRepository }) => ({
    listFinanceOrders: async ({ user, filters }) => {
        const rows = await financeRepository.listFinanceOrders({ user, filters });

        return rows.map((row) => ({
            ...row,
            monto_pagado: parseFloat(row.monto_pagado || 0),
            monto_pagado_caja: parseFloat(row.monto_pagado_caja || 0),
            monto_pagado_banco: parseFloat(row.monto_pagado_banco || 0),
            saldo: parseFloat(row.saldo || 0)
        }));
    },
    getCatalogos: async () => {
        const cuentas = await financeRepository.listActiveAccounts();

        return {
            cuentas: cuentas.map((row) => ({
                ...row,
                saldo_inicial: parseFloat(row.saldo_inicial || 0)
            })),
            categorias_gasto: {
                operativo: GASTOS_OPERATIVOS,
                costo_directo: COSTOS_DIRECTOS,
                otro: []
            }
        };
    },
    listMovimientos: async ({ user, filters }) => {
        const rows = await financeRepository.listMovements({ user, filters });
        return rows.map(normalizeMovimiento);
    },
    createMovimiento: async ({ user, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const montoNumber = parseFloat(body?.monto);
        if (Number.isNaN(montoNumber) || montoNumber <= 0) {
            return { ok: false, status: 400, error: 'Monto invalido' };
        }

        const tipoFondo = body?.tipo_fondo || 'banco';
        const cuentaResolution = await financeRepository.resolveCuentaFinanciera({
            cuentaId: body?.cuenta_id || null,
            tipoFondo
        });
        if (cuentaResolution.error) {
            return { ok: false, status: 400, error: cuentaResolution.error };
        }

        const movement = await financeRepository.createMovement({
            actorUserId: user.id,
            movementInput: {
                ...body,
                monto: montoNumber,
                tipo_fondo: tipoFondo,
                cuenta_id: cuentaResolution.cuentaId
            }
        });

        return {
            ok: true,
            status: 201,
            data: normalizeMovimiento(movement),
            meta: {
                tipo: body?.tipo,
                monto: montoNumber,
                categoria_gasto: body?.categoria_gasto || null,
                grupo_gasto: body?.grupo_gasto || null,
                cuenta_id: cuentaResolution.cuentaId,
                tipo_fondo: tipoFondo
            }
        };
    },
    getOrderFinanceDetail: async ({ user, orderId }) => {
        const pedido = await financeRepository.getOrderByIdWithClinic({ orderId });
        if (!pedido) {
            return { ok: false, status: 404, error: 'Pedido no encontrado' };
        }

        if (forbiddenForClient(user) && Number(user.clinica_id) !== Number(pedido.clinica_id)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const [pagosRows, items] = await Promise.all([
            financeRepository.listPaymentsByOrderId({ orderId }),
            financeRepository.listOrderItems({ orderId })
        ]);

        const pagos = pagosRows.map(normalizePago);
        const montoPagado = pagos.reduce((sum, pago) => sum + (Number.isNaN(pago.monto) ? 0 : pago.monto), 0);
        const montoPagadoCaja = pagos
            .filter((pago) => pago.tipo_fondo === 'caja')
            .reduce((sum, pago) => sum + (Number.isNaN(pago.monto) ? 0 : pago.monto), 0);
        const montoPagadoBancos = pagos
            .filter((pago) => pago.tipo_fondo === 'banco')
            .reduce((sum, pago) => sum + (Number.isNaN(pago.monto) ? 0 : pago.monto), 0);
        const total = parseFloat(pedido.total || 0);
        const saldo = total - montoPagado;
        const estadoPago = montoPagado >= total ? 'cancelado' : montoPagado > 0 ? 'pago_parcial' : 'por_cancelar';
        const pagosPendientesConciliacion = pagos.filter((pago) => !pago.conciliado).length;

        return {
            ok: true,
            status: 200,
            data: {
                ...pedido,
                items,
                pagos,
                monto_pagado: montoPagado,
                monto_pagado_caja: montoPagadoCaja,
                monto_pagado_bancos: montoPagadoBancos,
                saldo,
                estado_pago: estadoPago,
                pagos_pendientes_conciliacion: pagosPendientesConciliacion
            }
        };
    },
    registerPago: async ({ user, orderId, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const montoNumber = parseFloat(body?.monto);
        if (!body?.monto || Number.isNaN(montoNumber) || montoNumber <= 0) {
            return { ok: false, status: 400, error: 'Monto válido es requerido' };
        }

        const metodoPago = body?.metodo || 'transferencia';
        const tipoFondo = body?.tipo_fondo || metodoToTipoFondo(metodoPago);
        const registerResult = await financeRepository.registerPayment({
            orderId,
            actorUserId: user.id,
            paymentInput: {
                ...body,
                monto: montoNumber,
                metodo: metodoPago,
                tipo_fondo: tipoFondo
            }
        });

        if (registerResult.notFound) {
            return { ok: false, status: 404, error: 'Pedido no encontrado' };
        }

        if (registerResult.exceedsBalance) {
            return {
                ok: false,
                status: 400,
                error: 'El pago excede el saldo pendiente',
                details: registerResult.details
            };
        }

        if (registerResult.accountError) {
            return { ok: false, status: 400, error: registerResult.accountError };
        }

        return {
            ok: true,
            status: 201,
            data: normalizePago(registerResult.payment),
            meta: {
                pedido_id: Number(orderId),
                pedido_codigo: registerResult.pedido.codigo,
                monto: montoNumber,
                metodo: metodoPago,
                tipo_fondo: tipoFondo,
                cuenta_id: registerResult.cuentaId
            }
        };
    },
    getEstadoCuentaByClinica: async ({ user, clinicaId }) => {
        if (forbiddenForClient(user) && Number(user.clinica_id) !== Number(clinicaId)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const clinica = await financeRepository.getClinicById({ clinicaId });
        if (!clinica) {
            return { ok: false, status: 404, error: 'Clínica no encontrada' };
        }

        const pendingRows = await financeRepository.listPendingOrdersByClinic({ clinicaId });
        const pedidosPendientes = pendingRows.map((row) => ({
            ...row,
            total: parseFloat(row.total || 0),
            monto_pagado: parseFloat(row.monto_pagado || 0),
            saldo: parseFloat(row.saldo || 0)
        }));

        const saldoTotalPendiente = pedidosPendientes.reduce((sum, pedido) => sum + pedido.saldo, 0);

        return {
            ok: true,
            status: 200,
            data: {
                clinica_id: clinica.id,
                clinica_nombre: clinica.nombre,
                clinica_ruc: clinica.ruc,
                saldo_total_pendiente: saldoTotalPendiente,
                pedidos_pendientes: pedidosPendientes
            }
        };
    },
    registerPagosMasivos: async ({ user, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const clinicaId = body?.clinica_id;
        const montoTotalNumber = parseFloat(body?.monto_total);
        if (!clinicaId || Number.isNaN(montoTotalNumber) || montoTotalNumber <= 0) {
            return {
                ok: false,
                status: 400,
                error: 'Datos inválidos. Se requiere clinica_id y un monto_total mayor a 0.'
            };
        }

        const registerResult = await financeRepository.registerBulkPayments({
            actorUserId: user.id,
            bulkInput: {
                ...body,
                monto_total: montoTotalNumber
            }
        });

        if (registerResult.accountError) {
            return { ok: false, status: 400, error: registerResult.accountError };
        }

        return {
            ok: true,
            status: 201,
            data: {
                message: 'Pago masivo procesado exitosamente',
                monto_total_ingresado: montoTotalNumber,
                monto_total_distribuido: montoTotalNumber - registerResult.remainingMonto,
                monto_sobrante: registerResult.remainingMonto,
                pagos_registrados: registerResult.pagosRegistrados.map((item) => ({
                    pedido_codigo: item.pedido_codigo,
                    monto_abonado: item.monto_abonado,
                    pago: normalizePago(item.pago)
                }))
            },
            meta: {
                clinica_id: clinicaId,
                monto_total: montoTotalNumber,
                pedidos_afectados: registerResult.pagosRegistrados.length
            }
        };
    },
    conciliarPago: async ({ user, pagoId }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const pago = await financeRepository.getPaymentWithOrderCodeById({ pagoId });
        if (!pago) {
            return { ok: false, status: 404, error: 'Pago no encontrado' };
        }

        if (pago.conciliado) {
            return { ok: true, status: 200, data: normalizePago(pago), alreadyConciliated: true };
        }

        const conciliated = await financeRepository.conciliatePayment({
            pagoId,
            actorUserId: user.id
        });

        return {
            ok: true,
            status: 200,
            data: normalizePago(conciliated),
            meta: {
                pedido_id: pago.pedido_id,
                pedido_codigo: pago.pedido_codigo || '',
                monto: parseFloat(pago.monto || 0)
            }
        };
    }
});
