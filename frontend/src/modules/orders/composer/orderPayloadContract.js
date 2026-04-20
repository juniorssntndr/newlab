import { normalizeBridgePillars } from '../../../utils/odontograma.js';
import { buildContractRawState, normalizeOrderItem } from './orderItemNormalizer.js';

const isPositiveInt = (value) => Number.isInteger(value) && value >= 1;
const toFiniteNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const toNullableInt = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
};

const readContractRawState = (item = {}) => item._contract_raw || item.rawState || item;

const buildContractError = (item, message) => {
    return {
        itemId: item.id || item.producto_id || null,
        producto_id: item.producto_id || null,
        message
    };
};

export const validateOrderPayloadContract = ({ items = [] } = {}) => {
    const errors = [];

    items.forEach((rawItem, index) => {
        const item = normalizeOrderItem(rawItem);
        const contractRaw = readContractRawState(rawItem);
        const itemLabel = `Item ${index + 1}`;
        const rawPieces = Array.isArray(contractRaw.piezas_dentales) ? contractRaw.piezas_dentales : [];
        const rawBridgePillars = Array.isArray(contractRaw.pilares_dentales) ? contractRaw.pilares_dentales : [];
        const rawCantidad = toNullableInt(contractRaw.cantidad);
        const rawPrecioUnitario = toFiniteNumber(contractRaw.precio_unitario);
        const rawSubtotal = toFiniteNumber(contractRaw.subtotal);
        const expectedSubtotal =
            rawCantidad !== null && rawPrecioUnitario !== null
                ? Number((rawCantidad * rawPrecioUnitario).toFixed(2))
                : null;

        if (item.requiresDentalSelection) {
            if (rawPieces.length < 1) {
                errors.push(buildContractError(item, `${itemLabel}: requiere al menos una pieza dental seleccionada.`));
            }
            if (rawCantidad === null || rawCantidad !== rawPieces.length) {
                errors.push(buildContractError(item, `${itemLabel}: cantidad dental inconsistente con piezas seleccionadas.`));
            }
            if (item.es_puente) {
                if (rawPieces.length < 2) {
                    errors.push(buildContractError(item, `${itemLabel}: un puente debe cubrir al menos dos piezas en el mismo tramo.`));
                }

                const invalidPillars = rawBridgePillars.filter((tooth) => !rawPieces.includes(tooth));
                if (invalidPillars.length > 0) {
                    errors.push(buildContractError(item, `${itemLabel}: hay pilares fuera del tramo del puente.`));
                }

                if (rawBridgePillars.length === 1) {
                    errors.push(buildContractError(item, `${itemLabel}: un puente debe tener al menos dos pilares.`));
                }

                const effectivePillars = normalizeBridgePillars(rawPieces, rawBridgePillars);
                if (effectivePillars.length < 2) {
                    errors.push(buildContractError(item, `${itemLabel}: un puente debe conservar al menos dos pilares.`));
                }
            }
        } else {
            if (rawCantidad === null || !isPositiveInt(rawCantidad)) {
                errors.push(buildContractError(item, `${itemLabel}: cantidad manual invalida.`));
            }
            if (rawPieces.length > 0) {
                errors.push(buildContractError(item, `${itemLabel}: items no dentales no deben incluir piezas dentales.`));
            }
        }

        if (expectedSubtotal === null || rawSubtotal === null) {
            errors.push(buildContractError(item, `${itemLabel}: subtotal o precio unitario invalido.`));
        } else if (rawSubtotal !== expectedSubtotal) {
            errors.push(buildContractError(item, `${itemLabel}: subtotal inconsistente.`));
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
};

export const buildOrderPayload = (draft = {}) => {
    const normalizedItems = (draft.items || []).map((item) => normalizeOrderItem(item));
    const payload = {
        ...draft,
        items: normalizedItems.map((item) => {
            const piezas = Array.isArray(item.piezas_dentales) ? item.piezas_dentales : [];
            const rawState = buildContractRawState(item);
            const lockedCantidad = item.requiresDentalSelection ? piezas.length : item.cantidad;
            const lockedSubtotal = Number((lockedCantidad * item.precio_unitario).toFixed(2));

            return {
                producto_id: item.producto_id,
                cantidad: lockedCantidad,
                precio_unitario: item.precio_unitario,
                subtotal: lockedSubtotal,
                piezas_dentales: item.requiresDentalSelection ? piezas : [],
                es_puente: !!item.es_puente,
                pieza_inicio: item.pieza_inicio || null,
                pieza_fin: item.pieza_fin || null,
                pilares_dentales: item.es_puente ? (item.pilares_dentales || []) : [],
                color_vita: item.color_vita || '',
                material: item.material || '',
                notas: item.notas || '',
                es_urgente: !!item.es_urgente,
                _contract_raw: {
                    cantidad: rawState.cantidad,
                    precio_unitario: rawState.precio_unitario,
                    subtotal: rawState.subtotal,
                    piezas_dentales: Array.isArray(rawState.piezas_dentales) ? rawState.piezas_dentales : piezas,
                    pilares_dentales: Array.isArray(rawState.pilares_dentales) ? rawState.pilares_dentales : (item.pilares_dentales || [])
                }
            };
        })
    };

    return payload;
};

export const ensureOrderPayloadContract = (payload) => {
    const result = validateOrderPayloadContract(payload);
    if (!result.valid) {
        const message = result.errors.map((error) => error.message).join(' ');
        throw new Error(message || 'El payload del pedido no cumple el contrato de cantidades y subtotales.');
    }

    return {
        ...payload,
        items: (payload.items || []).map((item) => {
            const { _contract_raw, ...itemWithoutContractRaw } = item;
            return itemWithoutContractRaw;
        })
    };
};
