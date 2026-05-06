import { getIgvFactor } from '../../../config/env.js';

export const makeOrderService = ({ orderRepository }) => {
    const statusFlow = ['pendiente', 'en_diseno', 'esperando_aprobacion', 'en_produccion', 'terminado', 'enviado'];
    const igvFactor = getIgvFactor();

    const notifyLabAdmins = async (type, title, message, link) => {
        const admins = await orderRepository.getActiveLabUsers();
        for (const admin of admins) {
            await orderRepository.addNotification({
                userId: admin.id,
                type,
                title,
                message,
                link
            });
        }
    };

    const notifyClinicUsers = async (clinicId, type, title, message, link) => {
        const users = await orderRepository.getActiveClinicUsers({ clinicId });
        for (const user of users) {
            await orderRepository.addNotification({
                userId: user.id,
                type,
                title,
                message,
                link
            });
        }
    };

    return {
    listOrders: async ({ user, filters }) => {
        const rows = await orderRepository.listOrders({ user, filters });
        return {
            ok: true,
            type: 'SUCCESS',
            data: rows
        };
    },
    getOrderDetail: async ({ user, orderId }) => {
        const order = await orderRepository.getOrderBaseById({ orderId });

        if (!order) {
            return {
                ok: false,
                type: 'NOT_FOUND',
                error: 'Pedido no encontrado'
            };
        }

        if (user?.tipo === 'cliente') {
            const canAccess = !!user?.clinica_id && Number(user.clinica_id) === Number(order.clinica_id);
            if (!canAccess) {
                return {
                    ok: false,
                    type: 'FORBIDDEN',
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
            type: 'SUCCESS',
            data: {
                ...order,
                items,
                timeline,
                aprobaciones: approvals
            }
        };
    },
    createOrder: async ({ actorUserId, body }) => {
        const { clinica_id, paciente_nombre, fecha_entrega, items } = body || {};
        if (!clinica_id || !paciente_nombre || !fecha_entrega) {
            return {
                ok: false,
                type: 'BAD_REQUEST',
                error: 'Clínica, paciente y fecha de entrega son requeridos'
            };
        }

        const total = Array.isArray(items)
            ? items.reduce((sum, item) => sum + ((item.precio_unitario || 0) * (item.cantidad || 1)), 0)
            : 0;
        const subtotal = Number((total / igvFactor).toFixed(2));
        const igv = Number((total - subtotal).toFixed(2));

        const created = await orderRepository.createOrder({
            orderInput: body,
            totals: { total, subtotal, igv },
            actorUserId
        });

        // Side effects
        await orderRepository.addTimelineEntry({
            orderId: created.pedido.id,
            previousStatus: null,
            nextStatus: 'pendiente',
            userId: actorUserId,
            comment: 'Pedido creado'
        });

        await notifyLabAdmins(
            'nuevo_pedido',
            'Nuevo Pedido Recibido',
            `Pedido ${created.pedido.codigo} de ${paciente_nombre}`,
            `/pedidos/${created.pedido.id}`
        );

        return {
            ok: true,
            type: 'CREATED',
            data: created.pedido,
            meta: {
                total,
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
                type: 'FORBIDDEN',
                error: 'No autorizado'
            };
        }

        const { estado, sub_estado, comentario, responsable_id, link_exocad, forzar } = body || {};
        if (!estado) {
            return {
                ok: false,
                type: 'BAD_REQUEST',
                error: 'Estado es requerido'
            };
        }

        if (!statusFlow.includes(estado)) {
            return {
                ok: false,
                type: 'BAD_REQUEST',
                error: `Estado "${estado}" no válido`
            };
        }

        const current = await orderRepository.getOrderBaseById({ orderId });
        if (!current) {
            return {
                ok: false,
                type: 'NOT_FOUND',
                error: 'Pedido no encontrado'
            };
        }

        const currentIdx = statusFlow.indexOf(current.estado);
        const nextIdx = statusFlow.indexOf(estado);
        const isSameState = nextIdx === currentIdx;

        if (isSameState && !(estado === 'esperando_aprobacion' && link_exocad)) {
            return {
                ok: false,
                type: 'BAD_REQUEST',
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
                    type: 'BAD_REQUEST',
                    error: `Transición de "${current.estado}" a "${estado}" no permitida`
                };
            }
            if (estado === 'esperando_aprobacion' && !link_exocad) {
                return {
                    ok: false,
                    type: 'BAD_REQUEST',
                    error: 'Link de Exocad es requerido para aprobación'
                };
            }
            if (isForced && (!comentario || !comentario.trim())) {
                return {
                    ok: false,
                    type: 'BAD_REQUEST',
                    error: 'Motivo es requerido para forzar avance'
                };
            }
        } else if (nextIdx < currentIdx) {
            if (!comentario || !comentario.trim()) {
                return {
                    ok: false,
                    type: 'BAD_REQUEST',
                    error: 'Motivo es requerido para retroceder estado'
                };
            }
        }

        const updated = await orderRepository.updateOrderStatus({
            orderId,
            estado,
            sub_estado,
            responsable_id
        });

        if (updated.notFound) {
            return {
                ok: false,
                type: 'NOT_FOUND',
                error: 'Pedido no encontrado'
            };
        }

        // If transitioning to "esperando_aprobacion", we must create the approval link
        if (estado === 'esperando_aprobacion' && link_exocad) {
            await orderRepository.createOrderApprovalLink({
                orderId,
                link_exocad
            });
        }

        // Add timeline entry
        await orderRepository.addTimelineEntry({
            orderId,
            previousStatus: updated.previousOrder.estado,
            nextStatus: estado,
            userId: user.id,
            comment: comentario || (isSameState ? 'Actualización de diseño' : `Cambio a ${estado}`)
        });

        // Notifications
        const clientNotifMap = {
            en_diseno: { tipo: 'estado_diseno', titulo: 'Pedido en Diseño', mensaje: `Tu pedido ${current.codigo} ha comenzado el proceso de diseño.` },
            esperando_aprobacion: { tipo: 'aprobacion', titulo: '⭐ Diseño listo para aprobar', mensaje: `Pedido ${current.codigo} tiene un diseño listo para que lo revises.` },
            en_produccion: { tipo: 'estado_produccion', titulo: 'Pedido en Producción', mensaje: `Tu pedido ${current.codigo} ha pasado a la etapa de producción.` },
            terminado: { tipo: 'estado_terminado', titulo: '✅ Pedido Terminado', mensaje: `Tu pedido ${current.codigo} está listo. Pronto será enviado.` },
            enviado: { tipo: 'enviado', titulo: '🚀 Pedido Enviado', mensaje: `Tu pedido ${current.codigo} ha sido enviado. ¡Gracias por confiar en nosotros!` }
        };

        const notifInfo = clientNotifMap[estado];
        if (notifInfo) {
            await notifyClinicUsers(current.clinica_id, notifInfo.tipo, notifInfo.titulo, notifInfo.mensaje, `/pedidos/${orderId}`);
        }

        return {
            ok: true,
            type: 'SUCCESS',
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
                type: 'FORBIDDEN',
                error: 'No autorizado'
            };
        }

        const { link_exocad, comentario } = body || {};
        if (!link_exocad) {
            return {
                ok: false,
                type: 'BAD_REQUEST',
                error: 'Link de Exocad es requerido'
            };
        }

        const result = await orderRepository.createOrderApprovalLink({
            orderId,
            link_exocad
        });

        if (result.notFound) {
            return {
                ok: false,
                type: 'NOT_FOUND',
                error: 'Pedido no encontrado'
            };
        }

        await orderRepository.addTimelineEntry({
            orderId,
            previousStatus: null,
            nextStatus: null,
            userId: user.id,
            comment: comentario || 'Nuevo link de aprobación generado'
        });

        return {
            ok: true,
            type: 'CREATED',
            data: result.approval
        };
    },
    updateOrderResponsible: async ({ user, orderId, body }) => {
        if (user?.tipo === 'cliente') {
            return {
                ok: false,
                type: 'FORBIDDEN',
                error: 'No autorizado'
            };
        }

        const { responsable_id, comentario } = body || {};
        const result = await orderRepository.updateOrderResponsible({
            orderId,
            responsable_id
        });

        if (result.invalidResponsible) {
            return {
                ok: false,
                type: 'BAD_REQUEST',
                error: 'Responsable no valido'
            };
        }

        if (result.notFound) {
            return {
                ok: false,
                type: 'NOT_FOUND',
                error: 'Pedido no encontrado'
            };
        }

        await orderRepository.addTimelineEntry({
            orderId,
            previousStatus: null,
            nextStatus: null,
            userId: user.id,
            comment: comentario || `Responsable asignado: ${result.pedido.responsable_id || 'Ninguno'}`
        });

        return {
            ok: true,
            type: 'SUCCESS',
            data: result.pedido
        };
    },
    updateOrderDeliveryDate: async ({ user, orderId, body }) => {
        if (user?.tipo === 'cliente') {
            return {
                ok: false,
                type: 'FORBIDDEN',
                error: 'No autorizado'
            };
        }

        const { fecha_entrega, comentario } = body || {};
        if (!fecha_entrega) {
            return {
                ok: false,
                type: 'BAD_REQUEST',
                error: 'Fecha de entrega requerida'
            };
        }

        const result = await orderRepository.updateOrderDeliveryDate({
            orderId,
            fecha_entrega
        });

        if (result.notFound) {
            return {
                ok: false,
                type: 'NOT_FOUND',
                error: 'Pedido no encontrado'
            };
        }

        const fechaFormateada = new Date(fecha_entrega).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        await notifyClinicUsers(
            result.pedido.clinica_id,
            'fecha_actualizada',
            '📅 Fecha de entrega actualizada',
            `La fecha de entrega de ${result.pedido.codigo} fue actualizada al ${fechaFormateada}.`,
            `/pedidos/${result.pedido.id}`
        );

        await orderRepository.addTimelineEntry({
            orderId,
            previousStatus: null,
            nextStatus: null,
            userId: user.id,
            comment: comentario || `Nueva fecha de entrega: ${fechaFormateada}`
        });

        return {
            ok: true,
            type: 'SUCCESS',
            data: result.pedido
        };
    },
    respondOrderApproval: async ({ user, orderId, approvalId, body }) => {
        if (user?.tipo !== 'cliente') {
            return {
                ok: false,
                type: 'FORBIDDEN',
                error: 'No autorizado'
            };
        }

        const { estado, comentario_cliente } = body || {};
        if (!['aprobado', 'ajuste_solicitado'].includes(estado)) {
            return {
                ok: false,
                type: 'BAD_REQUEST',
                error: 'Estado de aprobacion no valido'
            };
        }

        const comentarioCliente = typeof comentario_cliente === 'string' ? comentario_cliente.trim() : '';
        if (estado === 'ajuste_solicitado' && !comentarioCliente) {
            return {
                ok: false,
                type: 'BAD_REQUEST',
                error: 'Comentario de ajustes requerido'
            };
        }

        const order = await orderRepository.getOrderBaseById({ orderId });
        if (!order) {
            return {
                ok: false,
                type: 'NOT_FOUND',
                error: 'Pedido no encontrado'
            };
        }

        const canAccess = !!user?.clinica_id && Number(user.clinica_id) === Number(order.clinica_id);
        if (!canAccess) {
            return {
                ok: false,
                type: 'FORBIDDEN',
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
                type: 'NOT_FOUND',
                error: 'Pedido no encontrado'
            };
        }

        if (result.approvalNotFound) {
            return {
                ok: false,
                type: 'NOT_FOUND',
                error: 'Aprobacion no encontrada'
            };
        }

        // Notifications
        if (estado === 'aprobado') {
            await notifyLabAdmins(
                'aprobacion_aprobada',
                'Diseño aprobado',
                `Cliente aprobó el diseño de ${result.pedido.codigo}`,
                `/pedidos/${result.pedido.id}`
            );
        } else if (estado === 'ajuste_solicitado') {
            await notifyLabAdmins(
                'ajuste_solicitado',
                'Ajustes solicitados',
                `Cliente solicitó ajustes para ${result.pedido.codigo}`,
                `/pedidos/${result.pedido.id}`
            );
        }

        // Add timeline entry
        await orderRepository.addTimelineEntry({
            orderId,
            previousStatus: order.estado,
            nextStatus: order.estado, // El estado del pedido no cambia automáticamente aquí según la lógica previa, 
                                      // pero se registra la respuesta
            userId: user.id,
            comment: `Diseño ${estado === 'aprobado' ? 'APROBADO' : 'CON AJUSTES'}. ${comentarioCliente}`
        });

        return {
            ok: true,
            type: 'SUCCESS',
            data: result.approval
        };
    }
    };
};
