import assert from 'node:assert/strict';
import {
    normalizeToothCode,
    buildBridgeRange,
    buildItemSelection,
    getBridgeParts,
    isMolarTooth,
    isVeneerProduct,
    isBridgeProduct,
    isArchProduct,
    isSurgicalGuideProduct,
    toggleFullArch,
    calculateClinicalQuantity,
    normalizeBridgePillars,
    sortTeethByArchOrder,
    connectBridgeSpan,
    addUnitTooth,
    removeTooth,
    toggleBridgeToothRole,
    toggleTooth,
    formatDentalSelection,
    getToothRole,
    UPPER_ARCH,
    LOWER_ARCH
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

    // Detección de nuevos modos de producto
    assert.equal(isArchProduct({ modo_odontograma: 'arcada' }), true);
    assert.equal(isArchProduct({ nombre: 'Férula de Relajación Miorrelajante' }), true);
    assert.equal(isArchProduct({ nombre: 'Prótesis Total Acrílica' }), true);
    assert.equal(isArchProduct({ modo_odontograma: 'unitario', nombre: 'Corona Zirconia' }), false);

    assert.equal(isSurgicalGuideProduct({ modo_odontograma: 'guia_quirurgica' }), true);
    assert.equal(isSurgicalGuideProduct({ nombre: 'Guía Quirúrgica para 3 Implantes' }), true);
    assert.equal(isSurgicalGuideProduct({ modo_odontograma: 'unitario', nombre: 'Corona Zirconia' }), false);

    // Selección de arcada completa (toggleFullArch)
    let archSel = buildItemSelection([], false);
    archSel = toggleFullArch(archSel, 'upper');
    assert.equal(archSel.piezas_dentales.length, 16);
    assert.deepEqual(archSel.piezas_dentales, UPPER_ARCH);
    // Deseleccionar arcada completa
    archSel = toggleFullArch(archSel, 'upper');
    assert.equal(archSel.piezas_dentales.length, 0);

    // Selección bimaxilar
    archSel = toggleFullArch(archSel, 'upper');
    archSel = toggleFullArch(archSel, 'lower');
    assert.equal(archSel.piezas_dentales.length, 32);

    // Tarificación clínica (calculateClinicalQuantity)
    // 1. Modo Unitario / Corona
    const prodUnit = { modo_odontograma: 'unitario', precio_base: 150 };
    assert.equal(calculateClinicalQuantity(prodUnit, ['11', '12', '13']), 3);

    // 2. Modo Puente
    const prodBridge = { modo_odontograma: 'puente', precio_base: 180 };
    assert.equal(calculateClinicalQuantity(prodBridge, ['14', '15', '16', '17']), 4);

    // 3. Modo Carilla (incluye molares/oclusales)
    const prodVeneer = { modo_odontograma: 'carilla', precio_base: 200 };
    assert.equal(calculateClinicalQuantity(prodVeneer, ['11', '21', '16']), 3);

    // 4. Modo Arcada (Férulas, Prótesis Totales) -> 1 o 2 unidades (NUNCA 16 o 32)
    const prodSplint = { modo_odontograma: 'arcada', precio_base: 120 };
    // 1 arcada (todas las 16 piezas superiores) -> 1 unidad
    assert.equal(calculateClinicalQuantity(prodSplint, UPPER_ARCH), 1);
    // 1 arcada parcial (3 piezas superiores) -> 1 unidad
    assert.equal(calculateClinicalQuantity(prodSplint, ['11', '12', '13']), 1);
    // 2 arcadas (bimaxilar: piezas superiores e inferiores) -> 2 unidades
    assert.equal(calculateClinicalQuantity(prodSplint, [...UPPER_ARCH, ...LOWER_ARCH]), 2);
    assert.equal(calculateClinicalQuantity(prodSplint, ['11', '41']), 2);

    // 5. Modo Guía Quirúrgica (hasta 5 implantes por arcada = 1 guía)
    const prodGuide = { modo_odontograma: 'guia_quirurgica', precio_base: 300 };
    // 1 a 5 implantes en maxilar superior -> 1 guía
    assert.equal(calculateClinicalQuantity(prodGuide, ['11']), 1);
    assert.equal(calculateClinicalQuantity(prodGuide, ['11', '12', '14', '21', '24']), 1);
    // 6 implantes en maxilar superior -> 2 guías
    assert.equal(calculateClinicalQuantity(prodGuide, ['11', '12', '13', '14', '21', '24']), 2);
    // Implantes en ambas arcadas (ej. 3 superiores y 2 inferiores) -> 2 guías independientes
    assert.equal(calculateClinicalQuantity(prodGuide, ['11', '12', '14', '31', '32']), 2);
    // 6 superiores y 1 inferior -> 2 + 1 = 3 guías
    assert.equal(calculateClinicalQuantity(prodGuide, ['11', '12', '13', '14', '15', '16', '31']), 3);

    console.log('ok - odontograma utils (single & multi-span bridges + clinical modes & pricing)');
};

run();
