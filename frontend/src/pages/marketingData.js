export function readMarketingData(response) {
    if (response?.ok === true && response.data !== undefined) return response.data;
    if (Array.isArray(response)) return response;
    if (response?.ok === false) throw new Error(response.error || 'No se pudieron cargar los datos.');
    throw new Error('Respuesta de marketing no válida.');
}

export function marketingErrorMessage(error, fallback = 'No se pudo completar la operación.') {
    return error?.payload?.error || error?.message || fallback;
}

// Settle each resource independently so an optional lookup cannot hide successful data.
export async function settleMarketingResources(resources, onError) {
    await Promise.all(resources.map(async ({ key, request, onSuccess }) => {
        try {
            onSuccess(await request());
        } catch (error) {
            onError(key, error);
        }
    }));
}

export function marketingClinicLabel(clinic) {
    return clinic.provincia ? `${clinic.nombre} (${clinic.provincia})` : clinic.nombre;
}
