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

export const buildItemSelection = (teeth = [], isBridge = false, pillars = []) => {
    const sorted = sortTeethByArchOrder(teeth);
    if (!isBridge || sorted.length === 0) {
        return {
            piezas_dentales: sorted,
            es_puente: false,
            pieza_inicio: null,
            pieza_fin: null,
            pilares_dentales: []
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

    return {
        piezas_dentales: range,
        es_puente: range.length > 1,
        pieza_inicio: range[0] || null,
        pieza_fin: range[range.length - 1] || null,
        pilares_dentales: range.length > 1 ? normalizedPillars : []
    };
};

export const isBridgeProduct = (product) => {
    if (!product) return false;
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

export const formatDentalSelection = (item) => {
    if (!item) return '—';
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
    const teeth = sortTeethByArchOrder(item?.piezas_dentales || []);
    if (!item?.es_puente || teeth.length < 2) return { pilares: [], ponticos: [] };

    const pilares = normalizeBridgePillars(teeth, item?.pilares_dentales || []);
    const pillarSet = new Set(pilares);

    return {
        pilares,
        ponticos: teeth.filter((tooth) => !pillarSet.has(tooth))
    };
};
