import test from 'node:test';
import assert from 'node:assert/strict';
import { newCampaignForm, campaignContentError, campaignBenefitLabel, campaignReceiptLines } from './marketingCampaign.js';
import { notificationData, shouldShowNotificationToast } from '../state/notificationCampaign.js';
test('composer has optional benefit and safe portal-only default', () => {
    const form = newCampaignForm();
    assert.equal(form.beneficio, null);
    assert.equal(form.mostrar_toast_in_app, true);
    assert.equal(form.enviar_push_web, false);
    assert.match(campaignContentError(form), /título/);
});
test('benefit summary and validation support amount and percentage', () => {
    assert.equal(campaignBenefitLabel({ tipo: 'monto_fijo', valor: 50 }), 'S/ 50.00 de descuento');
    assert.equal(campaignBenefitLabel({ tipo: 'porcentaje', valor: 30 }), '30% de descuento');
    assert.match(campaignContentError({ ...newCampaignForm(), titulo: 'Title', mensaje: 'Message', beneficio: { tipo: 'porcentaje', valor: 101, limite_usos_por_clinica: 1 } }), /valor/);
    assert.equal(campaignContentError({ ...newCampaignForm(), titulo: 'Promo', cupon_id: 12, codigo_descuento: 'AFX-TEST', beneficio: { tipo: 'monto_fijo', valor: 50 } }), '');
    assert.equal(campaignContentError({ ...newCampaignForm(), titulo: 'Promo', beneficio: { tipo: 'monto_fijo', valor: 50 } }), '');
});
test('provider metrics never use delivered or reached language', () => {
    const lines = campaignReceiptLines({ metricas: { cuentas_objetivo: 3, clinicas_objetivo: 2, avisos_portal: 3, push_aceptados: 1, push_inciertos: 2 } }).join('\n');
    assert.match(lines, /3 cuentas objetivo/);
    assert.match(lines, /1 Push aceptados/);
    assert.match(lines, /2 sin resultado confirmado/);
    assert.doesNotMatch(lines, /entregados|alcanzados/);
});
test('portal channel flag and expiration suppress campaign toast only', () => {
    assert.equal(shouldShowNotificationToast({ tipo: 'campana_marketing', data: { mostrar_toast_in_app: false } }), false);
    assert.equal(shouldShowNotificationToast({ tipo: 'campana_marketing', data: { fecha_fin: '2020-01-01' } }), false);
    assert.equal(shouldShowNotificationToast({ tipo: 'prueba_campana', data: JSON.stringify({ mostrar_toast_in_app: true }) }), true);
    assert.equal(shouldShowNotificationToast({ tipo: 'pedido', data: { mostrar_toast_in_app: false } }), true);
    assert.deepEqual(notificationData('{invalid'), {});
});
