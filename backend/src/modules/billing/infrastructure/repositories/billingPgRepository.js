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
    resolveInvoiceSeries: async ({ customerDocument, serieHint } = {}) => {
        const issuer = await getActiveIssuer(pool);
        if (serieHint) {
            return {
                serie: String(serieHint).trim().toUpperCase(),
                tipoComprobante: inferTipoComprobante(serieHint)
            };
        }

        const normalizedDocument = normalizeDoc(customerDocument);
        const isFactura = normalizedDocument.length === 11;
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

        const correlativoResult = await pool.query(
            `SELECT COALESCE(MAX(correlativo), 0) + 1 AS next_corr
             FROM nl_comprobantes
             WHERE tipo_comprobante = $1 AND serie = $2 AND estado_sunat != 'anulado'`,
            [resolved.tipoComprobante, resolved.serie]
        );

        const correlativo = Number(correlativoResult.rows[0]?.next_corr || 1);
        const issueDate = draft.issueDateIso ? draft.issueDateIso.split('T')[0] : null;

        const insertResult = await pool.query(
            `INSERT INTO nl_comprobantes (
                pedido_id,
                tipo_comprobante,
                serie,
                correlativo,
                fecha_emision,
                total_gravada,
                total_igv,
                total_venta,
                estado_sunat
            )
            VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7,$8,'generado')
            RETURNING id, correlativo`,
            [
                Number(draft.orderId),
                resolved.tipoComprobante,
                resolved.serie,
                correlativo,
                issueDate,
                Number(draft.subtotal?.amount) || 0,
                Number(draft.igv?.amount) || 0,
                Number(draft.total?.amount) || 0
            ]
        );

        return {
            draftId: String(insertResult.rows[0].id),
            correlativo: String(insertResult.rows[0].correlativo)
        };
    },
    markInvoiceResult: async (invoiceId, result) => {
        const sunatState = mapInvoiceStatusToSunatState(result.invoiceStatus);

        await pool.query(
            `UPDATE nl_comprobantes
             SET estado_sunat = $1,
                 external_id = COALESCE($2, external_id),
                 pdf_url = COALESCE($3, pdf_url),
                 xml_url = COALESCE($4, xml_url),
                 updated_at = NOW()
             WHERE id = $5`,
            [
                sunatState,
                result.sunatTicket || null,
                result.pdfUrl || null,
                result.xmlUrl || null,
                Number(invoiceId)
            ]
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
