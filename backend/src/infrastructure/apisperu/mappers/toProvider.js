import { numeroALetras, resolveUbigeoAddress } from '../../../services/apisperu.js';

const resolveAddress = ({ ubigeo, direccion, clinicName, source } = {}) => (
    resolveUbigeoAddress(ubigeo, direccion, { clinicName, source })
);

const resolveTipoDoc = (customerDocument) => {
    const normalized = String(customerDocument || '').replace(/\D/g, '');
    return normalized.length === 11 ? '6' : '1';
};

export const mapDraftToApisperuPayload = ({ draft, snapshot, issuer, tipoComprobante }) => {
    const customerAddress = snapshot?.customerAddress || {};

    const details = (draft.lines || []).map((line) => {
        const qty = Number(line.qty) || 0;
        const unitPrice = Number(line.unitPrice?.amount) || 0;
        const taxRate = Number(line.taxRate) || 0;
        const netAmount = unitPrice * qty;
        const igvAmount = netAmount * taxRate;

        return {
            codProducto: line.sku || 'SRV001',
            unidad: 'ZZ',
            descripcion: line.description,
            cantidad: qty,
            mtoValorUnitario: Number(unitPrice.toFixed(6)),
            mtoValorVenta: Number(netAmount.toFixed(2)),
            mtoBaseIgv: Number(netAmount.toFixed(2)),
            porcentajeIgv: Number((taxRate * 100).toFixed(2)),
            igv: Number(igvAmount.toFixed(2)),
            tipAfeIgv: 10,
            totalImpuestos: Number(igvAmount.toFixed(2)),
            mtoPrecioUnitario: Number((unitPrice * (1 + taxRate)).toFixed(6))
        };
    });

    return {
        ublVersion: '2.1',
        tipoOperacion: '0101',
        tipoDoc: tipoComprobante,
        serie: draft.serie,
        correlativo: draft.correlativo ? String(draft.correlativo) : undefined,
        fechaEmision: String(draft.issueDateIso || new Date().toISOString()).split('T')[0],
        formaPago: { moneda: 'PEN', tipo: 'Contado' },
        tipoMoneda: draft.total?.currency || 'PEN',
        client: {
            tipoDoc: resolveTipoDoc(snapshot.customerDocument),
            numDoc: snapshot.customerDocument,
            rznSocial: snapshot.customerName,
            address: resolveAddress({
                ubigeo: customerAddress.ubigeo,
                direccion: customerAddress.direccion,
                clinicName: snapshot.customerName,
                source: 'apisperu.mapper.toProvider.client'
            })
        },
        company: {
            ruc: issuer.ruc,
            razonSocial: issuer.razonSocial,
            nombreComercial: issuer.nombreComercial,
            address: resolveAddress({
                ubigeo: issuer.ubigeo,
                direccion: issuer.direccionFiscal,
                source: 'apisperu.mapper.toProvider.company'
            })
        },
        mtoOperGravadas: Number((draft.subtotal?.amount || 0).toFixed(2)),
        mtoIGV: Number((draft.igv?.amount || 0).toFixed(2)),
        valorVenta: Number((draft.subtotal?.amount || 0).toFixed(2)),
        totalImpuestos: Number((draft.igv?.amount || 0).toFixed(2)),
        subTotal: Number((draft.total?.amount || 0).toFixed(2)),
        mtoImpVenta: Number((draft.total?.amount || 0).toFixed(2)),
        details,
        legends: [
            {
                code: '1000',
                value: numeroALetras(Number(draft.total?.amount || 0))
            }
        ]
    };
};
