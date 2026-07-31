/**
 * Etiquetas de estado de pedido — lenguaje de negocio por audiencia.
 */
export const ORDER_STATUS_FLOW = [
    'pendiente',
    'en_diseno',
    'esperando_aprobacion',
    'en_produccion',
    'terminado',
    'enviado',
];

export const orderStatusLabelsLab = {
    pendiente: 'Pendiente',
    en_diseno: 'En diseño',
    esperando_aprobacion: 'Esperando aprobación',
    en_produccion: 'En producción',
    terminado: 'Terminado',
    enviado: 'Enviado',
};

export const orderStatusLabelsClient = {
    pendiente: 'Recibido',
    en_diseno: 'En diseño',
    esperando_aprobacion: 'Necesita tu visto bueno',
    en_produccion: 'En producción',
    terminado: 'Listo',
    enviado: 'Enviado',
};

export const getOrderStatusLabel = (estado, { forClient = false } = {}) => {
    const map = forClient ? orderStatusLabelsClient : orderStatusLabelsLab;
    return map[estado] || String(estado || '').replace(/_/g, ' ');
};

export const getClientNextStepMessage = (pedido) => {
    if (!pedido) return '';
    if (pedido.estado === 'esperando_aprobacion') {
        return 'Hay un diseño listo. Revísalo y apruébalo o pide un ajuste.';
    }
    if (['pendiente', 'en_diseno'].includes(pedido.estado)) {
        return 'El laboratorio está trabajando en tu pedido. Te avisaremos cuando el diseño esté listo.';
    }
    if (pedido.estado === 'en_produccion') {
        return 'Tu diseño fue aprobado. El laboratorio lo está fabricando.';
    }
    if (pedido.estado === 'terminado') {
        return 'El trabajo está listo.';
    }
    if (pedido.estado === 'enviado') {
        return 'El pedido ya fue enviado.';
    }
    return '';
};
