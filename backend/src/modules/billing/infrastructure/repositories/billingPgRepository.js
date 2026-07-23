import { InvoiceStatus, OrderStatus, PaymentStatus } from '@newlab/contracts';

const IGV_RATE = 0.18;

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizeDoc = (doc) => String(doc || '').replace(/\D/g, '');

const mapOrderStatus = (rawStatus) => {
    const status = String(rawStatus || '').toLowerCase();
    if (status === 'cancelado') return OrderStatus.CANCELLED;
    if (status === 'facturado' || status === 'billed') return OrderStatus.BILLED;
    if (status === 'aprobado' || status === 'en_produccion' || status === 'terminado' || status === 'enviado') {
        return OrderStatus.APPROVED;
    }

    return OrderStatus.PENDING;
};

const mapPaymentStatus = ({ total, paidAmount }) => {
    const safeTotal = Number(total) || 0;
    const safePaid = Number(paidAmount) || 0;
    if (safePaid <= 0) return PaymentStatus.UNPAID;
    if (safePaid >= safeTotal) return PaymentStatus.PAID;
    return PaymentStatus.PARTIAL;
};

const inferTipoComprobante = (serie = '') => {
    const normalizedSerie = String(serie).trim().toUpperCase();
    if (normalizedSerie.startsWith('F')) return '01';
    if (normalizedSerie.startsWith('B')) return '03';
    return '03';
};

const mapInvoiceStatusToSunatState = (invoiceStatus) => {
    switch (invoiceStatus) {
        case InvoiceStatus.SENT:
            return 'aceptado';
        case InvoiceStatus.REJECTED:
            return 'rechazado';
        case InvoiceStatus.DRAFT:
            return 'generado';
        case InvoiceStatus.GENERATED:
        default:
            return 'generado';
    }
};

const getActiveIssuer = async (db) => {
    const issuerResult = await db.query(
        `SELECT id, ruc, razon_social, nombre_comercial, direccion_fiscal, ubigeo,
                token_apisperu, entorno, serie_factura, serie_boleta
         FROM nl_empresas
         WHERE activo = TRUE
         ORDER BY id ASC
         LIMIT 1`
    );

    if (issuerResult.rows.length === 0) {
        throw new Error('No hay empresa emisora activa configurada para facturacion.');
    }

    const issuer = issuerResult.rows[0];
    return {
        id: issuer.id,
        ruc: issuer.ruc,
        razonSocial: issuer.razon_social,
        nombreComercial: issuer.nombre_comercial || issuer.razon_social,
        direccionFiscal: issuer.direccion_fiscal,
        ubigeo: issuer.ubigeo,
        token: issuer.token_apisperu,
        entorno: issuer.entorno,
        serieFactura: issuer.serie_factura || 'F001',
        serieBoleta: issuer.serie_boleta || 'B001'
    };
};

const reserveCorrelative = async (client, tipoComprobante, serie) => {
    const result = await client.query(
        `INSERT INTO nl_correlativos (tipo_comprobante, serie, ultimo_correlativo)
         VALUES ($1, $2, 1)
         ON CONFLICT (tipo_comprobante, serie) DO UPDATE
         SET ultimo_correlativo = nl_correlativos.ultimo_correlativo + 1,
             updated_at = NOW()
         RETURNING ultimo_correlativo`,
        [tipoComprobante, serie]
    );
    return Number(result.rows[0].ultimo_correlativo);
};

export const makeBillingPgRepository = ({ pool }) => ({
    getOrderSnapshot: async (orderId) => {
        const orderResult = await pool.query(
            `SELECT p.id, p.estado, p.total, p.paciente_nombre,
                    c.ruc as clinica_ruc,
                    c.dni as clinica_dni,
                    c.razon_social as clinica_razon_social,
                    c.ubigeo as clinica_ubigeo,
                    c.direccion as clinica_direccion
             FROM nl_pedidos p
             LEFT JOIN nl_clinicas c ON c.id = p.clinica_id
             WHERE p.id = $1
             LIMIT 1`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            return null;
        }

        const order = orderResult.rows[0];

        const [itemsResult, paymentsResult] = await Promise.all([
            pool.query(
                `SELECT id, producto_id, material, cantidad, precio_unitario, subtotal
                 FROM nl_pedido_items
                 WHERE pedido_id = $1
                 ORDER BY id ASC`,
                [orderId]
            ),
            pool.query(
                'SELECT COALESCE(SUM(monto), 0) as paid_amount FROM nl_pagos WHERE pedido_id = $1',
                [orderId]
            )
        ]);

        const lines = itemsResult.rows.map((item) => {
            const qty = Number(item.cantidad) || 1;
            const itemSubtotal = Number(item.subtotal) || 0;
            const fallbackUnitPrice = qty > 0 ? itemSubtotal / qty : 0;

            return {
                sku: item.producto_id ? String(item.producto_id) : `ITEM-${item.id}`,
                description: item.material || 'Servicio dental',
                qty,
                unitPrice: {
                    amount: roundMoney(Number(item.precio_unitario) || fallbackUnitPrice),
                    currency: 'PEN'
                },
                taxRate: IGV_RATE
            };
        });

        const customerDocument = normalizeDoc(order.clinica_ruc || order.clinica_dni || '00000000');
        const totalAmount = roundMoney(Number(order.total) || lines.reduce((sum, line) => {
            const net = (Number(line.unitPrice?.amount) || 0) * (Number(line.qty) || 0);
            return sum + net + (net * (Number(line.taxRate) || 0));
        }, 0));

        return {
            orderId: String(order.id),
            customerDocument,
            customerName: order.clinica_razon_social || order.paciente_nombre || 'CLIENTE VARIOS',
            status: mapOrderStatus(order.estado),
            paymentStatus: mapPaymentStatus({
                total: totalAmount,
                paidAmount: paymentsResult.rows[0]?.paid_amount
            }),
            customerAddress: {
                ubigeo: order.clinica_ubigeo || undefined,
                direccion: order.clinica_direccion || undefined
            },
            lines,
            total: {
                amount: totalAmount,
                currency: 'PEN'
            }
        };
    },
    resolveInvoiceSeries: async ({ customerDocument, serieHint, tipoComprobante } = {}) => {
        const issuer = await getActiveIssuer(pool);
        if (serieHint) {
            return {
                serie: String(serieHint).trim().toUpperCase(),
                tipoComprobante: inferTipoComprobante(serieHint)
            };
        }

        const normalizedDocument = normalizeDoc(customerDocument);
        const isFactura = tipoComprobante ? tipoComprobante === '01' : normalizedDocument.length === 11;
        return {
            serie: isFactura ? issuer.serieFactura : issuer.serieBoleta,
            tipoComprobante: isFactura ? '01' : '03'
        };
    },
    saveDraft: async (draft, options = {}) => {
        const resolved = await (async () => {
            if (options.tipoComprobante) {
                return { tipoComprobante: options.tipoComprobante, serie: draft.serie };
            }

            return {
                tipoComprobante: inferTipoComprobante(draft.serie),
                serie: draft.serie
            };
        })();

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            if (options.idempotencyKey) {
                await client.query(
                    'SELECT pg_advisory_xact_lock(hashtext($1))',
                    [options.idempotencyKey]
                );
                const existing = await client.query(
                    `SELECT id, correlativo FROM nl_comprobantes WHERE idempotency_key = $1 LIMIT 1`,
                    [options.idempotencyKey]
                );
                if (existing.rows.length > 0) {
                    await client.query('COMMIT');
                    return {
                        draftId: String(existing.rows[0].id),
                        correlativo: String(existing.rows[0].correlativo),
                        reused: true
                    };
                }
            }

            const correlativoResult = await client.query(
                `INSERT INTO nl_correlativos (tipo_comprobante, serie, ultimo_correlativo)
                 VALUES ($1, $2, 1)
                 ON CONFLICT (tipo_comprobante, serie) DO UPDATE
                 SET ultimo_correlativo = nl_correlativos.ultimo_correlativo + 1,
                     updated_at = NOW()
                 RETURNING ultimo_correlativo`,
                [resolved.tipoComprobante, resolved.serie]
            );

            const correlativo = Number(correlativoResult.rows[0].ultimo_correlativo);
            const issueDate = draft.issueDateIso ? draft.issueDateIso.split('T')[0] : null;
            const receptor = draft.receptor || null;
            const receptorDocumento = receptor?.documento ? String(receptor.documento) : null;
            const insertResult = await client.query(
            `INSERT INTO nl_comprobantes (
                pedido_id,
                tipo_comprobante,
                serie,
                correlativo,
                fecha_emision,
                total_gravada,
                total_igv,
                total_venta,
                estado_sunat,
                idempotency_key,
                receptor_tipo_doc,
                receptor_documento,
                receptor_razon_social,
                receptor_direccion,
                receptor_ubigeo,
                receptor_snapshot_at
            )
            VALUES (
                $1::integer,
                $2::varchar,
                $3::varchar,
                $4::integer,
                COALESCE($5::date, CURRENT_DATE),
                $6::numeric,
                $7::numeric,
                $8::numeric,
                'generado',
                $9::varchar,
                $10::varchar,
                $11::varchar,
                $12::varchar,
                $13::text,
                $14::varchar,
                $15::timestamptz
            )
            RETURNING id, correlativo`,
            [
                Number(draft.orderId),
                resolved.tipoComprobante,
                resolved.serie,
                correlativo,
                issueDate,
                Number(draft.subtotal?.amount) || 0,
                Number(draft.igv?.amount) || 0,
                Number(draft.total?.amount) || 0,
                options.idempotencyKey || null,
                receptor?.tipoDoc ? String(receptor.tipoDoc) : null,
                receptorDocumento,
                receptor?.razonSocial ? String(receptor.razonSocial) : null,
                receptor?.direccion ? String(receptor.direccion) : null,
                receptor?.ubigeo ? String(receptor.ubigeo) : null,
                receptorDocumento ? new Date() : null
            ]
            );
            await client.query('COMMIT');
            return {
                draftId: String(insertResult.rows[0].id),
                correlativo: String(insertResult.rows[0].correlativo)
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    markInvoiceResult: async (invoiceId, result) => {
        const sunatState = mapInvoiceStatusToSunatState(result.invoiceStatus);

        await pool.query(
            `UPDATE nl_comprobantes
             SET estado_sunat = $1::text,
                 external_id = COALESCE($2, external_id),
                 provider_ticket = COALESCE($2, provider_ticket),
                 pdf_url = COALESCE($3, pdf_url),
                 xml_url = COALESCE($4, xml_url),
                 cdr_url = COALESCE($5, cdr_url),
                 hash_cpe = COALESCE($6, hash_cpe),
                 cdr_code = COALESCE($7, cdr_code),
                 cdr_description = COALESCE($8, cdr_description),
                 provider_error = NULL,
                 sent_at = COALESCE(sent_at, NOW()),
                 accepted_at = CASE WHEN $1::text = 'aceptado' THEN COALESCE(accepted_at, NOW()) ELSE accepted_at END,
                 rejected_at = CASE WHEN $1::text = 'rechazado' THEN COALESCE(rejected_at, NOW()) ELSE rejected_at END,
                 updated_at = NOW()
             WHERE id = $9`,
            [
                sunatState,
                result.sunatTicket || null,
                result.pdfUrl || null,
                result.xmlUrl || null,
                result.cdrUrl || null,
                result.hash || null,
                result.cdrCode || null,
                result.cdrDescription || null,
                Number(invoiceId)
            ]
        );
    },
    markInvoiceFailure: async (invoiceId, error) => {
        await pool.query(
            `UPDATE nl_comprobantes
             SET estado_sunat = 'error',
                 provider_error = $1::jsonb,
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify({ message: error?.message || 'Error enviando comprobante' }), Number(invoiceId)]
        );
    },
    getInvoiceFiscalContext: async (invoiceId) => {
        const result = await pool.query(
            `SELECT c.*, p.paciente_nombre,
                    cl.ruc AS cliente_ruc, cl.dni AS cliente_dni,
                    cl.razon_social AS cliente_razon_social,
                    cl.direccion AS cliente_direccion, cl.ubigeo AS cliente_ubigeo,
                    cl.tipo_doc AS cliente_tipo_doc,
                    COALESCE((SELECT SUM(n.monto) FROM nl_notas_credito n
                              WHERE n.comprobante_id = c.id AND n.estado_sunat IN ('generado','aceptado')), 0) AS monto_acreditado
             FROM nl_comprobantes c
             JOIN nl_pedidos p ON p.id = c.pedido_id
             LEFT JOIN nl_clinicas cl ON cl.id = p.clinica_id
             WHERE c.id = $1 LIMIT 1`,
            [Number(invoiceId)]
        );

        const row = result.rows[0] || null;
        if (!row) return null;

        // Prefer persisted receptor snapshot over live clinic JOIN when available
        if (row.receptor_documento) {
            return {
                ...row,
                cliente_ruc: row.receptor_tipo_doc === '6' ? row.receptor_documento : (row.cliente_ruc || null),
                cliente_dni: row.receptor_tipo_doc === '1' ? row.receptor_documento : (row.cliente_dni || null),
                cliente_razon_social: row.receptor_razon_social || row.cliente_razon_social,
                cliente_direccion: row.receptor_direccion || row.cliente_direccion,
                cliente_ubigeo: row.receptor_ubigeo || row.cliente_ubigeo,
                cliente_tipo_doc: row.receptor_tipo_doc || row.cliente_tipo_doc
            };
        }

        return row;
    },
    getCreditNoteByIdempotency: async (key) => {
        const result = await pool.query('SELECT * FROM nl_notas_credito WHERE idempotency_key=$1 LIMIT 1', [key]);
        return result.rows[0] || null;
    },
    saveCreditNoteDraft: async ({ invoiceId, serie, tipoDocRef, motivo, codMotivo, monto, igv, base, idempotencyKey }) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [idempotencyKey]);
            const existing = await client.query('SELECT * FROM nl_notas_credito WHERE idempotency_key = $1 LIMIT 1', [idempotencyKey]);
            if (existing.rows.length) {
                await client.query('COMMIT');
                return { ...existing.rows[0], reused: true };
            }
            const correlativo = await reserveCorrelative(client, '07', serie);
            const inserted = await client.query(
                `INSERT INTO nl_notas_credito
                 (comprobante_id, serie, correlativo, tipo_doc_ref, motivo, cod_motivo,
                  monto, igv, base_imponible, estado_sunat, idempotency_key)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'generado',$10) RETURNING *`,
                [invoiceId, serie, correlativo, tipoDocRef, motivo, codMotivo, monto, igv, base, idempotencyKey]
            );
            await client.query('COMMIT');
            return inserted.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    markCreditNoteResult: async (noteId, result) => {
        await pool.query(
            `UPDATE nl_notas_credito SET estado_sunat=$1, hash_cpe=$2, cdr_code=$3,
             cdr_description=$4, provider_error=NULL, updated_at=NOW() WHERE id=$5`,
            [result.accepted ? 'aceptado' : 'rechazado', result.hash || null, result.code || null, result.description || null, noteId]
        );
    },
    markCreditNoteFailure: async (noteId, error) => {
        await pool.query(
            `UPDATE nl_notas_credito SET estado_sunat='error', provider_error=$1::jsonb, updated_at=NOW() WHERE id=$2`,
            [JSON.stringify({ message: error?.message || 'Error enviando nota' }), noteId]
        );
    },
    saveVoidingDraft: async ({ invoiceId, motivo, issueDate, idempotencyKey }) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [idempotencyKey]);
            const existing = await client.query('SELECT * FROM nl_comunicaciones_baja WHERE idempotency_key=$1 LIMIT 1', [idempotencyKey]);
            if (existing.rows.length) {
                await client.query('COMMIT');
                return { ...existing.rows[0], reused: true };
            }
            const serieLote = `RA-${issueDate.replaceAll('-', '')}`;
            const correlativo = await reserveCorrelative(client, 'RA', serieLote);
            const inserted = await client.query(
                `INSERT INTO nl_comunicaciones_baja
                 (comprobante_id, correlativo, fecha_generacion, fecha_comunicacion, motivo, idempotency_key)
                 VALUES ($1,$2,$3::date,CURRENT_DATE,$4,$5) RETURNING *`,
                [invoiceId, correlativo, issueDate, motivo, idempotencyKey]
            );
            await client.query('COMMIT');
            return inserted.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    getVoidingByIdempotency: async (key) => {
        const result = await pool.query('SELECT * FROM nl_comunicaciones_baja WHERE idempotency_key=$1 LIMIT 1', [key]);
        return result.rows[0] || null;
    },
    markVoidingSent: async (voidingId, response) => {
        await pool.query(
            `UPDATE nl_comunicaciones_baja SET estado='pendiente', provider_ticket=$1,
             hash_cpe=$2, provider_error=NULL, updated_at=NOW() WHERE id=$3`,
            [response.ticket, response.hash || null, voidingId]
        );
    },
    getVoiding: async (voidingId) => {
        const result = await pool.query('SELECT * FROM nl_comunicaciones_baja WHERE id=$1 LIMIT 1', [voidingId]);
        return result.rows[0] || null;
    },
    markVoidingStatus: async (voiding, result) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                `UPDATE nl_comunicaciones_baja SET estado=$1, cdr_code=$2, cdr_description=$3, updated_at=NOW() WHERE id=$4`,
                [result.accepted ? 'aceptado' : result.final ? 'rechazado' : 'pendiente', result.code || null, result.description || null, voiding.id]
            );
            if (result.accepted) {
                await client.query(
                    `UPDATE nl_comprobantes SET estado_sunat='anulado', motivo_anulacion=$1, updated_at=NOW() WHERE id=$2`,
                    [voiding.motivo, voiding.comprobante_id]
                );
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    listBoletasForSummary: async (summaryDate) => {
        const result = await pool.query(
            `SELECT c.*, COALESCE(cl.dni, cl.ruc, '00000000') AS cliente_documento,
                    COALESCE(cl.tipo_doc, '1') AS cliente_tipo_doc
             FROM nl_comprobantes c
             JOIN nl_pedidos p ON p.id=c.pedido_id
             LEFT JOIN nl_clinicas cl ON cl.id=p.clinica_id
             WHERE c.tipo_comprobante='03' AND c.fecha_emision=$1::date
               AND c.estado_sunat='aceptado'
               AND NOT EXISTS (
                 SELECT 1 FROM nl_resumen_diario_items i
                 JOIN nl_resumenes_diarios r ON r.id=i.resumen_id
                 WHERE i.comprobante_id=c.id AND r.estado IN ('generado','pendiente','aceptado')
               ) ORDER BY c.id`,
            [summaryDate]
        );
        return result.rows;
    },
    saveSummaryDraft: async ({ summaryDate, invoiceIds, idempotencyKey }) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [idempotencyKey]);
            const existing = await client.query('SELECT * FROM nl_resumenes_diarios WHERE idempotency_key=$1 LIMIT 1', [idempotencyKey]);
            if (existing.rows.length) {
                await client.query('COMMIT');
                return { ...existing.rows[0], reused: true };
            }
            const serieLote = `RC-${summaryDate.replaceAll('-', '')}`;
            const correlativo = await reserveCorrelative(client, 'RC', serieLote);
            const inserted = await client.query(
                `INSERT INTO nl_resumenes_diarios (fecha_resumen, correlativo, idempotency_key)
                 VALUES ($1::date,$2,$3) RETURNING *`,
                [summaryDate, correlativo, idempotencyKey]
            );
            for (const invoiceId of invoiceIds) {
                await client.query(
                    `INSERT INTO nl_resumen_diario_items (resumen_id, comprobante_id, estado_envio) VALUES ($1,$2,'1')`,
                    [inserted.rows[0].id, invoiceId]
                );
            }
            await client.query('COMMIT');
            return inserted.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },
    getSummaryByIdempotency: async (key) => {
        const result = await pool.query('SELECT * FROM nl_resumenes_diarios WHERE idempotency_key=$1 LIMIT 1', [key]);
        return result.rows[0] || null;
    },
    markSummarySent: async (summaryId, response) => {
        await pool.query(
            `UPDATE nl_resumenes_diarios SET estado='pendiente', provider_ticket=$1,
             hash_cpe=$2, provider_error=NULL, updated_at=NOW() WHERE id=$3`,
            [response.ticket, response.hash || null, summaryId]
        );
    },
    getSummary: async (summaryId) => {
        const result = await pool.query('SELECT * FROM nl_resumenes_diarios WHERE id=$1 LIMIT 1', [summaryId]);
        return result.rows[0] || null;
    },
    markSummaryStatus: async (summaryId, result) => {
        await pool.query(
            `UPDATE nl_resumenes_diarios SET estado=$1, cdr_code=$2, cdr_description=$3, updated_at=NOW() WHERE id=$4`,
            [result.accepted ? 'aceptado' : result.final ? 'rechazado' : 'pendiente', result.code || null, result.description || null, summaryId]
        );
    },
    getIssuerConfig: async () => getActiveIssuer(pool),
    getInvoiceProviderReference: async (invoiceId) => {
        const result = await pool.query(
            `SELECT id, tipo_comprobante, serie, correlativo
             FROM nl_comprobantes
             WHERE id = $1
             LIMIT 1`,
            [Number(invoiceId)]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return {
            invoiceId: String(result.rows[0].id),
            tipoComprobante: result.rows[0].tipo_comprobante,
            serie: result.rows[0].serie,
            correlativo: String(result.rows[0].correlativo)
        };
    }
});
