import { apiClient } from '../../../services/http/apiClient.js';

export const fetchBillingPreview = async ({ orderId, headers }) => {
    const data = await apiClient(`/facturacion/${orderId}`, {
        headers
    });

    return Array.isArray(data) ? data : [];
};

export const createInvoice = ({ orderId, payload, headers }) => apiClient(`/facturacion/${orderId}/emitir`, {
    method: 'POST',
    headers,
    body: payload
});

export const annulInvoice = ({ invoiceId, payload, headers }) => apiClient(`/facturacion/${invoiceId}/anular`, {
    method: 'POST',
    headers,
    body: payload
});

export const createCreditNote = ({ invoiceId, payload, headers }) => apiClient(`/facturacion/${invoiceId}/nota-credito`, {
    method: 'POST',
    headers,
    body: payload
});
