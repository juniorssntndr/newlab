const APISPERU_BASE = process.env.APISPERU_BASE_URL || 'https://facturacion.apisperu.com/api/v1';

const apiHeaders = (token) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
});

const isDemoMode = () => String(process.env.APISPERU_MOCK || '').toLowerCase() === 'true';

const parseJsonSafely = async (response) => {
    try {
        return await response.json();
    } catch (_error) {
        return { message: 'Respuesta no JSON de APISPERU' };
    }
};

const callApisperu = async ({ token, method, path, body }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.APISPERU_TIMEOUT_MS || 20000));
    let response;
    try {
        response = await fetch(`${APISPERU_BASE}${path}`, {
            method,
            headers: apiHeaders(token),
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('APISPERU no respondio dentro del tiempo esperado');
        }
        throw new Error('No se pudo conectar con APISPERU');
    } finally {
        clearTimeout(timeout);
    }

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
    getInvoiceStatus: async ({ token, tipoComprobante, serie, correlativo, ruc, entorno }) => {
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

        const params = new URLSearchParams({
            tipo: String(tipoComprobante),
            serie: String(serie),
            numero: String(correlativo)
        });
        if (ruc) params.set('ruc', String(ruc));

        return callApisperu({
            token,
            method: 'GET',
            path: `/invoice/status?${params.toString()}`
        });
    },
    sendCreditNote: ({ token, payload }) => isDemoMode()
        ? { hash: 'DEMO-NOTE-HASH', sunatResponse: { success: true, cdrResponse: { accepted: true, code: '0', description: 'Aceptado (DEMO)' } } }
        : callApisperu({ token, method: 'POST', path: '/note/send', body: payload }),
    sendVoided: ({ token, payload }) => isDemoMode()
        ? { hash: 'DEMO-VOIDED-HASH', sunatResponse: { success: true, ticket: `DEMO-VOIDED-${Date.now()}` } }
        : callApisperu({ token, method: 'POST', path: '/voided/send', body: payload }),
    getVoidedStatus: ({ token, ticket, ruc }) => isDemoMode()
        ? { success: true, cdrResponse: { accepted: true, code: '0', description: 'Baja aceptada (DEMO)' } }
        : callApisperu({
        token,
        method: 'GET',
        path: `/voided/status?ticket=${encodeURIComponent(ticket)}&ruc=${encodeURIComponent(ruc)}`
    }),
    sendSummary: ({ token, payload }) => isDemoMode()
        ? { hash: 'DEMO-SUMMARY-HASH', sunatResponse: { success: true, ticket: `DEMO-SUMMARY-${Date.now()}` } }
        : callApisperu({ token, method: 'POST', path: '/summary/send', body: payload }),
    getSummaryStatus: ({ token, ticket, ruc }) => isDemoMode()
        ? { success: true, cdrResponse: { accepted: true, code: '0', description: 'Resumen aceptado (DEMO)' } }
        : callApisperu({
        token,
        method: 'GET',
        path: `/summary/status?ticket=${encodeURIComponent(ticket)}&ruc=${encodeURIComponent(ruc)}`
    })
});
