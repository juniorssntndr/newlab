export const draftFixture = {
    orderId: '100',
    serie: 'F001',
    correlativo: '123',
    issueDateIso: '2026-03-20T12:00:00.000Z',
    subtotal: { amount: 100, currency: 'PEN' },
    igv: { amount: 18, currency: 'PEN' },
    total: { amount: 118, currency: 'PEN' },
    lines: [
        {
            sku: 'PRD-1',
            description: 'Corona zirconio',
            qty: 1,
            unitPrice: { amount: 100, currency: 'PEN' },
            taxRate: 0.18
        }
    ]
};

export const snapshotFixture = {
    orderId: '100',
    customerDocument: '20123456789',
    customerName: 'Clinica Test SAC',
    customerAddress: {
        ubigeo: '150101',
        direccion: 'Av. Test 123'
    }
};

export const issuerFixture = {
    token: 'token-test',
    entorno: 'beta',
    ruc: '20111111111',
    razonSocial: 'NEWLAB SAC',
    nombreComercial: 'NEWLAB',
    direccionFiscal: 'Av. Empresa 456',
    ubigeo: '150101'
};

export const issueProviderResponseFixture = {
    sunatResponse: {
        success: true,
        cdrResponse: {
            id: 'TICKET-123'
        }
    },
    links: {
        pdf: 'https://cdn.example.com/invoice.pdf',
        xml: 'https://cdn.example.com/invoice.xml'
    }
};

export const statusProviderResponseFixture = {
    estadoCpe: 'ACEPTADO',
    sunatTicket: 'TICKET-123',
    links: {
        pdf: 'https://cdn.example.com/invoice.pdf',
        xml: 'https://cdn.example.com/invoice.xml'
    }
};
