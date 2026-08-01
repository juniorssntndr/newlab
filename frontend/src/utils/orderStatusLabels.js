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
    esperando_aprobacion: 'Aprobación',
    en_produccion: 'En producción',
    terminado: 'Listo',
    enviado: 'Enviado',
};

export const getOrderStatusLabel = (estado, { forClient = false } = {}) => {
    const map = forClient ? orderStatusLabelsClient : orderStatusLabelsLab;
    return map[estado] || String(estado || '').replace(/_/g, ' ');
};

