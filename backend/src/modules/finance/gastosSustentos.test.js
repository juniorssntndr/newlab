import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovimientoFinancieroSchema } from '../../validation/schemas.js';

test('Gastos y Sustentos: Permite gasto con sustento fiscal válido', () => {
    const payload = {
        tipo: 'egreso',
        tipo_fondo: 'banco',
        monto: 250.50,
        categoria_gasto: 'materiales',
        grupo_gasto: 'costo_directo',
        beneficiario: 'Dental Supplies Perú S.A.C.',
        sustento_tipo: 'fiscal',
        sustento_comprobante_tipo: 'factura',
        sustento_emisor_doc: '20601234567',
        sustento_emisor_razon_social: 'Dental Supplies Perú S.A.C.',
        sustento_serie: 'F001',
        sustento_numero: '00004589',
        sustento_fecha_emision: '2026-09-01',
        descripcion: 'Compra de fresas CAD/CAM'
    };

    const parsed = createMovimientoFinancieroSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.sustento_tipo, 'fiscal');
    assert.equal(parsed.data.sustento_serie, 'F001');
});

test('Gastos y Sustentos: Permite gasto con sustento simple (recibo/foto)', () => {
    const payload = {
        tipo: 'egreso',
        tipo_fondo: 'caja',
        monto: 45.00,
        categoria_gasto: 'movilidad',
        grupo_gasto: 'operativo',
        sustento_tipo: 'simple',
        sustento_nota: 'Recibo simple de mensajería Express #451',
        descripcion: 'Envío de paquete a clínica'
    };

    const parsed = createMovimientoFinancieroSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.sustento_tipo, 'simple');
    assert.equal(parsed.data.monto, 45);
});

test('Gastos y Sustentos: Permite gasto sin sustento SOLO si incluye observación explicativa', () => {
    const payloadWithObs = {
        tipo: 'egreso',
        tipo_fondo: 'caja',
        monto: 15.00,
        categoria_gasto: 'otros',
        grupo_gasto: 'operativo',
        sustento_tipo: 'ninguno',
        sustento_observacion: 'Pasajes en mototaxi para entrega urgente sin comprobante',
        descripcion: 'Pasajes urgentes'
    };

    const parsedValid = createMovimientoFinancieroSchema.safeParse(payloadWithObs);
    assert.equal(parsedValid.success, true);
    assert.equal(parsedValid.data.sustento_tipo, 'ninguno');

    const payloadWithoutObs = {
        tipo: 'egreso',
        tipo_fondo: 'caja',
        monto: 15.00,
        categoria_gasto: 'otros',
        grupo_gasto: 'operativo',
        sustento_tipo: 'ninguno',
        sustento_observacion: ''
    };

    const parsedInvalid = createMovimientoFinancieroSchema.safeParse(payloadWithoutObs);
    assert.equal(parsedInvalid.success, false);
    assert.match(parsedInvalid.error.issues[0].message, /observación explicativa es obligatoria/i);
});
