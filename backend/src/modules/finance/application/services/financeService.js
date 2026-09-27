const COSTOS_DIRECTOS = ['materiales'];
const GASTOS_OPERATIVOS = [
    'logistica',
    'servicios',
    'alquiler',
    'sueldos',
    'mantenimiento',
    'gastos_generales',
    'marketing',
    'otros'
];

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
                costo_directo: COSTOS_DIRECTOS,
                operativo: GASTOS_OPERATIVOS,
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
    updateMovimiento: async ({ user, movementId, body }) => {
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

        const movement = await financeRepository.updateMovement({
            movementId,
            movementInput: {
                ...body,
                monto: montoNumber,
                tipo_fondo: tipoFondo,
                cuenta_id: cuentaResolution.cuentaId
            }
        });

        if (!movement) {
            return { ok: false, status: 404, error: 'Movimiento no encontrado' };
        }

        return {
            ok: true,
            status: 200,
            data: normalizeMovimiento(movement),
            meta: {
                movimiento_id: Number(movementId),
                tipo: body?.tipo,
                monto: montoNumber,
                categoria_gasto: body?.categoria_gasto || null,
                grupo_gasto: body?.grupo_gasto || null,
                cuenta_id: cuentaResolution.cuentaId,
                tipo_fondo: tipoFondo
            }
        };
    },
    deleteMovimiento: async ({ user, movementId }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const movement = await financeRepository.deleteMovement({ movementId });
        if (!movement) {
            return { ok: false, status: 404, error: 'Movimiento no encontrado' };
        }

        return {
            ok: true,
            status: 200,
            data: normalizeMovimiento(movement),
            meta: {
                movimiento_id: Number(movementId),
                tipo: movement.tipo,
                monto: parseFloat(movement.monto || 0),
                categoria_gasto: movement.categoria_gasto || null,
                grupo_gasto: movement.grupo_gasto || null,
                tipo_fondo: movement.tipo_fondo || null
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
    registerConsolidatedPayment: async ({ user, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const totalCobrado = parseFloat(body?.totalCobrado || 0);
        const orderPayments = Array.isArray(body?.orderPayments) ? body.orderPayments : [];

        if (totalCobrado <= 0 && orderPayments.length === 0) {
            return {
                ok: false,
                status: 400,
                error: 'Debe especificar al menos un pedido o un monto válido a cobrar.'
            };
        }

        const result = await financeRepository.registerConsolidatedPayment({
            actorUserId: user.id,
            consolidatedInput: {
                ...body,
                totalCobrado
            }
        });

        if (result.accountError) {
            return { ok: false, status: 400, error: result.accountError };
        }

        return {
            ok: true,
            status: 201,
            data: {
                message: 'Cobro consolidado registrado exitosamente',
                movimiento: result.movimiento,
                pagos: result.pagos
            },
            meta: {
                movimiento_id: result.movimiento?.id,
                total_cobrado: totalCobrado,
                pedidos_afectados: result.pagos?.length || 0
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
    },
    registerSaldoFavor: async ({ user, clinicaId, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const montoNumber = parseFloat(body?.monto);
        if (Number.isNaN(montoNumber) || montoNumber <= 0) {
            return { ok: false, status: 400, error: 'El monto debe ser un valor numérico mayor a 0' };
        }

        const result = await financeRepository.registerSaldoFavor({
            clinicaId: Number(clinicaId),
            actorUserId: user.id,
            paymentInput: {
                ...body,
                monto: montoNumber
            }
        });

        if (result.accountError) {
            return { ok: false, status: 400, error: result.accountError };
        }

        return {
            ok: true,
            status: 201,
            data: normalizePago(result.data),
            meta: {
                clinica_id: Number(clinicaId),
                monto: montoNumber
            }
        };
    },
    listSaldosFavorByClinica: async ({ user, clinicaId }) => {
        const clinicaIdNumber = Number(clinicaId);
        if (user?.tipo === 'cliente' && Number(user.clinica_id) !== clinicaIdNumber) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const rows = await financeRepository.listSaldosFavorByClinica({ clinicaId: clinicaIdNumber });
        return {
            ok: true,
            status: 200,
            data: rows.map((r) => ({
                ...normalizePago(r),
                saldo_disponible: parseFloat(r.saldo_disponible || 0)
            }))
        };
    },
    aplicarSaldoFavor: async ({ user, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const { pago_origen_id, pedido_destino_id, monto_aplicado, notas } = body;
        const montoNumber = parseFloat(monto_aplicado);
        if (!pago_origen_id || !pedido_destino_id || Number.isNaN(montoNumber) || montoNumber <= 0) {
            return { ok: false, status: 400, error: 'Datos de aplicación incompletos o monto inválido' };
        }

        return financeRepository.aplicarSaldoFavor({
            pagoOrigenId: Number(pago_origen_id),
            pedidoDestinoId: Number(pedido_destino_id),
            montoAplicado: montoNumber,
            notas,
            actorUserId: user.id
        });
    },
    listAplicacionesSaldoFavor: async ({ user, clinicaId }) => {
        const clinicaIdNumber = Number(clinicaId);
        if (user?.tipo === 'cliente' && Number(user.clinica_id) !== clinicaIdNumber) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const rows = await financeRepository.listAplicacionesSaldoFavor({ clinicaId: clinicaIdNumber });
        return {
            ok: true,
            status: 200,
            data: rows.map((r) => ({
                ...r,
                monto_aplicado: parseFloat(r.monto_aplicado || 0)
            }))
        };
    },
    getActiveCashSession: async ({ user }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const data = await financeRepository.getActiveCashSession();
        return {
            ok: true,
            status: 200,
            data
        };
    },
    openCashSession: async ({ user, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const montoApertura = parseFloat(body?.monto_apertura || 0);
        return financeRepository.openCashSession({
            montoApertura: Number.isNaN(montoApertura) ? 0 : montoApertura,
            turno: body?.turno || 'general',
            fecha: body?.fecha || null,
            actorUserId: user.id
        });
    },
    closeCashSession: async ({ user, sesionId, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const montoRealEfectivo = parseFloat(body?.monto_real_efectivo);
        if (Number.isNaN(montoRealEfectivo) || montoRealEfectivo < 0) {
            return { ok: false, status: 400, error: 'El monto real en efectivo es obligatorio para el arqueo' };
        }

        return financeRepository.closeCashSession({
            sesionId: Number(sesionId),
            montoRealEfectivo,
            observacionesCierre: body?.observaciones_cierre || null,
            actorUserId: user.id
        });
    },
    reopenCashSession: async ({ user, sesionId, body }) => {
        if (user?.tipo !== 'admin') {
            return { ok: false, status: 403, error: 'Solo los administradores pueden reabrir una caja cerrada' };
        }

        return financeRepository.reopenCashSession({
            sesionId: Number(sesionId),
            motivo: body?.motivo || null,
            actorUserId: user.id
        });
    },
    listCashSessions: async ({ user, query }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const limit = parseInt(query?.limit || '30', 10);
        const offset = parseInt(query?.offset || '0', 10);
        const rows = await financeRepository.listCashSessions({ limit, offset });

        return {
            ok: true,
            status: 200,
            data: rows.map((r) => ({
                ...r,
                monto_apertura: parseFloat(r.monto_apertura || 0),
                monto_esperado_efectivo: parseFloat(r.monto_esperado_efectivo || 0),
                monto_real_efectivo: r.monto_real_efectivo !== null ? parseFloat(r.monto_real_efectivo) : null,
                diferencia_efectivo: r.diferencia_efectivo !== null ? parseFloat(r.diferencia_efectivo) : null,
                total_ingresos_efectivo: parseFloat(r.total_ingresos_efectivo || 0),
                total_egresos_efectivo: parseFloat(r.total_egresos_efectivo || 0),
                total_ingresos_banco: parseFloat(r.total_ingresos_banco || 0),
                total_egresos_banco: parseFloat(r.total_egresos_banco || 0)
            }))
        };
    },
    getCobranzasOverview: async ({ user }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const rows = await financeRepository.getCobranzasOverview();

        // Calculate summary KPIs across all clinics
        let totalDeudaCalle = 0;
        let totalDeuda015 = 0;
        let totalDeuda1530 = 0;
        let totalDeuda30Mas = 0;
        let totalSaldoFavorCustodia = 0;
        let totalDeudaNeta = 0;

        const clinicas = rows.map((r) => {
            const totalDeuda = parseFloat(r.total_deuda || 0);
            const d015 = parseFloat(r.deuda_0_15 || 0);
            const d1530 = parseFloat(r.deuda_15_30 || 0);
            const d30mas = parseFloat(r.deuda_30_mas || 0);
            const sf = parseFloat(r.saldo_favor_disponible || 0);
            const dn = parseFloat(r.deuda_neta || 0);

            totalDeudaCalle += totalDeuda;
            totalDeuda015 += d015;
            totalDeuda1530 += d1530;
            totalDeuda30Mas += d30mas;
            totalSaldoFavorCustodia += sf;
            totalDeudaNeta += dn;

            return {
                ...r,
                pedidos_pendientes_count: parseInt(r.pedidos_pendientes_count || '0', 10),
                total_deuda: totalDeuda,
                deuda_0_15: d015,
                deuda_15_30: d1530,
                deuda_30_mas: d30mas,
                saldo_favor_disponible: sf,
                deuda_neta: dn
            };
        });

        return {
            ok: true,
            status: 200,
            data: {
                kpis: {
                    total_deuda_calle: totalDeudaCalle,
                    total_deuda_0_15: totalDeuda015,
                    total_deuda_15_30: totalDeuda1530,
                    total_deuda_30_mas: totalDeuda30Mas,
                    total_saldo_favor_custodia: totalSaldoFavorCustodia,
                    total_deuda_neta: totalDeudaNeta,
                    clinicas_con_deuda_count: clinicas.filter((c) => c.deuda_neta > 0).length
                },
                clinicas
            }
        };
    },
    getClinicDebtDetail: async ({ user, clinicaId }) => {
        const clinicaIdNumber = Number(clinicaId);
        if (user?.tipo === 'cliente' && Number(user.clinica_id) !== clinicaIdNumber) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }

        const data = await financeRepository.getClinicDebtDetail({ clinicaId: clinicaIdNumber });

        return {
            ok: true,
            status: 200,
            data: {
                pedidos_pendientes: data.pedidos_pendientes.map((p) => ({
                    ...p,
                    total: parseFloat(p.total || 0),
                    pagado: parseFloat(p.pagado || 0),
                    saldo: parseFloat(p.saldo || 0),
                    dias_antiguedad: parseInt(p.dias_antiguedad || '0', 10)
                })),
                saldos_favor: data.saldos_favor.map((s) => ({
                    ...s,
                    monto: parseFloat(s.monto || 0),
                    saldo_disponible: parseFloat(s.saldo_disponible || 0)
                }))
            }
        };
    },
    listAccountsWithBalance: async ({ user }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const accounts = await financeRepository.listAccountsWithBalance();
        return { ok: true, status: 200, data: accounts };
    },
    createAccount: async ({ user, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const nombre = body?.nombre?.trim();
        if (!nombre) {
            return { ok: false, status: 400, error: 'El nombre de la cuenta es obligatorio' };
        }
        const account = await financeRepository.createAccount({
            nombre,
            tipo_cuenta: body?.tipo_cuenta || 'banco',
            banco: body?.banco?.trim() || null,
            numero_cuenta: body?.numero_cuenta?.trim() || null,
            cci: body?.cci?.trim() || null,
            moneda: body?.moneda || 'PEN',
            saldo_inicial: parseFloat(body?.saldo_inicial || 0),
            color: body?.color || '#0284c7',
            descripcion: body?.descripcion?.trim() || null
        });
        return { ok: true, status: 201, data: account };
    },
    updateAccount: async ({ user, accountId, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const id = Number(accountId);
        if (!id) {
            return { ok: false, status: 400, error: 'ID de cuenta inválido' };
        }
        const account = await financeRepository.updateAccount({
            id,
            nombre: body?.nombre?.trim(),
            tipo_cuenta: body?.tipo_cuenta,
            banco: body?.banco?.trim(),
            numero_cuenta: body?.numero_cuenta?.trim(),
            cci: body?.cci?.trim(),
            moneda: body?.moneda,
            color: body?.color,
            descripcion: body?.descripcion?.trim(),
            activo: body?.activo
        });
        if (!account) {
            return { ok: false, status: 404, error: 'Cuenta no encontrada' };
        }
        return { ok: true, status: 200, data: account };
    },
    registerTransfer: async ({ user, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const origenId = Number(body?.cuenta_origen_id);
        const destinoId = Number(body?.cuenta_destino_id);
        const monto = parseFloat(body?.monto || 0);

        if (!origenId || !destinoId || origenId === destinoId) {
            return { ok: false, status: 400, error: 'Las cuentas de origen y destino deben ser distintas y válidas' };
        }
        if (Number.isNaN(monto) || monto <= 0) {
            return { ok: false, status: 400, error: 'El monto a transferir debe ser mayor a 0' };
        }

        const transfer = await financeRepository.registerTransfer({
            actorUserId: user.id,
            cuenta_origen_id: origenId,
            cuenta_destino_id: destinoId,
            monto,
            fecha: body?.fecha || null,
            referencia: body?.referencia?.trim() || null,
            motivo: body?.motivo?.trim() || 'Transferencia entre cuentas'
        });

        return {
            ok: true,
            status: 201,
            data: {
                message: 'Transferencia realizada con éxito',
                transfer
            }
        };
    },
    listTransfers: async ({ user, query = {} }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const transfers = await financeRepository.listTransfers({ limit: query.limit });
        return { ok: true, status: 200, data: transfers };
    },
    listSocios: async ({ user }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const socios = await financeRepository.listSocios();
        return { ok: true, status: 200, data: socios };
    },
    createSocio: async ({ user, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const nombre = body?.nombre?.trim();
        if (!nombre) {
            return { ok: false, status: 400, error: 'El nombre del socio es obligatorio' };
        }
        const socio = await financeRepository.createSocio({
            nombre,
            documento_tipo: body?.documento_tipo || 'DNI',
            documento_numero: body?.documento_numero?.trim() || null,
            porcentaje_participacion: parseFloat(body?.porcentaje_participacion || 0),
            telefono: body?.telefono?.trim() || null,
            email: body?.email?.trim() || null
        });
        return { ok: true, status: 201, data: socio };
    },
    updateSocio: async ({ user, socioId, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const id = Number(socioId);
        if (!id) {
            return { ok: false, status: 400, error: 'ID de socio inválido' };
        }
        const socio = await financeRepository.updateSocio({
            id,
            nombre: body?.nombre?.trim(),
            documento_tipo: body?.documento_tipo,
            documento_numero: body?.documento_numero?.trim(),
            porcentaje_participacion: body?.porcentaje_participacion !== undefined ? parseFloat(body.porcentaje_participacion) : undefined,
            telefono: body?.telefono?.trim(),
            email: body?.email?.trim(),
            activo: body?.activo
        });
        if (!socio) {
            return { ok: false, status: 404, error: 'Socio no encontrado' };
        }
        return { ok: true, status: 200, data: socio };
    },
    deleteSocio: async ({ user, socioId }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const id = Number(socioId);
        if (!id) {
            return { ok: false, status: 400, error: 'ID de socio inválido' };
        }
        const result = await financeRepository.deleteSocio({ id });
        if (!result?.socio) {
            return { ok: false, status: 404, error: 'Socio no encontrado' };
        }
        return { ok: true, status: 200, data: result };
    },
    registerRetiroSocio: async ({ user, body }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const socioId = Number(body?.socio_id);
        const cuentaId = Number(body?.cuenta_id);
        const monto = parseFloat(body?.monto || 0);

        if (!socioId || !cuentaId) {
            return { ok: false, status: 400, error: 'Selecciona el socio y la cuenta bancaria de origen' };
        }
        if (Number.isNaN(monto) || monto <= 0) {
            return { ok: false, status: 400, error: 'El monto de retiro debe ser mayor a 0' };
        }

        const retiro = await financeRepository.registerRetiroSocio({
            actorUserId: user.id,
            socio_id: socioId,
            cuenta_id: cuentaId,
            monto,
            fecha_movimiento: body?.fecha_movimiento || null,
            referencia: body?.referencia?.trim() || 'Retiro Utilidades',
            descripcion: body?.descripcion?.trim() || 'Distribución de utilidades a socio',
            tipo_fondo: body?.tipo_fondo || 'banco'
        });

        return {
            ok: true,
            status: 201,
            data: {
                message: 'Retiro de utilidades registrado exitosamente',
                retiro
            }
        };
    },
    listRetirosSocios: async ({ user, query = {} }) => {
        if (forbiddenForClient(user)) {
            return { ok: false, status: 403, error: 'No autorizado' };
        }
        const retiros = await financeRepository.listRetirosSocios({ limit: query.limit });
        return { ok: true, status: 200, data: retiros };
    }
});
