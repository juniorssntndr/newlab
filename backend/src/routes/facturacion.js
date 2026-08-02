import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    emitirComprobanteSunat,
    anularComprobante,
    emitirNotaCredito,
    consultarEstadoSunat,
} from '../services/apisperu.js';
import {
    clientToOverridePayload,
    upsertIdentityOverride,
} from '../infrastructure/identity/identityLocalStore.js';

const defaultFacturacionDeps = {
    emitirComprobanteSunat,
    anularComprobante,
    emitirNotaCredito,
    consultarEstadoSunat
};

let facturacionDeps = { ...defaultFacturacionDeps };

export const __setFacturacionDepsForTesting = (overrides = {}) => {
    facturacionDeps = {
        ...facturacionDeps,
        ...overrides
    };
};

export const __resetFacturacionDepsForTesting = () => {
    facturacionDeps = { ...defaultFacturacionDeps };
};

const router = Router();
router.use(authenticateToken);

const IGV_DEFAULT_RATE = 0.18;

const normalizeString = (value) => String(value ?? '').trim();
const normalizeDoc = (value) => normalizeString(value).replace(/\D/g, '');
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const inferTaxRate = (detail) => {
    const explicitRate = Number(detail?.taxRate);
    if (Number.isFinite(explicitRate) && explicitRate >= 0) {
        return explicitRate;
    }

    const percentage = Number(detail?.porcentajeIgv);
    if (Number.isFinite(percentage) && percentage >= 0) {
        return percentage > 1 ? percentage / 100 : percentage;
    }

    return IGV_DEFAULT_RATE;
};

const mapBillingDetailsToLines = (details = []) => details
    .map((detail, index) => {
        const qty = Number(detail?.qty ?? detail?.cantidad ?? 0);
        const unitPrice = Number(detail?.unitPrice?.amount ?? detail?.mtoValorUnitario ?? 0);

        return {
            sku: normalizeString(detail?.sku || detail?.codProducto || `ITEM-${index + 1}`),
            description: normalizeString(detail?.description || detail?.descripcion || 'Servicio dental'),
            qty,
            unitPrice: {
                amount: roundMoney(unitPrice),
                currency: normalizeString(detail?.unitPrice?.currency || 'PEN') || 'PEN'
            },
            taxRate: inferTaxRate(detail)
        };
    })
    .filter((line) => line.qty > 0 && line.unitPrice.amount >= 0 && line.description.length > 0);

const computeTotalFromLines = (lines = []) => roundMoney(lines.reduce((sum, line) => {
    const net = (Number(line.unitPrice?.amount) || 0) * (Number(line.qty) || 0);
    return sum + net + (net * (Number(line.taxRate) || 0));
}, 0));

const buildSnapshotOverride = ({ baseSnapshot, billingData, tipoComprobante }) => {
    if (!billingData) {
        return baseSnapshot;
    }

    const client = billingData?.client || {};
    const mappedLines = mapBillingDetailsToLines(billingData?.details || []);
    const lines = mappedLines.length > 0 ? mappedLines : baseSnapshot.lines;
    const fallbackTotal = computeTotalFromLines(lines);
    const requestedTotal = Number(billingData?.mtoImpVenta);
    const totalAmount = Number.isFinite(requestedTotal) && requestedTotal > 0
        ? roundMoney(requestedTotal)
        : fallbackTotal;

    const customerDocument = normalizeDoc(client?.numDoc) || baseSnapshot.customerDocument;
    if (tipoComprobante === '01' && customerDocument.length !== 11) {
        const error = new Error('Para emitir Factura, el receptor debe tener un RUC de 11 dígitos.');
        error.status = 400;
        throw error;
    }

    return {
        ...baseSnapshot,
        customerDocument,
        customerName: normalizeString(client?.rznSocial) || baseSnapshot.customerName,
        customerAddress: {
            ubigeo: normalizeString(client?.address?.ubigeo) || baseSnapshot?.customerAddress?.ubigeo,
            direccion: normalizeString(client?.address?.direccion) || baseSnapshot?.customerAddress?.direccion
        },
        lines,
        total: {
            amount: totalAmount,
            currency: baseSnapshot?.total?.currency || 'PEN'
        }
    };
};

const getBillingModule = (req) => req.app.locals?.modules?.billing;
const isLegacyBillingMode = (req) => getBillingModule(req)?.billingAclMode !== 'new-acl';

// ─── Helper: Admin/Tecnico only ───────────────────────────────────────────────
function requireTecnico(req, res) {
    if (req.user.tipo !== 'admin' && req.user.tipo !== 'tecnico') {
        res.status(403).json({ error: 'No tienes permisos para esta operación de facturación.' });
        return false;
    }
    return true;
}

// ─── Guard: validate clinica access for clients ───────────────────────────────
async function guardClinicaAccess(pool, pedidoId, user, res) {
    if (user.tipo === 'cliente') {
        const { rows } = await pool.query('SELECT clinica_id FROM nl_pedidos WHERE id = $1', [pedidoId]);
        if (rows.length === 0 || Number(rows[0].clinica_id) !== Number(user.clinica_id)) {
            res.status(403).json({ error: 'Acceso denegado a este pedido.' });
            return false;
        }
    }
    return true;
}

// ─── POST /:pedidoId/emitir ───────────────────────────────────────────────────
router.post('/:pedidoId/emitir', async (req, res, next) => {
    try {
        if (!requireTecnico(req, res)) return;
        const { tipoComprobante, billingData } = req.body;
        if (!['01', '03'].includes(tipoComprobante)) {
            return res.status(400).json({ error: 'Tipo de comprobante inválido. Use 01 (Factura) o 03 (Boleta).' });
        }
        const pool = req.app.locals.pool;
        const existing = await pool.query(
            "SELECT id, estado_sunat, idempotency_key FROM nl_comprobantes WHERE pedido_id = $1 AND estado_sunat != 'anulado' ORDER BY created_at DESC LIMIT 1",
            [req.params.pedidoId]
        );
        if (existing.rows.length > 0) {
            const current = existing.rows[0];
            const sameRetry = req.body?.idempotencyKey
                && current.idempotency_key === req.body.idempotencyKey
                && ['generado', 'error'].includes(current.estado_sunat);
            if (!sameRetry) {
                return res.status(409).json({ error: 'El pedido ya tiene un comprobante activo emitido.' });
            }
        }

        let comprobante;
        if (isLegacyBillingMode(req)) {
            comprobante = await facturacionDeps.emitirComprobanteSunat(pool, req.params.pedidoId, tipoComprobante, billingData);
        } else {
            const billingModule = getBillingModule(req);
            if (!billingModule?.billingController || !billingModule?.billingRepository) {
                const error = new Error('Modulo de facturacion no disponible');
                error.status = 503;
                throw error;
            }

            const baseSnapshot = await billingModule.billingRepository.getOrderSnapshot(req.params.pedidoId);
            if (!baseSnapshot) {
                return res.status(404).json({ error: 'Pedido no encontrado.' });
            }

            const snapshot = buildSnapshotOverride({
                baseSnapshot,
                billingData,
                tipoComprobante
            });

            const result = await billingModule.billingController.createInvoice.execute(
                {
                    requestId: req.requestId,
                    actorId: String(req.user?.id || req.user?.email || 'unknown')
                },
                {
                    params: { pedidoId: req.params.pedidoId },
                    body: {
                        snapshot,
                        tipoComprobante,
                        idempotencyKey: req.body?.idempotencyKey
                    }
                }
            );

            if (!result.ok) {
                return res.status(result.status).json({
                    error: result.errorMessage,
                    code: result.errorCode,
                    cdr_code: result.errorCode,
                    cdr_description: result.errorMessage,
                    details: result.details,
                    requestId: req.requestId || null
                });
            }

            if (result.data.invoiceStatus === 'REJECTED') {
                return res.status(422).json({
                    error: result.data.cdrDescription || 'SUNAT rechazó el comprobante.',
                    code: result.data.cdrCode || 'SUNAT_REJECTED',
                    cdr_code: result.data.cdrCode || null,
                    cdr_description: result.data.cdrDescription || null,
                    invoiceId: result.data.invoiceId,
                    requestId: req.requestId || null
                });
            }

            const persisted = await pool.query('SELECT * FROM nl_comprobantes WHERE id = $1 LIMIT 1', [result.data.invoiceId]);
            comprobante = persisted.rows[0] || result.data;
        }

        // Persistir receptor local solo si no constaba en RENIEC/SUNAT
        try {
            const client = billingData?.client;
            if (client?.numDoc && client?.rznSocial && client?.notInReniec) {
                await upsertIdentityOverride(pool, clientToOverridePayload(client, {
                    notInReniec: true,
                    source: 'billing',
                    createdBy: req.user?.id || null,
                }));
            }
        } catch (persistErr) {
            console.warn('[facturacion] identity override persist skipped:', persistErr.message);
        }

        res.json(comprobante);
    } catch (err) {
        console.error('[facturacion] emitir error:', err.message);
        next(err);
    }
});

// ─── POST /:comprobanteId/anular ──────────────────────────────────────────────
router.post('/:comprobanteId/anular', async (req, res, next) => {
    try {
        if (!requireTecnico(req, res)) return;
        const { motivo } = req.body;
        if (!motivo || motivo.trim().length < 5) {
            return res.status(400).json({ error: 'El motivo de anulación es obligatorio (mín. 5 caracteres).' });
        }
        const pool = req.app.locals.pool;
        if (!isLegacyBillingMode(req)) {
            const result = await getBillingModule(req).billingPhase2Service.requestVoiding(req.params.comprobanteId, {
                motivo: motivo.trim(), idempotencyKey: req.body.idempotencyKey
            });
            return res.status(202).json({ ok: true, baja: result });
        }
        const result = await facturacionDeps.anularComprobante(pool, req.params.comprobanteId, motivo.trim());
        res.json({ ok: true, comprobante: result });
    } catch (err) {
        console.error('[facturacion] anular error:', err.message);
        next(err);
    }
});

// ─── POST /:comprobanteId/nota-credito ────────────────────────────────────────
router.post('/:comprobanteId/nota-credito', async (req, res, next) => {
    try {
        if (!requireTecnico(req, res)) return;
        const { motivo, monto, detalles } = req.body;
        if (!motivo || motivo.trim().length < 5) {
            return res.status(400).json({ error: 'El motivo de la nota de crédito es obligatorio (mín. 5 caracteres).' });
        }
        if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
            return res.status(400).json({ error: 'El monto de la nota de crédito debe ser mayor a 0.' });
        }
        const pool = req.app.locals.pool;
        if (!isLegacyBillingMode(req)) {
            const result = await getBillingModule(req).billingPhase2Service.createCreditNote(req.params.comprobanteId, {
                motivo: motivo.trim(), monto, detalles, codMotivo: req.body.codMotivo,
                idempotencyKey: req.body.idempotencyKey
            });
            return res.status(result.status === 'aceptado' ? 201 : 422).json({ ok: result.status === 'aceptado', notaCredito: result });
        }
        const result = await facturacionDeps.emitirNotaCredito(pool, req.params.comprobanteId, { motivo: motivo.trim(), monto, detalles });
        res.json({ ok: true, notaCredito: result });
    } catch (err) {
        console.error('[facturacion] nota-credito error:', err.message);
        next(err);
    }
});

router.get('/bajas/:bajaId/status', async (req, res, next) => {
    try {
        if (!requireTecnico(req, res)) return;
        const service = getBillingModule(req)?.billingPhase2Service;
        if (!service) return res.status(503).json({ error: 'Módulo de facturación no disponible.' });
        res.json(await service.syncVoidingStatus(req.params.bajaId));
    } catch (error) {
        next(error);
    }
});

router.post('/resumenes-diarios', async (req, res, next) => {
    try {
        if (!requireTecnico(req, res)) return;
        const service = getBillingModule(req)?.billingPhase2Service;
        if (!service) return res.status(503).json({ error: 'Módulo de facturación no disponible.' });
        const result = await service.createDailySummary(req.body || {});
        res.status(202).json(result);
    } catch (error) {
        next(error);
    }
});

router.get('/resumenes-diarios/:resumenId/status', async (req, res, next) => {
    try {
        if (!requireTecnico(req, res)) return;
        const service = getBillingModule(req)?.billingPhase2Service;
        if (!service) return res.status(503).json({ error: 'Módulo de facturación no disponible.' });
        res.json(await service.syncSummaryStatus(req.params.resumenId));
    } catch (error) {
        next(error);
    }
});

// ─── GET /comprobantes/:id/print ─────────────────────────────────────────────
router.get('/comprobantes/:id/print', async (req, res, next) => {
    try {
        if (!requireTecnico(req, res)) return;
        const pool = req.app.locals.pool;
        const { id } = req.params;

        const { rows } = await pool.query(`
            SELECT
                c.id, c.tipo_comprobante, c.serie, c.correlativo, c.fecha_emision,
                c.total_gravada, c.total_igv, c.total_venta,
                c.estado_sunat, c.hash_cpe, c.cdr_code, c.cdr_description,
                c.pdf_url, c.xml_url, c.cdr_url,
                c.receptor_tipo_doc, c.receptor_documento, c.receptor_razon_social,
                c.receptor_direccion, c.receptor_ubigeo,
                c.pedido_id,
                p.id AS p_id, p.paciente_nombre,
                p.clinica_id,
                cl.ruc AS cl_ruc, cl.dni AS cl_dni,
                cl.razon_social AS cl_razon_social,
                cl.direccion AS cl_direccion,
                e.ruc AS e_ruc, e.razon_social AS e_razon_social,
                e.nombre_comercial AS e_nombre_comercial,
                e.direccion_fiscal AS e_direccion_fiscal,
                e.ubigeo AS e_ubigeo,
                e.entorno AS e_entorno
            FROM nl_comprobantes c
            JOIN nl_pedidos p ON p.id = c.pedido_id
            LEFT JOIN nl_clinicas cl ON cl.id = p.clinica_id
            LEFT JOIN nl_empresas e ON e.activo = true
            WHERE c.id = $1
            LIMIT 1
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Comprobante no encontrado.' });
        }

        const row = rows[0];

        const receptor_documento = row.receptor_documento || row.cl_ruc || row.cl_dni || '';
        const receptor_razon_social = row.receptor_razon_social || row.cl_razon_social || '';
        const receptor_direccion = row.receptor_direccion || row.cl_direccion || '';
        const receptor_tipo_doc = row.receptor_tipo_doc || (receptor_documento.length === 11 ? '6' : '1');

        const { rows: itemRows } = await pool.query(`
            SELECT
                COALESCE(NULLIF(TRIM(pi.material), ''), pr.nombre, 'Servicio dental') AS descripcion,
                pi.cantidad,
                pi.precio_unitario,
                pi.subtotal
            FROM nl_pedido_items pi
            LEFT JOIN nl_productos pr ON pr.id = pi.producto_id
            WHERE pi.pedido_id = $1
            ORDER BY pi.id
        `, [row.pedido_id]);

        const isDemoUrl = (url) => {
            if (!url) return false;
            return url.includes('/demo/') || url.includes('demo.apisperu') || url.includes('apisperu.com/demo');
        };

        const isDemoAsset = isDemoUrl(row.pdf_url) || isDemoUrl(row.xml_url) || isDemoUrl(row.cdr_url);

        res.json({
            comprobante: {
                id: row.id,
                tipo_comprobante: row.tipo_comprobante,
                serie: row.serie,
                correlativo: row.correlativo,
                fecha_emision: row.fecha_emision,
                total_gravada: row.total_gravada,
                total_igv: row.total_igv,
                total_venta: row.total_venta,
                estado_sunat: row.estado_sunat,
                hash_cpe: row.hash_cpe,
                cdr_code: row.cdr_code,
                cdr_description: row.cdr_description,
                pdf_url: row.pdf_url,
                xml_url: row.xml_url,
                cdr_url: row.cdr_url,
                receptor_tipo_doc,
                receptor_documento,
                receptor_razon_social,
                receptor_direccion,
                receptor_ubigeo: row.receptor_ubigeo || '',
            },
            emisor: {
                ruc: row.e_ruc || '',
                razon_social: row.e_razon_social || 'NEWLAB',
                nombre_comercial: row.e_nombre_comercial || 'NewLab Dental',
                direccion_fiscal: row.e_direccion_fiscal || '',
                ubigeo: row.e_ubigeo || '',
                entorno: row.e_entorno || 'demo',
            },
            pedido: {
                id: row.p_id,
                paciente_nombre: row.paciente_nombre,
            },
            lineas: itemRows.map(item => ({
                descripcion: item.descripcion,
                cantidad: Number(item.cantidad),
                precio_unitario: Number(item.precio_unitario),
                subtotal: Number(item.subtotal),
            })),
            assets: {
                pdfIsExternal: !!row.pdf_url,
                xmlIsExternal: !!row.xml_url,
                cdrIsExternal: !!row.cdr_url,
                isDemoAsset,
            },
        });
    } catch (err) {
        console.error('[facturacion] print error:', err.message);
        next(err);
    }
});

// ─── GET /:comprobanteId/status ───────────────────────────────────────────────
router.get('/:comprobanteId/status', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        let result;

        if (isLegacyBillingMode(req)) {
            result = await facturacionDeps.consultarEstadoSunat(pool, req.params.comprobanteId);
        } else {
            const billingModule = getBillingModule(req);
            if (!billingModule?.billingController) {
                const error = new Error('Modulo de facturacion no disponible');
                error.status = 503;
                throw error;
            }

            const syncResult = await billingModule.billingController.syncInvoiceStatus.execute(
                {
                    requestId: req.requestId,
                    actorId: String(req.user?.id || req.user?.email || 'unknown')
                },
                {
                    params: { comprobanteId: req.params.comprobanteId }
                }
            );

            if (!syncResult.ok) {
                return res.status(syncResult.status).json({ error: syncResult.errorMessage, code: syncResult.errorCode });
            }

            result = {
                comprobanteId: req.params.comprobanteId,
                invoiceStatus: syncResult.data.invoiceStatus,
                sunatTicket: syncResult.data.sunatTicket,
                pdfUrl: syncResult.data.pdfUrl,
                xmlUrl: syncResult.data.xmlUrl
            };
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─── GET /:pedidoId — Comprobantes de un pedido ───────────────────────────────
router.get('/:pedidoId', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        if (!(await guardClinicaAccess(pool, req.params.pedidoId, req.user, res))) return;

        const { rows } = await pool.query(`
            SELECT c.*,
                   json_agg(nc.*) FILTER (WHERE nc.id IS NOT NULL) AS notas_credito
            FROM nl_comprobantes c
            LEFT JOIN nl_notas_credito nc ON nc.comprobante_id = c.id
            WHERE c.pedido_id = $1
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, [req.params.pedidoId]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// ─── GET / — Historial global paginado con filtros ────────────────────────────
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const {
            page = 1,
            limit = 20,
            tipo,
            estado,
            clinica_id,
            desde,
            hasta,
            q, // search by serie-correlativo or paciente
        } = req.query;

        const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
        const params = [];
        const conditions = [];

        if (req.user.tipo === 'cliente') {
            params.push(req.user.clinica_id);
            conditions.push(`p.clinica_id = $${params.length}`);
        } else if (clinica_id) {
            params.push(clinica_id);
            conditions.push(`p.clinica_id = $${params.length}`);
        }

        if (tipo) {
            params.push(tipo);
            conditions.push(`c.tipo_comprobante = $${params.length}`);
        }
        if (estado) {
            params.push(estado);
            conditions.push(`c.estado_sunat = $${params.length}`);
        }
        if (desde) {
            params.push(desde);
            conditions.push(`c.fecha_emision >= $${params.length}`);
        }
        if (hasta) {
            params.push(hasta);
            conditions.push(`c.fecha_emision <= $${params.length}`);
        }
        if (q) {
            params.push(`%${q}%`);
            conditions.push(`(p.paciente_nombre ILIKE $${params.length} OR CONCAT(c.serie,'-',c.correlativo) ILIKE $${params.length})`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countRes = await pool.query(`
            SELECT COUNT(*) FROM nl_comprobantes c
            JOIN nl_pedidos p ON c.pedido_id = p.id
            LEFT JOIN nl_clinicas cl ON p.clinica_id = cl.id
            ${where}
        `, params);

        params.push(Math.min(100, parseInt(limit)));
        params.push(offset);

        const { rows } = await pool.query(`
            SELECT c.*,
                   p.codigo AS pedido_codigo,
                   p.paciente_nombre,
                   cl.nombre AS clinica_nombre,
                   (SELECT COUNT(*) FROM nl_notas_credito WHERE comprobante_id = c.id) AS notas_credito_count
            FROM nl_comprobantes c
            JOIN nl_pedidos p ON c.pedido_id = p.id
            LEFT JOIN nl_clinicas cl ON p.clinica_id = cl.id
            ${where}
            ORDER BY c.fecha_emision DESC, c.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        res.json({
            data: rows,
            total: parseInt(countRes.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit)),
        });
    } catch (err) {
        next(err);
    }
});

export default router;
