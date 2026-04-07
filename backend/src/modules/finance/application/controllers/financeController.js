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
    }
});
