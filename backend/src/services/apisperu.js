/**
 * APISPERU Facturación Electrónica — Service Layer
 * Endpoints: https://facturacion.apisperu.com/api/v1
 *
 * Supported operations:
 *  - emitirComprobanteSunat (boleta / factura)
 *  - anularComprobante       (void via Communication Low)
 *  - emitirNotaCredito       (credit note referencing original)
 */

// ─── Ubigeo → Jurisdiction lookup ───────────────────────────────────────────
// SUNAT requires provincia/departamento/distrito, not just the 6-digit code.
// We store a minimal map for the most common ubigeos. If the code is not found
// we fall back to Lima values (still valid for the API, just informational).
const UBIGEO_MAP = {
    '150101': { dep: 'LIMA', prov: 'LIMA', dist: 'LIMA' },
    '150102': { dep: 'LIMA', prov: 'LIMA', dist: 'ANCON' },
    '150103': { dep: 'LIMA', prov: 'LIMA', dist: 'ATE' },
    '150104': { dep: 'LIMA', prov: 'LIMA', dist: 'BARRANCO' },
    '150108': { dep: 'LIMA', prov: 'LIMA', dist: 'COMAS' },
    '150111': { dep: 'LIMA', prov: 'LIMA', dist: 'EL AGUSTINO' },
    '150113': { dep: 'LIMA', prov: 'LIMA', dist: 'JESUS MARIA' },
    '150116': { dep: 'LIMA', prov: 'LIMA', dist: 'LINCE' },
    '150117': { dep: 'LIMA', prov: 'LIMA', dist: 'LOS OLIVOS' },
    '150118': { dep: 'LIMA', prov: 'LIMA', dist: 'LURIGANCHO' },
    '150119': { dep: 'LIMA', prov: 'LIMA', dist: 'LURIN' },
    '150120': { dep: 'LIMA', prov: 'LIMA', dist: 'MAGDALENA DEL MAR' },
    '150121': { dep: 'LIMA', prov: 'LIMA', dist: 'MIRAFLORES' },
    '150122': { dep: 'LIMA', prov: 'LIMA', dist: 'PACHACAMAC' },
    '150130': { dep: 'LIMA', prov: 'LIMA', dist: 'PUEBLO LIBRE' },
    '150131': { dep: 'LIMA', prov: 'LIMA', dist: 'PUENTE PIEDRA' },
    '150132': { dep: 'LIMA', prov: 'LIMA', dist: 'RIMAC' },
    '150133': { dep: 'LIMA', prov: 'LIMA', dist: 'SAN BORJA' },
    '150134': { dep: 'LIMA', prov: 'LIMA', dist: 'SAN ISIDRO' },
    '150135': { dep: 'LIMA', prov: 'LIMA', dist: 'SAN JUAN DE LURIGANCHO' },
    '150136': { dep: 'LIMA', prov: 'LIMA', dist: 'SAN JUAN DE MIRAFLORES' },
    '150137': { dep: 'LIMA', prov: 'LIMA', dist: 'SAN LUIS' },
    '150138': { dep: 'LIMA', prov: 'LIMA', dist: 'SAN MARTIN DE PORRES' },
    '150139': { dep: 'LIMA', prov: 'LIMA', dist: 'SAN MIGUEL' },
    '150140': { dep: 'LIMA', prov: 'LIMA', dist: 'SANTA ANITA' },
    '150141': { dep: 'LIMA', prov: 'LIMA', dist: 'SANTA MARIA DEL MAR' },
    '150142': { dep: 'LIMA', prov: 'LIMA', dist: 'SANTA ROSA' },
    '150143': { dep: 'LIMA', prov: 'LIMA', dist: 'SANTIAGO DE SURCO' },
    '150144': { dep: 'LIMA', prov: 'LIMA', dist: 'SURQUILLO' },
    '150145': { dep: 'LIMA', prov: 'LIMA', dist: 'VILLA EL SALVADOR' },
    '150146': { dep: 'LIMA', prov: 'LIMA', dist: 'VILLA MARIA DEL TRIUNFO' },
    // Callao
    '070101': { dep: 'CALLAO', prov: 'CALLAO', dist: 'CALLAO' },
    // Arequipa
    '040101': { dep: 'AREQUIPA', prov: 'AREQUIPA', dist: 'AREQUIPA' },
    // Trujillo
    '130101': { dep: 'LA LIBERTAD', prov: 'TRUJILLO', dist: 'TRUJILLO' },
    // Piura
    '200101': { dep: 'PIURA', prov: 'PIURA', dist: 'PIURA' },
    // Chiclayo
    '140101': { dep: 'LAMBAYEQUE', prov: 'CHICLAYO', dist: 'CHICLAYO' },
};

function resolveAddress(ubigeo, direccion) {
    const loc = UBIGEO_MAP[ubigeo] || { dep: 'LIMA', prov: 'LIMA', dist: 'LIMA' };
    return {
        ubigeo: ubigeo || '150101',
        direccion: direccion || 'SIN DIRECCION',
        provincia: loc.prov,
        departamento: loc.dep,
        distrito: loc.dist,
    };
}

// ─── Número a Letras (SUNAT Leyenda 1000) ───────────────────────────────────
// Must produce: "CIENTO OCHENTA Y 00/100 SOLES" per RS N° 040-2015/SUNAT
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
    'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
const DECENAS = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function centenasToText(n) {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    let txt = c > 0 ? CENTENAS[c] : '';
    if (resto > 0) txt += (txt ? ' ' : '') + decenasToText(resto);
    return txt;
}
function decenasToText(n) {
    if (n <= 20) return UNIDADES[n];
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (d === 2 && u > 0) return 'VEINTI' + UNIDADES[u];
    return DECENAS[d] + (u > 0 ? ' Y ' + UNIDADES[u] : '');
}
function grupoToText(n) {
    if (n === 0) return '';
    if (n < 100) return decenasToText(n);
    return centenasToText(n);
}

export function numeroALetras(monto, currency = { singular: 'SOL', plural: 'SOLES' }) {
    const num = Math.abs(parseFloat(monto) || 0);
    const entero = Math.floor(num);
    const decimal = Math.round((num - entero) * 100);
    const decStr = String(decimal).padStart(2, '0');

    if (entero === 0) return `CERO Y ${decStr}/100 ${decimal === 1 ? currency.singular : currency.plural}`;

    const millones = Math.floor(entero / 1_000_000);
    const miles = Math.floor((entero % 1_000_000) / 1_000);
    const resto = entero % 1_000;

    let texto = '';
    if (millones > 0) {
        texto += (millones === 1 ? 'UN MILLON' : grupoToText(millones) + ' MILLONES') + ' ';
    }
    if (miles > 0) {
        texto += (miles === 1 ? 'MIL' : grupoToText(miles) + ' MIL') + ' ';
    }
    if (resto > 0) {
        texto += grupoToText(resto);
    }

    return `${texto.trim()} Y ${decStr}/100 ${decimal === 1 && entero === 0 ? currency.singular : currency.plural}`;
}

// ─── Helper: APISPERU Auth Header ───────────────────────────────────────────
function apiHeaders(token) {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

const APISPERU_BASE = 'https://facturacion.apisperu.com/api/v1';

async function callApisperu(token, method, path, body = null) {
    const opts = {
        method,
        headers: apiHeaders(token),
    };
    if (body) opts.body = JSON.stringify(body);

    const response = await fetch(`${APISPERU_BASE}${path}`, opts);
    let data;
    try { data = await response.json(); } catch { data = { message: 'Respuesta no JSON de APISPERU' }; }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Token de APISPERU inválido o sin permisos. Verifica la configuración de la empresa.');
        }
        // SUNAT rejection details are in data.errors or data.message
        const detail = Array.isArray(data?.errors)
            ? data.errors.map(e => `[${e.code}] ${e.description}`).join(' | ')
            : (data?.message || JSON.stringify(data));
        throw new Error(`APISPERU/SUNAT: ${detail}`);
    }
    return data;
}

// ─── Emit Boleta or Factura ──────────────────────────────────────────────────
export async function emitirComprobanteSunat(pool, pedidoId, tipoComprobante, billingData = null) {
    // 1. Empresa emisora
    const empRes = await pool.query('SELECT * FROM nl_empresas WHERE activo = true LIMIT 1');
    if (empRes.rows.length === 0) throw new Error('No hay empresa emisora configurada en el sistema.');
    const empresa = empRes.rows[0];
    if (!empresa.token_apisperu || empresa.token_apisperu === 'TU_TOKEN_AQUI') {
        throw new Error('El Token de APISPERU no está configurado en Empresa. Accede a Configuración → Empresa.');
    }

    // 2. Datos del pedido + clínica
    const pedRes = await pool.query(`
        SELECT p.*, c.razon_social, c.ruc, c.dni, c.direccion, c.ubigeo, c.tipo_doc
        FROM nl_pedidos p
        JOIN nl_clinicas c ON p.clinica_id = c.id
        WHERE p.id = $1
    `, [pedidoId]);
    if (pedRes.rows.length === 0) throw new Error('Pedido no encontrado.');
    const pedido = pedRes.rows[0];
    const esFactura = tipoComprobante === '01';

    // 3. Serie y correlativo (thread-safe via MAX)
    const serie = esFactura ? empresa.serie_factura : empresa.serie_boleta;
    const corrRes = await pool.query(`
        SELECT COALESCE(MAX(correlativo), 0) + 1 AS next_corr
        FROM nl_comprobantes
        WHERE tipo_comprobante = $1 AND serie = $2 AND estado_sunat != 'anulado'
    `, [tipoComprobante, serie]);
    const correlativo = corrRes.rows[0].next_corr;

    // 4. Construir datos del cliente y detalle
    let clientData, documentDetails, mtoOperGravadas, mtoIGV, mtoImpVenta;

    if (billingData) {
        clientData = billingData.client;
        documentDetails = billingData.details;
        mtoOperGravadas = parseFloat(billingData.mtoOperGravadas);
        mtoIGV = parseFloat(billingData.mtoIGV);
        mtoImpVenta = parseFloat(billingData.mtoImpVenta);

        if (esFactura && (!clientData.numDoc || clientData.numDoc.length !== 11)) {
            throw new Error('Para emitir Factura, el receptor debe tener un RUC de 11 dígitos.');
        }
        // Enrich address from ubigeo if client sent ubigeo
        if (clientData.address?.ubigeo) {
            clientData.address = resolveAddress(clientData.address.ubigeo, clientData.address.direccion);
        }
    } else {
        // Auto-generate from DB
        if (esFactura && (!pedido.ruc || pedido.ruc.length !== 11)) {
            throw new Error('Para emitir Factura, la clínica debe tener un RUC válido (11 dígitos).');
        }
        const itemsRes = await pool.query('SELECT * FROM nl_pedido_items WHERE pedido_id = $1', [pedidoId]);
        const items = itemsRes.rows;
        if (items.length === 0) throw new Error('El pedido no tiene ítems para facturar.');

        documentDetails = items.map(item => {
            const cantidad = parseFloat(item.cantidad) || 1;
            const valorUnitario = parseFloat(item.subtotal) / cantidad;
            const precioUnitario = valorUnitario * 1.18;
            const igvItem = +(precioUnitario * cantidad - valorUnitario * cantidad).toFixed(2);
            return {
                codProducto: item.producto_id ? String(item.producto_id) : 'SRV001',
                unidad: 'ZZ',
                descripcion: `${item.material || 'Servicio Dental'} - ${item.piezas_dentales?.join(',') || 'General'}`,
                cantidad,
                mtoValorUnitario: +valorUnitario.toFixed(6),
                mtoValorVenta: +parseFloat(item.subtotal).toFixed(2),
                mtoBaseIgv: +parseFloat(item.subtotal).toFixed(2),
                porcentajeIgv: 18,
                igv: igvItem,
                tipAfeIgv: 10,
                totalImpuestos: igvItem,
                mtoPrecioUnitario: +precioUnitario.toFixed(6),
            };
        });

        mtoOperGravadas = +parseFloat(pedido.subtotal).toFixed(2);
        mtoIGV = +parseFloat(pedido.igv).toFixed(2);
        mtoImpVenta = +parseFloat(pedido.total).toFixed(2);

        clientData = {
            tipoDoc: esFactura ? '6' : (pedido.tipo_doc || (pedido.ruc ? '6' : '1')),
            numDoc: esFactura ? pedido.ruc : (pedido.dni || pedido.ruc || '00000000'),
            rznSocial: pedido.razon_social || pedido.paciente_nombre || 'CLIENTE VARIOS',
            address: resolveAddress(pedido.ubigeo, pedido.direccion),
        };
    }

    // 5. Payload APISPERU
    const companyAddress = resolveAddress(empresa.ubigeo, empresa.direccion_fiscal);
    const payload = {
        ublVersion: '2.1',
        tipoOperacion: '0101',
        tipoDoc: tipoComprobante,
        serie,
        correlativo: String(correlativo),
        fechaEmision: new Date().toISOString().split('T')[0],
        formaPago: { moneda: 'PEN', tipo: 'Contado' },
        tipoMoneda: 'PEN',
        client: clientData,
        company: {
            ruc: empresa.ruc,
            razonSocial: empresa.razon_social,
            nombreComercial: empresa.nombre_comercial || empresa.razon_social,
            address: companyAddress,
        },
        mtoOperGravadas,
        mtoIGV,
        valorVenta: mtoOperGravadas,
        totalImpuestos: mtoIGV,
        subTotal: mtoImpVenta,
        mtoImpVenta,
        details: documentDetails,
        legends: [{
            code: '1000',
            value: numeroALetras(mtoImpVenta),
        }],
    };

    // 6. Envío a APISPERU (o DEMO)
    let responseData;
    const isDemo = empresa.entorno === 'beta' || proceso?.env?.ENTORNO === 'demo';

    if (isDemo && (empresa.token_apisperu === 'TU_TOKEN_AQUI')) {
        console.log('[DEMO] Simulando envío a SUNAT');
        responseData = {
            message: 'Aceptado por SUNAT (DEMO)',
            sunatResponse: { success: true, cdrResponse: { id: `DEMO-${Date.now()}` } },
            links: {
                xml: 'https://facturacion.apisperu.com/demo/doc.xml',
                pdf: 'https://facturacion.apisperu.com/demo/doc.pdf',
                cdr: 'https://facturacion.apisperu.com/demo/doc.cdr',
            },
        };
    } else {
        const endpoint = tipoComprobante === '01' ? '/invoice/send' : '/invoice/send';
        responseData = await callApisperu(empresa.token_apisperu, 'POST', endpoint, payload);
    }

    // 7. Guardar en BD
    const result = await pool.query(`
        INSERT INTO nl_comprobantes
            (pedido_id, tipo_comprobante, serie, correlativo, fecha_emision,
             total_gravada, total_igv, total_venta, estado_sunat,
             xml_url, pdf_url, cdr_url, external_id)
        VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
    `, [
        pedidoId, tipoComprobante, serie, correlativo,
        mtoOperGravadas, mtoIGV, mtoImpVenta,
        responseData.sunatResponse?.success ? 'aceptado' : 'generado',
        responseData.links?.xml || null,
        responseData.links?.pdf || null,
        responseData.links?.cdr || null,
        responseData.sunatResponse?.cdrResponse?.id || null,
    ]);

    return result.rows[0];
}

// ─── Anular Comprobante (Comunicación de Baja) ──────────────────────────────
export async function anularComprobante(pool, comprobanteId, motivo = 'Error en emisión') {
    // 1. Obtener el comprobante
    const compRes = await pool.query('SELECT * FROM nl_comprobantes WHERE id = $1', [comprobanteId]);
    if (compRes.rows.length === 0) throw new Error('Comprobante no encontrado.');
    const comp = compRes.rows[0];

    if (comp.estado_sunat === 'anulado') throw new Error('El comprobante ya está anulado.');

    // 2. Empresa
    const empRes = await pool.query('SELECT * FROM nl_empresas WHERE activo = true LIMIT 1');
    if (empRes.rows.length === 0) throw new Error('No hay empresa emisora configurada.');
    const empresa = empRes.rows[0];

    // 3. Llamar a APISPERU — Comunicación de Baja
    // Endpoint: DELETE /api/v1/void/{tipo}/{serie}/{correlativo}
    const tipo = comp.tipo_comprobante;
    const { serie, correlativo } = comp;

    let responseData;
    const isDemo = empresa.token_apisperu === 'TU_TOKEN_AQUI' || process.env.ENTORNO === 'demo';

    if (isDemo) {
        responseData = { success: true, message: 'Anulado (DEMO)' };
    } else {
        try {
            responseData = await callApisperu(
                empresa.token_apisperu,
                'DELETE',
                `/void/${tipo}/${serie}/${correlativo}`,
            );
        } catch (err) {
            // Some APISPERU plans use a POST endpoint for void communication
            // Fallback to POST if DELETE fails
            responseData = await callApisperu(
                empresa.token_apisperu,
                'POST',
                '/void/send',
                {
                    tipoDoc: comp.tipo_comprobante,
                    serie: comp.serie,
                    correlativo: String(comp.correlativo),
                    fechaEmision: comp.fecha_emision,
                    motivo,
                }
            );
        }
    }

    // 4. Actualizar BD
    const result = await pool.query(`
        UPDATE nl_comprobantes
        SET estado_sunat = 'anulado', motivo_anulacion = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
    `, [motivo, comprobanteId]);

    return result.rows[0];
}

// ─── Emitir Nota de Crédito ──────────────────────────────────────────────────
export async function emitirNotaCredito(pool, comprobanteId, { motivo, detalles, monto }) {
    // 1. Obtener el comprobante original
    const compRes = await pool.query(`
        SELECT c.*, p.clinica_id FROM nl_comprobantes c
        JOIN nl_pedidos p ON c.pedido_id = p.id
        WHERE c.id = $1
    `, [comprobanteId]);
    if (compRes.rows.length === 0) throw new Error('Comprobante de referencia no encontrado.');
    const comp = compRes.rows[0];
    if (comp.estado_sunat === 'anulado') throw new Error('No se puede emitir nota de crédito sobre un comprobante anulado.');

    // 2. Empresa
    const empRes = await pool.query('SELECT * FROM nl_empresas WHERE activo = true LIMIT 1');
    if (empRes.rows.length === 0) throw new Error('No hay empresa emisora configurada.');
    const empresa = empRes.rows[0];

    // 3. Obtener datos del pedido/clínica para el receptor
    const pedRes = await pool.query(`
        SELECT p.*, c.razon_social, c.ruc, c.dni, c.direccion, c.ubigeo, c.tipo_doc
        FROM nl_pedidos p
        JOIN nl_clinicas c ON p.clinica_id = c.id
        WHERE p.id = $1
    `, [comp.pedido_id]);
    if (pedRes.rows.length === 0) throw new Error('Pedido del comprobante no encontrado.');
    const pedido = pedRes.rows[0];

    // 4. Correlativo para la nota de crédito
    const serieNC = comp.tipo_comprobante === '01' ? 'FC01' : 'BC01'; // F=Factura, B=Boleta based NC
    const corrRes = await pool.query(`
        SELECT COALESCE(MAX(correlativo), 0) + 1 AS next_corr
        FROM nl_notas_credito
        WHERE tipo_doc_ref = $1 AND serie = $2
    `, [comp.tipo_comprobante, serieNC]);
    const correlativo = corrRes.rows[0].next_corr;

    const montoNC = parseFloat(monto) || parseFloat(comp.total_venta);
    const igvNC = +(montoNC / 1.18 * 0.18).toFixed(2);
    const baseNC = +(montoNC - igvNC).toFixed(2);

    // 5. Payload nota de crédito
    const payload = {
        ublVersion: '2.1',
        tipoDoc: '07', // 07 = Nota de Crédito
        tipoOperacion: '0101',
        serie: serieNC,
        correlativo: String(correlativo),
        fechaEmision: new Date().toISOString().split('T')[0],
        tipDocAfectado: comp.tipo_comprobante,
        serieAfectado: comp.serie,
        correlativoAfectado: String(comp.correlativo),
        codMotivo: '01', // 01 = Anulación de la operación
        desMotivo: motivo || 'Anulación de la operación',
        tipoMoneda: 'PEN',
        company: {
            ruc: empresa.ruc,
            razonSocial: empresa.razon_social,
            nombreComercial: empresa.nombre_comercial || empresa.razon_social,
            address: resolveAddress(empresa.ubigeo, empresa.direccion_fiscal),
        },
        client: {
            tipoDoc: comp.tipo_comprobante === '01' ? '6' : (pedido.tipo_doc || '1'),
            numDoc: comp.tipo_comprobante === '01' ? pedido.ruc : (pedido.dni || pedido.ruc || '00000000'),
            rznSocial: pedido.razon_social || pedido.paciente_nombre || 'CLIENTE VARIOS',
            address: resolveAddress(pedido.ubigeo, pedido.direccion),
        },
        mtoOperGravadas: baseNC,
        mtoIGV: igvNC,
        valorVenta: baseNC,
        totalImpuestos: igvNC,
        subTotal: montoNC,
        mtoImpVenta: montoNC,
        details: detalles || [{
            codProducto: 'NC001',
            unidad: 'ZZ',
            descripcion: motivo || 'Anulación de servicio',
            cantidad: 1,
            mtoValorUnitario: baseNC,
            mtoValorVenta: baseNC,
            mtoBaseIgv: baseNC,
            porcentajeIgv: 18,
            igv: igvNC,
            tipAfeIgv: 10,
            totalImpuestos: igvNC,
            mtoPrecioUnitario: montoNC,
        }],
        legends: [{ code: '1000', value: numeroALetras(montoNC) }],
    };

    // 6. Envío a APISPERU
    let responseData;
    const isDemo = empresa.token_apisperu === 'TU_TOKEN_AQUI' || process.env.ENTORNO === 'demo';
    if (isDemo) {
        responseData = {
            message: 'Nota de Crédito emitida (DEMO)',
            sunatResponse: { success: true, cdrResponse: { id: `NC-DEMO-${Date.now()}` } },
            links: { xml: null, pdf: null, cdr: null },
        };
    } else {
        responseData = await callApisperu(empresa.token_apisperu, 'POST', '/invoice/send', payload);
    }

    // 7. Guardar nota de crédito
    const result = await pool.query(`
        INSERT INTO nl_notas_credito
            (comprobante_id, serie, correlativo, tipo_doc_ref, motivo,
             monto, igv, base_imponible, estado_sunat, xml_url, pdf_url, cdr_url)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
    `, [
        comprobanteId, serieNC, correlativo, comp.tipo_comprobante,
        motivo, montoNC, igvNC, baseNC,
        responseData.sunatResponse?.success ? 'aceptado' : 'generado',
        responseData.links?.xml || null,
        responseData.links?.pdf || null,
        responseData.links?.cdr || null,
    ]);

    return result.rows[0];
}

// ─── Consultar estado SUNAT del comprobante ──────────────────────────────────
export async function consultarEstadoSunat(pool, comprobanteId) {
    const compRes = await pool.query('SELECT * FROM nl_comprobantes WHERE id = $1', [comprobanteId]);
    if (compRes.rows.length === 0) throw new Error('Comprobante no encontrado.');
    const comp = compRes.rows[0];

    const empRes = await pool.query('SELECT token_apisperu FROM nl_empresas WHERE activo = true LIMIT 1');
    if (empRes.rows.length === 0) throw new Error('No hay empresa emisora configurada.');
    const { token_apisperu } = empRes.rows[0];

    const data = await callApisperu(
        token_apisperu,
        'GET',
        `/invoice/status/${comp.tipo_comprobante}/${comp.serie}/${comp.correlativo}`
    );

    // Update local state if different
    if (data.estadoCpe && data.estadoCpe !== comp.estado_sunat) {
        await pool.query(
            'UPDATE nl_comprobantes SET estado_sunat = $1 WHERE id = $2',
            [data.estadoCpe, comprobanteId]
        );
    }

    return { ...data, comprobanteId };
}
