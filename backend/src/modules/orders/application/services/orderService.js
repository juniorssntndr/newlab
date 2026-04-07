export const makeOrderService = ({ orderRepository }) => {
    const statusFlow = ['pendiente', 'en_diseno', 'esperando_aprobacion', 'en_produccion', 'terminado', 'enviado'];

    return {
    listOrders: ({ user, filters }) => orderRepository.listOrders({ user, filters }),
    getOrderDetail: async ({ user, orderId }) => {
        const order = await orderRepository.getOrderBaseById({ orderId });

        if (!order) {
            return {
                ok: false,
                status: 404,
                error: 'Pedido no encontrado'
            };
        }

        if (user?.tipo === 'cliente') {
            const canAccess = !!user?.clinica_id && Number(user.clinica_id) === Number(order.clinica_id);
            if (!canAccess) {
                return {
                    ok: false,
                    status: 403,
                    error: 'No autorizado'
                };
            }
        }

        const [items, timeline, approvals] = await Promise.all([
            orderRepository.listOrderItems({ orderId }),
            orderRepository.listOrderTimeline({ orderId }),
            orderRepository.listOrderApprovals({ orderId })
        ]);

        return {
            ok: true,
            status: 200,
            data: {
                ...order,
                items,
                timeline,
                aprobaciones: approvals
            }
        };
    },
    createOrder: async ({ actorUserId, body }) => {
        const { clinica_id, paciente_nombre, fecha_entrega } = body || {};
        if (!clinica_id || !paciente_nombre || !fecha_entrega) {
            return {
                ok: false,
                status: 400,
                error: 'Clínica, paciente y fecha de entrega son requeridos'
            };
        }

        const created = await orderRepository.createOrder({
            orderInput: body,
            actorUserId
        });

        return {
            ok: true,
            status: 201,
            data: created.pedido,
            meta: {
                total: created.totals.total,
                clinica_id,
                paciente_nombre,
                codigo: created.pedido.codigo
            }
        };
    },
    updateOrderStatus: async ({ user, orderId, body }) => {
        if (user?.tipo === 'cliente') {
            return {
                ok: false,
                status: 403,
                error: 'No autorizado'
            };
        }

        const { estado, sub_estado, comentario, responsable_id, link_exocad, forzar } = body || {};
        if (!estado) {
            return {
                ok: false,
                status: 400,
                error: 'Estado es requerido'
            };
        }

        if (!statusFlow.includes(estado)) {
            return {
                ok: false,
                status: 400,
                error: `Estado "${estado}" no válido`
            };
        }

        const current = await orderRepository.getOrderBaseById({ orderId });
        if (!current) {
            return {
                ok: false,
                status: 404,
                error: 'Pedido no encontrado'
            };
        }

        const currentIdx = statusFlow.indexOf(current.estado);
        const nextIdx = statusFlow.indexOf(estado);
        const isSameState = nextIdx === currentIdx;

        if (isSameState && !(estado === 'esperando_aprobacion' && link_exocad)) {
            return {
                ok: false,
                status: 400,
                error: 'El pedido ya está en ese estado'
            };
        }

        const validTransitions = {
            pendiente: ['en_diseno'],
            en_diseno: ['esperando_aprobacion'],
            esperando_aprobacion: ['en_produccion', 'en_diseno'],
            en_produccion: ['terminado'],
            terminado: ['enviado']
        };

        if (nextIdx > currentIdx) {
            const isForced = !!forzar && estado === 'en_produccion' && ['en_diseno', 'esperando_aprobacion'].includes(current.estado);
            if (!validTransitions[current.estado]?.includes(estado) && !isForced) {
                return {
                    ok: false,
                    status: 400,
                    error: `Transición de "${current.estado}" a "${estado}" no permitida`
                };
            }
            if (estado === 'esperando_aprobacion' && !link_exocad) {
                return {
                    ok: false,
                    status: 400,
                    error: 'Link de Exocad es requerido para aprobación'
                };
            }
            if (isForced && (!comentario || !comentario.trim())) {
                return {
                    ok: false,
                    status: 400,
                    error: 'Motivo es requerido para forzar avance'
                };
            }
        } else if (nextIdx < currentIdx) {
            if (!comentario || !comentario.trim()) {
                return {
                    ok: false,
                    status: 400,
                    error: 'Motivo es requerido para retroceder estado'
                };
            }
        }

        const updated = await orderRepository.updateOrderStatus({
            orderId,
            estado,
            sub_estado,
            comentario,
            responsable_id,
            link_exocad,
            actorUserId: user.id
        });

        if (updated.notFound) {
            return {
                ok: false,
                status: 404,
                error: 'Pedido no encontrado'
            };
        }

        return {
            ok: true,
            status: 200,
            data: updated.pedido,
            meta: {
                estado_anterior: updated.previousOrder.estado,
                estado_nuevo: estado,
                comentario: comentario || null,
                forzar: !!forzar
            }
        };
    },
    createOrderApprovalLink: async ({ user, orderId, body }) => {
        if (user?.tipo === 'cliente') {
            return {
                ok: false,
                status: 403,
                error: 'No autorizado'
            };
        }

        const { link_exocad, comentario } = body || {};
        if (!link_exocad) {
            return {
                ok: false,
                status: 400,
                error: 'Link de Exocad es requerido'
            };
        }

        const result = await orderRepository.createOrderApprovalLink({
            orderId,
            link_exocad,
            actorUserId: user.id,
            comentario
        });

        if (result.notFound) {
            return {
                ok: false,
                status: 404,
                error: 'Pedido no encontrado'
            };
        }

        return {
            ok: true,
            status: 201,
            data: result.approval
        };
    },
    updateOrderResponsible: async ({ user, orderId, body }) => {
        if (user?.tipo === 'cliente') {
            return {
                ok: false,
                status: 403,
                error: 'No autorizado'
            };
        }

        const { responsable_id, comentario } = body || {};
        const result = await orderRepository.updateOrderResponsible({
            orderId,
            responsable_id,
            actorUserId: user.id,
            comentario
        });

        if (result.invalidResponsible) {
            return {
                ok: false,
                status: 400,
                error: 'Responsable no valido'
            };
        }

        if (result.notFound) {
            return {
                ok: false,
                status: 404,
                error: 'Pedido no encontrado'
            };
        }

        return {
            ok: true,
            status: 200,
            data: result.pedido
        };
    },
    updateOrderDeliveryDate: async ({ user, orderId, body }) => {
        if (user?.tipo === 'cliente') {
            return {
                ok: false,
                status: 403,
                error: 'No autorizado'
            };
        }

        const { fecha_entrega, comentario } = body || {};
        if (!fecha_entrega) {
            return {
                ok: false,
                status: 400,
                error: 'Fecha de entrega requerida'
            };
        }

        const result = await orderRepository.updateOrderDeliveryDate({
            orderId,
            fecha_entrega,
            actorUserId: user.id,
            comentario
        });

        if (result.notFound) {
            return {
                ok: false,
                status: 404,
                error: 'Pedido no encontrado'
            };
        }

        return {
            ok: true,
            status: 200,
            data: result.pedido
        };
    },
    respondOrderApproval: async ({ user, orderId, approvalId, body }) => {
        if (user?.tipo !== 'cliente') {
            return {
                ok: false,
                status: 403,
                error: 'No autorizado'
            };
        }

        const { estado, comentario_cliente } = body || {};
        if (!['aprobado', 'ajuste_solicitado'].includes(estado)) {
            return {
                ok: false,
                status: 400,
                error: 'Estado de aprobacion no valido'
            };
        }

        const comentarioCliente = typeof comentario_cliente === 'string' ? comentario_cliente.trim() : '';
        if (estado === 'ajuste_solicitado' && !comentarioCliente) {
            return {
                ok: false,
                status: 400,
                error: 'Comentario de ajustes requerido'
            };
        }

        const order = await orderRepository.getOrderBaseById({ orderId });
        if (!order) {
            return {
                ok: false,
                status: 404,
                error: 'Pedido no encontrado'
            };
        }

        const canAccess = !!user?.clinica_id && Number(user.clinica_id) === Number(order.clinica_id);
        if (!canAccess) {
            return {
                ok: false,
                status: 403,
                error: 'No autorizado'
            };
        }

        const result = await orderRepository.respondOrderApproval({
            orderId,
            approvalId,
            estado,
            comentarioCliente,
            actorUserId: user.id
        });

        if (result.notFound) {
            return {
                ok: false,
                status: 404,
                error: 'Pedido no encontrado'
            };
        }

        if (result.approvalNotFound) {
            return {
                ok: false,
                status: 404,
                error: 'Aprobacion no encontrada'
            };
        }

        return {
            ok: true,
            status: 200,
            data: result.approval
        };
    }
    };
};
