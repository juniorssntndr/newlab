import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canRepeatOrder, buildRepeatFormData } from './orderRepeat.js';

test('repeat action is exclusively for authorized staff on sent orders', () => {
    for (const tipo of ['admin','socio','tecnico','operador']) assert.equal(canRepeatOrder({ tipo,modulos:['pedidos'] },{ estado:'enviado' }),true);
    for (const tipo of ['cliente','visitador','unknown']) assert.equal(canRepeatOrder({ tipo,modulos:['pedidos'] },{ estado:'enviado' }),false);
    assert.equal(canRepeatOrder({ tipo:'tecnico',modulos:[] },{ estado:'enviado' }),false);
    assert.equal(canRepeatOrder({ tipo:'admin' },{ estado:'terminado' }),false);
});
test('form submits a zero warranty price, current paid quote and persistent request key', () => {
    const input = { kind:'warranty',reason:' Color ',requestKey:'same-retry-key',chargeAgreed:false,total:118,photos:[] };
    const warranty = buildRepeatFormData(input);
    assert.equal(warranty.get('expectedTotal'),'0');
    assert.equal(warranty.get('reason'),'Color');
    assert.equal(warranty.get('requestKey'),'same-retry-key');
    const paid = buildRepeatFormData({ ...input,kind:'paid',chargeAgreed:true,photos:[new Blob(['photo'])] });
    assert.equal(paid.get('expectedTotal'),'118');
    assert.equal(paid.get('chargeAgreed'),'true');
    assert.equal(paid.getAll('photos').length,1);
});
test('detail preserves back navigation with an accessible icon/text button and scoped touch target', () => {
    const jsx = readFileSync(new URL('../../pages/DetallePedido.jsx',import.meta.url),'utf8');
    const css = readFileSync(new URL('../../styles/order-repeats.css',import.meta.url),'utf8');
    assert.match(jsx,/className="pedido-back-button"[\s\S]*?navigate\('\/pedidos'\)[\s\S]*?aria-label="Volver a pedidos"[\s\S]*?aria-hidden="true"[\s\S]*?<span>Volver a Pedidos<\/span>/);
    assert.match(css,/\.pedido-detail \.pedido-back-button\s*\{[\s\S]*?gap: 10px;[\s\S]*?min-height: 44px;/);
    assert.match(css,/@media \(max-width: 600px\)[\s\S]*?\.pedido-detail \.pedido-back-button \{ display: none; \}/);
    assert.match(css,/:focus-visible/);
    assert.match(jsx,/pedido\.estado !== 'enviado' && rollbackOptions/);
});
