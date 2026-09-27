import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { apisperuIdentityAdapter } from '../infrastructure/identity/apisperuIdentityAdapter.js';
import {
    findIdentityOverride,
    upsertIdentityOverride,
    clientToOverridePayload,
} from '../infrastructure/identity/identityLocalStore.js';

const router = express.Router();

const ERROR_HTTP_STATUS = {
    DOCUMENT_NOT_FOUND: 404,
    INVALID_DOCUMENT: 400,
    QUOTA_OR_PROVIDER_ERROR: 503,
    TOKEN_MISSING: 500,
};

const FRIENDLY_NOT_FOUND = {
    dni: 'Datos no encontrados en RENIEC. Puedes completar el nombre manualmente; se guardará en el laboratorio para próximas consultas.',
    ruc: 'Datos no encontrados en SUNAT. Puedes completar la razón social manualmente; se guardará en el laboratorio para próximas consultas.',
};

function errorResponse(err, kind = 'dni') {
    const code = err.code || 'QUOTA_OR_PROVIDER_ERROR';
    const status = ERROR_HTTP_STATUS[code] || 500;
    const message = code === 'DOCUMENT_NOT_FOUND'
        ? (FRIENDLY_NOT_FOUND[kind] || FRIENDLY_NOT_FOUND.dni)
        : err.message;
    return { status, body: { error: message, code } };
}

async function lookupWithLocalFallback(pool, kind, numero) {
    const documentType = kind === 'ruc' ? '6' : '1';
    const local = await findIdentityOverride(pool, documentType, numero);
    if (local) return local;

    try {
        return kind === 'ruc'
            ? await apisperuIdentityAdapter.lookupRuc(numero)
            : await apisperuIdentityAdapter.lookupDni(numero);
    } catch (err) {
        if (err.code === 'DOCUMENT_NOT_FOUND') {
            // Re-check local in case another request saved it concurrently
            const again = await findIdentityOverride(pool, documentType, numero);
            if (again) return again;
        }
        throw err;
    }
}

router.get('/dni/:numero', authenticateToken, requireRole('admin', 'operador', 'tecnico'), async (req, res) => {
    try {
        const data = await lookupWithLocalFallback(req.app.locals.pool, 'dni', req.params.numero);
        res.json(data);
    } catch (err) {
        const { status, body } = errorResponse(err, 'dni');
        res.status(status).json(body);
    }
});

router.get('/ruc/:numero', authenticateToken, requireRole('admin', 'operador', 'tecnico'), async (req, res) => {
    try {
        const data = await lookupWithLocalFallback(req.app.locals.pool, 'ruc', req.params.numero);
        res.json(data);
    } catch (err) {
        const { status, body } = errorResponse(err, 'ruc');
        res.status(status).json(body);
    }
});

/**
 * POST /api/consultas/identidad
 * Guarda/actualiza un DNI o RUC en el registro local del laboratorio.
 * Body: { tipoDoc: '1'|'6', numDoc, rznSocial, direccion?, ubigeo?, notInReniec? }
 */
router.post('/identidad', authenticateToken, requireRole('admin', 'operador', 'tecnico'), async (req, res) => {
    try {
        const payload = clientToOverridePayload(req.body || {}, {
            notInReniec: req.body?.notInReniec !== false,
            source: req.body?.source || 'manual',
            createdBy: req.user?.id || null,
        });
        const saved = await upsertIdentityOverride(req.app.locals.pool, payload);
        if (!saved) {
            return res.status(400).json({
                error: 'Documento y nombre son obligatorios (DNI 8 dígitos o RUC 11).',
                code: 'INVALID_DOCUMENT',
            });
        }
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message || 'No se pudo guardar la identidad local' });
    }
});

/**
 * GET /api/consultas/catalogo-landing
 * Endpoint público para el carrusel de servicios de la landing page.
 */
router.get('/catalogo-landing', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const query = `
            SELECT 
                p.id,
                COALESCE(NULLIF(p.nombre_comercial, ''), p.nombre) AS name,
                p.nombre AS technical_name,
                COALESCE(NULLIF(p.descripcion_landing, ''), p.descripcion) AS detail,
                COALESCE(NULLIF(p.material_comercial, ''), m.nombre, p.material_default, 'Material dental certificado') AS material,
                p.tiempo_estimado_dias,
                CASE 
                    WHEN p.tiempo_estimado_dias IS NOT NULL THEN (p.tiempo_estimado_dias * 24) || ' horas'
                    ELSE '48 horas'
                END AS "leadTime",
                p.image_url AS image,
                p.orden_landing
            FROM nl_productos p
            LEFT JOIN nl_materiales m ON m.id = p.material_id
            WHERE p.destacado_landing = true AND p.activo = true
            ORDER BY p.orden_landing ASC, p.id ASC
        `;
        const { rows } = await pool.query(query);
        res.json({ ok: true, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'Error al obtener catálogo de la landing' });
    }
});

export default router;
