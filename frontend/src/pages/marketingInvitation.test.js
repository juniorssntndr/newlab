import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvitation, invitationOrigin, invitationPhone, eligibleInvitationCoupon } from './marketingInvitation.js';

const now = new Date('2026-10-10T12:00:00Z');
const coupon = { codigo: 'AFINIX-10', activo: true, usos_actuales: 0, limite_usos_total: 5, fecha_inicio: '2026-10-01', fecha_fin: '2026-10-31' };

test('registration URLs never share local or unsafe origins', () => {
    for (const origin of ['', 'http://localhost:5250', 'https://127.0.0.1', 'https://192.168.1.1', 'https://portal.local', 'https://[::1]', 'javascript:alert(1)', 'https://user:pass@example.com']) {
        assert.equal(invitationOrigin(origin), 'https://afinixlab.com');
    }
    assert.equal(invitationOrigin('https://portal.afinixlab.com/path'), 'https://portal.afinixlab.com');
});

test('phone accepts Peru mobile or explicit international prefix and rejects malformed destinations', () => {
    assert.equal(invitationPhone('958 123 456').number, '51958123456');
    assert.equal(invitationPhone('+51 958 123 456').number, '51958123456');
    assert.equal(invitationPhone('0051958123456').number, '51958123456');
    assert.equal(invitationPhone('+1 202 555 0123').number, '12025550123');
    assert.equal(invitationPhone('').error, '');
    for (const input of ['51958123456', '123', 'abc958123456', '+51 123456789', '+++123456789']) assert.ok(invitationPhone(input).error);
});

test('coupon eligibility follows active, date, use and clinic restrictions', () => {
    assert.equal(eligibleInvitationCoupon(coupon, now), true);
    for (const change of [{ activo: false }, { activo: 'false' }, { clinica_id: 1 }, { fecha_fin: '2026-10-01' }, { fecha_inicio: '2026-11-01' }, { fecha_fin: 'invalid' }, { usos_actuales: 5 }, { limite_usos_total: 0 }]) assert.equal(eligibleInvitationCoupon({ ...coupon, ...change }, now), false);
    assert.equal(eligibleInvitationCoupon({ ...coupon, limite_usos_total: null }, now), true);
});

test('preview, clipboard and WhatsApp consume identical encoded message and registration URL', () => {
    const model = buildInvitation({ name: 'Ana & Pérez', clinic: 'Clínica + Sonrisas', phone: '958123456', coupon, now });
    const registration = new URL(model.registrationUrl);
    assert.equal(registration.searchParams.get('doc'), 'Ana & Pérez');
    assert.equal(registration.searchParams.get('clinica'), 'Clínica + Sonrisas');
    assert.equal(registration.searchParams.get('tel'), '+51958123456');
    assert.equal(registration.searchParams.has('promo'), false);
    assert.ok(model.message.includes(model.registrationUrl));
    assert.ok(model.message.includes(coupon.codigo));
    assert.ok(model.whatsappDesktopUrl.startsWith('whatsapp://send?phone=51958123456&text='));
    assert.equal(new URL(model.whatsappMobileUrl).searchParams.get('text'), model.message);
});

test('blank phone permits generic sharing but invalid phone blocks WhatsApp', () => {
    const blank = buildInvitation();
    assert.ok(blank.whatsappDesktopUrl.startsWith('whatsapp://send?text='));
    assert.equal(buildInvitation({ phone: 'wrong' }).whatsappDesktopUrl, null);
    assert.ok(buildInvitation({ coupon: { ...coupon, clinica_id: 1 }, now }).message.includes('Complete su registro y elija su contraseña'));
    assert.ok(!buildInvitation({ coupon: { ...coupon, clinica_id: 1 }, now }).message.includes(coupon.codigo));
});

test('invitation describes both custom monetary and percentage benefits without automatic assignment', () => {
    for (const [tipo, valor, label] of [['monto_fijo', '30', 'S/ 30.00'], ['monto_fijo', '50', 'S/ 50.00'], ['monto_fijo', '100', 'S/ 100.00'], ['monto_fijo', '0.50', 'S/ 0.50'], ['porcentaje', '25', '25%'], ['porcentaje', '100', '100%']]) {
        const model = buildInvitation({ coupon: { ...coupon, tipo, valor }, now });
        assert.ok(model.message.includes(`${label} de descuento`));
        assert.ok(model.message.includes(coupon.codigo));
        assert.ok(model.message.includes('🎁 Como bienvenida especial'));
        assert.ok(model.message.includes('para su próximo pedido'));
        assert.ok(model.whatsappDesktopUrl.includes(encodeURIComponent(coupon.codigo)));
    }
});

test('short invitation uses warm tone and purposeful icons without a coupon', () => {
    const model = buildInvitation();
    const blocks = model.message.split('\n\n');
    assert.equal(blocks.length, 4);
    assert.ok(blocks[0].startsWith('👋 ¡Hola doctor(a)!'));
    assert.ok(blocks[1].includes('AFINIX Dental Lab'));
    assert.ok(blocks[1].includes('seguimiento en tiempo real'));
    assert.ok(blocks[2].startsWith('🔗 Complete su registro y elija su contraseña'));
    assert.ok(blocks[3].includes('¡Será un gusto trabajar juntos'));
    assert.ok(!model.message.includes('🎁'));
    assert.equal(new URL(model.whatsappMobileUrl).searchParams.get('text'), model.message);
});

test('compact invitation retains the full personalized link and warm greeting with a coupon', () => {
    const model = buildInvitation({ name: 'Ana Pérez', clinic: 'Clínica Sonrisas', phone: '958123456', email: 'ana@example.com', address: 'Calle Piura 316', district: 'Mariano Melgar', coupon: { ...coupon, tipo: 'monto_fijo', valor: 50 }, now });
    const registration = new URL(model.registrationUrl);
    assert.equal(model.message.split('\n\n').length, 5);
    assert.ok(model.message.startsWith('👋 ¡Hola Dr(a). Ana Pérez!'));
    assert.ok(model.message.includes('Clínica Sonrisas'));
    assert.ok(model.message.includes(model.registrationUrl));
    for (const key of ['doc', 'clinica', 'tel', 'email', 'direccion', 'distrito']) assert.ok(registration.searchParams.has(key), key);
    assert.ok(model.whatsappDesktopUrl.startsWith('whatsapp://send?phone=51958123456&text='));
});

test('buildInvitation respects customMessage and customTemplate when provided', () => {
    const custom = buildInvitation({
        name: 'Carlos Ruiz',
        phone: '958123456',
        customMessage: 'Hola Carlos, mensaje 100% personalizado.'
    });
    assert.equal(custom.message, 'Hola Carlos, mensaje 100% personalizado.');
    assert.ok(custom.whatsappDesktopUrl.includes(encodeURIComponent('Hola Carlos, mensaje 100% personalizado.')));

    const templateTest = buildInvitation({
        name: 'Carlos Ruiz',
        clinic: 'Dental Elite',
        customTemplate: 'Estimado [doctor] de [clinica], regístrese aquí: [enlace_registro]'
    });
    assert.ok(templateTest.message.includes('Estimado Dr(a). Carlos Ruiz de Dental Elite'));
    assert.ok(templateTest.message.includes('regístrese aquí: https://afinixlab.com/registro'));
});
