/**
 * Landing catalog photos (frontend/public/images/afinix-landing)
 * matched to AFINIX lab products by name heuristics.
 */
const LANDING = '/images/afinix-landing';

/** Exact / strong name matches first (order matters). */
const PRODUCT_IMAGE_RULES = [
    { match: /gu[ií]a\s*quir[uú]rgica/i, image: `${LANDING}/service-guide.jpg` },
    { match: /coronas?\s+impresas?\s+en\s+3d/i, image: `${LANDING}/service-crown-resin-3d.jpg` },
    { match: /carillas?\s+impresas?\s+en\s+3d/i, image: `${LANDING}/service-veneer-resin-3d.jpg` },
    { match: /corona.*resina|resina.*corona/i, image: `${LANDING}/service-crown-resin-3d.jpg` },
    { match: /carilla.*resina|resina.*carilla/i, image: `${LANDING}/service-veneer-resin-3d.jpg` },
    { match: /inlay|onlay/i, image: `${LANDING}/service-inlay-onlay-3d.jpg` },
    { match: /carilla.*disilicato|disilicato.*carilla/i, image: `${LANDING}/service-veneer-disilicate.jpg` },
    { match: /carilla/i, image: `${LANDING}/service-veneer-disilicate.jpg` },
    { match: /puente/i, image: `${LANDING}/service-zirconia-bridge.jpg` },
    { match: /pmma|provisional/i, image: `${LANDING}/service-provisional-pmma.jpg` },
    { match: /implante/i, image: `${LANDING}/service-implant-real.jpg` },
    { match: /disilicato|e\.?\s*max/i, image: `${LANDING}/service-emax.jpg` },
    { match: /corona.*zirconia|zirconia.*corona|^corona zirconia$/i, image: `${LANDING}/service-zirconia-crown.jpg` },
    { match: /corona/i, image: `${LANDING}/service-zirconia-crown.jpg` },
    { match: /h[ií]brid/i, image: `${LANDING}/service-hybrid.jpg` },
];

/** Explicit map for current seed / lab catalog names. */
export const PRODUCT_LANDING_IMAGES_BY_NAME = {
    'Corona Zirconia': `${LANDING}/service-zirconia-crown.jpg`,
    'Corona Disilicato': `${LANDING}/service-crown-disilicate.png`,
    'Corona Metal-Cerámica': `${LANDING}/service-cad-real.jpg`,
    'Corona PMMA Provisional': `${LANDING}/service-provisional-pmma.jpg`,
    'Carilla Disilicato': `${LANDING}/service-veneer-disilicate.jpg`,
    'Carilla Zirconia': `${LANDING}/service-veneer-disilicate.jpg`,
    'Inlay Disilicato': `${LANDING}/service-inlay-onlay-3d.jpg`,
    'Puente de Zirconia': `${LANDING}/service-zirconia-bridge.jpg`,
    'Puente Zirconia 3U': `${LANDING}/service-zirconia-bridge.jpg`,
    'Puente Metal-Cerámica 3U': `${LANDING}/service-zirconia-bridge.jpg`,
    'Corona Implante Zirconia': `${LANDING}/service-implant-real.jpg`,
    'Guía quirúrgica impresa': `${LANDING}/service-guide.jpg`,
    'Guías Quirúrgicas Impresas en 3D': `${LANDING}/service-guide.jpg`,
    'Guías Quirúrgicas Impresas en 3D (apilables y con irrigación)': `${LANDING}/service-guide.jpg`,
    'Coronas de Resina con Carga Cerámica Impresa en 3D': `${LANDING}/service-crown-resin-3d.jpg`,
    'Carillas de Resina con Carga Cerámica Impresa en 3D': `${LANDING}/service-veneer-resin-3d.jpg`,
    'Coronas impresas en 3D': `${LANDING}/service-crown-resin-3d.jpg`,
    'Carillas impresas en 3D': `${LANDING}/service-veneer-resin-3d.jpg`,
    'Inlay-Onlay impresos en 3D': `${LANDING}/service-inlay-onlay-3d.jpg`,
};

export const matchLandingProductImage = (productOrName) => {
    const name = typeof productOrName === 'string'
        ? productOrName
        : (productOrName?.nombre || '');
    if (!name) return '';

    const exact = PRODUCT_LANDING_IMAGES_BY_NAME[name];
    if (exact) return exact;

    for (const rule of PRODUCT_IMAGE_RULES) {
        if (rule.match.test(name)) return rule.image;
    }
    return '';
};

/**
 * Resolve catalog image for a product.
 * Priority:
 * 1. Custom upload (/uploads/...) from admin catalog tool
 * 2. Explicit image_url stored in DB
 * 3. Landing catalog fallback by product name
 */
export const resolveProductCatalogImage = (product) => {
    const dbUrl = String(product?.image_url || '').trim();
    if (dbUrl.includes('/uploads/')) return dbUrl;
    if (dbUrl) return dbUrl;

    return matchLandingProductImage(product) || '';
};
