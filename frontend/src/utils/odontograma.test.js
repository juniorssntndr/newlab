import assert from 'node:assert/strict';
import {
    normalizeToothCode,
    buildBridgeRange,
    buildItemSelection,
    getBridgeParts,
    isMolarTooth,
    isVeneerProduct,
    isBridgeProduct,
    normalizeBridgePillars,
    sortTeethByArchOrder,
    connectBridgeSpan,
    addUnitTooth,
    removeTooth,
    toggleBridgeToothRole,
    toggleTooth,
    formatDentalSelection,
    getToothRole
} from './odontograma.js';

const run = () => {
    // Normalizacion FDI
    assert.equal(normalizeToothCode('1.1'), '11');
    assert.equal(normalizeToothCode(' 26 '), '26');
    assert.equal(normalizeToothCode('49'), '');
    assert.equal(normalizeToothCode('abc'), '');

    // Rango de puente en un mismo arco
    assert.deepEqual(buildBridgeRange('11', '13'), ['13', '12', '11']);
    assert.deepEqual(buildBridgeRange('36', '34'), ['34', '35', '36']);
    assert.deepEqual(buildBridgeRange('11', '31'), ['11']);

    // isBridgeProduct con admite_puente y fallback por texto
    assert.equal(isBridgeProduct({ admite_puente: true }), true);
    assert.equal(isBridgeProduct({ admite_puente: 'true' }), true);
    assert.equal(isBridgeProduct({ admite_puente: false, nombre: 'Corona Zirconia' }), false);
    assert.equal(isBridgeProduct({ nombre: 'Puente Fijo Metal Cerámica' }), true);
    assert.equal(isBridgeProduct({ categoria_nombre: 'Puentes Dentales' }), true);

    // Seleccion de item para puente basico
    const bridgeSelection = buildItemSelection(['11', '13'], true);
    assert.deepEqual(bridgeSelection.piezas_dentales, ['13', '12', '11']);
    assert.equal(bridgeSelection.es_puente, true);
    assert.equal(bridgeSelection.pieza_inicio, '13');
    assert.equal(bridgeSelection.pieza_fin, '11');
    assert.deepEqual(bridgeSelection.pilares_dentales, ['13', '11']);
    assert.deepEqual(bridgeSelection.ponticos_dentales, ['12']);
    assert.equal(bridgeSelection.cantidad, 3);
    assert.equal(bridgeSelection.tramos_detalle.length, 1);
    assert.equal(bridgeSelection.tramos_detalle[0].tipo, 'puente');

    const multiPillarBridge = buildItemSelection(['23', '27'], true, ['23', '25', '27']);
    assert.deepEqual(multiPillarBridge.piezas_dentales, ['23', '24', '25', '26', '27']);
    assert.deepEqual(multiPillarBridge.pilares_dentales, ['23', '25', '27']);
    assert.deepEqual(multiPillarBridge.ponticos_dentales, ['24', '26']);
    assert.equal(multiPillarBridge.cantidad, 5);

    assert.deepEqual(normalizeBridgePillars(['23', '24', '25', '26', '27'], ['23', '25', '27']), ['23', '25', '27']);
    assert.deepEqual(normalizeBridgePillars(['23', '24', '25', '26', '27'], []), ['23', '27']);

    const bridgeParts = getBridgeParts({
        es_puente: true,
        piezas_dentales: ['23', '24', '25', '26', '27'],
        pilares_dentales: ['23', '25', '27']
    });
    assert.deepEqual(bridgeParts.pilares, ['23', '25', '27']);
    assert.deepEqual(bridgeParts.ponticos, ['24', '26']);

    const singleToothBridge = buildItemSelection(['11'], true);
    assert.equal(singleToothBridge.es_puente, false);

    // Multi-Tramo: Puentes independientes (14-16 y 24-26) + unitaria suelta (21)
    let multiSpanSel = buildItemSelection([], true);
    // Conectar puente 14 a 16
    multiSpanSel = connectBridgeSpan(multiSpanSel, '14', '16');
    assert.equal(multiSpanSel.es_puente, true);
    assert.deepEqual(multiSpanSel.piezas_dentales, ['16', '15', '14']);
    assert.deepEqual(multiSpanSel.pilares_dentales, ['16', '14']);
    assert.deepEqual(multiSpanSel.ponticos_dentales, ['15']);
    assert.equal(multiSpanSel.cantidad, 3);
    assert.equal(multiSpanSel.tramos_detalle.length, 1);

    // Conectar segundo puente 24 a 26
    multiSpanSel = connectBridgeSpan(multiSpanSel, '24', '26');
    assert.equal(multiSpanSel.tramos_detalle.length, 2);
    assert.deepEqual(multiSpanSel.piezas_dentales, ['16', '15', '14', '24', '25', '26']);
    assert.deepEqual(multiSpanSel.pilares_dentales, ['16', '14', '24', '26']);
    assert.deepEqual(multiSpanSel.ponticos_dentales, ['15', '25']);
    assert.equal(multiSpanSel.cantidad, 6);

    // Agregar corona unitaria 21
    multiSpanSel = addUnitTooth(multiSpanSel, '21');
    assert.equal(multiSpanSel.tramos_detalle.length, 3);
    assert.deepEqual(multiSpanSel.piezas_dentales, ['16', '15', '14', '21', '24', '25', '26']);
    assert.deepEqual(multiSpanSel.pilares_dentales, ['16', '14', '24', '26']);
    assert.deepEqual(multiSpanSel.ponticos_dentales, ['15', '25']);
    assert.equal(multiSpanSel.cantidad, 7);

    // Conmutar rol de pieza en puente: 15 de póntico a pilar
    const toggled15 = toggleBridgeToothRole(multiSpanSel, '15');
    assert.equal(toggled15.error, null);
    assert.deepEqual(toggled15.selection.pilares_dentales, ['16', '15', '14', '24', '26']);
    assert.deepEqual(toggled15.selection.ponticos_dentales, ['25']);

    // Intentar deshabilitar un pilar cuando solo quedan 2
    const blockedToggle = toggleBridgeToothRole(multiSpanSel, '16');
    assert.notEqual(blockedToggle.error, null);
    assert.match(blockedToggle.error, /al menos 2 pilares/i);

    // Deseleccionar pieza unitaria 21 con toggleTooth
    const deselect21 = toggleTooth(multiSpanSel, '21', true);
    assert.deepEqual(deselect21.piezas_dentales, ['16', '15', '14', '24', '25', '26']);
    assert.equal(deselect21.tramos_detalle.length, 2);

    // Formateo de selección multi-tramo
    const formatStr = formatDentalSelection(multiSpanSel);
    assert.match(formatStr, /Puente 16-14/);
    assert.match(formatStr, /Puente 24-26/);
    assert.match(formatStr, /21/);

    // Bloqueo de molares para carillas (regla base)
    assert.equal(isVeneerProduct({ nombre: 'Carilla de disilicato' }), true);
    assert.equal(isVeneerProduct({ nombre: 'Corona zirconia' }), false);
    assert.equal(isMolarTooth('16'), true);
    assert.equal(isMolarTooth('26'), true);
    assert.equal(isMolarTooth('14'), false);

    // Orden dental consistente
    assert.deepEqual(sortTeethByArchOrder(['22', '11', '18']), ['18', '11', '22']);

    // Roles dentales para colores (pilar: verde, pontico: naranja, unitaria: azul)
    assert.equal(getToothRole('16', multiSpanSel), 'pilar');
    assert.equal(getToothRole('15', multiSpanSel), 'pontico');
    assert.equal(getToothRole('21', multiSpanSel), 'unitaria');
    assert.equal(getToothRole('13', { es_puente: true, pieza_inicio: '13', pieza_fin: '11', piezas_dentales: ['13', '12', '11'] }), 'pilar');
    assert.equal(getToothRole('12', { es_puente: true, pieza_inicio: '13', pieza_fin: '11', piezas_dentales: ['13', '12', '11'] }), 'pontico');

    console.log('ok - odontograma utils (single & multi-span bridges)');
};

run();
