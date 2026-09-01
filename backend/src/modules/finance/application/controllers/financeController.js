import { writeAuditEvent } from '../../../../services/audit.js';

const sendServiceResult = (res, result) => {
    if (!result.ok) {
        const payload = { error: result.error };
        if (result.details) {
            payload.details = result.details;
        }
        return res.status(result.status).json(payload);
    }

    if (result.status === 201) {
        return res.status(201).json(result.data);
    }

    return res.json(result.data);
};

export const makeFinanceController = ({ financeService }) => ({
    listFinanceOrders: async (req, res, next) => {
        try {
            const rows = await financeService.listFinanceOrders({
                user: req.user,
                filters: {
                    estado_pago: req.query.estado_pago,
                    clinica_id: req.query.clinica_id,
                    search: req.query.search
                }
            });

            return res.json(rows);
        } catch (error) {
            next(error);
        }
    },
    getCatalogos: async (req, res, next) => {
        try {
            const data = await financeService.getCatalogos();
            return res.json(data);
        } catch (error) {
            next(error);
        }
    },
    listMovimientos: async (req, res, next) => {
        try {
            const rows = await financeService.listMovimientos({
                user: req.user,
                filters: {
                    tipo: req.query.tipo,
                    tipo_fondo: req.query.tipo_fondo,
                    grupo_gasto: req.query.grupo_gasto,
                    from: req.query.from,
                    to: req.query.to,
                    search: req.query.search,
                    limit: req.query.limit
                }
            });

            return res.json(rows);
        } catch (error) {
            next(error);
        }
    },
    createMovimiento: async (req, res, next) => {
        try {
            const result = await financeService.createMovimiento({
                user: req.user,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'movimiento_financiero',
                    entidadId: result.data.id,
                    accion: 'movimiento_financiero_created',
                    descripcion: `${result.meta.tipo === 'egreso' ? 'Egreso' : 'Ingreso'} registrado`,
                    metadata: result.meta
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    updateMovimiento: async (req, res, next) => {
        try {
            const result = await financeService.updateMovimiento({
                user: req.user,
                movementId: req.params.movimientoId,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'movimiento_financiero',
                    entidadId: result.data.id,
                    accion: 'movimiento_financiero_updated',
                    descripcion: `${result.meta.tipo === 'egreso' ? 'Egreso' : 'Ingreso'} actualizado`,
                    metadata: result.meta
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    deleteMovimiento: async (req, res, next) => {
        try {
            const result = await financeService.deleteMovimiento({
                user: req.user,
                movementId: req.params.movimientoId
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'movimiento_financiero',
                    entidadId: req.params.movimientoId,
                    accion: 'movimiento_financiero_deleted',
                    descripcion: `${result.meta.tipo === 'egreso' ? 'Egreso' : 'Ingreso'} eliminado`,
                    metadata: result.meta
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    getOrderFinanceDetail: async (req, res, next) => {
        try {
            const result = await financeService.getOrderFinanceDetail({
                user: req.user,
                orderId: req.params.id
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    registerPago: async (req, res, next) => {
        try {
            const result = await financeService.registerPago({
                user: req.user,
                orderId: req.params.id,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'pago',
                    entidadId: result.data.id,
                    accion: 'pago_created',
                    descripcion: `Pago registrado para pedido ${result.meta.pedido_codigo}`,
                    metadata: {
                        pedido_id: result.meta.pedido_id,
                        monto: result.meta.monto,
                        metodo: result.meta.metodo,
                        tipo_fondo: result.meta.tipo_fondo,
                        cuenta_id: result.meta.cuenta_id
                    }
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    getEstadoCuentaByClinica: async (req, res, next) => {
        try {
            const result = await financeService.getEstadoCuentaByClinica({
                user: req.user,
                clinicaId: req.params.clinica_id
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    registerPagosMasivos: async (req, res, next) => {
        try {
            const result = await financeService.registerPagosMasivos({
                user: req.user,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'clinica',
                    entidadId: result.meta.clinica_id,
                    accion: 'pago_masivo_created',
                    descripcion: `Pago masivo de S/. ${result.meta.monto_total.toFixed(2)} distribuido en ${result.meta.pedidos_afectados} pedidos.`,
                    metadata: result.meta
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    conciliarPago: async (req, res, next) => {
        try {
            const result = await financeService.conciliarPago({
                user: req.user,
                pagoId: req.params.pagoId
            });

            if (result.ok && !result.alreadyConciliated) {
                await writeAuditEvent(req, {
                    entidad: 'pago',
                    entidadId: req.params.pagoId,
                    accion: 'pago_conciliado',
                    descripcion: `Pago conciliado para pedido ${result.meta.pedido_codigo}`.trim(),
                    metadata: {
                        pedido_id: result.meta.pedido_id,
                        monto: result.meta.monto
                    }
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    registerSaldoFavor: async (req, res, next) => {
        try {
            const result = await financeService.registerSaldoFavor({
                user: req.user,
                clinicaId: req.params.clinicaId || req.body.clinica_id,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'clinica',
                    entidadId: result.meta.clinica_id,
                    accion: 'saldo_favor_created',
                    descripcion: `Saldo a favor de S/. ${result.meta.monto.toFixed(2)} registrado para la clínica.`,
                    metadata: result.meta
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    listSaldosFavorByClinica: async (req, res, next) => {
        try {
            const result = await financeService.listSaldosFavorByClinica({
                user: req.user,
                clinicaId: req.params.clinicaId
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    aplicarSaldoFavor: async (req, res, next) => {
        try {
            const result = await financeService.aplicarSaldoFavor({
                user: req.user,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'pago',
                    entidadId: result.data.pago_pedido.id,
                    accion: 'saldo_favor_aplicado',
                    descripcion: `Aplicación de saldo a favor de S/. ${result.data.aplicacion.monto_aplicado} al pedido #${result.data.aplicacion.pedido_destino_id}.`,
                    metadata: result.data
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    listAplicacionesSaldoFavor: async (req, res, next) => {
        try {
            const result = await financeService.listAplicacionesSaldoFavor({
                user: req.user,
                clinicaId: req.params.clinicaId
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    getActiveCashSession: async (req, res, next) => {
        try {
            const result = await financeService.getActiveCashSession({ user: req.user });
            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    openCashSession: async (req, res, next) => {
        try {
            const result = await financeService.openCashSession({
                user: req.user,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'sesion_caja',
                    entidadId: result.data.id,
                    accion: 'caja_opened',
                    descripcion: `Apertura de caja diaria (Turno ${result.data.turno}) con monto S/. ${result.data.monto_apertura}.`,
                    metadata: result.data
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    closeCashSession: async (req, res, next) => {
        try {
            const result = await financeService.closeCashSession({
                user: req.user,
                sesionId: req.params.sesionId,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'sesion_caja',
                    entidadId: result.data.id,
                    accion: 'caja_closed',
                    descripcion: `Cierre de caja. Real contado: S/. ${result.data.monto_real_efectivo}, Diferencia: S/. ${result.data.diferencia_efectivo}.`,
                    metadata: result.data
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    reopenCashSession: async (req, res, next) => {
        try {
            const result = await financeService.reopenCashSession({
                user: req.user,
                sesionId: req.params.sesionId,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'sesion_caja',
                    entidadId: result.data.id,
                    accion: 'caja_reopened',
                    descripcion: `Reapertura de caja por administración: ${result.data.reabierto_motivo || 'Sin motivo'}.`,
                    metadata: result.data
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    listCashSessions: async (req, res, next) => {
        try {
            const result = await financeService.listCashSessions({
                user: req.user,
                query: req.query
            });
            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    getCobranzasOverview: async (req, res, next) => {
        try {
            const result = await financeService.getCobranzasOverview({ user: req.user });
            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    getClinicDebtDetail: async (req, res, next) => {
        try {
            const result = await financeService.getClinicDebtDetail({
                user: req.user,
                clinicaId: req.params.clinicaId
            });
            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    }
});
