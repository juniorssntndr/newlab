import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';

const subscription = { endpoint: 'https://push.invalid/synthetic', p256dh: 'synthetic-key', auth: 'synthetic-auth' };
const payload = { title: 'Synthetic campaign', body: 'Mock-only provider adapter test' };
let instance = 0;
const freshAdapter = async () => (await import(`./pushNotificationService.js?campaign-adapter-test=${++instance}`)).sendCampaignPush;

test('real campaign adapter reports provider acceptance without delivery claim', async t => {
    t.mock.method(webpush, 'setVapidDetails', () => {});
    const provider = t.mock.method(webpush, 'sendNotification', async (target, serialized, options) => {
        assert.equal(target.endpoint, subscription.endpoint);
        assert.deepEqual(JSON.parse(serialized), payload);
        assert.equal(options.timeout, 10000);
        return { statusCode: 201 };
    });
    assert.deepEqual(await (await freshAdapter())({ subscription, payload }), { state: 'accepted' });
    assert.equal(provider.mock.callCount(), 1);
});
test('real campaign adapter classifies definitive HTTP 4xx/5xx as failed and expires only 404/410', async t => {
    t.mock.method(webpush, 'setVapidDetails', () => {});
    const send = await freshAdapter();
    for (const statusCode of [400, 401, 403, 404, 410, 429, 500, 503, 599]) {
        const provider = t.mock.method(webpush, 'sendNotification', async () => { throw Object.assign(new Error('Synthetic HTTP rejection'), { statusCode }); });
        assert.deepEqual(await send({ subscription, payload }), { state: 'failed', expired: [404, 410].includes(statusCode) });
        assert.equal(provider.mock.callCount(), 1);
        provider.mock.restore();
    }
});
test('real campaign adapter retains timeout, network reset and lost response as unknown', async t => {
    t.mock.method(webpush, 'setVapidDetails', () => {});
    const send = await freshAdapter();
    for (const error of [Object.assign(new Error('Timed out'), { code: 'ETIMEDOUT' }), Object.assign(new Error('Reset after send'), { code: 'ECONNRESET' }), new Error('Provider response lost'), Object.assign(new Error('Invalid status'), { statusCode: 0 })]) {
        const provider = t.mock.method(webpush, 'sendNotification', async () => { throw error; });
        assert.deepEqual(await send({ subscription, payload }), { state: 'unknown', reason: 'provider_result_unconfirmed' });
        assert.equal(provider.mock.callCount(), 1);
        provider.mock.restore();
    }
});
test('real campaign adapter skips when VAPID configuration could not be initialized', async t => {
    t.mock.method(webpush, 'setVapidDetails', () => { throw new Error('Synthetic unavailable configuration'); });
    t.mock.method(console, 'error', () => {});
    const provider = t.mock.method(webpush, 'sendNotification', () => assert.fail('Unavailable configuration must not dispatch'));
    assert.deepEqual(await (await freshAdapter())({ subscription, payload }), { state: 'skipped', reason: 'push_not_configured' });
    assert.equal(provider.mock.callCount(), 0);
});
