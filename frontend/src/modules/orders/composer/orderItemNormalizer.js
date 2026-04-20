import { normalizeBridgePillars, sortTeethByArchOrder } from '../../../utils/odontograma.js';

const DENTAL_TYPES = new Set(['fija', 'implante']);
const NON_DENTAL_TYPES = new Set(['removible', 'especialidad']);

const DENTAL_KEYWORDS = [
    'corona',
    'carilla',
    'inlay',
    'onlay',
    'puente',
    'perno',
    'pilar',
    'implante',
    'abutment'
];

const NON_DENTAL_KEYWORDS = [
    'ferula',
    'férula',
    'guia quirurgica',
    'guía quirúrgica',
    'alineador',
    'acrilico',
    'acrílico',
    'flexible',
    'ppr',
    'protesis total',
    'prótesis total'
];

const getExplicitRequiresOdontogram = (source = {}) => {
    if (typeof source.requiresDentalSelection === 'boolean') return source.requiresDentalSelection;
    if (typeof source.requires_dental_selection === 'boolean') return source.requires_dental_selection;
    if (typeof source.requires_odontogram === 'boolean') return source.requires_odontogram;
    return null;
};

const toPositiveInt = (value, fallback = 1) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
};

const toPrice = (value) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
};

const pickFirstDefined = (...values) => values.find((value) => value !== undefined);

const toSearchableText = (product = {}) => {
    return [
        product.nombre,
        product.descripcion,
        product.categoria_nombre,
        product.categoria_tipo,
        product.tipo,
        product.material,
        product.material_nombre
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
};

export const checkRequiresOdontogram = (product = {}) => {
    const explicitRequiresOdontogram = getExplicitRequiresOdontogram(product);
    if (explicitRequiresOdontogram !== null) return explicitRequiresOdontogram;

    const categoryType = String(product.categoria_tipo || product.tipo || '').toLowerCase();
    if (DENTAL_TYPES.has(categoryType)) return true;
    if (NON_DENTAL_TYPES.has(categoryType)) return false;

    const searchable = toSearchableText(product);
    if (NON_DENTAL_KEYWORDS.some((keyword) => searchable.includes(keyword))) return false;
    if (DENTAL_KEYWORDS.some((keyword) => searchable.includes(keyword))) return true;

    return null;
};

export const buildContractRawState = (item = {}) => {
    const existingRawState = item.rawState || {};
    const rawPieces = Array.isArray(item.piezas_dentales)
        ? item.piezas_dentales
        : Array.isArray(existingRawState.piezas_dentales)
            ? existingRawState.piezas_dentales
            : [];
    const piezas_dentales = sortTeethByArchOrder(rawPieces);
    const rawBridgePillars = Array.isArray(item.pilares_dentales)
        ? item.pilares_dentales
        : Array.isArray(existingRawState.pilares_dentales)
            ? existingRawState.pilares_dentales
            : [];
    const es_puente = Boolean(item.es_puente ?? existingRawState.es_puente);
    const pilares_dentales = es_puente ? normalizeBridgePillars(piezas_dentales, rawBridgePillars) : [];

    const inferredRequiresOdontogram = checkRequiresOdontogram(item.product || item);
    const requiresDentalSelection =
        typeof inferredRequiresOdontogram === 'boolean'
            ? inferredRequiresOdontogram
            : piezas_dentales.length > 0;

    const cantidadManualInput = pickFirstDefined(
        item.cantidadManual,
        item.cantidad_manual,
        existingRawState.cantidadManual,
        existingRawState.cantidad_manual,
        item.cantidad,
        existingRawState.cantidad,
        1
    );

    const precioUnitarioInput = pickFirstDefined(
        item.precio_unitario,
        item.precio_base,
        existingRawState.precio_unitario,
        0
    );

    const cantidadNormalizada = requiresDentalSelection ? piezas_dentales.length : toPositiveInt(cantidadManualInput, 1);
    const subtotalNormalizado = Number((cantidadNormalizada * toPrice(precioUnitarioInput)).toFixed(2));

    return {
        cantidad: requiresDentalSelection ? piezas_dentales.length : cantidadManualInput,
        cantidadManual: cantidadManualInput,
        subtotal: subtotalNormalizado,
        precio_unitario: precioUnitarioInput,
        piezas_dentales,
        pilares_dentales,
        requiresDentalSelection
    };
};

export const normalizeOrderItem = (item = {}) => {
    const rawState = buildContractRawState(item);
    const unitPrice = toPrice(rawState.precio_unitario ?? item.precio_unitario ?? item.precio_base);
    const normalizedPieces = sortTeethByArchOrder(rawState.piezas_dentales || []);
    const inferredRequiresOdontogram = checkRequiresOdontogram(item.product || item);
    const requiresDentalSelection =
        typeof inferredRequiresOdontogram === 'boolean'
            ? inferredRequiresOdontogram
            : normalizedPieces.length > 0;
    const normalizedBridgePillars = item.es_puente
        ? normalizeBridgePillars(normalizedPieces, rawState.pilares_dentales ?? item.pilares_dentales ?? [])
        : [];
    const cantidadManual = toPositiveInt(rawState.cantidadManual ?? item.cantidadManual ?? item.cantidad_manual ?? item.cantidad ?? 1, 1);
    const cantidad = requiresDentalSelection ? normalizedPieces.length : cantidadManual;
    const subtotal = Number((cantidad * unitPrice).toFixed(2));

    return {
        ...item,
        rawState,
        piezas_dentales: normalizedPieces,
        pilares_dentales: normalizedBridgePillars,
        requiresDentalSelection,
        cantidadEditable: !requiresDentalSelection,
        cantidadManual,
        cantidad,
        precio_unitario: unitPrice,
        subtotal
    };
};

export const normalizeOrderItems = (items = []) => {
    return (items || []).map((item) => normalizeOrderItem(item));
};

export const computeCartTotals = (items = []) => {
    const normalized = normalizeOrderItems(items);
    const total = normalized.reduce((sum, item) => sum + item.subtotal, 0);

    return {
        items: normalized,
        total: Number(total.toFixed(2))
    };
};
