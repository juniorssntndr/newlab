import { orderStatusSchema } from '@newlab/contracts';
import { apiClient } from '../../../services/http/apiClient.js';

const normalizeOrder = (order) => {
    const contractStatus = orderStatusSchema.safeParse(String(order?.estado || '').toUpperCase());

    return {
        ...order,
        contractStatus: contractStatus.success ? contractStatus.data : null
    };
};

export const fetchOrdersList = async ({ filters, headers }) => {
    const data = await apiClient('/pedidos', {
        query: filters,
        headers
    });

    if (!Array.isArray(data)) {
        return [];
    }

    return data.map(normalizeOrder);
};

export const fetchOrderDetail = async ({ orderId, headers }) => {
    const data = await apiClient(`/pedidos/${orderId}`, {
        headers
    });

    return normalizeOrder(data);
};

export const createOrder = ({ payload, headers }) => apiClient('/pedidos', {
    method: 'POST',
    headers,
    body: payload
});

export const updateOrderStatus = ({ orderId, payload, headers }) => apiClient(`/pedidos/${orderId}/estado`, {
    method: 'PATCH',
    headers,
    body: payload
});

export const createOrderApprovalLink = ({ orderId, payload, headers }) => apiClient(`/pedidos/${orderId}/aprobacion`, {
    method: 'POST',
    headers,
    body: payload
});

export const respondOrderApproval = ({ orderId, approvalId, payload, headers }) => apiClient(`/pedidos/${orderId}/aprobacion/${approvalId}`, {
    method: 'PATCH',
    headers,
    body: payload
});

export const updateOrderResponsible = ({ orderId, payload, headers }) => apiClient(`/pedidos/${orderId}/responsable`, {
    method: 'PATCH',
    headers,
    body: payload
});

export const updateOrderDeliveryDate = ({ orderId, payload, headers }) => apiClient(`/pedidos/${orderId}/fecha-entrega`, {
    method: 'PATCH',
    headers,
    body: payload
});
