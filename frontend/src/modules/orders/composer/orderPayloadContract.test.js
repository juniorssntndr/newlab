import assert from 'node:assert/strict';
import {
    buildOrderPayload,
    ensureOrderPayloadContract,
    validateOrderPayloadContract
} from './orderPayloadContract.js';

const run = () => {
    // 1. Surgical guide with 2 sites on same arch (the exact user scenario reported)
    const surgicalGuideProduct = {
        id: 16,
        nombre: 'Guías Quirúrgicas Impresas en 3D',
        modo_odontograma: 'guia_quirurgica',
        precio_base: 350,
        categoria_tipo: 'implante'
    };

    const surgicalGuideDraft = {
        clinica_id: 1,
        paciente_nombre: 'Brandon Junior Santander Yanqui',
        fecha_entrega: '2026-11-01',
        items: [
            {
                producto_id: 16,
                product: surgicalGuideProduct,
                modo_odontograma: 'guia_quirurgica',
                precio_unitario: 350,
                piezas_dentales: ['12', '11']
            }
        ]
    };

    const guidePayload = buildOrderPayload(surgicalGuideDraft);
    assert.equal(guidePayload.items[0].cantidad, 1, 'Clinical quantity for 2 sites in same arch must be 1 guide');
    assert.equal(guidePayload.items[0].subtotal, 350);

    // ensureOrderPayloadContract must validate cleanly without throwing
    const validGuidePayload = ensureOrderPayloadContract(guidePayload);
    assert.equal(validGuidePayload.items[0].cantidad, 1);
    assert.equal(validGuidePayload.items[0].subtotal, 350);
    assert.equal(validGuidePayload.items[0]._contract_raw, undefined, '_contract_raw must be stripped for the API');

    // 2. Arch product (e.g. Férula miorelajante with 16 upper teeth)
    const splintProduct = {
        id: 14,
        nombre: 'Férula miorelajante',
        modo_odontograma: 'arcada',
        precio_base: 150,
        categoria_tipo: 'especialidad'
    };

    const splintDraft = {
        clinica_id: 1,
        paciente_nombre: 'Paciente Férula',
        fecha_entrega: '2026-11-05',
        items: [
            {
                producto_id: 14,
                product: splintProduct,
                modo_odontograma: 'arcada',
                precio_unitario: 150,
                piezas_dentales: ['11', '12', '13', '14', '15', '16', '17', '18', '21', '22', '23', '24', '25', '26', '27', '28']
            }
        ]
    };

    const splintPayload = buildOrderPayload(splintDraft);
    assert.equal(splintPayload.items[0].cantidad, 1, 'Full arch must equal quantity 1');
    assert.equal(splintPayload.items[0].subtotal, 150);

    const validSplintPayload = ensureOrderPayloadContract(splintPayload);
    assert.equal(validSplintPayload.items[0].cantidad, 1);

    // 3. Unitary dental product (e.g. Corona Zirconia with 2 teeth)
    const crownProduct = {
        id: 1,
        nombre: 'Corona Zirconia',
        modo_odontograma: 'unitario',
        precio_base: 180,
        categoria_tipo: 'fija'
    };

    const crownDraft = {
        clinica_id: 1,
        paciente_nombre: 'Paciente Coronas',
        fecha_entrega: '2026-11-05',
        items: [
            {
                producto_id: 1,
                product: crownProduct,
                modo_odontograma: 'unitario',
                precio_unitario: 180,
                piezas_dentales: ['11', '21']
            }
        ]
    };

    const crownPayload = buildOrderPayload(crownDraft);
    assert.equal(crownPayload.items[0].cantidad, 2);
    assert.equal(crownPayload.items[0].subtotal, 360);
    const validCrownPayload = ensureOrderPayloadContract(crownPayload);
    assert.equal(validCrownPayload.items[0].cantidad, 2);

    // 4. Bridge product (3 teeth: 14, 15, 16 with pillars 14, 16)
    const bridgeProduct = {
        id: 8,
        nombre: 'Puente de Zirconia',
        modo_odontograma: 'puente',
        admite_puente: true,
        precio_base: 150,
        categoria_tipo: 'fija'
    };

    const bridgeDraft = {
        clinica_id: 1,
        paciente_nombre: 'Paciente Puente',
        fecha_entrega: '2026-11-05',
        items: [
            {
                producto_id: 8,
                product: bridgeProduct,
                modo_odontograma: 'puente',
                es_puente: true,
                precio_unitario: 150,
                piezas_dentales: ['14', '15', '16'],
                pilares_dentales: ['14', '16']
            }
        ]
    };

    const bridgePayload = buildOrderPayload(bridgeDraft);
    assert.equal(bridgePayload.items[0].cantidad, 3);
    assert.equal(bridgePayload.items[0].subtotal, 450);
    const validBridgePayload = ensureOrderPayloadContract(bridgePayload);
    assert.equal(validBridgePayload.items[0].cantidad, 3);

    // 5. Non-dental product (manual quantity, no teeth)
    const modelProduct = {
        id: 99,
        nombre: 'Modelo de Yeso',
        modo_odontograma: 'ninguno',
        precio_base: 30,
        categoria_tipo: 'removible'
    };

    const modelDraft = {
        clinica_id: 1,
        paciente_nombre: 'Paciente Modelo',
        fecha_entrega: '2026-11-05',
        items: [
            {
                producto_id: 99,
                product: modelProduct,
                modo_odontograma: 'ninguno',
                precio_unitario: 30,
                cantidadManual: 3,
                piezas_dentales: []
            }
        ]
    };

    const modelPayload = buildOrderPayload(modelDraft);
    assert.equal(modelPayload.items[0].cantidad, 3);
    assert.equal(modelPayload.items[0].subtotal, 90);
    const validModelPayload = ensureOrderPayloadContract(modelPayload);
    assert.equal(validModelPayload.items[0].cantidad, 3);

    // 6. Inconsistency rejection: forged/mismatched quantity
    const badCrownPayload = {
        items: [
            {
                producto_id: 1,
                cantidad: 1, // should be 2 for 2 teeth
                precio_unitario: 180,
                subtotal: 180,
                piezas_dentales: ['11', '21'],
                _contract_raw: {
                    cantidad: 1,
                    precio_unitario: 180,
                    subtotal: 180,
                    piezas_dentales: ['11', '21'],
                    modo_odontograma: 'unitario'
                }
            }
        ]
    };

    const invalidResult = validateOrderPayloadContract(badCrownPayload);
    assert.equal(invalidResult.valid, false);
    assert.ok(
        invalidResult.errors.some((e) => e.message.includes('cantidad dental inconsistente')),
        'Must reject mismatched dental quantities'
    );

    // 7. Subtotal mismatch rejection
    const badSubtotalPayload = {
        items: [
            {
                producto_id: 1,
                cantidad: 2,
                precio_unitario: 180,
                subtotal: 999, // incorrect subtotal
                piezas_dentales: ['11', '21'],
                _contract_raw: {
                    cantidad: 2,
                    precio_unitario: 180,
                    subtotal: 999,
                    piezas_dentales: ['11', '21'],
                    modo_odontograma: 'unitario'
                }
            }
        ]
    };

    const badSubtotalResult = validateOrderPayloadContract(badSubtotalPayload);
    assert.equal(badSubtotalResult.valid, false);
    assert.ok(
        badSubtotalResult.errors.some((e) => e.message.includes('subtotal inconsistente')),
        'Must reject inconsistent subtotals'
    );

    console.log('ok - orderPayloadContract preflight and clinical modes tests passed');
};

run();
