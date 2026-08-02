import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = process.env.API_BASE || 'http://localhost:3001';

try {
    const { rows } = await pool.query(`
        SELECT id, pedido_id, serie, correlativo, estado_sunat, idempotency_key, tipo_comprobante,
               receptor_documento, receptor_razon_social
        FROM nl_comprobantes
        WHERE id = $1
    `, [Number(process.argv[2] || 4)]);

    const comp = rows[0];
    if (!comp) throw new Error('Comprobante no encontrado');
    console.log(JSON.stringify({
        id: comp.id,
        pedido_id: comp.pedido_id,
        doc: `${comp.serie}-${comp.correlativo}`,
        estado_sunat: comp.estado_sunat,
        has_idempotency: Boolean(comp.idempotency_key)
    }, null, 2));

    if (comp.estado_sunat !== 'error' && comp.estado_sunat !== 'generado') {
        throw new Error(`Estado ${comp.estado_sunat} no es reintentable por esta via`);
    }

    const login = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@newlab.pe', password: 'admin123' })
    }).then((r) => r.json());

    const token = login.token || login.accessToken || login.data?.token;
    if (!token) throw new Error('Login falló');

    const body = {
        tipoComprobante: comp.tipo_comprobante || '03',
        idempotencyKey: comp.idempotency_key,
        billingData: {
            client: {
                tipoDoc: String(comp.receptor_documento || '').length === 11 ? '6' : '1',
                numDoc: comp.receptor_documento,
                rznSocial: comp.receptor_razon_social
            }
        }
    };

    const res = await fetch(`${base}/api/facturacion/${comp.pedido_id}/emitir`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    console.log(JSON.stringify({
        http: res.status,
        estado: data.estado_sunat || data.estado || data.status,
        serie: data.serie,
        correlativo: data.correlativo,
        error: data.error,
        code: data.code,
        cdr: data.cdr_description || data.cdrDescription
    }, null, 2));
} catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
