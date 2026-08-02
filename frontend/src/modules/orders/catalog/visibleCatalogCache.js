import { apiClient } from '../../../services/http/apiClient.js';

const TTL_MS = 60_000;

/** @type {{ products: any[], categories: any[], at: number } | null} */
let cache = null;
let inflight = null;

const normalizeProducts = (products) => (Array.isArray(products) ? products : [])
    .filter((product) => product?.activo !== false && product?.visible !== false);

const isFresh = (entry) => Boolean(entry) && (Date.now() - entry.at) < TTL_MS;

/**
 * Sync peek of warm cache (for first paint without flash).
 * @returns {{ products: any[], categories: any[], at: number } | null}
 */
export function peekVisibleCatalog() {
    return isFresh(cache) ? cache : null;
}

/**
 * Shared visible catalog fetch for Catálogo and NuevoPedido.
 * Dedupes concurrent calls and caches briefly to avoid blank waits on revisit.
 */
export async function fetchVisibleCatalog(getHeaders, { force = false } = {}) {
    if (!force && isFresh(cache)) {
        return cache;
    }
    if (!force && inflight) {
        return inflight;
    }

    inflight = Promise.all([
        apiClient('/productos', {
            headers: getHeaders(),
            query: { activo: true, visible: true },
        }),
        apiClient('/categorias', { headers: getHeaders() }),
    ]).then(([productsPayload, categoriesPayload]) => {
        const products = normalizeProducts(productsPayload);
        const categoryIdsWithProducts = new Set(
            products
                .map((product) => (product?.categoria_id == null ? '' : String(product.categoria_id)))
                .filter(Boolean)
        );
        const categories = (Array.isArray(categoriesPayload) ? categoriesPayload : [])
            .filter((category) => categoryIdsWithProducts.has(String(category.id)));

        cache = {
            products,
            categories,
            at: Date.now(),
        };
        return cache;
    }).finally(() => {
        inflight = null;
    });

    return inflight;
}

export function clearVisibleCatalogCache() {
    cache = null;
    inflight = null;
}
