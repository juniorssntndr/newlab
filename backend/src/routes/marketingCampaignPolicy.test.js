import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCampaign, campaignPayloadHash, validateCampaignImage } from './marketingCampaignPolicy.js';
const input = () => ({ titulo: 'Opening promotion', mensaje: 'S/ 50 for your next technical order.', tipo_audiencia: 'todos', segmento_ids: [], fecha_inicio: '2026-01-01', fecha_fin: '2099-12-31', link_destino: '/pedidos/nuevo', mostrar_toast_in_app: true, enviar_push_web: false, beneficio: { tipo: 'monto_fijo', valor: 50 } });
test('benefit defaults to one clinic use and supports configurable percentage or soles', () => {
    assert.equal(normalizeCampaign(input()).beneficio.limite_usos_por_clinica, 1);
    for (const tipo of ['monto_fijo', 'porcentaje']) {
        const c = normalizeCampaign({ ...input(), beneficio: { tipo, valor: 30, limite_usos_por_clinica: 3 } });
        assert.equal(c.beneficio.tipo, tipo);
        assert.equal(c.beneficio.limite_usos_por_clinica, 3);
    }
});
test('invalid channels, destinations, benefits, dates and legacy typed codes are rejected', () => {
    for (const patch of [{ mostrar_toast_in_app: false }, { enviar_push_web: 'false' }, { link_destino: 'https://example.com' }, { link_destino: '//example.com' }, { fecha_fin: '2026-02-30' }, { fecha_inicio: '2100-01-01' }, { codigo_descuento: 'FAKE' }, { beneficio: { tipo: 'porcentaje', valor: 101 } }, { beneficio: { tipo: 'monto_fijo', valor: true } }, { beneficio: { tipo: 'monto_fijo', valor: 50, limite_usos_por_clinica: 0 } }, { beneficio: { tipo: 'monto_fijo', valor: 50, limite_usos_por_clinica: 1.5 } }, { beneficio: { tipo: 'monto_fijo', valor: 50, monto_minimo_pedido: -10 } }, { titulo: 'a'.repeat(121) }]) assert.throws(() => normalizeCampaign({ ...input(), ...patch }), { status: 400 });
});
test('canonical idempotency sorts audience ids and binds normalized content/test mode', () => {
    const a = normalizeCampaign({ ...input(), titulo: ' Opening promotion ', tipo_audiencia: 'clinicas_especificas', segmento_ids: [12, 7, 12] });
    const b = normalizeCampaign({ ...input(), tipo_audiencia: 'clinicas_especificas', segmento_ids: [7, 12] });
    assert.equal(campaignPayloadHash(a, false), campaignPayloadHash(b, false));
    assert.notEqual(campaignPayloadHash(a, false), campaignPayloadHash(a, true));
    assert.notEqual(campaignPayloadHash(a, false), campaignPayloadHash({ ...a, mensaje: 'changed' }, false));
});
test('image validation rejects SVG, MIME spoofing and oversized data', () => {
    for (const file of [null, { mimetype: 'image/svg+xml', buffer: Buffer.from('<svg/>') }, { mimetype: 'image/png', buffer: Buffer.from('not a png') }, { mimetype: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }]) assert.throws(() => validateCampaignImage(file), { status: 400 });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1EAAAAASUVORK5CYII=', 'base64');
    assert.equal(validateCampaignImage({ mimetype: 'image/png', buffer: png }), 'image/png');
    assert.throws(() => validateCampaignImage({ mimetype: 'image/jpeg', buffer: png }), { status: 400 });
});
