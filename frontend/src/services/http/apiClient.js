import { API_URL } from '../../config.js';

const buildUrl = (path, query) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${API_URL}${cleanPath}`, window.location.origin);

    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }

            url.searchParams.set(key, value);
        });
    }

    if (API_URL.startsWith('http')) {
        return url.toString();
    }

    return `${API_URL}${cleanPath}${url.search}`;
};

export const apiClient = async (path, options = {}) => {
    const {
        method = 'GET',
        query,
        headers = {},
        body
    } = options;

    const response = await fetch(buildUrl(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = typeof payload === 'string'
            ? payload
            : (payload?.error || 'Error de red');
        const error = new Error(message);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
};
