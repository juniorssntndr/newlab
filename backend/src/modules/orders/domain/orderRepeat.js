import { createHash } from 'node:crypto';
import { detectRepeatPhoto } from './repeatPhoto.js';

export const canManageOrderRepeats = (user) =>
    ['admin', 'socio', 'operador', 'tecnico'].includes(user?.tipo) &&
    (user.tipo === 'admin' || (Array.isArray(user.modulos) && user.modulos.includes('pedidos')));

export const repeatError = (message, type = 'BAD_REQUEST') => Object.assign(new Error(message), { serviceType: type });

export const validateRepeatInput = (body = {}, files = []) => {
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!['warranty', 'paid'].includes(body.kind)) throw repeatError('Tipo de repetición no válido');
    if (!reason || reason.length > 1000) throw repeatError('Indica un motivo breve (máximo 1000 caracteres)');
    if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey || '')) throw repeatError('Identificador de solicitud no válido');
    const chargeAgreed = body.chargeAgreed === true || body.chargeAgreed === 'true';
    if (body.kind === 'paid' && !chargeAgreed) throw repeatError('Confirma que el nuevo cobro fue acordado con la clínica');
    const expectedTotal = Number(body.expectedTotal);
    if (body.expectedTotal === undefined || !Number.isFinite(expectedTotal) || expectedTotal < 0) throw repeatError('Importe de confirmación no válido');
    if (files.length > 3) throw repeatError('Se admiten hasta 3 fotos');
    const photos = files.map((file) => {
        const b = file.buffer;
        const mime = detectRepeatPhoto(b);
        if (!mime || file.mimetype !== mime || b.length > 5 * 1024 * 1024) throw repeatError('Fotos válidas JPG, PNG o WebP de hasta 5 MB');
        return { buffer: b, mime, hash: createHash('sha256').update(b).digest('hex') };
    });
    return { kind: body.kind, reason, requestKey: body.requestKey.toLowerCase(), chargeAgreed, expectedTotal, photos };
};

export const repeatFingerprint = (orderId, actorId, input) => createHash('sha256').update(JSON.stringify({
    orderId: Number(orderId), actorId: Number(actorId), kind: input.kind, reason: input.reason,
    expectedTotal: input.expectedTotal, chargeAgreed: input.chargeAgreed, photos: input.photos.map(p => p.hash)
})).digest('hex');

export const buildRepeatQuote = (source, items, igvFactor) => {
    if (!source) throw repeatError('Pedido no encontrado', 'NOT_FOUND');
    if (source.estado !== 'enviado') throw repeatError('Solo se puede repetir un pedido enviado');
    if (!items.length || !items[0].producto_id || new Set(items.map(i => Number(i.producto_id))).size !== 1) throw repeatError('El pedido debe contener un único tipo de producto válido');
    if (!Number.isFinite(igvFactor) || igvFactor < 1) throw repeatError('Configuración de IGV no válida');
    let cents = 0;
    for (const item of items) {
        if (!item.activo || !Number.isFinite(Number(item.precio_base)) || Number(item.precio_base) < 0 || !Number.isFinite(Number(item.cantidad)) || !(Number(item.cantidad) > 0)) throw repeatError('Producto o cantidad no disponible para repetición');
        cents += Math.round(Number(item.precio_base) * Number(item.cantidad) * 100);
    }
    const total = cents / 100;
    if (total > 9999999999.99) throw repeatError('Importe fuera de rango');
    const subtotal = Math.round(total / igvFactor * 100) / 100;
    return { total, subtotal, igv: Math.round((total - subtotal) * 100) / 100,
        deliveryDate: items[0].delivery_date, productName: items[0].producto_nombre };
};
