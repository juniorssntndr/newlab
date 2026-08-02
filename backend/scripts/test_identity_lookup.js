/**
 * Prueba rápida DNI/RUC contra dniruc.apisperu.com (sin filtrar secretos en stdout).
 * Uso: node scripts/test_identity_lookup.js [dni|ruc] [numero]
 */
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const type = (process.argv[2] || 'dni').toLowerCase();
const numero = process.argv[3] || (type === 'ruc' ? '20100070970' : '77348864');
const token = process.env.EXTERNAL_API_TOKEN;

if (!token || token.startsWith('tu_token')) {
    console.error('EXTERNAL_API_TOKEN ausente o placeholder');
    process.exit(1);
}

const url = `https://dniruc.apisperu.com/api/v1/${type}/${numero}?token=${token}`;

try {
    const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
    const data = res.data;
    const safe = typeof data === 'object' && data
        ? {
            success: data.success,
            message: data.message,
            keys: Object.keys(data),
            dni: data.dni || data.numeroDocumento || null,
            ruc: data.ruc || null,
            nombres: data.nombres || data.nombre || null,
            apellidoPaterno: data.apellidoPaterno || data.apPaterno || null,
            apellidoMaterno: data.apellidoMaterno || data.apMaterno || null,
            nombreCompleto: data.nombreCompleto || null,
            razonSocial: data.razonSocial || null,
            estado: data.estado || null,
            condicion: data.condicion || null,
        }
        : { rawType: typeof data, preview: String(data).slice(0, 200) };

    console.log(JSON.stringify({
        http: res.status,
        type,
        numero,
        tokenLen: token.length,
        body: safe
    }, null, 2));
} catch (err) {
    console.error(JSON.stringify({
        error: err.message,
        code: err.code,
        status: err.response?.status,
        body: err.response?.data
    }, null, 2));
    process.exit(1);
}
