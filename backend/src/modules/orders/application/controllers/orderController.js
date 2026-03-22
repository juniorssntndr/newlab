import { writeAuditEvent } from '../../../../services/audit.js';

const sendServiceResult = (res, result) => {
    if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
    }

    if (result.status === 201) {
        return res.status(201).json(result.data);
    }

    return res.json(result.data);
};

export const makeOrderController = ({ orderService }) => ({
    listOrders: async (req, res, next) => {
        try {
            const rows = await orderService.listOrders({
                user: req.user,
                filters: {
                    estado: req.query.estado,
                    clinica_id: req.query.clinica_id,
                    search: req.query.search,
                    responsable_id: req.query.responsable_id
                }
            });

            res.json(rows);
        } catch (error) {
            next(error);
        }
    },
    getOrderDetail: async (req, res, next) => {
        try {
            const result = await orderService.getOrderDetail({
                user: req.user,
                orderId: req.params.id
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    createOrder: async (req, res, next) => {
        try {
            const result = await orderService.createOrder({
                actorUserId: req.user.id,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'pedido',
                    entidadId: result.data.id,
                    accion: 'pedido_created',
                    descripcion: `Pedido ${result.meta.codigo} creado`,
                    metadata: {
                        clinica_id: result.meta.clinica_id,
                        paciente_nombre: result.meta.paciente_nombre,
                        total: result.meta.total
                    }
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    updateOrderStatus: async (req, res, next) => {
        try {
            const result = await orderService.updateOrderStatus({
                user: req.user,
                orderId: req.params.id,
                body: req.body
            });

            if (result.ok) {
                await writeAuditEvent(req, {
                    entidad: 'pedido',
                    entidadId: req.params.id,
                    accion: 'pedido_estado_updated',
                    descripcion: `Cambio de estado de ${result.meta.estado_anterior} a ${result.meta.estado_nuevo}`,
                    metadata: {
                        estado_anterior: result.meta.estado_anterior,
                        estado_nuevo: result.meta.estado_nuevo,
                        comentario: result.meta.comentario,
                        forzar: result.meta.forzar
                    }
                });
            }

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    createOrderApprovalLink: async (req, res, next) => {
        try {
            const result = await orderService.createOrderApprovalLink({
                user: req.user,
                orderId: req.params.id,
                body: req.body
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    updateOrderResponsible: async (req, res, next) => {
        try {
            const result = await orderService.updateOrderResponsible({
                user: req.user,
                orderId: req.params.id,
                body: req.body
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    updateOrderDeliveryDate: async (req, res, next) => {
        try {
            const result = await orderService.updateOrderDeliveryDate({
                user: req.user,
                orderId: req.params.id,
                body: req.body
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    respondOrderApproval: async (req, res, next) => {
        try {
            const result = await orderService.respondOrderApproval({
                user: req.user,
                orderId: req.params.id,
                approvalId: req.params.aprobacionId,
                body: req.body
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    }
});
