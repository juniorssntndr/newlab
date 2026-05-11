import fs from 'fs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const token = jwt.sign({ id: 1, tipo: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

const payload = {
    tipoComprobante: '01',
    billingData: {
        client: {
            tipoDoc: '6',
            numDoc: '20123456789',
            rznSocial: 'CLINICA TEST',
            address: {
                direccion: 'Av Test 123',
                ubigeo: '150101',
                provincia: 'LIMA',
                departamento: 'LIMA',
                distrito: 'LIMA'
            }
        },
        details: [
            {
                codProducto: 'SRV',
                unidad: 'ZZ',
                descripcion: 'Corona de prueba',
                cantidad: 1,
                mtoValorUnitario: 100, // sin igv
                mtoValorVenta: 100,
                mtoBaseIgv: 100,
                porcentajeIgv: 18,
                igv: 18,
                tipAfeIgv: 10,
                totalImpuestos: 18,
                mtoPrecioUnitario: 118 // con igv
            }
        ],
        mtoOperGravadas: 100,
        mtoIGV: 18,
        mtoImpVenta: 118
    }
};

fetch('http://localhost:3001/api/facturacion/1/emitir', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
})
    .then(res => res.json().then(data => ({ status: res.status, data })))
    .then(res => console.log('Response:', res))
    .catch(err => console.error('Error:', err));
