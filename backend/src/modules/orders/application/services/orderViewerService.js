import jwt from 'jsonwebtoken';
import { getAllowedOrigins, getJwtSecret, getViewerConfig } from '../../../../config/env.js';

const legacyKeyFor = (value) => {
    const normalized = String(value || '');
    return /^\/uploads\/pedidos\/[A-Za-z0-9_-]+\/aprobaciones\/[^/?#]+\.html?$/i.test(normalized)
        ? `legacy-viewer://${normalized.slice('/uploads/'.length)}` : null;
};

export const isPrivateViewerKey = (value) => String(value || '').startsWith('private-viewer://');

export const makeOrderViewerService = ({ orderRepository }) => ({
    createViewerSession: async ({ user, orderId, approvalId, parentOrigin }) => {
        const order = await orderRepository.getOrderBaseById({ orderId });
        if (!order) return { ok: false, type: 'NOT_FOUND', error: 'Pedido no encontrado' };
        if (user?.tipo === 'cliente' && Number(user.clinica_id) !== Number(order.clinica_id)) return { ok: false, type: 'FORBIDDEN', error: 'No autorizado' };
        const approval = (await orderRepository.listOrderApprovals({ orderId })).find((row) => String(row.id) === String(approvalId));
        if (!approval) return { ok: false, type: 'NOT_FOUND', error: 'Diseño no encontrado' };
        const objectKey = isPrivateViewerKey(approval.link_exocad) ? approval.link_exocad : legacyKeyFor(approval.link_exocad);
        if (!objectKey) return { ok: false, type: 'UNAVAILABLE', error: 'Este diseño anterior debe volver a publicarse de forma segura.' };
        const allowedOrigins = getAllowedOrigins();
        // API requests from the app always send Origin. Failing closed avoids an invalid/wildcard postMessage target.
        if (!allowedOrigins.includes(parentOrigin)) return { ok: false, type: 'FORBIDDEN', error: 'Origen del visor no autorizado' };
        const { origin, ttlSeconds } = getViewerConfig();
        const token = jwt.sign({ typ: 'order-viewer', orderId: String(orderId), approvalId: String(approvalId), objectKey, parentOrigin }, getJwtSecret(), { audience: 'afinix-order-viewer', expiresIn: ttlSeconds });
        return { ok: true, data: { url: `${origin}/viewer/session/${encodeURIComponent(token)}`, expires_in: ttlSeconds } };
    }
});

export const verifyViewerCapability = (token) => jwt.verify(token, getJwtSecret(), { audience: 'afinix-order-viewer' });
