import dotenv from 'dotenv';
import pg from 'pg';
import { mapDraftToApisperuPayload } from '../src/infrastructure/apisperu/mappers/toProvider.js';

dotenv.config();

const APISPERU_BASE = process.env.APISPERU_BASE_URL || 'https://facturacion.apisperu.com/api/v1';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const send = async (token, payload, label) => {
    const res = await fetch(`${APISPERU_BASE}/invoice/send`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const text = await res.text();
    let body;
    try {
        body = JSON.parse(text);
    } catch {
        body = { raw: text.slice(0, 400) };
    }
    const safe = {
        label,
        http: res.status,
        success: body?.sunatResponse?.success,
        cdr: body?.sunatResponse?.cdrResponse
            ? {
                id: body.sunatResponse.cdrResponse.id,
                code: body.sunatResponse.cdrResponse.code,
                description: body.sunatResponse.cdrResponse.description
            }
            : undefined,
        error: body?.error || body?.message || (body?.sunatResponse ? undefined : body)
    };
    console.log(JSON.stringify(safe, null, 2));
    return body;
};

try {
    const { rows } = await pool.query(`
        SELECT ruc, razon_social, nombre_comercial, direccion_fiscal, ubigeo, token_apisperu, entorno
        FROM nl_empresas WHERE id = 1
    `);
    const e = rows[0];
    if (!e?.token_apisperu) throw new Error('Token vacio');

    const correlativo = String(process.argv[2] || '22');
    console.log(JSON.stringify({
        entorno: e.entorno,
        ruc: e.ruc,
        ubigeo: e.ubigeo,
        token_len: e.token_apisperu.length,
        correlativo
    }));

    const swaggerLike = {
        ublVersion: '2.1',
        tipoOperacion: '0101',
        tipoDoc: '03',
        serie: 'B001',
        correlativo,
        fechaEmision: '2026-07-23T00:00:00-05:00',
        formaPago: { moneda: 'PEN', tipo: 'Contado' },
        tipoMoneda: 'PEN',
        client: {
            tipoDoc: '1',
            numDoc: 77348864,
            rznSocial: 'Brandon Santander Yanqui',
            address: {
                direccion: 'Arequipa',
                provincia: 'AREQUIPA',
                departamento: 'AREQUIPA',
                distrito: 'AREQUIPA',
                ubigueo: '040101'
            }
        },
        company: {
            ruc: Number(e.ruc),
            razonSocial: e.razon_social,
            nombreComercial: e.nombre_comercial || 'AFINIX',
            address: {
                direccion: e.direccion_fiscal,
                provincia: 'AREQUIPA',
                departamento: 'AREQUIPA',
                distrito: 'MARIANO MELGAR',
                ubigueo: e.ubigeo || '040126'
            }
        },
        mtoOperGravadas: 100,
        mtoIGV: 18,
        valorVenta: 100,
        totalImpuestos: 18,
        subTotal: 118,
        mtoImpVenta: 118,
        details: [{
            codProducto: 'P001',
            unidad: 'NIU',
            descripcion: 'PRODUCTO PRUEBA AFINIX NEWLAB TOKEN',
            cantidad: 2,
            mtoValorUnitario: 50,
            mtoValorVenta: 100,
            mtoBaseIgv: 100,
            porcentajeIgv: 18,
            igv: 18,
            tipAfeIgv: 10,
            totalImpuestos: 18,
            mtoPrecioUnitario: 59
        }],
        legends: [{ code: '1000', value: 'SON CIENTO DIECIOCHO CON 00/100 SOLES' }]
    };

    await send(e.token_apisperu, swaggerLike, 'swagger_like_with_db_token');

    const newlabLike = mapDraftToApisperuPayload({
        draft: {
            serie: 'B001',
            correlativo,
            issueDateIso: '2026-07-23T05:00:00.000Z',
            lines: [{
                sku: 'P001',
                description: 'PRODUCTO PRUEBA AFINIX MAPPER',
                qty: 2,
                unitPrice: { amount: 50 },
                taxRate: 0.18
            }],
            subtotal: { amount: 100 },
            igv: { amount: 18 },
            total: { amount: 118, currency: 'PEN' }
        },
        snapshot: {
            customerDocument: '77348864',
            customerName: 'Brandon Santander Yanqui',
            customerAddress: { ubigeo: '040101', direccion: 'Arequipa' }
        },
        issuer: {
            ruc: e.ruc,
            razonSocial: e.razon_social,
            nombreComercial: e.nombre_comercial || 'AFINIX',
            direccionFiscal: e.direccion_fiscal,
            ubigeo: e.ubigeo
        },
        tipoComprobante: '03'
    });

    // Use correlativo+1 to avoid duplicate if first succeeded
    newlabLike.correlativo = String(Number(correlativo) + 1);
    console.log('newlab_payload_preview', JSON.stringify({
        fechaEmision: newlabLike.fechaEmision,
        companyRucType: typeof newlabLike.company.ruc,
        clientNumDocType: typeof newlabLike.client.numDoc,
        unidad: newlabLike.details[0].unidad,
        companyAddress: newlabLike.company.address,
        correlativo: newlabLike.correlativo
    }, null, 2));

    await send(e.token_apisperu, newlabLike, 'newlab_mapper_with_db_token');
} catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
