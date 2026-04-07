const APISPERU_BASE = process.env.APISPERU_BASE_URL || 'https://facturacion.apisperu.com/api/v1';

const apiHeaders = (token) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
});

const isDemoMode = ({ entorno, token }) => {
    const envDemo = String(process.env.ENTORNO || '').toLowerCase() === 'demo';
    const issuerDemo = String(entorno || '').toLowerCase() === 'beta';
    return envDemo || (issuerDemo && (!token || token === 'TU_TOKEN_AQUI'));
};

const parseJsonSafely = async (response) => {
    try {
        return await response.json();
    } catch (_error) {
        return { message: 'Respuesta no JSON de APISPERU' };
    }
};

const callApisperu = async ({ token, method, path, body }) => {
    const response = await fetch(`${APISPERU_BASE}${path}`, {
        method,
        headers: apiHeaders(token),
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
        const detail = Array.isArray(data?.errors)
            ? data.errors.map((entry) => `[${entry.code}] ${entry.description}`).join(' | ')
            : (data?.message || JSON.stringify(data));
        throw new Error(`APISPERU/SUNAT: ${detail}`);
    }

    return data;
};

export const makeApisperuAdapter = () => ({
    sendInvoice: async ({ token, payload, entorno }) => {
        if (isDemoMode({ entorno, token })) {
            return {
                message: 'Aceptado por SUNAT (DEMO)',
                sunatResponse: { success: true, cdrResponse: { id: `DEMO-${Date.now()}` } },
                links: {
                    xml: 'https://facturacion.apisperu.com/demo/doc.xml',
                    pdf: 'https://facturacion.apisperu.com/demo/doc.pdf',
                    cdr: 'https://facturacion.apisperu.com/demo/doc.cdr'
                }
            };
        }

        if (!token || token === 'TU_TOKEN_AQUI') {
            throw new Error('Token de APISPERU invalido o no configurado.');
        }

        return callApisperu({
            token,
            method: 'POST',
            path: '/invoice/send',
            body: payload
        });
    },
    getInvoiceStatus: async ({ token, tipoComprobante, serie, correlativo, entorno }) => {
        if (isDemoMode({ entorno, token })) {
            return {
                estadoCpe: 'aceptado',
                links: {
                    xml: 'https://facturacion.apisperu.com/demo/doc.xml',
                    pdf: 'https://facturacion.apisperu.com/demo/doc.pdf'
                }
            };
        }

        if (!token || token === 'TU_TOKEN_AQUI') {
            throw new Error('Token de APISPERU invalido o no configurado.');
        }

        return callApisperu({
            token,
            method: 'GET',
            path: `/invoice/status/${tipoComprobante}/${serie}/${correlativo}`
        });
    }
});
