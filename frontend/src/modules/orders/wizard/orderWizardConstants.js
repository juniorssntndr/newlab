/** Coordinación de cómo llega el caso al lab (sin subir archivos en el wizard). */
export const ORDER_INTAKE_DEFAULT = 'recoleccion';

export const ORDER_INTAKE_MODES = [
    {
        id: 'recoleccion',
        label: 'Recolección en consultorio',
        description: 'El laboratorio coordinará el recojo de modelos en tu consultorio.',
        icon: 'bi-geo-alt',
    },
    {
        id: 'envio',
        label: 'Envío de modelos',
        description: 'Enviarás impresiones o modelos físicos al laboratorio.',
        icon: 'bi-box-seam',
    },
    {
        id: 'digital',
        label: 'Archivos digitales',
        description: 'Coordinaremos la subida de STL u otros archivos (después del pedido).',
        icon: 'bi-cloud-arrow-up',
    },
];

export const ORDER_INTAKE_LABELS = Object.fromEntries(
    ORDER_INTAKE_MODES.map((mode) => [mode.id, mode.label])
);

const INTAKE_PREFIX_RE = /^\[INGRESO:(digital|envio|recoleccion)\]\s*/i;

export const formatObservacionesWithIntake = (intakeMode, notes = '') => {
    const mode = ORDER_INTAKE_LABELS[intakeMode] ? intakeMode : ORDER_INTAKE_DEFAULT;
    const cleanNotes = String(notes || '').replace(INTAKE_PREFIX_RE, '').trim();
    const header = `[INGRESO:${mode}]`;
    return cleanNotes ? `${header}\n${cleanNotes}` : header;
};

export const parseIntakeFromObservaciones = (observaciones = '') => {
    const text = String(observaciones || '');
    const match = text.match(INTAKE_PREFIX_RE);
    return {
        intakeMode: match?.[1]?.toLowerCase() || null,
        notes: text.replace(INTAKE_PREFIX_RE, '').trim(),
    };
};

/**
 * Tres pasos reales del wizard (producto ya viene del catálogo).
 * 1 Paciente — datos + urgencia + precio/plazo
 * 2 Piezas — odontograma + tono + nota
 * 3 Confirmar — revisión + cómo llega el caso
 */
export const ORDER_WIZARD_MACRO_STEPS = [
    { id: 'paciente', label: 'Paciente', index: 1 },
    { id: 'piezas', label: 'Piezas', index: 2 },
    { id: 'confirmar', label: 'Confirmar', index: 3 },
];

/** Recargo Affinity Dental Lab por pedido express (urgente). */
export const ORDER_EXPRESS_SURCHARGE_RATE = 0.25;

export const applyExpressSurcharge = (basePrice, isUrgent) => {
    const base = Number(basePrice) || 0;
    if (!isUrgent || base <= 0) return Number(base.toFixed(2));
    return Number((base * (1 + ORDER_EXPRESS_SURCHARGE_RATE)).toFixed(2));
};

export const expressSurchargeAmount = (basePrice, isUrgent) => {
    const base = Number(basePrice) || 0;
    if (!isUrgent || base <= 0) return 0;
    return Number((base * ORDER_EXPRESS_SURCHARGE_RATE).toFixed(2));
};
