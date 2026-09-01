import { API_URL, FINANCE_QUERY_ROLLOUT_ENABLED, FINANCE_READ_FALLBACK_ENABLED } from '../../../config.js';
import { apiClient } from '../../../services/http/apiClient.js';

const buildFallbackUrl = (path, query) => {
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

const fallbackFetchJson = async ({ path, headers, query }) => {
    const response = await fetch(buildFallbackUrl(path, query), {
        method: 'GET',
        headers
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

const withFinanceReadFallback = async ({ queryPath, query, headers, runPrimary }) => {
    if (!FINANCE_QUERY_ROLLOUT_ENABLED) {
        return fallbackFetchJson({ path: queryPath, query, headers });
    }

    try {
        return await runPrimary();
    } catch (error) {
        if (!FINANCE_READ_FALLBACK_ENABLED) {
            throw error;
        }

        return fallbackFetchJson({ path: queryPath, query, headers });
    }
};

export const fetchFinanceAccounts = async ({ filters, headers }) => {
    const data = await withFinanceReadFallback({
        queryPath: '/finanzas',
        query: filters,
        headers,
        runPrimary: () => apiClient('/finanzas', {
            query: filters,
            headers
        })
    });

    return Array.isArray(data) ? data : [];
};

export const fetchFinanceDetail = ({ orderId, headers }) => withFinanceReadFallback({
    queryPath: `/finanzas/${orderId}`,
    headers,
    runPrimary: () => apiClient(`/finanzas/${orderId}`, {
        headers
    })
});

export const fetchFinanceCatalogs = ({ headers }) => withFinanceReadFallback({
    queryPath: '/finanzas/catalogos',
    headers,
    runPrimary: () => apiClient('/finanzas/catalogos', {
        headers
    })
});

export const fetchFinanceMovements = async ({ filters, headers }) => {
    const data = await withFinanceReadFallback({
        queryPath: '/finanzas/movimientos',
        query: filters,
        headers,
        runPrimary: () => apiClient('/finanzas/movimientos', {
            query: filters,
            headers
        })
    });

    return Array.isArray(data) ? data : [];
};

export const fetchFinanceAccountState = ({ clinicId, headers }) => withFinanceReadFallback({
    queryPath: `/finanzas/estado-cuenta/${clinicId}`,
    headers,
    runPrimary: () => apiClient(`/finanzas/estado-cuenta/${clinicId}`, {
        headers
    })
});

export const fetchOrderComprobantes = async ({ orderId, headers }) => {
    const data = await withFinanceReadFallback({
        queryPath: `/facturacion/${orderId}`,
        headers,
        runPrimary: () => apiClient(`/facturacion/${orderId}`, {
            headers
        })
    });

    return Array.isArray(data) ? data : [];
};

export const fetchFacturacionList = async ({ headers }) => {
    const data = await withFinanceReadFallback({
        queryPath: '/facturacion',
        headers,
        runPrimary: () => apiClient('/facturacion', {
            headers
        })
    });

    return Array.isArray(data) ? data : [];
};

export const registerPayment = ({ orderId, payload, headers }) => apiClient(`/finanzas/${orderId}/pagos`, {
    method: 'POST',
    headers,
    body: payload
});

export const registerBulkPayment = ({ payload, headers }) => apiClient('/finanzas/pagos-masivos', {
    method: 'POST',
    headers,
    body: payload
});

export const conciliatePayment = ({ paymentId, payload, headers }) => apiClient(`/finanzas/pagos/${paymentId}/conciliar`, {
    method: 'PATCH',
    headers,
    body: payload
});

export const createFinanceMovement = ({ payload, headers }) => apiClient('/finanzas/movimientos', {
    method: 'POST',
    headers,
    body: payload
});

export const updateFinanceMovement = ({ movementId, payload, headers }) => apiClient(`/finanzas/movimientos/${movementId}`, {
    method: 'PUT',
    headers,
    body: payload
});

export const deleteFinanceMovement = ({ movementId, headers }) => apiClient(`/finanzas/movimientos/${movementId}`, {
    method: 'DELETE',
    headers
});

export const registerSaldoFavor = ({ clinicaId, payload, headers }) => apiClient(`/finanzas/saldos-favor/${clinicaId}`, {
    method: 'POST',
    headers,
    body: payload
});

export const fetchSaldosFavorByClinica = ({ clinicaId, headers }) => apiClient(`/finanzas/saldos-favor/${clinicaId}`, {
    headers
});

export const aplicarSaldoFavor = ({ payload, headers }) => apiClient('/finanzas/saldos-favor/aplicar', {
    method: 'POST',
    headers,
    body: payload
});

export const fetchAplicacionesSaldoFavor = ({ clinicaId, headers }) => apiClient(`/finanzas/saldos-favor/aplicaciones/${clinicaId}`, {
    headers
});

export const fetchActiveCashSession = ({ headers } = {}) => apiClient('/finanzas/sesiones-caja/actual', {
    headers
});

export const fetchCashSessions = ({ headers } = {}) => apiClient('/finanzas/sesiones-caja', {
    headers
});

export const openCashSession = ({ payload, headers }) => apiClient('/finanzas/sesiones-caja/abrir', {
    method: 'POST',
    headers,
    body: payload
});

export const closeCashSession = ({ sesionId, payload, headers }) => apiClient(`/finanzas/sesiones-caja/${sesionId}/cerrar`, {
    method: 'POST',
    headers,
    body: payload
});

export const reopenCashSession = ({ sesionId, payload, headers }) => apiClient(`/finanzas/sesiones-caja/${sesionId}/reabrir`, {
    method: 'POST',
    headers,
    body: payload
});

export const fetchCobranzasOverview = ({ headers } = {}) => apiClient('/finanzas/cobranzas/overview', {
    headers
});

export const fetchClinicDebtDetail = ({ clinicaId, headers }) => apiClient(`/finanzas/cobranzas/clinica/${clinicaId}`, {
    headers
});
