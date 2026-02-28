export async function emitirComprobanteSunat(pool, pedidoId, tipoComprobante, billingData = null) {
    // 1. Obtener datos de empresa
    const empRes = await pool.query('SELECT * FROM nl_empresas WHERE activo = true LIMIT 1');
    if (empRes.rows.length === 0) {
        throw new Error('No hay una empresa emisora configurada.');
    }
    const empresa = empRes.rows[0];
    if (!empresa.token_apisperu) {
        throw new Error('El Token de APIs Perú no está configurado.');
    }

    // 2. Obtener datos del pedido y clínica
    const pedRes = await pool.query(`
        SELECT p.*, c.razon_social, c.ruc, c.dni, c.direccion, c.ubigeo, c.tipo_doc
        FROM nl_pedidos p
        JOIN nl_clinicas c ON p.clinica_id = c.id
        WHERE p.id = $1
    `, [pedidoId]);
    if (pedRes.rows.length === 0) throw new Error('Pedido no encontrado.');
    const pedido = pedRes.rows[0];

    const esFactura = tipoComprobante === '01';

    // 3. Determinar Serie y Correlativo
    const serie = esFactura ? empresa.serie_factura : empresa.serie_boleta;

    // Obtener siguiente correlativo
    const corrRes = await pool.query(`
        SELECT COALESCE(MAX(correlativo), 0) + 1 as next_corr
        FROM nl_comprobantes
        WHERE tipo_comprobante = $1 AND serie = $2
    `, [tipoComprobante, serie]);
    const correlativo = corrRes.rows[0].next_corr;

    // 4. Preparar payload (Priorizar billingData si viene del Frontend)
    let clientData, documentDetails, mtoOperGravadas, mtoIGV, mtoImpVenta;

    if (billingData) {
        // Usar datos provistos por la UI Avanzada de Facturación
        clientData = billingData.client;
        documentDetails = billingData.details;
        mtoOperGravadas = parseFloat(billingData.mtoOperGravadas);
        mtoIGV = parseFloat(billingData.mtoIGV);
        mtoImpVenta = parseFloat(billingData.mtoImpVenta);

        // Validar tipo de documento del cliente para la factura (debe tener RUC)
        if (esFactura && (!clientData.numDoc || clientData.numDoc.length < 11)) {
            throw new Error('Para emitir Factura, la clínica debe tener un RUC válido de 11 dígitos.');
        }

    } else {
        // Fallback: Autogenerar desde Base de Datos
        if (esFactura && (!pedido.ruc || pedido.ruc.length !== 11)) {
            throw new Error('Para emitir Factura, la clínica debe tener un RUC válido en el sistema.');
        }

        const itemsRes = await pool.query('SELECT * FROM nl_pedido_items WHERE pedido_id = $1', [pedidoId]);
        const items = itemsRes.rows;

        documentDetails = items.map(item => {
            const valorUnitario = parseFloat(item.subtotal) / parseFloat(item.cantidad);
            const precioUnitario = valorUnitario * 1.18; // Precio con IGV
            const igvItem = parseFloat(item.precio_unitario) * parseFloat(item.cantidad) - parseFloat(item.subtotal);

            return {
                codProducto: item.producto_id ? item.producto_id.toString() : 'SRV',
                unidad: 'ZZ', // ZZ = Servicio
                descripcion: `${item.cantidad}x ${item.material || 'Servicio'} - DP: ${item.piezas_dentales?.join(',') || ''}`,
                cantidad: parseInt(item.cantidad, 10),
                mtoValorUnitario: valorUnitario,
                mtoValorVenta: parseFloat(item.subtotal),
                mtoBaseIgv: parseFloat(item.subtotal),
                porcentajeIgv: 18,
                igv: igvItem,
                tipAfeIgv: 10, // 10 = Gravado - Operación Onerosa
                totalImpuestos: igvItem,
                mtoPrecioUnitario: precioUnitario
            };
        });

        mtoOperGravadas = parseFloat(pedido.subtotal);
        mtoIGV = parseFloat(pedido.igv);
        mtoImpVenta = parseFloat(pedido.total);

        clientData = {
            tipoDoc: esFactura ? '6' : (pedido.tipo_doc || (pedido.dni ? '1' : '6')),
            numDoc: esFactura ? pedido.ruc : (pedido.dni || pedido.ruc || '00000000'),
            rznSocial: pedido.razon_social || 'CLIENTE',
            address: {
                direccion: pedido.direccion || 'LIMA',
                provincia: 'LIMA',
                departamento: 'LIMA',
                distrito: 'LIMA',
                ubigeo: pedido.ubigeo || '150101'
            }
        };
    }

    const payload = {
        ublVersion: '2.1',
        tipoOperacion: '0101', // Venta Interna
        tipoDoc: tipoComprobante,
        serie: serie,
        correlativo: correlativo.toString(),
        fechaEmision: new Date().toISOString().split('T')[0],
        formaPago: {
            moneda: 'PEN',
            tipo: 'Contado' // Para simplificar. Si requiere crédito hay que añadir cuotas.
        },
        tipoMoneda: 'PEN',
        client: clientData,
        company: {
            ruc: empresa.ruc,
            razonSocial: empresa.razon_social,
            nombreComercial: empresa.nombre_comercial || empresa.razon_social,
            address: {
                direccion: empresa.direccion_fiscal,
                provincia: 'LIMA',
                departamento: 'LIMA',
                distrito: 'LIMA',
                ubigeo: empresa.ubigeo || '150101'
            }
        },
        mtoOperGravadas: mtoOperGravadas,
        mtoIGV: mtoIGV,
        valorVenta: mtoOperGravadas,
        totalImpuestos: mtoIGV,
        subTotal: mtoImpVenta,
        mtoImpVenta: mtoImpVenta,
        details: documentDetails,
        legends: [
            {
                code: '1000',
                value: numeroALetras(mtoImpVenta, { plural: 'SOLES', singular: 'SOL' })
            }
        ]
    };

    let responseData;
    let isOk = true;
    let responseStatus = 200;

    if (empresa.token_apisperu === 'TU_TOKEN_AQUI' || process.env.ENTORNO === 'demo') {
        // DEMO MODE: Bypass real API call and simulate success
        console.log('--- MODO DEMO ACTIVADO --- Simulando envío a SUNAT');
        responseData = {
            message: 'Aceptado por SUNAT (DEMO)',
            sunatResponse: {
                success: true,
                cdrResponse: { id: `DEMO-${Math.floor(Math.random() * 100000)}` }
            },
            links: {
                xml: 'https://nubefact.com/bpe_ejemplo.xml',
                pdf: 'https://nubefact.com/bpe_ejemplo.pdf',
                cdr: 'https://nubefact.com/bpe_ejemplo.cdr'
            }
        };
    } else {
        // 5. Llamada Real a APIs Perú
        const apiUrl = 'https://facturacion.apisperu.com/api/v1/invoice/send';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${empresa.token_apisperu}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        isOk = response.ok;
        responseStatus = response.status;

        try {
            responseData = await response.json();
        } catch {
            responseData = { message: 'Error desconocido al contactar SUNAT/APIsPerú' };
        }
    }

    if (!isOk) {
        if (responseStatus === 401 || responseStatus === 403) {
            throw new Error('Error de Autenticación con APIs Perú. Verifique que su Token sea válido.');
        }

        const sunatMessage = responseData.message || responseData.error || JSON.stringify(responseData);
        throw new Error(`Rechazo de SUNAT: ${sunatMessage}`);
    }

    // 6. Guardar en Base de Datos
    const insertSql = `
        INSERT INTO nl_comprobantes 
        (pedido_id, tipo_comprobante, serie, correlativo, fecha_emision, total_gravada, total_igv, total_venta, estado_sunat, xml_url, pdf_url, cdr_url, external_id)
        VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
    `;
    const comprobanteData = [
        pedidoId,
        tipoComprobante,
        serie,
        correlativo,
        mtoOperGravadas,
        mtoIGV,
        mtoImpVenta,
        'generado', // Or could be accepted if the API is sync
        responseData.links?.xml || null,
        responseData.links?.pdf || null,
        responseData.links?.cdr || null,
        responseData.sunatResponse?.cdrResponse?.id || null
    ];

    const result = await pool.query(insertSql, comprobanteData);

    return result.rows[0];
}

// Utils (puedes moverlo a un archivo numéricos o utils)
function numeroALetras(num, currency = { plural: 'SOLES', singular: 'SOL' }) {
    // Implementación simplificada para el ejemplo. Para producción usarías una librería o script completo.
    // Esto es vital para 'legends.code = 1000' que exige la SUNAT
    const entero = Math.floor(num);
    const decimal = Math.round((num - entero) * 100);
    return `SON ${entero} Y ${decimal}/100 ${currency.plural}`;
}
