import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret, getAllowedOrigins } from '../config/env.js';
import { isPrivateViewerKey } from '../modules/orders/application/services/orderViewerService.js';

const router = Router();

const isDirectWebLink = (link) =>
    typeof link === 'string' &&
    !link.startsWith('private-viewer://') &&
    !link.startsWith('legacy-viewer://') &&
    /^https?:\/\//i.test(link);

const decodeTrackingToken = (token) => {
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, getJwtSecret());
        if (decoded.typ !== 'order-tracking' && decoded.typ !== 'magic-link') {
            return null;
        }
        return decoded;
    } catch {
        return null;
    }
};

/**
 * GET /api/public/tracking/:token
 * Public view of order tracking without account login.
 */
router.get('/:token', async (req, res) => {
    const { token } = req.params;
    const decoded = decodeTrackingToken(token);
    if (!decoded) {
        return res.status(401).json({ ok: false, error: 'Enlace de seguimiento inválido o expirado' });
    }

    const { orderId, clinicaId } = decoded;
    const orderRepository = req.app.locals.modules?.orders?.orderRepository;
    if (!orderRepository) {
        return res.status(503).json({ ok: false, error: 'Servicio de pedidos no disponible' });
    }

    try {
        const order = await orderRepository.getOrderBaseById({ orderId });
        if (!order) {
            return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
        }

        if (Number(order.clinica_id) !== Number(clinicaId)) {
            return res.status(403).json({ ok: false, error: 'Acceso no autorizado a este pedido' });
        }

        const [items, timeline, approvals] = await Promise.all([
            orderRepository.listOrderItems({ orderId }),
            orderRepository.listOrderTimeline({ orderId }),
            orderRepository.listOrderApprovals({ orderId })
        ]);

        const currentApproval = approvals[0] || null;
        const has3dDesign = Boolean(currentApproval?.link_exocad && currentApproval?.archivo_disponible !== false);

        // Sanitize sensitive business/financial fields - only return clinical and tracking details
        const publicOrder = {
            id: order.id,
            codigo: order.codigo,
            estado: order.estado,
            fecha: order.fecha,
            fecha_entrega: order.fecha_entrega,
            paciente_nombre: order.paciente_nombre,
            clinica_nombre: order.clinica_nombre || order.clinica_razon_social || 'Clínica',
            observaciones: order.observaciones || '',
            items: items.map((it) => ({
                id: it.id,
                producto_nombre: it.producto_nombre,
                cantidad: it.cantidad,
                dientes: it.dientes,
                color: it.color,
                material: it.material
            })),
            approval: currentApproval
                ? {
                      id: currentApproval.id,
                      estado: currentApproval.estado,
                      comentario: currentApproval.comentario,
                      comentario_cliente: currentApproval.comentario_cliente,
                      has3dDesign,
                      isDirectWebLink: isDirectWebLink(currentApproval.link_exocad),
                      directWebLink: isDirectWebLink(currentApproval.link_exocad) ? currentApproval.link_exocad : null,
                      created_at: currentApproval.created_at,
                      respondido_at: currentApproval.respondido_at,
                      meet_status: currentApproval.meet_status,
                      meet_url: currentApproval.meet_url,
                      meet_scheduled_at: currentApproval.meet_scheduled_at
                  }
                : null,
            timeline: timeline.map((tl) => ({
                id: tl.id,
                estado_anterior: tl.estado_anterior,
                estado_nuevo: tl.estado_nuevo,
                created_at: tl.created_at,
                comentario: tl.comentario
            }))
        };

        return res.json({ ok: true, order: publicOrder });
    } catch (err) {
        req.log?.error?.({ err }, 'Error al consultar tracking público');
        return res.status(500).json({ ok: false, error: 'Error interno al cargar el seguimiento' });
    }
});

/**
 * POST /api/public/tracking/:token/visor
 * Creates a 3D viewer session or returns external viewer link.
 */
router.post('/:token/visor', async (req, res) => {
    const { token } = req.params;
    const decoded = decodeTrackingToken(token);
    if (!decoded) {
        return res.status(401).json({ ok: false, error: 'Enlace de seguimiento inválido o expirado' });
    }

    const { orderId, clinicaId } = decoded;
    const { orderRepository, orderViewerService } = req.app.locals.modules?.orders || {};
    if (!orderRepository || !orderViewerService) {
        return res.status(503).json({ ok: false, error: 'Servicio de visor 3D no disponible' });
    }

    try {
        const order = await orderRepository.getOrderBaseById({ orderId });
        if (!order || Number(order.clinica_id) !== Number(clinicaId)) {
            return res.status(403).json({ ok: false, error: 'No autorizado' });
        }

        const approvals = await orderRepository.listOrderApprovals({ orderId });
        const targetApproval = req.body?.approvalId
            ? approvals.find((a) => String(a.id) === String(req.body.approvalId))
            : approvals[0];

        if (!targetApproval) {
            return res.status(404).json({ ok: false, error: 'Diseño no encontrado' });
        }

        // If direct external link, return immediately
        if (isDirectWebLink(targetApproval.link_exocad)) {
            return res.json({ ok: true, url: targetApproval.link_exocad });
        }

        const parentOrigin = req.get('origin') || getAllowedOrigins()[0] || 'https://afinixlab.com';
        const session = await orderViewerService.createViewerSession({
            user: { tipo: 'cliente', clinica_id: clinicaId },
            orderId,
            approvalId: targetApproval.id,
            parentOrigin
        });

        if (!session.ok) {
            return res.status(400).json({ ok: false, error: session.error || 'No se pudo abrir el visor 3D' });
        }

        return res.json({ ok: true, url: session.data.url });
    } catch (err) {
        req.log?.error?.({ err }, 'Error al generar sesión de visor 3D');
        return res.status(500).json({ ok: false, error: 'Error al cargar visor 3D' });
    }
});

/**
 * POST /api/public/tracking/:token/aprobar
 * Approves 3D design or requests adjustments from the public tracking page.
 */
router.post('/:token/aprobar', async (req, res) => {
    const { token } = req.params;
    const decoded = decodeTrackingToken(token);
    if (!decoded) {
        return res.status(401).json({ ok: false, error: 'Enlace de seguimiento inválido o expirado' });
    }

    const { orderId, clinicaId } = decoded;
    const { orderService, orderRepository } = req.app.locals.modules?.orders || {};
    if (!orderService || !orderRepository) {
        return res.status(503).json({ ok: false, error: 'Servicio de pedidos no disponible' });
    }

    const { estado, comentario_cliente, comentario, request_meet, approvalId } = req.body || {};
    if (!['aprobado', 'ajuste_solicitado'].includes(estado)) {
        return res.status(400).json({ ok: false, error: 'Estado de aprobación no válido' });
    }

    const finalComment = (comentario_cliente || comentario || '').trim();
    if (estado === 'ajuste_solicitado' && !finalComment) {
        return res.status(400).json({ ok: false, error: 'Ingresa una nota con las observaciones o ajustes deseados' });
    }

    try {
        const approvals = await orderRepository.listOrderApprovals({ orderId });
        const targetApproval = approvalId
            ? approvals.find((a) => String(a.id) === String(approvalId))
            : approvals.find((a) => a.estado === 'pendiente') || approvals[0];

        if (!targetApproval) {
            return res.status(404).json({ ok: false, error: 'Revisión de diseño no encontrada' });
        }

        const result = await orderService.respondOrderApproval({
            user: {
                id: null,
                tipo: 'cliente',
                clinica_id: clinicaId,
                isGuestTracking: true
            },
            orderId,
            approvalId: targetApproval.id,
            body: {
                estado,
                comentario_cliente: finalComment,
                request_meet: Boolean(request_meet)
            }
        });

        if (!result.ok) {
            return res.status(400).json({ ok: false, error: result.error || 'Error al procesar la respuesta' });
        }

        return res.json({ ok: true, data: result.data });
    } catch (err) {
        req.log?.error?.({ err }, 'Error al responder aprobación desde tracking');
        return res.status(500).json({ ok: false, error: 'Error interno al procesar la aprobación' });
    }
});

export default router;
