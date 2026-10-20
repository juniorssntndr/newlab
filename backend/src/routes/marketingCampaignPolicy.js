import crypto from 'node:crypto';
import { buildMarketingAudience } from './marketingAudience.js';

export const campaignError = (message, status = 400) => Object.assign(new Error(message), { status });
const text = (value, max, label) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw campaignError(`${label} no válido.`);
    return value.trim();
};
const amount = (value, label, optional = false) => {
    if (optional && (value == null || value === '')) return null;
    if (!['string', 'number'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw campaignError(`${label} no válido.`);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 9999999) throw campaignError(`${label} no válido.`);
    return parsed;
};
export function campaignDate(value, end = false) {
    const date = new Date(`${value}T00:00:00Z`);
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw campaignError('Selecciona fechas de vigencia válidas.');
    }
    return `${value}T${end ? '23:59:59.999' : '00:00:00.000'}-05:00`;
}
export function normalizeCampaign(body) {
    if (!body || typeof body !== 'object') throw campaignError('Campaña no válida.');
    const audience = buildMarketingAudience(body.tipo_audiencia, body.segmento_ids);
    const start = campaignDate(body.fecha_inicio);
    const end = campaignDate(body.fecha_fin, true);
    if (new Date(end) < new Date(start) || new Date(end) < new Date()) throw campaignError('La vigencia debe terminar después del inicio y no estar vencida.');
    if (!['/pedidos/nuevo', '/catalogo', 'whatsapp'].includes(body.link_destino)) throw campaignError('Selecciona un destino válido del portal o WhatsApp.');
    if (typeof body.mostrar_toast_in_app !== 'boolean' || typeof body.enviar_push_web !== 'boolean' || (!body.mostrar_toast_in_app && !body.enviar_push_web)) throw campaignError('Selecciona al menos un canal.');
    let benefit = null;
    let cuponId = null;
    let cuponCodigo = null;
    if (body.cupon_id) {
        cuponId = Number(body.cupon_id);
        if (!Number.isSafeInteger(cuponId) || cuponId <= 0) throw campaignError('Cupón seleccionado no válido.');
        cuponCodigo = body.codigo_descuento ? String(body.codigo_descuento).trim().toUpperCase() : null;
    } else if (body.codigo_descuento != null) {
        throw campaignError('Selecciona un cupón de la lista.');
    } else if (body.beneficio != null) {
        const b = body.beneficio;
        if (!['monto_fijo', 'porcentaje'].includes(b.tipo)) throw campaignError('Tipo de beneficio no válido.');
        const value = amount(b.valor, 'Beneficio');
        if (b.tipo === 'porcentaje' && value > 100) throw campaignError('El porcentaje no puede superar 100.');
        const limit = b.limite_usos_por_clinica ?? 1;
        if (!['string', 'number'].includes(typeof limit) || !Number.isSafeInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100) throw campaignError('Usos por clínica: entre 1 y 100.');
        benefit = { tipo: b.tipo, valor: value, limite_usos_por_clinica: Number(limit), monto_minimo_pedido: amount(b.monto_minimo_pedido, 'Pedido mínimo', true), tope_descuento_maximo: b.tipo === 'porcentaje' ? amount(b.tope_descuento_maximo, 'Tope', true) : null };
    }
    const image = body.imagen_url || null;
    const safeMessage = (body.mensaje && body.mensaje.trim()) ? body.mensaje.trim() : 'Beneficio exclusivo para tu próximo trabajo en AFINIX Dental Lab.';
    const buttonText = (body.texto_boton && typeof body.texto_boton === 'string' && body.texto_boton.trim())
        ? body.texto_boton.trim().slice(0, 40)
        : 'QUIERO MI DESCUENTO';
    return {
        titulo: text(body.titulo, 120, 'Nombre de la campaña'), mensaje: text(safeMessage, 600, 'Mensaje'), imagen_url: image,
        tipo_audiencia: body.tipo_audiencia || 'todos', segmento_ids: [...audience.clinicIds].sort((a, b) => a - b),
        fecha_inicio: start, fecha_fin: end, link_destino: body.link_destino, texto_boton: buttonText,
        mostrar_toast_in_app: body.mostrar_toast_in_app, enviar_push_web: body.enviar_push_web,
        beneficio: benefit, cupon_id: cuponId, codigo_descuento: cuponCodigo
    };
}
export const campaignPayloadHash = (campaign, isTest) => crypto.createHash('sha256').update(JSON.stringify({ campaign, isTest })).digest('hex');
export function campaignRequestId(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(value)) throw campaignError('Identificador de envío no válido.');
    return value;
}
export function validateCampaignImage(file) {
    const b = file?.buffer;
    if (!Buffer.isBuffer(b) || !b.length || b.length > 5 * 1024 * 1024) throw campaignError('La imagen debe pesar como máximo 5 MB.');
    const png = b.length > 45 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && b.readUInt32BE(8) === 13 && b.toString('ascii', 12, 16) === 'IHDR' && b.toString('ascii', b.length - 8, b.length - 4) === 'IEND';
    const jpeg = b.length > 4 && b[0] === 255 && b[1] === 216 && b[2] === 255 && b[b.length - 2] === 255 && b[b.length - 1] === 217;
    const webp = b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.readUInt32LE(4) === b.length - 8 && b.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(b.toString('ascii', 12, 16));
    const type = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : null;
    if (!type || file.mimetype !== type) throw campaignError('Sube una imagen PNG, JPEG o WebP válida.');
    if (png) {
        const width = b.readUInt32BE(16); const height = b.readUInt32BE(20);
        if (!width || !height || width > 8192 || height > 8192 || width * height > 40000000) throw campaignError('La imagen es demasiado grande o no tiene dimensiones válidas.');
        let offset = 8; let hasData = false;
        while (offset + 12 <= b.length) {
            const length = b.readUInt32BE(offset);
            if (length > b.length - offset - 12) throw campaignError('Imagen PNG incompleta.');
            const chunk = b.toString('ascii', offset + 4, offset + 8);
            if (chunk === 'IDAT' && length > 0) hasData = true;
            offset += length + 12;
        }
        if (!hasData || offset !== b.length) throw campaignError('Imagen PNG incompleta.');
    }
    return type;
}
