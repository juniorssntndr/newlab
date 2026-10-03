import { writeAuditEvent } from '../../../../services/audit.js';
import { buildGoogleCalendarAuthUrl, storeGoogleCalendarCode } from '../../../../services/googleCalendar.js';
import { uploadOrderCaseImage } from '../../../../services/storage.js';

const sendServiceResult = (res, result) => {
    const typeToStatus = {
        'SUCCESS': 200,
        'CREATED': 201,
        'BAD_REQUEST': 400,
        'UNAUTHORIZED': 401,
        'FORBIDDEN': 403,
        'NOT_FOUND': 404,
        'CONFLICT': 409,
        'INTERNAL_ERROR': 500
    };

    const status = typeToStatus[result.type] || (result.ok ? 200 : 500);

    if (!result.ok) {
        return res.status(status).json({ error: result.error || 'Ocurrió un error inesperado' });
    }

    return res.status(status).json(result.data);
};

export const makeOrderController = ({ orderService }) => ({
    createViewerSession: async (req, res, next) => {
        try { return sendServiceResult(res, await orderService.createViewerSession({ user: req.user, orderId: req.params.id, approvalId: req.params.aprobacionId, parentOrigin: req.get('origin') })); }
        catch (error) { next(error); }
    },
    getOrderRepeatQuote: async (req, res, next) => {
        try {
            return sendServiceResult(res, await orderService.getOrderRepeatQuote({ user: req.user, orderId: req.params.id }));
        } catch (error) { next(error); }
    },
    createOrderRepeat: async (req, res, next) => {
        try {
            return sendServiceResult(res, await orderService.createOrderRepeat({
                user: req.user, orderId: req.params.id, body: req.body, files: req.files || []
            }));
        } catch (error) { next(error); }
    },
    getOrderRepeatPhoto: async (req, res, next) => {
        try {
            const result = await orderService.getOrderRepeatPhoto({ user: req.user, orderId: req.params.id, photoId: req.params.photoId });
            if (!result.ok) return sendServiceResult(res, result);
            const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[result.data.mime_type];
            res.set({ 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `attachment; filename="evidencia.${extension}"` });
            return res.send(result.data.data);
        } catch (error) { next(error); }
    },
    listOrders: async (req, res, next) => {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 200;
            const paginated = req.query.paginated === 'true' || !!req.query.page || !!req.query.limit;

            const result = await orderService.listOrders({
                user: req.user,
                filters: {
                    estado: req.query.estado,
                    filtro: req.query.filtro,
                    clinica_id: req.query.clinica_id,
                    search: req.query.search,
                    responsable_id: req.query.responsable_id,
                    page,
                    limit
                }
            });

            if (!result.ok) {
                return sendServiceResult(res, result);
            }

            if (paginated) {
                const total = result.data.total;
                return res.status(200).json({
                    data: result.data.rows,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit)
                    }
                });
            }

            return res.status(200).json(result.data.rows);
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
                body: req.body,
                file: req.file
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    uploadOrderFile: async (req, res, next) => {
        try {
            const access = await orderService.getOrderDetail({
                user: req.user,
                orderId: req.params.id
            });
            if (!access.ok) {
                return sendServiceResult(res, access);
            }

            const uploadedUrl = req.file
                ? await uploadOrderCaseImage({ file: req.file, orderId: req.params.id })
                : null;

            const result = await orderService.uploadOrderFile({
                user: req.user,
                orderId: req.params.id,
                fileInput: {
                    url: uploadedUrl,
                    type: req.body?.tipo,
                    originalName: req.file?.originalname || null,
                    mimeType: req.file?.mimetype || null,
                    sizeBytes: req.file?.size || null
                }
            });

            return sendServiceResult(res, result);
        } catch (error) {
            next(error);
        }
    },
    getGoogleCalendarAuthUrl: async (req, res, next) => {
        try {
            if (req.user?.tipo !== 'admin') {
                return res.status(403).json({ error: 'No autorizado' });
            }
            return res.json({ url: buildGoogleCalendarAuthUrl() });
        } catch (error) {
            next(error);
        }
    },
    storeGoogleCalendarCode: async (req, res, next) => {
        try {
            if (req.user?.tipo !== 'admin') {
                return res.status(403).json({ error: 'No autorizado' });
            }
            const code = String(req.body?.code || '').trim();
            if (!code) {
                return res.status(400).json({ error: 'Codigo OAuth requerido' });
            }
            const integration = await storeGoogleCalendarCode({
                pool: req.app.locals.pool,
                code,
                actorUserId: req.user.id
            });
            return res.json(integration);
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
    },
    updateApprovalMeetLink: async (req, res, next) => {
        try {
            const result = await orderService.updateApprovalMeetLink({
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
