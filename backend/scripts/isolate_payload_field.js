import dotenv from 'dotenv';
import pg from 'pg';
import { mapDraftToApisperuPayload } from '../src/infrastructure/apisperu/mappers/toProvider.js';

dotenv.config();

const APISPERU_BASE = process.env.APISPERU_BASE_URL || 'https://facturacion.apisperu.com/api/v1';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const send = async (token, payload) => {
    const res = await fetch(`${APISPERU_BASE}/invoice/send`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    return {
        http: res.status,
        ok: Boolean(body?.sunatResponse?.success),
        cdr: body?.sunatResponse?.cdrResponse?.description,
        error: body?.error
    };
};

try {
    const { rows } = await pool.query(
        'SELECT ruc, razon_social, nombre_comercial, direccion_fiscal, ubigeo, token_apisperu FROM nl_empresas WHERE id=1'
    );
    const e = rows[0];
    let n = 30;

    const base = mapDraftToApisperuPayload({
        draft: {
            serie: 'B001',
            correlativo: String(n),
            issueDateIso: '2026-07-23T05:00:00.000Z',
            lines: [{
                sku: 'P001',
                description: 'PRUEBA AISLAR',
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

    const variants = [
        {
            name: 'A_fecha_iso',
            apply: (p) => {
                p.fechaEmision = '2026-07-23T00:00:00-05:00';
            }
        },
        {
            name: 'B_fecha_and_numbers',
            apply: (p) => {
                p.fechaEmision = '2026-07-23T00:00:00-05:00';
                p.company.ruc = Number(p.company.ruc);
                p.client.numDoc = Number(p.client.numDoc);
            }
        },
        {
            name: 'C_fecha_numbers_niu',
            apply: (p) => {
                p.fechaEmision = '2026-07-23T00:00:00-05:00';
                p.company.ruc = Number(p.company.ruc);
                p.client.numDoc = Number(p.client.numDoc);
                p.details[0].unidad = 'NIU';
            }
        },
        {
            name: 'D_fecha_numbers_niu_ubigueo_only',
            apply: (p) => {
                p.fechaEmision = '2026-07-23T00:00:00-05:00';
                p.company.ruc = Number(p.company.ruc);
                p.client.numDoc = Number(p.client.numDoc);
                p.details[0].unidad = 'NIU';
                const strip = (addr) => {
                    const { ubigeo, ...rest } = addr;
                    return rest;
                };
                p.client.address = strip(p.client.address);
                p.company.address = strip(p.company.address);
            }
        }
    ];

    for (const variant of variants) {
        n += 1;
        const payload = structuredClone(base);
        payload.correlativo = String(n);
        variant.apply(payload);
        const result = await send(e.token_apisperu, payload);
        console.log(JSON.stringify({ variant: variant.name, correlativo: n, ...result }));
        if (result.ok) break;
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
