import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const APISPERU_BASE = process.env.APISPERU_BASE_URL || 'https://facturacion.apisperu.com/api/v1';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const checkStatus = async (token, url) => {
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    const text = await res.text();
    let body;
    try {
        body = JSON.parse(text);
    } catch {
        body = { raw: text.slice(0, 500) };
    }
    return { http: res.status, body };
};

try {
    const { rows } = await pool.query(
        'SELECT token_apisperu, entorno, ruc FROM nl_empresas WHERE id = 1'
    );
    const token = rows[0]?.token_apisperu;
    const ruc = rows[0]?.ruc;
    if (!token) throw new Error('Token de empresa vacio');

    console.log(JSON.stringify({
        entorno: rows[0].entorno,
        ruc,
        mock: process.env.APISPERU_MOCK || 'unset'
    }));

    const tipo = '03';
    const serie = 'B001';
    const correlativo = '3';

    const variants = [
        {
            label: 'path_style',
            url: `${APISPERU_BASE}/invoice/status/${tipo}/${serie}/${correlativo}`
        },
        {
            label: 'query_style',
            url: `${APISPERU_BASE}/invoice/status?tipo=${tipo}&serie=${serie}&numero=${correlativo}`
        },
        {
            label: 'query_style_with_ruc',
            url: `${APISPERU_BASE}/invoice/status?tipo=${tipo}&serie=${serie}&numero=${correlativo}&ruc=${encodeURIComponent(ruc)}`
        }
    ];

    for (const variant of variants) {
        const result = await checkStatus(token, variant.url);
        console.log(JSON.stringify({
            variant: variant.label,
            documento: `${serie}-${correlativo}`,
            http: result.http,
            body: result.body
        }));
    }
} catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
