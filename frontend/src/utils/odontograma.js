export const UPPER_ARCH = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
export const LOWER_ARCH = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
export const ARCH_ORDER = [...UPPER_ARCH, ...LOWER_ARCH];

const ARCH_SET = new Set(ARCH_ORDER);

export const normalizeToothCode = (value) => {
    if (value === null || value === undefined) return '';
    const raw = String(value).trim();
    if (!raw) return '';

    const dotted = raw.match(/^(\d)\.(\d)$/);
    if (dotted) {
        const normalized = `${dotted[1]}${dotted[2]}`;
        return ARCH_SET.has(normalized) ? normalized : '';
    }

    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 2) return '';
    return ARCH_SET.has(digits) ? digits : '';
};

export const sortTeethByArchOrder = (teeth = []) => {
    const unique = [...new Set((teeth || []).map(normalizeToothCode).filter(Boolean))];
    return unique.sort((a, b) => ARCH_ORDER.indexOf(a) - ARCH_ORDER.indexOf(b));
};

export const buildBridgeRange = (startTooth, endTooth) => {
    const start = normalizeToothCode(startTooth);
    const end = normalizeToothCode(endTooth);
    if (!start || !end) return [];

    const arch = UPPER_ARCH.includes(start) && UPPER_ARCH.includes(end)
        ? UPPER_ARCH
        : LOWER_ARCH.includes(start) && LOWER_ARCH.includes(end)
            ? LOWER_ARCH
            : null;

    if (!arch) return [start];

    const startIndex = arch.indexOf(start);
    const endIndex = arch.indexOf(end);
    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    return arch.slice(from, to + 1);
};

export const getDefaultBridgePillars = (bridgeTeeth = []) => {
    const range = sortTeethByArchOrder(bridgeTeeth);
    if (range.length < 2) return [];
    return [range[0], range[range.length - 1]];
};

export const normalizeBridgePillars = (bridgeTeeth = [], pillars = []) => {
    const range = sortTeethByArchOrder(bridgeTeeth);
    if (range.length < 2) return [];

    const bridgeSet = new Set(range);
    const explicitPillars = sortTeethByArchOrder(pillars).filter((tooth) => bridgeSet.has(tooth));

    if (explicitPillars.length >= 2) {
        return explicitPillars;
    }

    return getDefaultBridgePillars(range);
};

export const isBridgeProduct = (product) => {
    if (!product) return false;
    if (product.admite_puente === true || product.admite_puente === 'true') return true;
    const source = [product.nombre, product.categoria_nombre, product.categoria_tipo, product.tipo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return source.includes('puente');
};

export const isVeneerProduct = (product) => {
    if (!product) return false;
    const source = [product.nombre, product.categoria_nombre, product.categoria_tipo, product.tipo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return source.includes('carilla');
};

export const isMolarTooth = (tooth) => {
    const normalized = normalizeToothCode(tooth);
    if (!normalized) return false;
    const secondDigit = parseInt(normalized[1], 10);
    return secondDigit >= 6;
};

/**
 * Normaliza y extrae tramos desde una selección existente o genera tramos por defecto.
 */
export const getSpansFromSelection = (selection) => {
    if (Array.isArray(selection?.tramos_detalle) && selection.tramos_detalle.length > 0) {
        return selection.tramos_detalle.map((span, index) => {
            const piezas = sortTeethByArchOrder(span.piezas || []);
            const isBridgeSpan = span.tipo === 'puente' || (span.tipo !== 'unitaria' && piezas.length > 1);
            const pilares = isBridgeSpan
                ? normalizeBridgePillars(piezas, span.pilares || [])
                : [];
            const pilarSet = new Set(pilares);
            const ponticos = isBridgeSpan
                ? piezas.filter((t) => !pilarSet.has(t))
                : [];

            return {
                id: span.id || `tramo-${index + 1}-${piezas.join('-')}`,
                tipo: isBridgeSpan ? 'puente' : 'unitaria',
                piezas,
                pilares,
                ponticos
            };
        });
    }

    const currentTeeth = sortTeethByArchOrder(selection?.piezas_dentales || []);
    if (currentTeeth.length === 0) return [];

    if (selection?.es_puente && currentTeeth.length > 1) {
        const pilares = normalizeBridgePillars(currentTeeth, selection.pilares_dentales || []);
        const pilarSet = new Set(pilares);
        const ponticos = currentTeeth.filter((t) => !pilarSet.has(t));
        return [{
            id: `bridge-${currentTeeth[0]}-${currentTeeth[currentTeeth.length - 1]}`,
            tipo: 'puente',
            piezas: currentTeeth,
            pilares,
            ponticos
        }];
    }

    return currentTeeth.map((tooth) => ({
        id: `unit-${tooth}`,
        tipo: 'unitaria',
        piezas: [tooth],
        pilares: [],
        ponticos: []
    }));
};

/**
 * Compila un array de tramos (puentes + unitarias) en el objeto enriquecido de selección.
 */
export const createSelectionFromSpans = (spans = []) => {
    const validSpans = spans.filter((s) => Array.isArray(s.piezas) && s.piezas.length > 0);
    const allPieces = [];
    const allPillars = [];
    const allPontics = [];

    const normalizedSpans = validSpans.map((s, idx) => {
        const piezas = sortTeethByArchOrder(s.piezas);
        const isBridge = s.tipo === 'puente' && piezas.length > 1;
        const pilares = isBridge ? normalizeBridgePillars(piezas, s.pilares || []) : [];
        const pilarSet = new Set(pilares);
        const ponticos = isBridge ? piezas.filter((t) => !pilarSet.has(t)) : [];

        allPieces.push(...piezas);
        allPillars.push(...pilares);
        allPontics.push(...ponticos);

        return {
            id: s.id || (isBridge ? `bridge-${piezas[0]}-${piezas[piezas.length - 1]}` : `unit-${piezas[0]}-${idx}`),
            tipo: isBridge ? 'puente' : 'unitaria',
            piezas,
            pilares,
            ponticos
        };
    });

    const piezas_dentales = sortTeethByArchOrder(allPieces);
    const pilares_dentales = sortTeethByArchOrder(allPillars);
    const ponticos_dentales = sortTeethByArchOrder(allPontics);
    const bridgeSpans = normalizedSpans.filter((s) => s.tipo === 'puente');
    const es_puente = bridgeSpans.length > 0;

    const firstBridge = bridgeSpans[0];
    const pieza_inicio = firstBridge ? firstBridge.piezas[0] : (piezas_dentales[0] || null);
    const pieza_fin = firstBridge ? firstBridge.piezas[firstBridge.piezas.length - 1] : (piezas_dentales[piezas_dentales.length - 1] || null);

    return {
        piezas_dentales,
        pilares_dentales,
        ponticos_dentales,
        tramos_detalle: normalizedSpans,
        es_puente,
        cantidad: piezas_dentales.length,
        pieza_inicio,
        pieza_fin
    };
};

/**
 * Construye la selección de ítem dental manteniendo compatibilidad retroactiva completa.
 */
export const buildItemSelection = (teeth = [], isBridge = false, pillars = [], existingTramos = null) => {
    if (Array.isArray(existingTramos) && existingTramos.length > 0) {
        return createSelectionFromSpans(existingTramos);
    }

    const sorted = sortTeethByArchOrder(teeth);
    if (!isBridge || sorted.length === 0) {
        const spans = sorted.map((t) => ({
            id: `unit-${t}`,
            tipo: 'unitaria',
            piezas: [t],
            pilares: [],
            ponticos: []
        }));
        return {
            piezas_dentales: sorted,
            pilares_dentales: [],
            ponticos_dentales: [],
            tramos_detalle: spans,
            es_puente: false,
            cantidad: sorted.length,
            pieza_inicio: null,
            pieza_fin: null
        };
    }

    const anchor = sorted[0];
    const sameArch = UPPER_ARCH.includes(anchor)
        ? sorted.filter((tooth) => UPPER_ARCH.includes(tooth))
        : sorted.filter((tooth) => LOWER_ARCH.includes(tooth));

    const bridgeStart = sameArch[0];
    const bridgeEnd = sameArch[sameArch.length - 1];
    const range = buildBridgeRange(bridgeStart, bridgeEnd);
    const normalizedPillars = normalizeBridgePillars(range, pillars);
    const pilarSet = new Set(normalizedPillars);
    const ponticos = range.filter((t) => !pilarSet.has(t));
    const isMultiToothBridge = range.length > 1;

    const spans = isMultiToothBridge
        ? [{
            id: `bridge-${range[0]}-${range[range.length - 1]}`,
            tipo: 'puente',
            piezas: range,
            pilares: normalizedPillars,
            ponticos
        }]
        : (range.length === 1 ? [{
            id: `unit-${range[0]}`,
            tipo: 'unitaria',
            piezas: range,
            pilares: [],
            ponticos: []
        }] : []);

    return {
        piezas_dentales: range,
        pilares_dentales: isMultiToothBridge ? normalizedPillars : [],
        ponticos_dentales: isMultiToothBridge ? ponticos : [],
        tramos_detalle: spans,
        es_puente: isMultiToothBridge,
        cantidad: range.length,
        pieza_inicio: range[0] || null,
        pieza_fin: range[range.length - 1] || null
    };
};

/**
 * Agrega una pieza como unitaria a la selección actual.
 */
export const addUnitTooth = (selection, tooth) => {
    const normalized = normalizeToothCode(tooth);
    if (!normalized) return selection;

    const spans = getSpansFromSelection(selection);
    const alreadySelected = spans.some((s) => s.piezas.includes(normalized));
    if (alreadySelected) return selection;

    const nextSpans = [
        ...spans,
        {
            id: `unit-${normalized}-${Date.now()}`,
            tipo: 'unitaria',
            piezas: [normalized],
            pilares: [],
            ponticos: []
        }
    ];

    return createSelectionFromSpans(nextSpans);
};

/**
 * Remueve una pieza de la selección, ajustando o disolviendo puentes si es necesario.
 */
export const removeTooth = (selection, tooth) => {
    const normalized = normalizeToothCode(tooth);
    if (!normalized) return selection;

    const spans = getSpansFromSelection(selection);
    const nextSpans = spans.map((span) => {
        if (!span.piezas.includes(normalized)) return span;

        const remainingPiezas = span.piezas.filter((t) => t !== normalized);
        if (remainingPiezas.length === 0) return null;

        if (span.tipo === 'puente') {
            if (remainingPiezas.length === 1) {
                return {
                    id: `unit-${remainingPiezas[0]}`,
                    tipo: 'unitaria',
                    piezas: remainingPiezas,
                    pilares: [],
                    ponticos: []
                };
            }
            const remainingPillars = normalizeBridgePillars(
                remainingPiezas,
                (span.pilares || []).filter((p) => p !== normalized)
            );
            const pSet = new Set(remainingPillars);
            const remainingPontics = remainingPiezas.filter((t) => !pSet.has(t));
            return {
                ...span,
                piezas: remainingPiezas,
                pilares: remainingPillars,
                ponticos: remainingPontics
            };
        }

        return null;
    }).filter(Boolean);

    return createSelectionFromSpans(nextSpans);
};

/**
 * Conecta un tramo de puente entre dos piezas en la misma arcada.
 * Extremos = pilares, intermedios = pónticos.
 * Preserva tramos no solapados y reemplaza los solapados.
 */
export const connectBridgeSpan = (selection, startTooth, endTooth) => {
    const start = normalizeToothCode(startTooth);
    const end = normalizeToothCode(endTooth);
    if (!start || !end) return selection;

    if (start === end) {
        return addUnitTooth(selection, start);
    }

    const isUpper = UPPER_ARCH.includes(start) && UPPER_ARCH.includes(end);
    const isLower = LOWER_ARCH.includes(start) && LOWER_ARCH.includes(end);
    if (!isUpper && !isLower) {
        return selection;
    }

    const range = buildBridgeRange(start, end);
    if (range.length < 2) return selection;

    const rangeSet = new Set(range);
    const pillars = [range[0], range[range.length - 1]];
    const ponticos = range.slice(1, range.length - 1);

    const existingSpans = getSpansFromSelection(selection);
    // Filtrar tramos que se solapan completamente o remover piezas solapadas
    const nonOverlappingSpans = [];

    for (const span of existingSpans) {
        const remaining = span.piezas.filter((t) => !rangeSet.has(t));
        if (remaining.length === 0) {
            continue;
        }
        if (remaining.length === span.piezas.length) {
            nonOverlappingSpans.push(span);
        } else if (remaining.length === 1) {
            nonOverlappingSpans.push({
                id: `unit-${remaining[0]}`,
                tipo: 'unitaria',
                piezas: remaining,
                pilares: [],
                ponticos: []
            });
        } else if (span.tipo === 'puente') {
            const nextPillars = normalizeBridgePillars(
                remaining,
                (span.pilares || []).filter((p) => remaining.includes(p))
            );
            const pSet = new Set(nextPillars);
            nonOverlappingSpans.push({
                ...span,
                piezas: remaining,
                pilares: nextPillars,
                ponticos: remaining.filter((t) => !pSet.has(t))
            });
        }
    }

    const newBridgeSpan = {
        id: `bridge-${range[0]}-${range[range.length - 1]}-${Date.now()}`,
        tipo: 'puente',
        piezas: range,
        pilares: pillars,
        ponticos
    };

    return createSelectionFromSpans([...nonOverlappingSpans, newBridgeSpan]);
};

/**
 * Conmuta el rol de una pieza dentro de su tramo de puente entre pilar y póntico.
 * Asegura que se mantengan al menos 2 pilares en el puente.
 */
export const toggleBridgeToothRole = (selection, tooth) => {
    const normalized = normalizeToothCode(tooth);
    if (!normalized) return { selection, error: null };

    const spans = getSpansFromSelection(selection);
    let bridgeFound = false;
    let errorMessage = null;

    const nextSpans = spans.map((span) => {
        if (span.tipo !== 'puente' || !span.piezas.includes(normalized)) {
            return span;
        }
        bridgeFound = true;
        const isCurrentPillar = span.pilares.includes(normalized);

        if (isCurrentPillar) {
            if (span.pilares.length <= 2) {
                errorMessage = 'El puente debe conservar al menos 2 pilares activos.';
                return span;
            }
            const nextPilares = span.pilares.filter((p) => p !== normalized);
            const nextPonticos = sortTeethByArchOrder([...span.ponticos, normalized]);
            return {
                ...span,
                pilares: nextPilares,
                ponticos: nextPonticos
            };
        } else {
            const nextPilares = sortTeethByArchOrder([...span.pilares, normalized]);
            const nextPonticos = span.ponticos.filter((p) => p !== normalized);
            return {
                ...span,
                pilares: nextPilares,
                ponticos: nextPonticos
            };
        }
    });

    if (!bridgeFound) {
        return { selection, error: null };
    }

    return {
        selection: createSelectionFromSpans(nextSpans),
        error: errorMessage
    };
};

/**
 * Alterna una pieza: si no está seleccionada, la añade como unitaria.
 * Si es unitaria, la deselecciona.
 * Si está dentro de un puente y `isBridgeMode` es true, alterna pilar/póntico.
 */
export const toggleTooth = (selection, tooth, isBridgeMode = false) => {
    const normalized = normalizeToothCode(tooth);
    if (!normalized) return selection;

    const currentTeeth = new Set(selection?.piezas_dentales || []);
    if (!currentTeeth.has(normalized)) {
        return addUnitTooth(selection, normalized);
    }

    const spans = getSpansFromSelection(selection);
    const targetSpan = spans.find((s) => s.piezas.includes(normalized));

    if (targetSpan && targetSpan.tipo === 'puente' && isBridgeMode) {
        const { selection: nextSel } = toggleBridgeToothRole(selection, normalized);
        return nextSel;
    }

    return removeTooth(selection, normalized);
};

export const formatDentalSelection = (item) => {
    if (!item) return '—';
    if (Array.isArray(item.tramos_detalle) && item.tramos_detalle.length > 0) {
        return item.tramos_detalle.map((tramo) => {
            if (tramo.tipo === 'puente') {
                const pilares = normalizeBridgePillars(tramo.piezas, tramo.pilares || []);
                const pillarSummary = pilares.length > 2 ? ` | Pilares: ${pilares.join(', ')}` : '';
                return `Puente ${tramo.piezas[0]}-${tramo.piezas[tramo.piezas.length - 1]}${pillarSummary}`;
            }
            return tramo.piezas.join(', ');
        }).join(' + ');
    }

    const piezas = sortTeethByArchOrder(item.piezas_dentales || []);
    if (item.es_puente && item.pieza_inicio && item.pieza_fin) {
        const pilares = normalizeBridgePillars(piezas, item.pilares_dentales || []);
        const pillarSummary = pilares.length > 2 ? ` | Pilares: ${pilares.join(', ')}` : '';
        return `Puente ${item.pieza_inicio}-${item.pieza_fin}${pillarSummary}`;
    }
    if (piezas.length > 0) {
        return piezas.join(', ');
    }
    if (item.pieza_dental) {
        return String(item.pieza_dental);
    }
    return '—';
};

export const getBridgeParts = (item) => {
    if (Array.isArray(item?.tramos_detalle) && item.tramos_detalle.length > 0) {
        const allPilares = [];
        const allPonticos = [];
        item.tramos_detalle.forEach((tramo) => {
            if (tramo.tipo === 'puente') {
                allPilares.push(...(tramo.pilares || []));
                allPonticos.push(...(tramo.ponticos || []));
            }
        });
        return {
            pilares: sortTeethByArchOrder(allPilares),
            ponticos: sortTeethByArchOrder(allPonticos)
        };
    }

    const teeth = sortTeethByArchOrder(item?.piezas_dentales || []);
    if (!item?.es_puente || teeth.length < 2) return { pilares: [], ponticos: [] };

    const pilares = normalizeBridgePillars(teeth, item?.pilares_dentales || []);
    const pillarSet = new Set(pilares);

    return {
        pilares,
        ponticos: teeth.filter((tooth) => !pillarSet.has(tooth))
    };
};

export const getToothRole = (tooth, item) => {
    if (!tooth || !item) return 'unitaria';
    const toothStr = String(tooth).trim();

    if (Array.isArray(item.ponticos_dentales) && item.ponticos_dentales.some((t) => String(t) === toothStr)) {
        return 'pontico';
    }
    if (Array.isArray(item.pilares_dentales) && item.pilares_dentales.some((t) => String(t) === toothStr)) {
        return 'pilar';
    }

    const { pilares, ponticos } = getBridgeParts(item);
    if (ponticos.some((t) => String(t) === toothStr)) return 'pontico';
    if (pilares.some((t) => String(t) === toothStr)) return 'pilar';

    return 'unitaria';
};

