export const campaignDestinations = [
    { value: '/pedidos/nuevo', label: 'Nuevo pedido con cupón', icon: 'bi-bag-plus' },
    { value: '/catalogo', label: 'Catálogo de productos', icon: 'bi-grid' },
    { value: 'whatsapp', label: 'WhatsApp Oficial (910 707 060)', icon: 'bi-whatsapp' }
];
export const campaignAudiences = [
    { value: 'todos', label: 'Todos los clientes con acceso al portal', icon: 'bi-people' },
    { value: 'inactivos', label: 'Clientes inactivos (Sin pedidos en 30 días)', icon: 'bi-clock-history' },
    { value: 'clinicas_especificas', label: 'Clínicas específicas seleccionadas', icon: 'bi-hospital' }
];
const localDate = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function newCampaignForm() {
    return {
        titulo: '',
        mensaje: '',
        imagen_url: '',
        imagen_token: '',
        tipo_audiencia: 'todos',
        segmento_ids: [],
        link_destino: '/pedidos/nuevo',
        texto_boton: 'QUIERO MI DESCUENTO',
        fecha_inicio: localDate(new Date()),
        fecha_fin: localDate(new Date(Date.now() + 30 * 86400000)),
        mostrar_toast_in_app: true,
        enviar_push_web: false,
        cupon_id: null,
        codigo_descuento: '',
        beneficio: null
    };
}
export function campaignContentError(form) {
    if (!form.titulo || !form.titulo.trim()) return 'Ingresa el título de la campaña.';
    if (!form.fecha_inicio || !form.fecha_fin || form.fecha_fin < form.fecha_inicio) return 'Revisa las fechas de vigencia.';
    if (form.beneficio && !form.cupon_id) {
        const b = form.beneficio;
        if (!(Number(b.valor) > 0) || (b.tipo === 'porcentaje' && Number(b.valor) > 100)) return 'Revisa el valor del descuento.';
        const limit = b.limite_usos_por_clinica ?? b.limite_usos_por_doctor ?? 1;
        if (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100) return 'Indica entre 1 y 100 usos por clínica.';
    }
    return '';
}
export function campaignBenefitLabel(benefit, couponCode) {
    if (couponCode) return `Cupón ${couponCode}`;
    if (!benefit) return 'Sin cupón';
    return benefit.tipo === 'porcentaje' ? `${Number(benefit.valor)}% de descuento` : `S/ ${Number(benefit.valor).toFixed(2)} de descuento`;
}
export function campaignReceiptLines(receipt) {
    const m = receipt?.metricas || {};
    return [
        `${m.cuentas_objetivo || 0} cuentas objetivo · ${m.clinicas_objetivo || 0} clínicas`,
        `${m.avisos_portal || 0} avisos guardados en el portal`,
        `${m.push_aceptados || 0} Push aceptados por el proveedor · ${m.push_fallidos || 0} fallidos · ${m.push_omitidos || 0} omitidos`,
        `${m.push_pendientes || 0} pendientes · ${m.push_inciertos || 0} sin resultado confirmado`
    ];
}
