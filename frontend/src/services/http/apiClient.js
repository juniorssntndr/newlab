import { API_URL } from '../../config.js';

const buildUrl = (path, query) => {
    let cleanPath = path.startsWith('/') ? path : `/${path}`;
    const base = (API_URL || '/api').replace(/\/+$/, '');

    // Normalize path to prevent duplicate /api if caller passed /api/... or api/...
    let relativePath = cleanPath;
    if (relativePath.startsWith('/api/')) {
        relativePath = relativePath.slice('/api'.length);
    } else if (relativePath === '/api') {
        relativePath = '';
    }

    const fullPath = `${base}${relativePath}`;

    if (API_URL.startsWith('http')) {
        const url = new URL(fullPath);
        if (query) {
            Object.entries(query).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.set(key, value);
                }
            });
        }
        return url.toString();
    }

    const url = new URL(fullPath, window.location.origin);
    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, value);
            }
        });
    }

    return `${fullPath}${url.search}`;
};

export const apiClient = async (path, options = {}) => {
    const {
        method = 'GET',
        query,
        headers = {},
        body
    } = options;

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const requestHeaders = { ...headers };
    if (isFormData) {
        delete requestHeaders['Content-Type'];
        delete requestHeaders['content-type'];
    } else if (body !== undefined && !requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
        requestHeaders['Content-Type'] = 'application/json';
    }

    if (!requestHeaders.Authorization && !requestHeaders.authorization && typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('nl_token');
        if (token) {
            requestHeaders.Authorization = `Bearer ${token}`;
        }
    }

    const response = await fetch(buildUrl(path, query), {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body)
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

// Convenience HTTP helpers
apiClient.get = (path, options = {}) => apiClient(path, { ...options, method: 'GET' });
apiClient.post = (path, body, options = {}) => apiClient(path, { ...options, method: 'POST', body });
apiClient.patch = (path, body, options = {}) => apiClient(path, { ...options, method: 'PATCH', body });
apiClient.put = (path, body, options = {}) => apiClient(path, { ...options, method: 'PUT', body });
apiClient.delete = (path, options = {}) => apiClient(path, { ...options, method: 'DELETE' });
