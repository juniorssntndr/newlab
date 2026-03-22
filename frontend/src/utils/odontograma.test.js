import assert from 'node:assert/strict';
import {
    normalizeToothCode,
    buildBridgeRange,
    buildItemSelection,
    isMolarTooth,
    isVeneerProduct,
    sortTeethByArchOrder
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

    // Seleccion de item para puente
    const bridgeSelection = buildItemSelection(['11', '13'], true);
    assert.deepEqual(bridgeSelection.piezas_dentales, ['13', '12', '11']);
    assert.equal(bridgeSelection.es_puente, true);
    assert.equal(bridgeSelection.pieza_inicio, '13');
    assert.equal(bridgeSelection.pieza_fin, '11');

    const singleToothBridge = buildItemSelection(['11'], true);
    assert.equal(singleToothBridge.es_puente, false);

    // Bloqueo de molares para carillas (regla base)
    assert.equal(isVeneerProduct({ nombre: 'Carilla de disilicato' }), true);
    assert.equal(isVeneerProduct({ nombre: 'Corona zirconia' }), false);
    assert.equal(isMolarTooth('16'), true);
    assert.equal(isMolarTooth('26'), true);
    assert.equal(isMolarTooth('14'), false);

    // Orden dental consistente
    assert.deepEqual(sortTeethByArchOrder(['22', '11', '18']), ['18', '11', '22']);

    console.log('ok - odontograma utils');
};

run();
