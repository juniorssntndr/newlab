/**
 * Nombres cortos para UI (catálogo, cards, landing).
 * Conserva el nombre técnico largo en BD cuando aún exista.
 */
const PRODUCT_DISPLAY_NAME_ALIASES = {
    'Coronas de Resina con Carga Cerámica Impresa en 3D': 'Coronas impresas en 3D',
    'Carillas de Resina con Carga Cerámica Impresa en 3D': 'Carillas impresas en 3D',
    'Inlay - Onlay de Resina con Carga Cerámica Impresa en 3D': 'Inlay-Onlay impresos en 3D',
    'Inlay-Onlay de Resina con Carga Cerámica Impresa en 3D': 'Inlay-Onlay impresos en 3D',
};

export function getProductDisplayName(nombre) {
    const raw = String(nombre || '').trim();
    if (!raw) return 'Producto';
    if (PRODUCT_DISPLAY_NAME_ALIASES[raw]) return PRODUCT_DISPLAY_NAME_ALIASES[raw];

    const shortened = raw
        .replace(/\s+de Resina con Carga Cerámica Impresa en 3D$/i, ' impresas en 3D')
        .replace(/\s+con Carga Cerámica Impresa en 3D$/i, ' impresas en 3D')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return shortened || raw;
}
