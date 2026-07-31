/**
 * Resolve product / upload image URLs for UI.
 * - Absolute http(s) → as-is
 * - /images/... → frontend public assets (landing catalog)
 * - /uploads/... → backend origin
 */
import { API_URL } from '../config.js';
import { resolveProductCatalogImage } from './productCatalogImages.js';

const BACKEND_BASE = API_URL.endsWith('/api')
    ? API_URL.slice(0, -4)
    : (API_URL.startsWith('http') ? API_URL : '');

export const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    if (imageUrl.startsWith('/images/')) return imageUrl;
    return `${BACKEND_BASE}${imageUrl}`;
};

export const resolveProductImageUrl = (product) => {
    return resolveImageUrl(resolveProductCatalogImage(product));
};
